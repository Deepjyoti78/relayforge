import React, { useEffect, useState } from 'react';
import {
  addMember,
  createOrganization,
  fetchMembers,
  fetchOrganization,
  fetchMe,
  logout,
  removeMember,
  setSessionToken,
  updateMemberRole,
  updateOrganization,
} from './api.ts';
import { OrgManagement } from './components/OrgManagement.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { SignIn } from './components/SignIn.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { MembershipRole, OrganizationDetails, OrganizationMember, UserProfile } from './types.ts';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [activeOrg, setActiveOrg] = useState<OrganizationDetails | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'settings'>('members');

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
    // Check if returned from OAuth redirect with ?token=...
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        setSessionToken(urlToken);
        params.delete('token');
        const remainingQuery = params.toString();
        const cleanUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : '') + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch {
      // Ignore URL parsing errors
    }

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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        color: '#64748b',
        fontSize: '14px',
        fontWeight: 600,
        gap: '12px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <span>Initializing RelayForge Console...</span>
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      {/* Monochromatic Left Sidebar */}
      <Sidebar
        user={user}
        organizations={user.organizations}
        selectedOrgId={selectedOrgId}
        activeTab={activeTab}
        onSelectOrg={setSelectedOrgId}
        onCreateOrg={handleCreateOrg}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      {/* Main Layout Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar
          user={user}
          organization={activeOrg}
          activeTab={activeTab}
          onLogout={handleLogout}
        />

        <main style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>
          {activeOrg ? (
            <OrgManagement
              organization={activeOrg}
              members={members}
              currentUserId={user.id}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onUpdateOrgName={handleUpdateOrgName}
              onAddMember={handleAddMember}
              onUpdateRole={handleUpdateRole}
              onRemoveMember={handleRemoveMember}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              padding: '40px',
              textAlign: 'center',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#0f172a',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
                No Organization Selected
              </h2>
              <p style={{ fontSize: '13px', margin: 0, maxWidth: '360px', color: '#64748b' }}>
                Create or select an organization from the sidebar to manage identity, roles, and API keys.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
