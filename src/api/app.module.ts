import { Module } from '@nestjs/common';
import { ApiKeyModule } from '../modules/api-keys/api-key.module';
import { AuthModule } from '../modules/auth/auth.module';
import { ConfigurationModule } from '../modules/config/config.module';
import { DatabaseModule } from '../modules/database/database.module';
import { DestinationModule } from '../modules/destinations/destination.module';
import { EndpointModule } from '../modules/endpoints/endpoint.module';
import { HealthController } from '../modules/health/health.controller';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { ObservabilityModule } from '../modules/observability/observability.module';
import { OrganizationModule } from '../modules/organizations/organization.module';

@Module({
  imports: [
    ConfigurationModule.forRoot('api'),
    ObservabilityModule,
    DatabaseModule,
    AuthModule,
    OrganizationModule,
    ApiKeyModule,
    EndpointModule,
    DestinationModule,
    IngestionModule,
  ],
  controllers: [HealthController],
})
export class ApiModule {}
