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
