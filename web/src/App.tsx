import React, { useEffect, useState } from 'react';
import {
  addMember,
  deleteOrganization,
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
import { ProfileModal } from './components/ProfileModal.tsx';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'destinations' | 'deliveries' | 'workflows' | 'metrics' | 'dlq' | 'settings'>('members');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [modalOrgName, setModalOrgName] = useState('');
  const [modalOrgSlug, setModalOrgSlug] = useState('');
  const [modalOrgLoading, setModalOrgLoading] = useState(false);
  const [modalOrgError, setModalOrgError] = useState<string | null>(null);

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
    await updateOrganization(selectedOrgId, name);
    await Promise.all([loadUser(), loadActiveOrg(selectedOrgId)]);
  };

  const handleAddMember = async (
    identifier: { email?: string; username?: string },
    role: MembershipRole,
  ) => {
    if (!selectedOrgId) return;
    await addMember(selectedOrgId, identifier, role);
    await loadActiveOrg(selectedOrgId);
  };

  const handleUpdateRole = async (memberId: string, role: MembershipRole) => {
    if (!selectedOrgId) return;
    await updateMemberRole(selectedOrgId, memberId, role);
    await loadActiveOrg(selectedOrgId);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedOrgId) return;
    await removeMember(selectedOrgId, memberId);
    await Promise.all([loadUser(), loadActiveOrg(selectedOrgId)]);
  };

  const handleDeleteOrg = async (orgId: string) => {
    await deleteOrganization(orgId);
    setSelectedOrgId(null);
    setActiveOrg(null);
    await loadUser();
  };

  const handleModalCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalOrgName.trim()) return;
    setModalOrgError(null);
    setModalOrgLoading(true);
    try {
      await handleCreateOrg(modalOrgName.trim(), modalOrgSlug.trim() || undefined);
      setModalOrgName('');
      setModalOrgSlug('');
      setCreateOrgModalOpen(false);
    } catch (err: unknown) {
      setModalOrgError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setModalOrgLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0E0E10',
        color: '#9A9AA6',
        fontSize: '14px',
        fontWeight: 500,
        gap: '12px',
      }}>
        <div style={{
          width: '18px',
          height: '18px',
          border: '2px solid #3E3E45',
          borderTopColor: '#F2F2F5',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}></div>
        <span>Initializing RelayForge Console...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <SignIn
        onTokenSignIn={async (token) => {
          setSessionToken(token);
          await loadUser();
        }}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#0E0E10',
      color: '#F2F2F5',
      position: 'relative',
    }}>
      {/* Desktop Sidebar Navigation */}
      <div className="rf-sidebar-desktop">
        <Sidebar
          user={user}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenCreateModal={() => setCreateOrgModalOpen(true)}
          onOpenProfile={() => setProfileModalOpen(true)}
          organizations={user.organizations}
          selectedOrgId={selectedOrgId}
          activeTab={activeTab}
          onSelectOrg={setSelectedOrgId}
          onCreateOrg={handleCreateOrg}
          onTabChange={setActiveTab}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <>
          <div
            className="rf-sidebar-mobile-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <Sidebar
            user={user}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onOpenCreateModal={() => setCreateOrgModalOpen(true)}
            onOpenProfile={() => setProfileModalOpen(true)}
            organizations={user.organizations}
            selectedOrgId={selectedOrgId}
            activeTab={activeTab}
            onSelectOrg={setSelectedOrgId}
            onCreateOrg={handleCreateOrg}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
            isMobile={true}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />
        </>
      )}

      {/* Main Layout Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', minWidth: 0 }}>
        <TopBar
          user={user}
          organization={activeOrg}
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          onOpenProfile={() => setProfileModalOpen(true)}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#0E0E10', minWidth: 0, width: '100%' }}>
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
              onDeleteOrg={handleDeleteOrg}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9A9AA6',
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#0E0E10',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#232327',
                border: '1px solid #3E3E45',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#F2F2F5',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#F2F2F5' }}>
                No Organization Selected
              </h2>
              <p style={{ fontSize: '13px', margin: 0, maxWidth: '360px', color: '#9A9AA6' }}>
                Create or select an organization from the sidebar to manage identity, roles, and API keys.
              </p>
              <button
                id="create-org-overview-btn"
                onClick={() => setCreateOrgModalOpen(true)}
                style={{
                  marginTop: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#F2F2F5',
                  color: '#0E0E10',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '11px 26px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255, 255, 255, 0.1)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                + Create Organization
              </button>
            </div>
          )}
        </main>
      </div>
      {/* Create Organization Modal */}
      {createOrgModalOpen && (
        <div
          onClick={() => setCreateOrgModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#18181B',
              border: '1px solid #3E3E45',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '28px 24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#F2F2F5' }}>Create Organization</h3>
              <button
                onClick={() => setCreateOrgModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9A9AA6',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#9A9AA6', lineHeight: 1.5 }}>
              Organizations isolate tenant identities, API keys, webhook endpoints, and workflows.
            </p>

            {modalOrgError && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#2d1515', border: '1px solid #7f1d1d', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }}>
                {modalOrgError}
              </div>
            )}

            <form onSubmit={handleModalCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#C9C9D2', marginBottom: '6px' }}>Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  value={modalOrgName}
                  onChange={(e) => setModalOrgName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0E0E10',
                    border: '1px solid #3E3E45',
                    color: '#F2F2F5',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#C9C9D2', marginBottom: '6px' }}>Custom Slug (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. acme-corp"
                  value={modalOrgSlug}
                  onChange={(e) => setModalOrgSlug(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0E0E10',
                    border: '1px solid #3E3E45',
                    color: '#F2F2F5',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setCreateOrgModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#232327',
                    border: '1px solid #3E3E45',
                    borderRadius: '8px',
                    color: '#C9C9D2',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalOrgLoading}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#F2F2F5',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#0E0E10',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {modalOrgLoading ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* User Profile Modal */}
      {user && (
        <ProfileModal
          user={user}
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};