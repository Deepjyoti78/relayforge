import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { RuntimeConfig } from '../modules/config/config.module';
import { DatabaseService } from '../modules/database/database.service';
import { safeError } from '../modules/observability/logging';

@Injectable()
export class HeartbeatService implements OnApplicationBootstrap, OnModuleDestroy {
  readonly instanceId = randomUUID();
  private readonly logger = new Logger(HeartbeatService.name);
  private timer: NodeJS.Timeout | undefined;
  private pending: Promise<void> | undefined;
  private stopping = false;

  constructor(private readonly database: DatabaseService, private readonly config: RuntimeConfig) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.persist();
    this.schedule();
    this.logger.log({ event: 'worker_started', instanceId: this.instanceId });
  }

  private async persist(): Promise<void> {
    await this.database.client.workerHeartbeat.upsert({
      where: { instanceId: this.instanceId },
      create: { instanceId: this.instanceId, version: this.config.values.version },
      update: { lastSeenAt: new Date() },
    });
  }

  private schedule(): void {
    if (this.stopping) return;
    this.timer = setTimeout(() => {
      this.pending = this.persist()
        .catch((error: unknown) => {
          this.logger.error({ event: 'worker_heartbeat_failed', error: safeError(error) });
        })
        .finally(() => this.schedule());
    }, this.config.values.workerHeartbeatMs).unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    await this.pending;
    try {
      await this.database.client.workerHeartbeat.deleteMany({ where: { instanceId: this.instanceId } });
    } catch (error) {
      this.logger.warn({ event: 'worker_heartbeat_cleanup_failed', error: safeError(error) });
    }
  }
}
