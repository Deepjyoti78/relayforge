import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { UnrecoverableError, Worker } from 'bullmq';
import { RuntimeConfig } from '../modules/config/config.module';
import { DatabaseService } from '../modules/database/database.service';
import { RedisService } from '../modules/redis/redis.service';
import { safeError } from '../modules/observability/logging';
import { HeartbeatService } from './heartbeat.service';
import { HEALTH_JOB, healthProbeSchema, SYSTEM_QUEUE } from './system-queue';
import type { HealthProbe, HealthResult } from './system-queue';

@Injectable()
export class SystemWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemWorkerService.name);
  private worker: Worker<HealthProbe, HealthResult> | undefined;

  constructor(
    private readonly redis: RedisService,
    private readonly database: DatabaseService,
    private readonly config: RuntimeConfig,
    private readonly heartbeat: HeartbeatService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.worker = new Worker<HealthProbe, HealthResult>(SYSTEM_QUEUE, async (job) => {
      const payload = healthProbeSchema.safeParse(job.data);
      if (job.name !== HEALTH_JOB || !payload.success) {
        throw new UnrecoverableError('Unsupported operational job');
      }
      await this.database.ping();
      return {
        probeId: payload.data.probeId,
        instanceId: this.heartbeat.instanceId,
        version: this.config.values.version,
      };
    }, {
      connection: this.redis.connection,
      prefix: this.config.values.queuePrefix,
      concurrency: this.config.values.workerConcurrency,
      removeOnComplete: { age: 60, count: 100 },
      removeOnFail: { age: 3600, count: 20 },
    });
    this.worker.on('error', (error: Error) => {
      this.logger.error({ event: 'worker_queue_error', error: safeError(error) });
    });
    this.worker.on('failed', (job, error: Error) => {
      this.logger.warn({ event: 'operational_job_failed', jobId: job?.id, error: safeError(error) });
    });
    await this.worker.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
