export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'not_exists'
  | 'contains';

export type ConditionGroupLogic = 'ALL' | 'ANY';

export interface ConditionRule {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  nodeId: string;
  logic: ConditionGroupLogic;
  conditions: ConditionRule[];
}

export type TransformRuleType = 'map' | 'set' | 'remove';

export interface TransformRule {
  type: TransformRuleType;
  sourcePath?: string;
  targetPath: string;
  value?: unknown;
}

export interface TransformStep {
  nodeId: string;
  preserveOriginal?: boolean;
  rules: TransformRule[];
}

export interface ActionStep {
  nodeId: string;
  destinationId: string;
  name?: string;
  timeoutMs?: number;
  retryPolicy?: {
    maxRetries?: number;
    backoffBaseSeconds?: number;
    backoffMaxSeconds?: number;
  };
}

export interface WorkflowDefinition {
  trigger: {
    nodeId: string;
    endpointId: string;
  };
  conditions?: ConditionGroup | undefined;
  conditionGroup?: ConditionGroup | undefined;
  transform?: TransformStep | undefined;
  actions: ActionStep[];
}

export interface CreateWorkflowDto {
  endpointId: string;
  name: string;
  description?: string;
  initialDefinition?: WorkflowDefinition;
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string | null;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
}

export interface PublishWorkflowDto {
  definition: WorkflowDefinition;
}

export interface WorkflowDto {
  id: string;
  organizationId: string;
  endpointId: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  activeVersionId: string | null;
  activeVersion?: WorkflowVersionDto | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowVersionDto {
  id: string;
  workflowId: string;
  versionNumber: number;
  definition: WorkflowDefinition;
  definitionHash: string;
  publishedAt: Date;
  createdAt: Date;
}

export interface WorkflowExecutionDto {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  eventId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'FILTERED' | 'RETRY_WAIT' | 'CANCELLED';
  currentStep: number;
  startedAt: Date | null;
  completedAt: Date | null;
  failureReason: string | null;
  context: unknown;
  createdAt: Date;
  updatedAt: Date;
  steps?: WorkflowStepExecutionDto[];
}

export interface WorkflowStepExecutionDto {
  id: string;
  executionId: string;
  nodeId: string;
  stepIndex: number;
  stepType: 'TRIGGER' | 'CONDITION' | 'TRANSFORM' | 'HTTP_ACTION';
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'RETRY_WAIT';
  attemptCount: number;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  errorDetails: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
