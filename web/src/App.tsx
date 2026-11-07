import React, { useEffect, useState } from 'react';
import {
  addMember,
  createOrganization,
  fetchMembers,
  fetchOrganization,
  fetchMe,
  logout,
  removeMember,
  updateMemberRole,
  updateOrganization,
} from './api.ts';
import { OrgManagement } from './components/OrgManagement.tsx';
import { OrgSelector } from './components/OrgSelector.tsx';
import { SignIn } from './components/SignIn.tsx';
import { UserProfileBar } from './components/UserProfile.tsx';
import type { MembershipRole, OrganizationDetails, OrganizationMember, UserProfile } from './types.ts';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [activeOrg, setActiveOrg] = useState<OrganizationDetails | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);

  const loadUser = async () => {
    try {
      const data = await fetchMe();
      setUser(data);
      if (data && data.organizations.length > 0) {
        setSelectedOrgId((prev) => prev ?? data.organizations[0]!.id);
      }
    } catch (err) {
      console.error('Failed to load user', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUser();
  }, []);

  const loadActiveOrg = async (orgId: string) => {
    try {
      const [orgData, memberData] = await Promise.all([
        fetchOrganization(orgId),
        fetchMembers(orgId),
      ]);
      setActiveOrg(orgData);
      setMembers(memberData);
    } catch (err) {
      console.error('Failed to load organization', err);
      setActiveOrg(null);
      setMembers([]);
    }
  };

  useEffect(() => {
    if (selectedOrgId) {
      void loadActiveOrg(selectedOrgId);
    } else {
      setActiveOrg(null);
      setMembers([]);
    }
  }, [selectedOrgId]);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setSelectedOrgId(null);
    setActiveOrg(null);
    setMembers([]);
  };

  const handleCreateOrg = async (name: string, slug?: string) => {
    const newOrg = await createOrganization(name, slug);
    await loadUser();
    setSelectedOrgId(newOrg.id);
  };

  const handleUpdateOrgName = async (name: string) => {
    if (!selectedOrgId) return;
    const updated = await updateOrganization(selectedOrgId, name);
    setActiveOrg(updated);
    await loadUser();
  };

  const handleAddMember = async (identifier: { email?: string; username?: string }, role: MembershipRole) => {
    if (!selectedOrgId) return;
    await addMember(selectedOrgId, identifier, role);
    const updatedMembers = await fetchMembers(selectedOrgId);
    setMembers(updatedMembers);
  };

  const handleUpdateRole = async (memberId: string, role: MembershipRole) => {
    if (!selectedOrgId) return;
    await updateMemberRole(selectedOrgId, memberId, role);
    const updatedMembers = await fetchMembers(selectedOrgId);
    setMembers(updatedMembers);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedOrgId) return;
    await removeMember(selectedOrgId, memberId);
    await loadUser();
    if (selectedOrgId) {
      const updatedMembers = await fetchMembers(selectedOrgId);
      setMembers(updatedMembers);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: '#64748b',
        fontSize: '14px',
        fontWeight: 500,
      }}>
        Initializing RelayForge...
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <UserProfileBar user={user} onLogout={handleLogout} />
      <div style={{ display: 'flex', flex: 1 }}>
        <OrgSelector
          organizations={user.organizations}
          selectedOrgId={selectedOrgId}
          onSelectOrg={setSelectedOrgId}
          onCreateOrg={handleCreateOrg}
        />
        {activeOrg ? (
          <OrgManagement
            organization={activeOrg}
            members={members}
            currentUserId={user.id}
            onUpdateOrgName={handleUpdateOrgName}
            onAddMember={handleAddMember}
            onUpdateRole={handleUpdateRole}
            onRemoveMember={handleRemoveMember}
          />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontSize: '14px',
          }}>
            Select or create an organization from the sidebar to manage identity and tenancy.
          </div>
        )}
      </div>
    </div>
  );
};
