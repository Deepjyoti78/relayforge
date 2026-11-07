import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../modules/config/config.module';
import { DatabaseModule } from '../modules/database/database.module';
import { ObservabilityModule } from '../modules/observability/observability.module';
import { RedisModule } from '../modules/redis/redis.module';
import { HeartbeatService } from './heartbeat.service';
import { SystemWorkerService } from './system-worker.service';

@Module({
  imports: [ConfigurationModule.forRoot('worker'), ObservabilityModule, DatabaseModule, RedisModule],
  providers: [HeartbeatService, SystemWorkerService],
})
export class WorkerModule {}
