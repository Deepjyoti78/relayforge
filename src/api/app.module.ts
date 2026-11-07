import { Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module';
import { ConfigurationModule } from '../modules/config/config.module';
import { DatabaseModule } from '../modules/database/database.module';
import { HealthController } from '../modules/health/health.controller';
import { ObservabilityModule } from '../modules/observability/observability.module';
import { OrganizationModule } from '../modules/organizations/organization.module';

@Module({
  imports: [
    ConfigurationModule.forRoot('api'),
    ObservabilityModule,
    DatabaseModule,
    AuthModule,
    OrganizationModule,
  ],
  controllers: [HealthController],
})
export class ApiModule {}
