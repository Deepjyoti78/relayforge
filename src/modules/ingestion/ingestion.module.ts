import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EndpointModule } from '../endpoints/endpoint.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [DatabaseModule, EndpointModule],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
