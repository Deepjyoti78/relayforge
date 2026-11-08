import type {
  ApiKeyMetadata,
  CreatedApiKeyResponse,
  CreatedEndpointResponse,
  DeliveryAttemptMetadata,
  DestinationMetadata,
  EndpointMetadata,
  MembershipRole,
  OrganizationDetails,
  OrganizationMember,
  UserProfile,
  WorkflowExecutionMetadata,
  WorkflowMetadata,
} from './types.ts';

const TOKEN_KEY = 'rf_session_token';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (res.status === 401) {
    setSessionToken(null);
  }

  return res;
}

export async function fetchMe(): Promise<UserProfile | null> {
  const res = await apiFetch('/v1/me');
  if (res.status === 401) return null;
  const contentType = res.headers.get('content-type');
  if (!res.ok || !contentType?.includes('application/json')) {
    return null;
  }
  return res.json() as Promise<UserProfile>;
}

export async function logout(): Promise<void> {
  const res = await apiFetch('/v1/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  setSessionToken(null);
  if (!res.ok) throw new Error('Failed to logout');
}

export async function createOrganization(name: string, slug?: string): Promise<OrganizationDetails> {
  const res = await apiFetch('/v1/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, slug: slug || undefined }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to create organization' })) as { message?: string };
    throw new Error(error.message || 'Failed to create organization');
  }
  return res.json() as Promise<OrganizationDetails>;
}

export async function fetchOrganization(orgId: string): Promise<OrganizationDetails> {
  const res = await apiFetch(`/v1/organizations/${orgId}`);
  if (!res.ok) throw new Error('Failed to fetch organization details');
  return res.json() as Promise<OrganizationDetails>;
}

export async function updateOrganization(orgId: string, name: string): Promise<OrganizationDetails> {
  const res = await apiFetch(`/v1/organizations/${orgId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to update organization' })) as { message?: string };
    throw new Error(error.message || 'Failed to update organization');
  }
  return res.json() as Promise<OrganizationDetails>;
}

export async function fetchMembers(orgId: string): Promise<OrganizationMember[]> {
  const res = await apiFetch(`/v1/organizations/${orgId}/members`);
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json() as Promise<OrganizationMember[]>;
}

export async function addMember(
  orgId: string,
  identifier: { email?: string; username?: string },
  role: MembershipRole,
): Promise<OrganizationMember> {
  const res = await apiFetch(`/v1/organizations/${orgId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identifier, role }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to add member' })) as { message?: string };
    throw new Error(error.message || 'Failed to add member');
  }
  return res.json() as Promise<OrganizationMember>;
}

export async function updateMemberRole(
  orgId: string,
  memberId: string,
  role: MembershipRole,
): Promise<void> {
  const res = await apiFetch(`/v1/organizations/${orgId}/members/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to update member role' })) as { message?: string };
    throw new Error(error.message || 'Failed to update member role');
  }
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  const res = await apiFetch(`/v1/organizations/${orgId}/members/${memberId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to remove member' })) as { message?: string };
    throw new Error(error.message || 'Failed to remove member');
  }
}

// Milestone 3 — API Keys

export async function fetchApiKeys(orgId: string): Promise<ApiKeyMetadata[]> {
  const res = await apiFetch(`/v1/organizations/${orgId}/api-keys`);
  if (!res.ok) throw new Error('Failed to fetch API keys');
  return res.json() as Promise<ApiKeyMetadata[]>;
}

export async function createApiKey(
  orgId: string,
  name: string,
  scopes: string[] = ['ingest'],
): Promise<CreatedApiKeyResponse> {
  const res = await apiFetch(`/v1/organizations/${orgId}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, scopes }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to create API key' })) as { message?: string };
    throw new Error(error.message || 'Failed to create API key');
  }
  return res.json() as Promise<CreatedApiKeyResponse>;
}

export async function revokeApiKey(orgId: string, keyId: string): Promise<ApiKeyMetadata> {
  const res = await apiFetch(`/v1/organizations/${orgId}/api-keys/${keyId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to revoke API key' })) as { message?: string };
    throw new Error(error.message || 'Failed to revoke API key');
  }
  return res.json() as Promise<ApiKeyMetadata>;
}

// Milestone 3 Phase 2 & 3 — Endpoints

export async function fetchEndpoints(orgId: string): Promise<EndpointMetadata[]> {
  const res = await apiFetch(`/v1/organizations/${orgId}/endpoints`);
  if (!res.ok) throw new Error('Failed to fetch endpoints');
  return res.json() as Promise<EndpointMetadata[]>;
}

export async function createEndpoint(
  orgId: string,
  name: string,
  slug?: string,
): Promise<CreatedEndpointResponse> {
  const res = await apiFetch(`/v1/organizations/${orgId}/endpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, slug: slug || undefined }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to create endpoint' })) as { message?: string };
    throw new Error(error.message || 'Failed to create endpoint');
  }
  return res.json() as Promise<CreatedEndpointResponse>;
}

// Milestone 3 Option 1 — Destinations & SSRF Registry

export async function fetchDestinations(orgId: string): Promise<DestinationMetadata[]> {
  const res = await apiFetch(`/v1/organizations/${orgId}/destinations`);
  if (!res.ok) throw new Error('Failed to fetch destinations');
  return res.json() as Promise<DestinationMetadata[]>;
}

export async function createDestination(
  orgId: string,
  name: string,
  url: string,
  options?: {
    httpMethod?: string;
    rateLimitPerSecond?: number;
    timeoutMs?: number;
    headers?: Record<string, string>;
  },
): Promise<DestinationMetadata> {
  const res = await apiFetch(`/v1/organizations/${orgId}/destinations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, ...options }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to create destination' })) as { message?: string };
    throw new Error(error.message || 'Failed to create destination');
  }
  return res.json() as Promise<DestinationMetadata>;
}

export async function updateDestination(
  orgId: string,
  destinationId: string,
  update: Partial<DestinationMetadata>,
): Promise<DestinationMetadata> {
  const res = await apiFetch(`/v1/organizations/${orgId}/destinations/${destinationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to update destination' })) as { message?: string };
    throw new Error(error.message || 'Failed to update destination');
  }
  return res.json() as Promise<DestinationMetadata>;
}

export async function deleteDestination(orgId: string, destinationId: string): Promise<void> {
  const res = await apiFetch(`/v1/organizations/${orgId}/destinations/${destinationId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to delete destination' })) as { message?: string };
    throw new Error(error.message || 'Failed to delete destination');
  }
}

export async function deleteEndpoint(orgId: string, endpointId: string): Promise<void> {
  const res = await apiFetch(`/v1/organizations/${orgId}/endpoints/${endpointId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to delete endpoint' })) as { message?: string };
    throw new Error(error.message || 'Failed to delete endpoint');
  }
}

export async function rotateEndpointSecret(orgId: string, endpointId: string): Promise<CreatedEndpointResponse> {
  const res = await apiFetch(`/v1/organizations/${orgId}/endpoints/${endpointId}/rotate-secret`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to rotate secret' })) as { message?: string };
    throw new Error(error.message || 'Failed to rotate secret');
  }
  return res.json() as Promise<CreatedEndpointResponse>;
}

// Milestone 3 Option 2 — Delivery Pipeline & Real-Time Attempts

export async function fetchDeliveries(
  orgId: string,
  filters?: { destinationId?: string; eventId?: string; status?: 'SUCCESS' | 'FAILED' },
): Promise<DeliveryAttemptMetadata[]> {
  const query = new URLSearchParams();
  if (filters?.destinationId) query.set('destinationId', filters.destinationId);
  if (filters?.eventId) query.set('eventId', filters.eventId);
  if (filters?.status) query.set('status', filters.status);
  const qs = query.toString();
  const res = await apiFetch(`/v1/organizations/${orgId}/deliveries${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch delivery attempts');
  return res.json() as Promise<DeliveryAttemptMetadata[]>;
}

export async function testDestinationPing(
  orgId: string,
  destinationId: string,
): Promise<DeliveryAttemptMetadata> {
  const res = await apiFetch(`/v1/organizations/${orgId}/destinations/${destinationId}/test`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to test destination' })) as { message?: string };
    throw new Error(err.message || 'Failed to test destination');
  }
  return res.json() as Promise<DeliveryAttemptMetadata>;
}

export async function replayDelivery(
  orgId: string,
  deliveryId: string,
): Promise<{ success: boolean; outboxMessageId: string; eventId: string; status: string }> {
  const res = await apiFetch(`/v1/organizations/${orgId}/deliveries/${deliveryId}/replay`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to replay delivery' })) as { message?: string };
    throw new Error(err.message || 'Failed to replay delivery');
  }
  return res.json() as Promise<{ success: boolean; outboxMessageId: string; eventId: string; status: string }>;
}

// Milestone 4: Sequential Workflow Engine API

export async function fetchWorkflows(orgId: string): Promise<WorkflowMetadata[]> {
  const res = await apiFetch(`/v1/organizations/${orgId}/workflows`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  return res.json() as Promise<WorkflowMetadata[]>;
}

export async function fetchWorkflow(orgId: string, workflowId: string): Promise<WorkflowMetadata> {
  const res = await apiFetch(`/v1/organizations/${orgId}/workflows/${workflowId}`);
  if (!res.ok) throw new Error('Failed to fetch workflow');
  return res.json() as Promise<WorkflowMetadata>;
}

export async function createWorkflow(
  orgId: string,
  data: { name: string; description?: string; endpointId?: string; definition?: unknown },
): Promise<WorkflowMetadata> {
  const res = await apiFetch(`/v1/organizations/${orgId}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create workflow' })) as { message?: string };
    throw new Error(err.message || 'Failed to create workflow');
  }
  return res.json() as Promise<WorkflowMetadata>;
}

export async function updateWorkflow(
  orgId: string,
  workflowId: string,
  data: { name?: string; description?: string; endpointId?: string; status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' },
): Promise<WorkflowMetadata> {
  const res = await apiFetch(`/v1/organizations/${orgId}/workflows/${workflowId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to update workflow' })) as { message?: string };
    throw new Error(err.message || 'Failed to update workflow');
  }
  return res.json() as Promise<WorkflowMetadata>;
}

export async function publishWorkflowVersion(
  orgId: string,
  workflowId: string,
  definition: unknown,
): Promise<{ success: boolean; versionNumber: number; definitionHash: string }> {
  const res = await apiFetch(`/v1/organizations/${orgId}/workflows/${workflowId}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to publish workflow version' })) as { message?: string };
    throw new Error(err.message || 'Failed to publish workflow version');
  }
  return res.json() as Promise<{ success: boolean; versionNumber: number; definitionHash: string }>;
}

export async function validateWorkflowDefinition(
  orgId: string,
  definition: unknown,
): Promise<{ valid: boolean; errors: string[]; definitionHash?: string }> {
  const res = await apiFetch(`/v1/organizations/${orgId}/workflows/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to validate workflow definition' })) as { message?: string };
    throw new Error(err.message || 'Failed to validate workflow definition');
  }
  return res.json() as Promise<{ valid: boolean; errors: string[]; definitionHash?: string }>;
}

export async function fetchExecutions(
  orgId: string,
  filters?: { workflowId?: string; status?: string },
): Promise<WorkflowExecutionMetadata[]> {
  const q = new URLSearchParams();
  if (filters?.workflowId) q.set('workflowId', filters.workflowId);
  if (filters?.status) q.set('status', filters.status);
  const qs = q.toString();
  const res = await apiFetch(`/v1/organizations/${orgId}/executions${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch workflow executions');
  return res.json() as Promise<WorkflowExecutionMetadata[]>;
}

export async function fetchExecution(
  orgId: string,
  executionId: string,
): Promise<WorkflowExecutionMetadata> {
  const res = await apiFetch(`/v1/organizations/${orgId}/executions/${executionId}`);
  if (!res.ok) throw new Error('Failed to fetch execution details');
  return res.json() as Promise<WorkflowExecutionMetadata>;
}

export async function resumeExecution(
  orgId: string,
  executionId: string,
): Promise<{ success: boolean; executionId: string; status: string; message: string }> {
  const res = await apiFetch(`/v1/organizations/${orgId}/executions/${executionId}/resume`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to resume execution' })) as { message?: string };
    throw new Error(err.message || 'Failed to resume execution');
  }
  return res.json() as Promise<{ success: boolean; executionId: string; status: string; message: string }>;
}
