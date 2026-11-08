import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ObservabilityModule } from '../observability/observability.module';
import { RedisModule } from '../redis/redis.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { DlqController } from './dlq.controller';
import { DlqService } from './dlq.service';
import { RateLimiterService } from './rate-limiter.service';

@Module({
  imports: [DatabaseModule, AuthModule, RedisModule, ObservabilityModule],
  controllers: [DeliveryController, DlqController],
  providers: [DeliveryService, RateLimiterService, DlqService],
  exports: [DeliveryService, RateLimiterService, DlqService],
})
export class DeliveryModule {}
