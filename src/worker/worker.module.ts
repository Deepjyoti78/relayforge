import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../modules/config/config.module';
import { DatabaseModule } from '../modules/database/database.module';
import { DeliveryModule } from '../modules/delivery/delivery.module';
import { ObservabilityModule } from '../modules/observability/observability.module';
import { RedisModule } from '../modules/redis/redis.module';
import { HeartbeatService } from './heartbeat.service';
import { OutboxWorkerService } from './outbox-worker.service';
import { SystemWorkerService } from './system-worker.service';

@Module({
  imports: [
    ConfigurationModule.forRoot('worker'),
    ObservabilityModule,
    DatabaseModule,
    RedisModule,
    DeliveryModule,
  ],
  providers: [HeartbeatService, SystemWorkerService, OutboxWorkerService],
})
export class WorkerModule {}
