import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { TenantContextService } from '../database/tenant-context.service';
import { DeliveryService } from '../delivery/delivery.service';
import { calculateNextRetryDelay, evaluateRetry } from '../delivery/retry-policy';
import { EventStreamService } from '../observability/event-stream.service';
import { safeError } from '../observability/logging';
import { evaluateConditionGroup } from './condition-evaluator';
import { applyJsonTransformation } from './json-transformer';
import type {
  ActionStep,
} from './workflow.types';
import { validateWorkflowDefinitionStructure } from './workflow-validator';

export interface WorkflowOutboxContext {
  outboxMessageId: string;
  leaseToken: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'FILTERED' | 'RETRY_WAIT' | 'RUNNING' | 'QUEUED' | 'CANCELLED';
  currentStep: number;
  completedAt?: Date | null;
  failureReason?: string | null;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly tenantContext: TenantContextService,
    private readonly deliveryService: DeliveryService,
    @Optional() private readonly eventStream?: EventStreamService,
  ) {}

  /**
   * Worker outbox hook: dispatches workflow execution for a claimed outbox row.
   */
  async processWorkflowOutbox(msg: {
    id: string;
    event_id: string;
    org_id: string;
    workflow_execution_id?: string | null;
    lease_token: string;
  }): Promise<WorkflowExecutionResult | null> {
    let executionId = msg.workflow_execution_id;
    if (!executionId) {
      const outbox = await this.tenantContext.runInTenantContext(msg.org_id, '', async (tx) => {
        return tx.outboxMessage.findUnique({
          where: { id: msg.id },
          select: { workflowExecutionId: true },
        });
      });
      executionId = outbox?.workflowExecutionId ?? null;
    }

    if (!executionId) {
      // Fallback: search for workflow execution by event_id within tenant context
      const found = await this.tenantContext.runInTenantContext(msg.org_id, '', async (tx) => {
        return tx.workflowExecution.findFirst({
          where: { eventId: msg.event_id, organizationId: msg.org_id },
          orderBy: { createdAt: 'desc' },
        });
      });
      if (!found) {
        return null;
      }
      executionId = found.id;
    }

    return this.executeWorkflow(
      executionId,
      {
        outboxMessageId: msg.id,
        leaseToken: msg.lease_token,
      },
      msg.org_id,
    );
  }

  /**
   * Executes or resumes a sequential workflow execution instance.
   * Checkpoints every node execution to ensure earlier steps are never re-executed on resume.
   */
  async executeWorkflow(
    executionId: string,
    outboxContext?: WorkflowOutboxContext,
    orgId?: string,
  ): Promise<WorkflowExecutionResult> {
    // 0. Resolve organizationId if not explicitly provided
    let organizationId = orgId;
    if (!organizationId) {
      const rows = await this.database.client.$queryRaw<{ get_workflow_execution_org: string }[]>`
        SELECT get_workflow_execution_org(${executionId}::uuid)
      `;
      organizationId = rows[0]?.get_workflow_execution_org;
    }

    if (!organizationId) {
      throw new NotFoundException(`WorkflowExecution '${executionId}' not found`);
    }

    // 1. Fetch execution record with version and event within tenant RLS context
    const execution = await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
      return tx.workflowExecution.findUnique({
        where: { id: executionId },
        include: {
          workflowVersion: {
            include: {
              workflow: true,
            },
          },
          event: true,
        },
      });
    });

    if (!execution) {
      throw new NotFoundException(`WorkflowExecution '${executionId}' not found`);
    }

    const { event, workflowVersion } = execution;
    const definition = validateWorkflowDefinitionStructure(
      workflowVersion.definition,
    );

    // If execution was cancelled or already succeeded, do not re-run
    if (execution.status === 'SUCCEEDED' || execution.status === 'CANCELLED' || execution.status === 'FILTERED') {
      return {
        executionId,
        status: execution.status,
        currentStep: execution.currentStep,
      };
    }

    // Mark execution RUNNING if it was QUEUED or RETRY_WAIT
    await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
      await tx.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'RUNNING',
          startedAt: execution.startedAt ?? new Date(),
        },
      });
    });

    // Load existing step executions for checkpointing and resume
    const existingSteps = await this.tenantContext.runInTenantContext(
      organizationId,
      '',
      async (tx) => {
        return tx.workflowStepExecution.findMany({
          where: { executionId },
          orderBy: { stepIndex: 'asc' },
        });
      },
    );

    const stepMap = new Map<string, typeof existingSteps[0]>();
    for (const step of existingSteps) {
      stepMap.set(step.nodeId, step);
    }

    let currentPayload = (event.payload as Record<string, unknown>) ?? {};
    const eventHeaders = (event.headers as Record<string, string>) ?? {};
    const eventType = event.eventType;

    let stepCounter = 0;

    // STEP 0: TRIGGER NODE
    const triggerNodeId = definition.trigger.nodeId || 'trigger_1';
    let triggerStep = stepMap.get(triggerNodeId);
    if (!triggerStep || triggerStep.status !== 'SUCCEEDED') {
      triggerStep = await this.checkpointStep(organizationId, {
        executionId,
        nodeId: triggerNodeId,
        stepIndex: stepCounter,
        stepType: 'TRIGGER',
        status: 'SUCCEEDED',
        attemptCount: 1,
        inputSnapshot: null,
        outputSnapshot: currentPayload as Prisma.InputJsonValue,
        completedAt: new Date(),
      });
      stepMap.set(triggerNodeId, triggerStep);
    }
    stepCounter++;

    // STEP 1: CONDITIONS NODE (OPTIONAL)
    const conditionGroup = definition.conditions || definition.conditionGroup;
    if (conditionGroup) {
      const conditionNodeId = conditionGroup.nodeId || 'condition_1';
      let conditionStep = stepMap.get(conditionNodeId);

      if (!conditionStep || conditionStep.status !== 'SUCCEEDED') {
        const evalResult = evaluateConditionGroup(
          {
            payload: currentPayload,
            headers: eventHeaders,
            eventType,
            eventId: event.id,
          },
          conditionGroup,
        );

        if (!evalResult.passed) {
          // Conditions failed: mark step SKIPPED, mark execution FILTERED
          await this.checkpointStep(organizationId, {
            executionId,
            nodeId: conditionNodeId,
            stepIndex: stepCounter,
            stepType: 'CONDITION',
            status: 'SKIPPED',
            attemptCount: (conditionStep?.attemptCount ?? 0) + 1,
            inputSnapshot: currentPayload as Prisma.InputJsonValue,
            outputSnapshot: { passed: false },
            completedAt: new Date(),
          });

          await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
            await tx.workflowExecution.update({
              where: { id: executionId },
              data: {
                status: 'FILTERED',
                completedAt: new Date(),
              },
            });
          });

          if (outboxContext) {
            await this.completeOutbox(outboxContext, event.id, 'DISPATCHED', 'COMPLETED');
          }

          return {
            executionId,
            status: 'FILTERED',
            currentStep: stepCounter,
          };
        }

        // Passed conditions: mark step SUCCEEDED
        conditionStep = await this.checkpointStep(organizationId, {
          executionId,
          nodeId: conditionNodeId,
          stepIndex: stepCounter,
          stepType: 'CONDITION',
          status: 'SUCCEEDED',
          attemptCount: (conditionStep?.attemptCount ?? 0) + 1,
          inputSnapshot: currentPayload as Prisma.InputJsonValue,
          outputSnapshot: { passed: true },
          completedAt: new Date(),
        });
        stepMap.set(conditionNodeId, conditionStep);
      }
      stepCounter++;
    }

    // STEP 2: TRANSFORM NODE (OPTIONAL)
    if (definition.transform) {
      const transformNodeId = definition.transform.nodeId || 'transform_1';
      let transformStep = stepMap.get(transformNodeId);

      if (!transformStep || transformStep.status !== 'SUCCEEDED') {
        try {
          const transformed = applyJsonTransformation(currentPayload, definition.transform);
          currentPayload = transformed;

          transformStep = await this.checkpointStep(organizationId, {
            executionId,
            nodeId: transformNodeId,
            stepIndex: stepCounter,
            stepType: 'TRANSFORM',
            status: 'SUCCEEDED',
            attemptCount: (transformStep?.attemptCount ?? 0) + 1,
            inputSnapshot: currentPayload as Prisma.InputJsonValue,
            outputSnapshot: transformed as Prisma.InputJsonValue,
            completedAt: new Date(),
          });
          stepMap.set(transformNodeId, transformStep);
        } catch (err: unknown) {
          const reason = err instanceof Error ? err.message : 'Transformation failed';
          await this.checkpointStep(organizationId, {
            executionId,
            nodeId: transformNodeId,
            stepIndex: stepCounter,
            stepType: 'TRANSFORM',
            status: 'FAILED',
            attemptCount: (transformStep?.attemptCount ?? 0) + 1,
            inputSnapshot: currentPayload as Prisma.InputJsonValue,
            errorDetails: { message: reason },
            completedAt: new Date(),
          });

          await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
            await tx.workflowExecution.update({
              where: { id: executionId },
              data: {
                status: 'FAILED',
                failureReason: reason,
                completedAt: new Date(),
              },
            });
          });

          if (outboxContext) {
            await this.completeOutbox(outboxContext, event.id, 'FAILED', 'FAILED');
          }

          return {
            executionId,
            status: 'FAILED',
            currentStep: stepCounter,
            failureReason: reason,
          };
        }
      } else if (transformStep.outputSnapshot) {
        currentPayload = transformStep.outputSnapshot as Record<string, unknown>;
      }
      stepCounter++;
    }

    // STEPS 3..N: SEQUENTIAL HTTP ACTIONS (1 to 5 actions)
    let actionIndex = 0;
    for (const action of definition.actions) {
      actionIndex++;
      const currentActionStepIndex = stepCounter++;
      const actionNodeId = action.nodeId;
      let actionStep = stepMap.get(actionNodeId);

      // Checkpoint check: if already SUCCEEDED, skip delivery!
      if (actionStep && actionStep.status === 'SUCCEEDED') {
        continue;
      }

      // Checkpoint step as RUNNING
      const attemptCount = (actionStep?.attemptCount ?? 0) + 1;
      actionStep = await this.checkpointStep(organizationId, {
        executionId,
        nodeId: actionNodeId,
        stepIndex: currentActionStepIndex,
        stepType: 'HTTP_ACTION',
        status: 'RUNNING',
        attemptCount,
        inputSnapshot: currentPayload as Prisma.InputJsonValue,
        startedAt: new Date(),
      });
      stepMap.set(actionNodeId, actionStep);

      // Update execution current step
      await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
        await tx.workflowExecution.update({
          where: { id: executionId },
          data: { currentStep: actionIndex },
        });
      });

      // Execute destination delivery outside DB transaction
      const deliveryResult = await this.executeActionDelivery(
        organizationId,
        event.id,
        executionId,
        actionStep.id,
        action,
        currentPayload,
        eventType,
        attemptCount,
        outboxContext?.outboxMessageId,
      );

      if (deliveryResult.status === 'SUCCESS') {
        // Step succeeded: mark SUCCEEDED, proceed to next action
        actionStep = await this.checkpointStep(organizationId, {
          executionId,
          nodeId: actionNodeId,
          stepIndex: currentActionStepIndex,
          stepType: 'HTTP_ACTION',
          status: 'SUCCEEDED',
          attemptCount,
          inputSnapshot: currentPayload as Prisma.InputJsonValue,
          outputSnapshot: {
            statusCode: deliveryResult.statusCode,
            latencyMs: deliveryResult.latencyMs,
          },
          completedAt: new Date(),
        });
        stepMap.set(actionNodeId, actionStep);
        continue;
      }

      // Action failed: evaluate retry policy
      const maxRetries = action.retryPolicy?.maxRetries ?? 3;
      const retryEval = evaluateRetry({
        attemptCount,
        maxRetries,
        statusCode: deliveryResult.statusCode,
        errorDescription: deliveryResult.errorDescription,
        retryAfterMs: deliveryResult.retryAfterSeconds ? deliveryResult.retryAfterSeconds * 1000 : undefined,
      });

      if (retryEval.shouldRetry) {
        // Retryable error: mark step RETRY_WAIT, schedule next outbox retry
        await this.checkpointStep(organizationId, {
          executionId,
          nodeId: actionNodeId,
          stepIndex: currentActionStepIndex,
          stepType: 'HTTP_ACTION',
          status: 'RETRY_WAIT',
          attemptCount,
          inputSnapshot: currentPayload as Prisma.InputJsonValue,
          errorDetails: { message: deliveryResult.errorDescription ?? `HTTP ${deliveryResult.statusCode}` },
        });

        await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
          await tx.workflowExecution.update({
            where: { id: executionId },
            data: { status: 'RETRY_WAIT' },
          });
        });

        if (outboxContext) {
          const backoffDelayMs = calculateNextRetryDelay(
            attemptCount,
            (action.retryPolicy?.backoffBaseSeconds ?? 1) * 1000,
            (action.retryPolicy?.backoffMaxSeconds ?? 300) * 1000,
          );
          const backoffSec = Math.ceil(backoffDelayMs / 1000);

          await this.database.client.$queryRaw`
            SELECT schedule_outbox_retry(
              ${outboxContext.outboxMessageId}::uuid,
              ${outboxContext.leaseToken}::uuid,
              ${deliveryResult.statusCode},
              ${deliveryResult.errorDescription},
              ${backoffSec}
            )
          `;
        }

        return {
          executionId,
          status: 'RETRY_WAIT',
          currentStep: actionIndex,
          failureReason: deliveryResult.errorDescription,
        };
      }

      // Permanent failure or retries exhausted: mark step FAILED, mark execution FAILED
      const errorMsg = deliveryResult.errorDescription ?? `HTTP action failed with status ${deliveryResult.statusCode}`;
      await this.checkpointStep(organizationId, {
        executionId,
        nodeId: actionNodeId,
        stepIndex: currentActionStepIndex,
        stepType: 'HTTP_ACTION',
        status: 'FAILED',
        attemptCount,
        inputSnapshot: currentPayload as Prisma.InputJsonValue,
        errorDetails: { message: errorMsg },
        completedAt: new Date(),
      });

      await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
        await tx.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: 'FAILED',
            failureReason: errorMsg,
            completedAt: new Date(),
          },
        });
      });

      if (outboxContext) {
        await this.completeOutbox(outboxContext, event.id, 'FAILED', 'FAILED');
      }

      return {
        executionId,
        status: 'FAILED',
        currentStep: actionIndex,
        failureReason: errorMsg,
      };
    }

    // ALL ACTIONS SUCCEEDED: Mark execution SUCCEEDED
    await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
      await tx.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'SUCCEEDED',
          completedAt: new Date(),
        },
      });
    });

    if (this.eventStream) {
      void this.eventStream.publishEvent({
        type: 'workflow.completed',
        organizationId,
        timestamp: new Date().toISOString(),
        payload: {
          executionId,
          status: 'SUCCEEDED',
          stepsCount: definition.actions.length,
        },
      });
    }

    if (outboxContext) {
      await this.completeOutbox(outboxContext, event.id, 'DISPATCHED', 'COMPLETED');
    }

    return {
      executionId,
      status: 'SUCCEEDED',
      currentStep: definition.actions.length,
      completedAt: new Date(),
    };
  }

  /**
   * Dispatches a single action delivery to a registered destination target.
   */
  private async executeActionDelivery(
    organizationId: string,
    eventId: string,
    executionId: string,
    stepExecutionId: string,
    action: ActionStep,
    payload: unknown,
    eventType: string,
    attemptNumber: number,
    outboxMessageId?: string,
  ) {
    // 1. Fetch destination metadata within tenant RLS context
    const destination = await this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
      return tx.destination.findUnique({
        where: { id: action.destinationId },
      });
    });

    if (!destination || !destination.isActive) {
      return {
        status: 'FAILED' as const,
        statusCode: null,
        latencyMs: 0,
        errorDescription: `Destination '${action.destinationId}' not found or inactive`,
        retryAfterSeconds: null,
      };
    }

    // 2. Stable downstream idempotency identifier
    const customDeliveryId = `wf_${executionId}_${action.nodeId}`;

    // 3. Deliver via DeliveryService
    const attempt = await this.deliveryService.deliverEventToDestination({
      organizationId,
      eventId,
      destination: {
        id: destination.id,
        url: destination.url,
        httpMethod: destination.httpMethod,
        headers: destination.headers as Record<string, string> | null,
        rateLimitPerSecond: destination.rateLimitPerSecond,
        timeoutMs: action.timeoutMs ?? destination.timeoutMs,
      },
      payload,
      eventType,
      ...(outboxMessageId ? { outboxMessageId } : {}),
      attemptNumber,
      workflowExecutionId: executionId,
      stepExecutionId,
      customDeliveryId,
    });

    return attempt;
  }

  /**
   * Checkpoints a step execution record inside tenant context.
   */
  private async checkpointStep(
    organizationId: string,
    data: {
      executionId: string;
      nodeId: string;
      stepIndex: number;
      stepType: 'TRIGGER' | 'CONDITION' | 'TRANSFORM' | 'HTTP_ACTION';
      status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'RETRY_WAIT';
      attemptCount?: number;
      inputSnapshot?: Prisma.InputJsonValue | null;
      outputSnapshot?: Prisma.InputJsonValue | null;
      errorDetails?: Prisma.InputJsonValue | null;
      startedAt?: Date;
      completedAt?: Date;
    },
  ) {
    return this.tenantContext.runInTenantContext(organizationId, '', async (tx) => {
      const existing = await tx.workflowStepExecution.findFirst({
        where: {
          executionId: data.executionId,
          nodeId: data.nodeId,
        },
      });

      if (existing) {
        return tx.workflowStepExecution.update({
          where: { id: existing.id },
          data: {
            status: data.status,
            ...(data.attemptCount !== undefined ? { attemptCount: data.attemptCount } : {}),
            ...(data.inputSnapshot !== undefined && data.inputSnapshot !== null ? { inputSnapshot: data.inputSnapshot } : {}),
            ...(data.outputSnapshot !== undefined && data.outputSnapshot !== null ? { outputSnapshot: data.outputSnapshot } : {}),
            ...(data.errorDetails !== undefined && data.errorDetails !== null ? { errorDetails: data.errorDetails } : {}),
            completedAt: data.completedAt ?? null,
          },
        });
      }

      return tx.workflowStepExecution.create({
        data: {
          id: randomUUID(),
          executionId: data.executionId,
          organizationId,
          nodeId: data.nodeId,
          stepIndex: data.stepIndex,
          stepType: data.stepType,
          status: data.status,
          attemptCount: data.attemptCount ?? 1,
          ...(data.inputSnapshot !== undefined && data.inputSnapshot !== null ? { inputSnapshot: data.inputSnapshot } : {}),
          ...(data.outputSnapshot !== undefined && data.outputSnapshot !== null ? { outputSnapshot: data.outputSnapshot } : {}),
          ...(data.errorDetails !== undefined && data.errorDetails !== null ? { errorDetails: data.errorDetails } : {}),
          startedAt: data.startedAt ?? new Date(),
          completedAt: data.completedAt ?? null,
        },
      });
    });
  }

  /**
   * Completes an outbox message lease dispatch.
   */
  private async completeOutbox(
    ctx: WorkflowOutboxContext,
    eventId: string,
    outboxStatus: 'DISPATCHED' | 'FAILED',
    eventStatus: 'COMPLETED' | 'FAILED',
  ): Promise<void> {
    try {
      await this.database.client.$queryRaw`
        SELECT complete_outbox_dispatch(
          ${ctx.outboxMessageId}::uuid,
          ${eventId}::uuid,
          ${outboxStatus},
          ${eventStatus},
          ${ctx.leaseToken}::uuid
        )
      `;
    } catch (err: unknown) {
      this.logger.error({
        event: 'complete_workflow_outbox_error',
        outboxId: ctx.outboxMessageId,
        error: safeError(err),
      });
    }
  }
}
