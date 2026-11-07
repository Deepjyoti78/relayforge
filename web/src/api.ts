import type {
  ApiKeyMetadata,
  CreatedApiKeyResponse,
  MembershipRole,
  OrganizationDetails,
  OrganizationMember,
  UserProfile,
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
