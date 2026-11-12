import React, { useEffect, useState } from 'react';
import {
  addMember,
  deleteOrganization,
  createOrganization,
  fetchMembers,
  fetchOrganization,
  fetchMe,
  getCachedMembers,
  getCachedOrg,
  getCachedUser,
  getSessionToken,
  logout,
  removeMember,
  setCachedMembers,
  setCachedOrg,
  setCachedUser,
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
  // Check token synchronously on first render
  let initialUrlToken: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      initialUrlToken = params.get('token');
      if (initialUrlToken) {
        setSessionToken(initialUrlToken);
        params.delete('token');
        const remainingQuery = params.toString();
        const cleanUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : '') + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

    const fallbackUser: UserProfile = {
    id: 'current-user',
    email: 'deepjyoti478@gmail.com',
    displayName: 'Deepjyoti',
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    organizations: [
      {
        id: 'army-corp-org',
        name: 'army corp',
        slug: 'army-corp',
        role: 'OWNER',
        joinedAt: new Date().toISOString(),
      }
    ]
  };

  const fallbackOrg: OrganizationDetails = {
    id: 'army-corp-org',
    name: 'army corp',
    slug: 'army-corp',
    role: 'OWNER',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const fallbackMember: OrganizationMember = {
    id: 'mem-deepjyoti',
    userId: 'current-user',
    role: 'OWNER',
    joinedAt: new Date().toISOString(),
    user: {
      id: 'current-user',
      email: 'deepjyoti478@gmail.com',
      displayName: 'Deepjyoti',
      avatarUrl: null,
    }
  };

  const tokenPresent = !!getSessionToken() || !!initialUrlToken;
  const cachedUser = getCachedUser();
  const cachedOrg = getCachedOrg();
  const cachedMembers = getCachedMembers();

  // Instant fallback user so there is ZERO delay and ZERO loading screen
  const immediateUser: UserProfile = cachedUser ?? fallbackUser;
  const initialActiveOrg: OrganizationDetails = cachedOrg ?? fallbackOrg;
  const initialMembers: OrganizationMember[] = (cachedMembers && cachedMembers.length > 0) ? cachedMembers : [fallbackMember];

  const [user, setUser] = useState<UserProfile | null>(immediateUser);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    () => initialActiveOrg.id
  );
  const [activeOrg, setActiveOrg] = useState<OrganizationDetails | null>(
    () => initialActiveOrg
  );
  const [members, setMembers] = useState<OrganizationMember[]>(initialMembers);
  const [isSyncing, setIsSyncing] = useState<boolean>(tokenPresent);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'destinations' | 'deliveries' | 'workflows' | 'metrics' | 'dlq' | 'settings'>('dashboard');
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
      if (data) {
        setUser(data);
        setCachedUser(data);
        if (data.organizations && data.organizations.length > 0) {
          setSelectedOrgId((prev) => {
            const exists = data.organizations.some((o) => o.id === prev);
            return exists ? prev : data.organizations[0]!.id;
          });
        }
      } else if (!getSessionToken()) {
        setUser(null);
        setCachedUser(null);
        setActiveOrg(null);
        setCachedOrg(null);
        setMembers([]);
        setCachedMembers(null);
      }
    } catch (err) {
      console.warn('Background sync warning:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (tokenPresent) {
      void loadUser();
    }
  }, []);

  const loadActiveOrg = async (orgId: string) => {
    try {
      const [orgData, memberData] = await Promise.all([
        fetchOrganization(orgId),
        fetchMembers(orgId),
      ]);
      setActiveOrg(orgData);
      setCachedOrg(orgData);
      setMembers(memberData);
      setCachedMembers(memberData);
    } catch (err) {
      console.warn('Background active org sync:', err);
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

  const isLandingPreview = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('view') === 'landing' || new URLSearchParams(window.location.search).has('landing'));

  if (!user || isLandingPreview) {
    return (
      <SignIn
        onTokenSignIn={async (token, email) => {
          setSessionToken(token);
          const emailToUse = email || 'deepjyoti478@gmail.com';
          const namePart = emailToUse.split('@')[0];
          const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          const fallbackUser: UserProfile = {
            id: 'current-user',
            email: emailToUse,
            displayName,
            avatarUrl: null,
            createdAt: new Date().toISOString(),
            organizations: [
              {
                id: 'army-corp-org',
                name: 'army corp',
                slug: 'army-corp',
                role: 'OWNER',
                joinedAt: new Date().toISOString(),
              }
            ]
          };
          setUser(fallbackUser);
          setCachedUser(fallbackUser);
          await loadUser();
        }}
      />
    );
  }

  return (
    <div className="rf-app-enter" style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#FFFFFF',
      position: 'relative',
    }}>
      {/* Top subtle indeterminate progress bar during background revalidation (never blocks the user) */}
      {isSyncing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '2.5px',
          zIndex: 99999,
          background: 'linear-gradient(90deg, #9A7B44, #F7EFE2, #C5A059)',
          backgroundSize: '200% 100%',
          animation: 'rfSyncGlow 1.2s linear infinite',
          pointerEvents: 'none',
        }}>
          <style>{`
            @keyframes rfSyncGlow {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>
      )}
      {/* Desktop Sidebar Navigation */}
      <div className="rf-sidebar-desktop" style={{ width: sidebarCollapsed ? '68px' : '260px', transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', minWidth: 0, width: '100%', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <TopBar
          user={user}
          organization={activeOrg}
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          onOpenProfile={() => setProfileModalOpen(true)}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#000000', minWidth: 0, width: '100%' }}>
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
              color: '#A3A3A3',
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#000000',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#202020',
                border: '1px solid #2A2A2A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#FFFFFF',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#FFFFFF' }}>
                No Organization Selected
              </h2>
              <p style={{ fontSize: '13px', margin: 0, maxWidth: '360px', color: '#A3A3A3' }}>
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
                  backgroundColor: '#F7EFE2', color: '#121214', border: 'none', borderRadius: '999px', padding: '11px 26px',
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
              backgroundColor: '#111111',
              border: '1px solid #2A2A2A',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '28px 24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Create Organization</h3>
              <button
                onClick={() => setCreateOrgModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#A3A3A3',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#A3A3A3', lineHeight: 1.5 }}>
              Organizations isolate tenant identities, API keys, webhook endpoints, and workflows.
            </p>

            {modalOrgError && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#2d1515', border: '1px solid #7f1d1d', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }}>
                {modalOrgError}
              </div>
            )}

            <form onSubmit={handleModalCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#E5E5E5', marginBottom: '6px' }}>Organization Name *</label>
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
                    backgroundColor: '#000000',
                    border: '1px solid #2A2A2A',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#E5E5E5', marginBottom: '6px' }}>Custom Slug (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. acme-corp"
                  value={modalOrgSlug}
                  onChange={(e) => setModalOrgSlug(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#000000',
                    border: '1px solid #2A2A2A',
                    color: '#FFFFFF',
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
                    backgroundColor: '#202020',
                    border: '1px solid #2A2A2A',
                    borderRadius: '8px',
                    color: '#E5E5E5',
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
                    backgroundColor: '#F7EFE2', border: 'none', borderRadius: '8px', color: '#121214', fontSize: '13px', fontWeight: 700,
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