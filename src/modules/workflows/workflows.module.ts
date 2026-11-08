import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [DatabaseModule, AuthModule, DeliveryModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowEngineService],
  exports: [WorkflowService, WorkflowEngineService],
})
export class WorkflowsModule {}
