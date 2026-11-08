import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { RuntimeConfig } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { httpLoggerOptions } from './logging';
import { MetricsService } from './metrics.service';
import { EventStreamService } from './event-stream.service';
import { TelemetryController } from './telemetry.controller';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [RuntimeConfig],
      useFactory: (config: RuntimeConfig) => ({ pinoHttp: httpLoggerOptions(config.values) }),
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
  ],
  controllers: [TelemetryController],
  providers: [MetricsService, EventStreamService],
  exports: [LoggerModule, MetricsService, EventStreamService],
})
export class ObservabilityModule {}
