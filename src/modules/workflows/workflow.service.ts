import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { AuthorizationService } from '../auth/authorization.service';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';
import { WorkflowEngineService } from './workflow-engine.service';
import type {
  CreateWorkflowDto,
  PublishWorkflowDto,
  UpdateWorkflowDto,
} from './workflow.types';
import {
  computeDefinitionHash,
  validateWorkflowDefinitionStructure,
  validateWorkflowEntities,
} from './workflow-validator';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly authService: AuthorizationService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  /**
   * Lists all workflows for an organization.
   */
  async listWorkflows(organizationId: string, userId: string) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      await this.authService.verifyMembership(tx, organizationId, userId);

      const workflows = await tx.workflow.findMany({
        where: { organizationId },
        include: {
          activeVersion: true,
          endpoint: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              versions: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return workflows.map((wf) => ({
        id: wf.id,
        organizationId: wf.organizationId,
        endpointId: wf.endpointId,
        endpoint: wf.endpoint,
        name: wf.name,
        description: wf.description,
        status: wf.status,
        activeVersionId: wf.activeVersionId,
        activeVersionNumber: wf.activeVersion?.versionNumber ?? null,
        activeVersionHash: wf.activeVersion?.definitionHash ?? null,
        versionCount: wf._count.versions,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
      }));
    });
  }

  /**
   * Retrieves single workflow details.
   */
  async getWorkflow(organizationId: string, userId: string, workflowId: string) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      await this.authService.verifyMembership(tx, organizationId, userId);

      const wf = await tx.workflow.findUnique({
        where: { id: workflowId },
        include: {
          activeVersion: true,
          endpoint: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 10,
          },
        },
      });

      if (!wf || wf.organizationId !== organizationId) {
        throw new NotFoundException(`Workflow '${workflowId}' not found`);
      }

      return {
        id: wf.id,
        organizationId: wf.organizationId,
        endpointId: wf.endpointId,
        endpoint: wf.endpoint,
        name: wf.name,
        description: wf.description,
        status: wf.status,
        activeVersionId: wf.activeVersionId,
        activeVersion: wf.activeVersion
          ? {
              id: wf.activeVersion.id,
              versionNumber: wf.activeVersion.versionNumber,
              definition: wf.activeVersion.definition,
              definitionHash: wf.activeVersion.definitionHash,
              publishedAt: wf.activeVersion.publishedAt,
              createdAt: wf.activeVersion.createdAt,
            }
          : null,
        recentVersions: wf.versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          definitionHash: v.definitionHash,
          publishedAt: v.publishedAt,
          createdAt: v.createdAt,
        })),
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
      };
    });
  }

  /**
   * Creates a new workflow record.
   */
  async createWorkflow(organizationId: string, userId: string, dto: CreateWorkflowDto) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await this.authService.verifyMembership(tx, organizationId, userId);
      if (membership.role !== 'OWNER' && membership.role !== 'DEVELOPER') {
        throw new ForbiddenException('Only Owners and Developers can create workflows');
      }

      // Verify endpoint exists and belongs to org
      const endpoint = await tx.endpoint.findUnique({
        where: { id: dto.endpointId },
      });
      if (!endpoint || endpoint.organizationId !== organizationId) {
        throw new BadRequestException(`Endpoint '${dto.endpointId}' not found in organization`);
      }

      const workflowId = randomUUID();

      // If initial definition is supplied, validate and create initial version
      let initialVersionId: string | null = null;
      if (dto.initialDefinition) {
        const validated = validateWorkflowDefinitionStructure(dto.initialDefinition);
        await validateWorkflowEntities(tx, organizationId, validated);
        const hash = computeDefinitionHash(validated);
        const versionId = randomUUID();

        await tx.workflowVersion.create({
          data: {
            id: versionId,
            organizationId,
            workflowId,
            versionNumber: 1,
            definition: validated as unknown as Prisma.InputJsonValue,
            definitionHash: hash,
            publishedAt: new Date(),
          },
        });
        initialVersionId = versionId;
      }

      const workflow = await tx.workflow.create({
        data: {
          id: workflowId,
          organizationId,
          endpointId: dto.endpointId,
          name: dto.name.trim(),
          description: dto.description?.trim() ?? null,
          status: initialVersionId ? 'ACTIVE' : 'DRAFT',
          activeVersionId: initialVersionId,
        },
      });

      return {
        id: workflow.id,
        organizationId: workflow.organizationId,
        endpointId: workflow.endpointId,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        activeVersionId: workflow.activeVersionId,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      };
    });
  }

  /**
   * Updates workflow metadata.
   */
  async updateWorkflow(
    organizationId: string,
    userId: string,
    workflowId: string,
    dto: UpdateWorkflowDto,
  ) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await this.authService.verifyMembership(tx, organizationId, userId);
      if (membership.role !== 'OWNER' && membership.role !== 'DEVELOPER') {
        throw new ForbiddenException('Only Owners and Developers can update workflows');
      }

      const existing = await tx.workflow.findUnique({ where: { id: workflowId } });
      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundException(`Workflow '${workflowId}' not found`);
      }

      return tx.workflow.update({
        where: { id: workflowId },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
      });
    });
  }

  /**
   * Validates a workflow definition without saving or publishing it.
   */
  async validateWorkflow(
    organizationId: string,
    userId: string,
    _workflowId: string,
    definition: unknown,
  ) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      await this.authService.verifyMembership(tx, organizationId, userId);
      const validated = validateWorkflowDefinitionStructure(definition);
      await validateWorkflowEntities(tx, organizationId, validated);
      const hash = computeDefinitionHash(validated);
      return {
        valid: true,
        definitionHash: hash,
        actionsCount: validated.actions.length,
        hasConditions: !!(validated.conditions || validated.conditionGroup),
        hasTransform: !!validated.transform,
      };
    });
  }

  /**
   * Publishes a new immutable version of a workflow and sets it as the active version.
   */
  async publishWorkflow(
    organizationId: string,
    userId: string,
    workflowId: string,
    dto: PublishWorkflowDto,
  ) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await this.authService.verifyMembership(tx, organizationId, userId);
      if (membership.role !== 'OWNER' && membership.role !== 'DEVELOPER') {
        throw new ForbiddenException('Only Owners and Developers can publish workflow versions');
      }

      const workflow = await tx.workflow.findUnique({
        where: { id: workflowId },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
      });

      if (!workflow || workflow.organizationId !== organizationId) {
        throw new NotFoundException(`Workflow '${workflowId}' not found`);
      }

      // Validate definition structure & destination targets
      const validated = validateWorkflowDefinitionStructure(dto.definition);
      await validateWorkflowEntities(tx, organizationId, validated);

      const hash = computeDefinitionHash(validated);
      const latestVersionNumber = workflow.versions[0]?.versionNumber ?? 0;
      const nextVersionNumber = latestVersionNumber + 1;
      const versionId = randomUUID();

      // Create immutable version record
      const version = await tx.workflowVersion.create({
        data: {
          id: versionId,
          organizationId,
          workflowId,
          versionNumber: nextVersionNumber,
          definition: validated as unknown as Prisma.InputJsonValue,
          definitionHash: hash,
          publishedAt: new Date(),
        },
      });

      // Update workflow active version and set status ACTIVE
      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          activeVersionId: version.id,
          status: 'ACTIVE',
        },
      });

      return {
        id: version.id,
        workflowId: version.workflowId,
        versionNumber: version.versionNumber,
        definitionHash: version.definitionHash,
        definition: version.definition,
        publishedAt: version.publishedAt,
        createdAt: version.createdAt,
      };
    });
  }

  /**
   * Lists historical versions of a workflow.
   */
  async listVersions(organizationId: string, userId: string, workflowId: string) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      await this.authService.verifyMembership(tx, organizationId, userId);

      const wf = await tx.workflow.findUnique({ where: { id: workflowId } });
      if (!wf || wf.organizationId !== organizationId) {
        throw new NotFoundException(`Workflow '${workflowId}' not found`);
      }

      return tx.workflowVersion.findMany({
        where: { workflowId },
        orderBy: { versionNumber: 'desc' },
      });
    });
  }

  /**
   * Lists executions for an organization with optional workflow filter and cursor pagination.
   */
  async listExecutions(
    organizationId: string,
    userId: string,
    filters?: {
      workflowId?: string;
      status?: string;
      limit?: number;
    },
  ) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      await this.authService.verifyMembership(tx, organizationId, userId);

      const where: Prisma.WorkflowExecutionWhereInput = {
        organizationId,
        ...(filters?.status
          ? {
              status: filters.status as
                | 'QUEUED'
                | 'RUNNING'
                | 'SUCCEEDED'
                | 'FAILED'
                | 'FILTERED'
                | 'RETRY_WAIT'
                | 'CANCELLED',
            }
          : {}),
      };

      if (filters?.workflowId) {
        where.workflowVersion = {
          workflowId: filters.workflowId,
        };
      }

      const take = filters?.limit ? Math.min(filters.limit, 100) : 50;

      const executions = await tx.workflowExecution.findMany({
        where,
        include: {
          workflowVersion: {
            include: {
              workflow: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          event: {
            select: {
              id: true,
              eventType: true,
              idempotencyKey: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              steps: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take,
      });

      return executions.map((ex) => ({
        id: ex.id,
        organizationId: ex.organizationId,
        workflowId: ex.workflowVersion.workflow.id,
        workflowName: ex.workflowVersion.workflow.name,
        workflowVersionNumber: ex.workflowVersion.versionNumber,
        eventId: ex.eventId,
        eventType: ex.event.eventType,
        idempotencyKey: ex.event.idempotencyKey,
        status: ex.status,
        currentStep: ex.currentStep,
        stepCount: ex._count.steps,
        startedAt: ex.startedAt,
        completedAt: ex.completedAt,
        failureReason: ex.failureReason,
        durationMs: ex.completedAt && ex.startedAt
          ? ex.completedAt.getTime() - ex.startedAt.getTime()
          : null,
      }));
    });
  }

  /**
   * Retrieves single execution with full lineage and step snapshots.
   */
  async getExecution(organizationId: string, userId: string, executionId: string) {
    return this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      await this.authService.verifyMembership(tx, organizationId, userId);

      const execution = await tx.workflowExecution.findUnique({
        where: { id: executionId },
        include: {
          workflowVersion: {
            include: {
              workflow: true,
            },
          },
          event: true,
          steps: {
            orderBy: { stepIndex: 'asc' },
          },
          deliveryAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!execution || execution.organizationId !== organizationId) {
        throw new NotFoundException(`WorkflowExecution '${executionId}' not found`);
      }

      return {
        id: execution.id,
        organizationId: execution.organizationId,
        workflowId: execution.workflowVersion.workflow.id,
        workflowName: execution.workflowVersion.workflow.name,
        workflowVersionId: execution.workflowVersionId,
        workflowVersionNumber: execution.workflowVersion.versionNumber,
        definitionSnapshot: execution.workflowVersion.definition,
        eventId: execution.eventId,
        event: {
          id: execution.event.id,
          eventType: execution.event.eventType,
          idempotencyKey: execution.event.idempotencyKey,
          payload: execution.event.payload,
          headers: execution.event.headers,
          createdAt: execution.event.createdAt,
        },
        status: execution.status,
        currentStep: execution.currentStep,
        failureReason: execution.failureReason,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        steps: execution.steps.map((step) => ({
          id: step.id,
          nodeId: step.nodeId,
          stepIndex: step.stepIndex,
          stepType: step.stepType,
          status: step.status,
          attemptCount: step.attemptCount,
          inputSnapshot: step.inputSnapshot,
          outputSnapshot: step.outputSnapshot,
          errorDetails: step.errorDetails,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
        })),
        deliveryAttempts: execution.deliveryAttempts.map((att) => ({
          id: att.id,
          destinationId: att.destinationId,
          stepExecutionId: att.stepExecutionId,
          status: att.status,
          statusCode: att.statusCode,
          latencyMs: att.latencyMs,
          requestUrl: att.requestUrl,
          errorDescription: att.errorDescription,
          createdAt: att.createdAt,
        })),
      };
    });
  }

  /**
   * Resumes a failed or waiting workflow execution without repeating succeeded steps.
   */
  async resumeExecution(organizationId: string, userId: string, executionId: string) {
    const res = await this.tenantContext.runInTenantContext(organizationId, userId, async (tx) => {
      const membership = await this.authService.verifyMembership(tx, organizationId, userId);
      if (membership.role !== 'OWNER' && membership.role !== 'DEVELOPER') {
        throw new ForbiddenException('Only Owners and Developers can resume workflow executions');
      }

      const execution = await tx.workflowExecution.findUnique({
        where: { id: executionId },
      });

      if (!execution || execution.organizationId !== organizationId) {
        throw new NotFoundException(`WorkflowExecution '${executionId}' not found`);
      }

      if (execution.status === 'SUCCEEDED' || execution.status === 'FILTERED') {
        throw new BadRequestException(`Cannot resume execution with terminal status '${execution.status}'`);
      }

      // Reset execution status to QUEUED and clear failure reason
      await tx.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'QUEUED',
          failureReason: null,
        },
      });

      // Find or create associated outbox message
      const existingOutbox = await tx.outboxMessage.findFirst({
        where: { workflowExecutionId: executionId },
      });

      if (existingOutbox) {
        await tx.outboxMessage.update({
          where: { id: existingOutbox.id },
          data: {
            status: 'PENDING',
            attemptCount: 0,
            nextRetryAt: new Date(),
          },
        });
      } else {
        await tx.outboxMessage.create({
          data: {
            id: randomUUID(),
            organizationId,
            eventId: execution.eventId,
            workflowExecutionId: executionId,
            channel: 'workflow',
            payload: {},
            status: 'PENDING',
          },
        });
      }

      return {
        success: true,
        executionId,
        status: 'QUEUED',
        message: 'Workflow execution reset to QUEUED for resumption',
      };
    });

    // Trigger execution asynchronously in background with tenant context
    void this.workflowEngine.executeWorkflow(executionId, undefined, organizationId).catch(() => {});
    return res;
  }
}
