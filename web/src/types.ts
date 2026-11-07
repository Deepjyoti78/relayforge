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
