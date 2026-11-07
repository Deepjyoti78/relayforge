import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../modules/config/config.module';
import { DatabaseModule } from '../modules/database/database.module';
import { HealthController } from '../modules/health/health.controller';
import { ObservabilityModule } from '../modules/observability/observability.module';

@Module({
  imports: [ConfigurationModule.forRoot('api'), ObservabilityModule, DatabaseModule],
  controllers: [HealthController],
})
export class ApiModule {}
