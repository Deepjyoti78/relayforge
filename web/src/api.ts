import type { MembershipRole, OrganizationDetails, OrganizationMember, UserProfile } from './types.ts';

export async function fetchMe(): Promise<UserProfile | null> {
  const res = await fetch('/v1/me', { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to fetch user profile');
  return res.json() as Promise<UserProfile>;
}

export async function logout(): Promise<void> {
  const res = await fetch('/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to logout');
}

export async function createOrganization(name: string, slug?: string): Promise<OrganizationDetails> {
  const res = await fetch('/v1/organizations', {
    method: 'POST',
    credentials: 'include',
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
  const res = await fetch(`/v1/organizations/${orgId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch organization details');
  return res.json() as Promise<OrganizationDetails>;
}

export async function updateOrganization(orgId: string, name: string): Promise<OrganizationDetails> {
  const res = await fetch(`/v1/organizations/${orgId}`, {
    method: 'PATCH',
    credentials: 'include',
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
  const res = await fetch(`/v1/organizations/${orgId}/members`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json() as Promise<OrganizationMember[]>;
}

export async function addMember(
  orgId: string,
  identifier: { email?: string; username?: string },
  role: MembershipRole,
): Promise<OrganizationMember> {
  const res = await fetch(`/v1/organizations/${orgId}/members`, {
    method: 'POST',
    credentials: 'include',
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
  const res = await fetch(`/v1/organizations/${orgId}/members/${memberId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to update member role' })) as { message?: string };
    throw new Error(error.message || 'Failed to update member role');
  }
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  const res = await fetch(`/v1/organizations/${orgId}/members/${memberId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to remove member' })) as { message?: string };
    throw new Error(error.message || 'Failed to remove member');
  }
}
