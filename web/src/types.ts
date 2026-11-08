export type MembershipRole = 'OWNER' | 'DEVELOPER' | 'VIEWER';

export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  role: MembershipRole;
  joinedAt: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  organizations: UserOrganization[];
}

export interface OrganizationDetails {
  id: string;
  name: string;
  slug: string;
  role: MembershipRole;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  role: MembershipRole;
  joinedAt: string;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface ApiKeyMetadata {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdBy: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKeyResponse {
  apiKey: string;
  record: ApiKeyMetadata;
}

export interface EndpointMetadata {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  secretPreview: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedEndpointResponse {
  endpoint: EndpointMetadata;
  signingSecret: string;
}

export interface DestinationMetadata {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  httpMethod: string;
  headers: Record<string, string> | null;
  rateLimitPerSecond: number;
  timeoutMs: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAttemptMetadata {
  id: string;
  organizationId: string;
  eventId: string;
  destinationId: string;
  outboxMessageId: string | null;
  attemptNumber: number;
  status: 'SUCCESS' | 'FAILED';
  statusCode: number | null;
  latencyMs: number;
  requestUrl: string;
  requestMethod: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string> | null;
  responseBodyPreview: string | null;
  errorDescription: string | null;
  createdAt: string;
}

// Milestone 4: Sequential Workflow Execution Engine

export interface WorkflowConditionRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'exists' | 'not_exists' | 'contains';
  value?: unknown;
}

export interface WorkflowConditionGroup {
  nodeId?: string;
  logic: 'ALL' | 'ANY';
  rules: WorkflowConditionRule[];
}

export interface WorkflowActionStep {
  nodeId: string;
  destinationId: string;
  httpMethod?: 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GET';
  payloadTemplate?: unknown;
  retryPolicy?: {
    maxRetries?: number;
    initialBackoffMs?: number;
    maxBackoffMs?: number;
    backoffMultiplier?: number;
  };
}

export interface WorkflowDefinitionDto {
  trigger: {
    nodeId?: string;
    endpointId?: string;
    eventType?: string;
  };
  conditionGroup?: WorkflowConditionGroup;
  transform?: {
    nodeId?: string;
    type: 'pick' | 'map';
    fields?: Record<string, string>;
    pickKeys?: string[];
  };
  actions: WorkflowActionStep[];
}

export interface WorkflowVersionMetadata {
  id: string;
  workflowId: string;
  versionNumber: number;
  definitionHash: string;
  definition: WorkflowDefinitionDto;
  publishedAt: string | null;
  createdAt: string;
}

export interface WorkflowMetadata {
  id: string;
  organizationId: string;
  endpointId: string | null;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  activeVersionId: string | null;
  activeVersion?: WorkflowVersionMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepExecutionMetadata {
  id: string;
  executionId: string;
  organizationId: string;
  nodeId: string;
  stepIndex: number;
  stepType: 'TRIGGER' | 'CONDITION' | 'TRANSFORM' | 'HTTP_ACTION';
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'RETRY_WAIT';
  attemptCount: number;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  errorDetails: unknown;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WorkflowExecutionMetadata {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  eventId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'FILTERED' | 'RETRY_WAIT' | 'CANCELLED';
  currentStep: number;
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: WorkflowStepExecutionMetadata[];
}

// Milestone 5: Observability, Metrics & Advanced DLQ Types

export interface TelemetryMetrics {
  organizationId: string;
  generatedAt: string;
  ingestion: {
    totalEvents: number;
    lastHourEvents: number;
    last24HourEvents: number;
  };
  delivery: {
    totalAttempts: number;
    successCount: number;
    failedCount: number;
    unknownCount: number;
    successRatePercentage: number;
    latency: {
      minMs: number;
      avgMs: number;
      p50Ms: number;
      p95Ms: number;
      p99Ms: number;
      maxMs: number;
    };
  };
  outbox: {
    pendingBacklogCount: number;
    oldestPendingLagSeconds: number;
    dlqBacklogCount: number;
  };
  workflows: {
    totalExecutions: number;
    activeRunningCount: number;
    succeededCount: number;
    filteredCount: number;
    failedCount: number;
  };
}

export interface DlqRecordItem {
  id: string;
  eventId: string;
  channel: string;
  attemptCount: number;
  maxRetries: number;
  status: string;
  createdAt: string;
  lastAttemptAt: string | null;
  lastStatusCode: number | null;
  lastErrorDescription: string | null;
  destinationId: string | null;
  destinationName: string | null;
  destinationUrl: string | null;
  replayedAt: string | null;
  payloadSummary: unknown;
  errorCategory?: 'PERMANENT_HTTP' | 'EXHAUSTED_RETRIES' | 'SSRF_BLOCKED' | 'TIMEOUT';
}

export interface DlqFilterParams {
  destinationId?: string;
  errorCategory?: 'PERMANENT_HTTP' | 'EXHAUSTED_RETRIES' | 'SSRF_BLOCKED' | 'TIMEOUT';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface RealtimeTelemetryEvent {
  type: 'webhook.ingested' | 'delivery.attempt' | 'workflow.step' | 'workflow.completed' | 'dlq.routed' | 'ping';
  organizationId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

