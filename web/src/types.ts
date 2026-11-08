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
