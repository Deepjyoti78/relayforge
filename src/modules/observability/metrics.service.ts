import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';

export interface LatencyQuantiles {
  minMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface OrganizationMetrics {
  organizationId: string;
  generatedAt: string;
  ingestion: {
    totalEvents: number;
    lastHourEvents: number;
    last24HourEvents: number;
  };
  delivery: {
    totalAttempts: number;
    successCount: number;
    failedCount: number;
    unknownCount: number;
    successRatePercentage: number;
    latency: LatencyQuantiles;
  };
  outbox: {
    pendingBacklogCount: number;
    oldestPendingLagSeconds: number;
    dlqBacklogCount: number;
  };
  workflows: {
    totalExecutions: number;
    activeRunningCount: number;
    succeededCount: number;
    filteredCount: number;
    failedCount: number;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Computes operational telemetry and p50/p95/p99 latency metrics for an organization
   * inside the tenant's PostgreSQL RLS session.
   */
  async getOrganizationMetrics(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMetrics> {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });
      if (!membership) {
        throw new ForbiddenException('User is not a member of this organization');
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Ingestion event metrics
      const [totalEvents, lastHourEvents, last24HourEvents] = await Promise.all([
        tx.event.count({ where: { organizationId } }),
        tx.event.count({ where: { organizationId, createdAt: { gte: oneHourAgo } } }),
        tx.event.count({ where: { organizationId, createdAt: { gte: oneDayAgo } } }),
      ]);

      // Delivery attempts metrics
      const [totalAttempts, successCount, failedCount, unknownCount] = await Promise.all([
        tx.deliveryAttempt.count({ where: { organizationId } }),
        tx.deliveryAttempt.count({ where: { organizationId, status: 'SUCCESS' } }),
        tx.deliveryAttempt.count({ where: { organizationId, status: 'FAILED' } }),
        tx.deliveryAttempt.count({ where: { organizationId, status: 'UNKNOWN' } }),
      ]);

      const successRatePercentage =
        totalAttempts > 0
          ? Number(((successCount / totalAttempts) * 100).toFixed(2))
          : 100;

      // Latency statistics (Sample recent 500 attempts for percentile precision)
      const recentAttempts = await tx.deliveryAttempt.findMany({
        where: { organizationId, status: 'SUCCESS' },
        select: { latencyMs: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      const latencies = recentAttempts.map((a) => a.latencyMs).sort((a, b) => a - b);
      const latencyQuantiles: LatencyQuantiles = this.calculateQuantiles(latencies);

      // Outbox backlog and pipeline lag
      const [pendingOutboxCount, dlqBacklogCount, oldestPendingMsg] = await Promise.all([
        tx.outboxMessage.count({ where: { organizationId, status: 'PENDING' } }),
        tx.outboxMessage.count({
          where: { organizationId, status: { in: ['FAILED', 'DEAD_LETTER'] } },
        }),
        tx.outboxMessage.findFirst({
          where: { organizationId, status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
      ]);

      const oldestLagSeconds = oldestPendingMsg
        ? Math.max(0, Math.floor((now.getTime() - oldestPendingMsg.createdAt.getTime()) / 1000))
        : 0;

      // Workflow execution stats
      const [totalExecs, runningExecs, succeededExecs, filteredExecs, failedExecs] =
        await Promise.all([
          tx.workflowExecution.count({ where: { organizationId } }),
          tx.workflowExecution.count({
            where: { organizationId, status: { in: ['RUNNING', 'QUEUED'] } },
          }),
          tx.workflowExecution.count({ where: { organizationId, status: 'SUCCEEDED' } }),
          tx.workflowExecution.count({ where: { organizationId, status: 'FILTERED' } }),
          tx.workflowExecution.count({
            where: { organizationId, status: { in: ['FAILED', 'RETRY_WAIT'] } },
          }),
        ]);

      return {
        organizationId,
        generatedAt: now.toISOString(),
        ingestion: {
          totalEvents,
          lastHourEvents,
          last24HourEvents,
        },
        delivery: {
          totalAttempts,
          successCount,
          failedCount,
          unknownCount,
          successRatePercentage,
          latency: latencyQuantiles,
        },
        outbox: {
          pendingBacklogCount: pendingOutboxCount,
          oldestPendingLagSeconds: oldestLagSeconds,
          dlqBacklogCount,
        },
        workflows: {
          totalExecutions: totalExecs,
          activeRunningCount: runningExecs,
          succeededCount: succeededExecs,
          filteredCount: filteredExecs,
          failedCount: failedExecs,
        },
      };
    });
  }

  private calculateQuantiles(sortedValues: number[]): LatencyQuantiles {
    if (!sortedValues || sortedValues.length === 0) {
      return { minMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
    }

    const count = sortedValues.length;
    const sum = sortedValues.reduce((acc, val) => acc + val, 0);
    const avgMs = Math.round(sum / count);
    const minMs = sortedValues[0]!;
    const maxMs = sortedValues[count - 1]!;

    const getPercentile = (pct: number) => {
      const idx = Math.min(Math.floor((pct / 100) * count), count - 1);
      return sortedValues[idx]!;
    };

    return {
      minMs,
      avgMs,
      p50Ms: getPercentile(50),
      p95Ms: getPercentile(95),
      p99Ms: getPercentile(99),
      maxMs,
    };
  }
}
