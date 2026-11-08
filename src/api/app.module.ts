import { Module } from '@nestjs/common';
import { ApiKeyModule } from '../modules/api-keys/api-key.module';
import { AuthModule } from '../modules/auth/auth.module';
import { ConfigurationModule } from '../modules/config/config.module';
import { DatabaseModule } from '../modules/database/database.module';
import { DestinationModule } from '../modules/destinations/destination.module';
import { DeliveryModule } from '../modules/delivery/delivery.module';
import { EndpointModule } from '../modules/endpoints/endpoint.module';
import { HealthController } from '../modules/health/health.controller';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { ObservabilityModule } from '../modules/observability/observability.module';
import { OrganizationModule } from '../modules/organizations/organization.module';
import { WorkflowsModule } from '../modules/workflows/workflows.module';

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
    DeliveryModule,
    IngestionModule,
    WorkflowsModule,
  ],
  controllers: [HealthController],
})
export class ApiModule {}
