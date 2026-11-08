import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkflowService } from './workflow.service';
import type {
  CreateWorkflowDto,
  PublishWorkflowDto,
  UpdateWorkflowDto,
} from './workflow.types';

@Controller('v1/organizations/:orgId')
@UseGuards(AuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('workflows')
  async listWorkflows(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
  ) {
    return this.workflowService.listWorkflows(orgId, user.id);
  }

  @Post('workflows')
  @HttpCode(HttpStatus.CREATED)
  async createWorkflow(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Body() body: CreateWorkflowDto,
  ) {
    return this.workflowService.createWorkflow(orgId, user.id, body);
  }

  @Get('workflows/:workflowId')
  async getWorkflow(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: User,
  ) {
    return this.workflowService.getWorkflow(orgId, user.id, workflowId);
  }

  @Patch('workflows/:workflowId')
  async updateWorkflow(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: User,
    @Body() body: UpdateWorkflowDto,
  ) {
    return this.workflowService.updateWorkflow(orgId, user.id, workflowId, body);
  }

  @Post('workflows/:workflowId/validate')
  async validateWorkflow(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: User,
    @Body() body: { definition: unknown },
  ) {
    return this.workflowService.validateWorkflow(
      orgId,
      user.id,
      workflowId,
      body.definition,
    );
  }

  @Post('workflows/:workflowId/publish')
  @HttpCode(HttpStatus.CREATED)
  async publishWorkflow(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: User,
    @Body() body: PublishWorkflowDto,
  ) {
    return this.workflowService.publishWorkflow(orgId, user.id, workflowId, body);
  }

  @Get('workflows/:workflowId/versions')
  async listVersions(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: User,
  ) {
    return this.workflowService.listVersions(orgId, user.id, workflowId);
  }

  @Get('executions')
  async listExecutions(
    @Param('orgId') orgId: string,
    @CurrentUser() user: User,
    @Query('workflowId') workflowId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: { workflowId?: string; status?: string; limit?: number } = {};
    if (workflowId) filters.workflowId = workflowId;
    if (status) filters.status = status;
    if (limit) filters.limit = Number.parseInt(limit, 10);

    return this.workflowService.listExecutions(orgId, user.id, filters);
  }

  @Get('executions/:executionId')
  async getExecution(
    @Param('orgId') orgId: string,
    @Param('executionId') executionId: string,
    @CurrentUser() user: User,
  ) {
    return this.workflowService.getExecution(orgId, user.id, executionId);
  }

  @Post('executions/:executionId/resume')
  @HttpCode(HttpStatus.OK)
  async resumeExecution(
    @Param('orgId') orgId: string,
    @Param('executionId') executionId: string,
    @CurrentUser() user: User,
  ) {
    return this.workflowService.resumeExecution(orgId, user.id, executionId);
  }
}
