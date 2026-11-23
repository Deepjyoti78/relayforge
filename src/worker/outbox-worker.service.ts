import { Injectable, Logger, Optional } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { decryptSecret } from '../common/crypto';
import { DatabaseService } from '../modules/database/database.service';
import { DeliveryService } from '../modules/delivery/delivery.service';
import { RateLimiterService } from '../modules/delivery/rate-limiter.service';
import { calculateNextRetryDelay, evaluateRetry } from '../modules/delivery/retry-policy';
import { RuntimeConfig } from '../modules/config/config.module';
import { EventStreamService } from '../modules/observability/event-stream.service';
import { safeError } from '../modules/observability/logging';
import { WorkflowEngineService } from '../modules/workflows/workflow-engine.service';

interface ClaimedOutboxRow {
  id: string;
  event_id: string;
  workflow_execution_id?: string | null;
  org_id: string;
  channel: string;
  payload: unknown;
  status: string;
  attempt_count: number;
  created_at: Date;
  event_type: string;
  max_retries: number;
  lease_token: string;
}

interface ActiveDestinationRow {
  id: string;
  org_id: string;
  name: string;
  url: string;
  http_method: string;
  headers: Record<string, string> | null;
  rate_limit_per_second: number;
  timeout_ms: number;
  is_active: boolean;
  attempt_count: number;
}

interface OrgEndpointSecretRow {
  endpoint_id: string;
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
}

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private sweepTimer: NodeJS.Timeout | undefined;
  private staleRecoveryTimer: NodeJS.Timeout | undefined;
  private readonly pendingSweeps = new Set<Promise<number>>();
  private isProcessing = false;
  private isRunning = true;

  constructor(
    private readonly database: DatabaseService,
    private readonly deliveryService: DeliveryService,
    private readonly rateLimiter: RateLimiterService,
    private readonly eventStream: EventStreamService,
    @Optional() private readonly workflowEngine?: WorkflowEngineService,
    @Optional() private readonly config?: RuntimeConfig,
  ) {}

  private getEncryptionKey(): Buffer {
    if (this.config?.values?.encryptionKey) {
      return this.config.values.encryptionKey;
    }
    const rawKey = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    return createHash('sha256').update(rawKey).digest();
  }

  onModuleInit(): void {
    this.isRunning = true;

    // Start background polling sweep every 1000ms
    this.sweepTimer = setInterval(() => {
      void this.sweepPendingOutbox();
    }, 1000);

    // Start crash recovery stale lease sweeper every 15000ms
    this.staleRecoveryTimer = setInterval(() => {
      void this.sweepStaleLeases();
    }, 15000);

    // Initial immediate sweeps
    void this.sweepPendingOutbox();
    void this.sweepStaleLeases();
    this.logger.log({ event: 'outbox_worker_started', pollIntervalMs: 1000 });
  }

  async onModuleDestroy(): Promise<void> {
    this.isRunning = false;
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
    if (this.staleRecoveryTimer) {
      clearInterval(this.staleRecoveryTimer);
      this.staleRecoveryTimer = undefined;
    }
    // Nest closes database/Redis connections in onApplicationShutdown, after
    // this hook. Finish active work before those resources or Jest disappear.
    await Promise.all(this.pendingSweeps);
  }

  private trackSweep(task: Promise<number>): Promise<number> {
    this.pendingSweeps.add(task);
    const remove = () => { this.pendingSweeps.delete(task); };
    void task.then(remove, remove);
    return task;
  }

  /**
   * Concurrently claims and dispatches pending transactional outbox messages.
   * Uses FOR UPDATE SKIP LOCKED with unique lease_token via claim_pending_outbox_messages
   * to fence database state ownership; remote HTTP receipt can remain ambiguous.
   */
  sweepPendingOutbox(): Promise<number> {
    return this.trackSweep(this.runPendingOutboxSweep());
  }

  private async runPendingOutboxSweep(): Promise<number> {
    if (!this.isRunning || this.isProcessing) return 0;
    this.isProcessing = true;

    let processedCount = 0;
    try {
      const visited: string[] = [];
      // Start each lease immediately before work, rather than aging 25 leases
      // while earlier messages wait on sequential HTTP delivery.
      for (let i = 0; i < 25 && this.isRunning; i += 1) {
        const claimedMessages = await this.database.client.$queryRaw<ClaimedOutboxRow[]>`
          SELECT * FROM claim_pending_outbox_messages(1, 30, ${visited}::uuid[])
        `;
        if (!claimedMessages?.length) break;
        for (const msg of claimedMessages) {
          if (!this.isRunning) break;
          visited.push(msg.id);
          processedCount += 1;
          await this.withLeaseHeartbeat(msg);
        }
      }
    } catch (err: unknown) {
      this.logger.error({
        event: 'outbox_sweep_error',
        error: safeError(err),
      });
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  /**
   * Reclaims stale outbox message leases in case of worker crashes or ungraceful terminations.
   */
  sweepStaleLeases(): Promise<number> {
    if (!this.isRunning) return Promise.resolve(0);
    return this.trackSweep(this.runStaleLeaseSweep());
  }

  private async runStaleLeaseSweep(): Promise<number> {
    try {
      const res = await this.database.client.$queryRaw<{ reclaim_stale_outbox_leases: number }[]>`
        SELECT reclaim_stale_outbox_leases()
      `;
      const count = res?.[0]?.reclaim_stale_outbox_leases ?? 0;
      if (count > 0) {
        this.logger.warn({ event: 'stale_leases_reclaimed', count });
      }
      return count;
    } catch (err: unknown) {
      this.logger.error({ event: 'stale_lease_recovery_error', error: safeError(err) });
      return 0;
    }
  }

  private async renewLease(msg: ClaimedOutboxRow): Promise<boolean> {
    const rows = await this.database.client.$queryRaw<{ renew_outbox_lease: boolean }[]>`
      SELECT renew_outbox_lease(${msg.id}::uuid, ${msg.lease_token}::uuid, 30)
    `;
    return rows[0]?.renew_outbox_lease === true;
  }

  private async withLeaseHeartbeat(msg: ClaimedOutboxRow): Promise<void> {
    const controller = new AbortController();
    let pending: Promise<void> | undefined;
    const renew = async () => {
      try {
        if (!await this.renewLease(msg)) controller.abort();
      } catch (error: unknown) {
        controller.abort();
        this.logger.warn({ event: 'outbox_lease_renewal_failed', error: safeError(error), outboxId: msg.id });
      }
    };
    await renew();
    if (controller.signal.aborted || !this.isRunning) return;
    const timer = setInterval(() => {
      if (!pending) pending = renew().finally(() => { pending = undefined; });
    }, 10000).unref();
    try { await this.processOutboxMessage(msg, controller.signal); }
    finally { clearInterval(timer); await pending; }
  }

  private async recordDestination(msg: ClaimedOutboxRow, destinationId: string,
    status: 'PENDING' | 'DISPATCHED' | 'DEAD_LETTER', next: Date | null, error: string | null, refund = false): Promise<boolean> {
    const rows = await this.database.client.$queryRaw<{ record_destination_result: boolean }[]>`
      SELECT record_destination_result(${msg.id}::uuid, ${destinationId}::uuid, ${msg.lease_token}::uuid,
        ${status}::outbox_status, ${next}::timestamptz, ${error}::text, ${refund}::boolean)
    `;
    return rows[0]?.record_destination_result === true;
  }

  private async processOutboxMessage(msg: ClaimedOutboxRow, signal: AbortSignal): Promise<void> {
    try {
      // If outbox message belongs to a workflow execution, delegate to WorkflowEngineService
      if (msg.channel === 'workflow' && this.workflowEngine) {
        await this.workflowEngine.processWorkflowOutbox({
          id: msg.id,
          event_id: msg.event_id,
          org_id: msg.org_id,
          workflow_execution_id: msg.workflow_execution_id ?? null,
          lease_token: msg.lease_token,
        });
        return;
      }

      const destinations = await this.database.client.$queryRaw<ActiveDestinationRow[]>`
        SELECT * FROM prepare_destination_deliveries(${msg.id}::uuid, ${msg.lease_token}::uuid)
      `;
      const secrets = await this.database.client.$queryRaw<OrgEndpointSecretRow[]>`
        SELECT * FROM get_event_endpoint_signing_secret(${msg.org_id}::uuid, ${msg.event_id}::uuid)
      `;
      const secret = secrets[0];
      if (destinations.length && !secret) throw new Error('Originating endpoint signing secret unavailable');
      const signingSecret = secret ? decryptSecret(secret.secret_ciphertext, secret.secret_iv, secret.secret_tag, this.getEncryptionKey()) : undefined;
      for (const dest of destinations) {
        if (!this.isRunning) break;
        if (signal.aborted || !await this.renewLease(msg)) return;
        const started = await this.database.client.$queryRaw<{ begin_destination_delivery: number }[]>`
          SELECT begin_destination_delivery(${msg.id}::uuid, ${dest.id}::uuid, ${msg.lease_token}::uuid)
        `;
        const attemptNumber = started[0]?.begin_destination_delivery ?? 0;
        if (!attemptNumber) continue;
        if (!dest.is_active) {
          if (!await this.recordDestination(msg, dest.id, 'DEAD_LETTER', null, 'Destination deleted or deactivated')) return;
          continue;
        }
        if (dest.rate_limit_per_second > 0) {
          const limit = await this.rateLimiter.checkRateLimit(dest.id, dest.rate_limit_per_second);
          if (!limit.allowed) {
            if (!await this.recordDestination(msg, dest.id, 'PENDING', new Date(Date.now() + limit.retryAfterSeconds * 1000), 'Rate limited', true)) return;
            continue;
          }
        }
        // A fresh fence immediately precedes egress; renewal failure aborts an
        // in-flight request as ambiguous, rather than authorizing stale work.
        if (signal.aborted || !await this.renewLease(msg)) return;
        const attempt = await this.deliveryService.deliverEventToDestination({
          organizationId: msg.org_id, eventId: msg.event_id, outboxMessageId: msg.id,
          destination: { id: dest.id, url: dest.url, httpMethod: dest.http_method, headers: dest.headers,
            rateLimitPerSecond: dest.rate_limit_per_second, timeoutMs: dest.timeout_ms },
          payload: msg.payload, eventType: msg.event_type || 'webhook.event', attemptNumber, ...(signingSecret ? { signingSecret } : {}), signal,
        });
        const retry = evaluateRetry({ attemptCount: attemptNumber, maxRetries: msg.max_retries,
          statusCode: attempt.statusCode, errorDescription: attempt.errorDescription,
          ...(attempt.retryAfterSeconds ? { retryAfterMs: attempt.retryAfterSeconds * 1000 } : {}),
        });
        const status = attempt.status === 'SUCCESS' ? 'DISPATCHED' : retry.shouldRetry ? 'PENDING' : 'DEAD_LETTER';
        if (!await this.recordDestination(msg, dest.id, status, status === 'PENDING' ? retry.nextRetryAt : null, attempt.errorDescription)) return;
      }
      const result = await this.database.client.$queryRaw<{ finish_destination_batch: string | null }[]>`
        SELECT finish_destination_batch(${msg.id}::uuid, ${msg.lease_token}::uuid)
      `;
      if (result[0]?.finish_destination_batch === 'DEAD_LETTER') {
        await this.eventStream.publishEvent({ type: 'dlq.routed', organizationId: msg.org_id,
          timestamp: new Date().toISOString(), payload: { outboxId: msg.id, eventId: msg.event_id } });
      }
    } catch (err: unknown) {
      this.logger.error({
        event: 'process_outbox_message_failed',
        outboxId: msg.id,
        error: safeError(err),
      });

      if (msg.channel !== 'workflow') {
        // Coordinator/configuration failures must not exhaust a destination's
        // separate transport budget just because other targets woke this row.
        const next = new Date(Date.now() + calculateNextRetryDelay(msg.attempt_count));
        await this.database.client.$queryRaw`
          SELECT schedule_outbox_retry(${msg.id}::uuid, ${msg.event_id}::uuid, ${next}::timestamptz, false, ${msg.lease_token}::uuid)
        `;
        return;
      }

      const evalResult = evaluateRetry({
        attemptCount: msg.attempt_count,
        maxRetries: msg.max_retries ?? 5,
        statusCode: null,
        errorDescription: err instanceof Error ? err.message : 'Unknown dispatch error',
      });

      if (evalResult.shouldRetry && evalResult.nextRetryAt) {
        await this.database.client.$queryRaw<{ schedule_outbox_retry: boolean }[]>`
          SELECT schedule_outbox_retry(${msg.id}::uuid, ${msg.event_id}::uuid, ${evalResult.nextRetryAt}::timestamptz, false, ${msg.lease_token}::uuid)
        `;
      } else {
        await this.database.client.$queryRaw<{ schedule_outbox_retry: boolean }[]>`
          SELECT schedule_outbox_retry(${msg.id}::uuid, ${msg.event_id}::uuid, NOW(), true, ${msg.lease_token}::uuid)
        `;
      }
    }
  }
}
