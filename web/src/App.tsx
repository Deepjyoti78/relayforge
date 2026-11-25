import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  addMember,
  deleteOrganization,
  createOrganization,
  fetchMembers,
  fetchOrganization,
  fetchMe,
  logout,
  removeMember,
  setCachedMembers,
  setCachedOrg,
  setCachedUser,
  setSessionToken,
  updateMemberRole,
  updateOrganization,
} from './api.ts';
import { SessionLoading } from './components/SessionLoading.tsx';
import { OrganizationOnboardingModal } from './components/OrganizationOnboardingModal.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { SignIn } from './components/SignIn.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { MembershipRole, OrganizationDetails, OrganizationMember, UserProfile } from './types.ts';
import { dashboardPath, readDashboardLocation } from './auth-navigation.ts';
import type { DashboardTab } from './auth-navigation.ts';

const OrgManagement = lazy(() => import('./components/OrgManagement.tsx').then(module => ({ default: module.OrgManagement })));

export const App: React.FC = () => {
  const isLandingPreview = new URLSearchParams(window.location.search).get('view') === 'landing' || new URLSearchParams(window.location.search).has('landing');
  const lookupGeneration = useRef(0);
  const [authError, setAuthError] = useState<string | null>(null);
  // The server validates the HttpOnly session before rendering authenticated content.
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [activeOrg, setActiveOrg] = useState<OrganizationDetails | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => readDashboardLocation().tab);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => window.location.pathname === '/onboarding');
  const [modalOrgName, setModalOrgName] = useState('');
  const [modalOrgSlug, setModalOrgSlug] = useState('');
  const [modalOrgLoading, setModalOrgLoading] = useState(false);
  const [modalOrgError, setModalOrgError] = useState<string | null>(null);

  const loadUser = async () => {
    const generation = ++lookupGeneration.current;
    setIsSyncing(true);
    setAuthError(null);
    try {
      const data = await fetchMe();
      if (generation !== lookupGeneration.current) return;
      if (data) {
        setUser(data);
        setCachedUser(data);
        if (data.organizations && data.organizations.length > 0) {
          setSelectedOrgId((prev) => {
            const intended = readDashboardLocation().orgId ?? prev;
            return data.organizations.some((o) => o.id === intended) ? intended : data.organizations[0]!.id;
          });
        } else setSelectedOrgId(null);
      } else {
        // Token invalid, expired, or user not found
        setSessionToken(null);
        setUser(null);
        setCachedUser(null);
        setSelectedOrgId(null);
        setActiveOrg(null);
        setCachedOrg(null);
        setMembers([]);
        setCachedMembers(null);
      }
    } catch {
      if (generation !== lookupGeneration.current) return;
      // Unknown is not signed out. Never authorize an initial render from cache.
      setAuthError('Unable to verify your session. Please retry.');
    } finally {
      if (generation === lookupGeneration.current) setIsSyncing(false);
    }
  };

  useEffect(() => {
    void loadUser();
    return () => { lookupGeneration.current++; };
  }, []);

  useEffect(() => {
    if (user && !isSyncing && !authError && !isLandingPreview && !isOnboardingOpen) window.history.replaceState({}, '', dashboardPath(activeTab, selectedOrgId));
  }, [user, activeTab, selectedOrgId, isOnboardingOpen, isLandingPreview, isSyncing, authError]);

  useEffect(() => {
    const onNavigation = () => {
      setActiveTab(readDashboardLocation().tab);
      setIsOnboardingOpen(window.location.pathname === '/onboarding');
      void loadUser();
    };
    window.addEventListener('popstate', onNavigation);
    return () => window.removeEventListener('popstate', onNavigation);
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
    try {
      await logout();
    } catch {
      window.alert('Unable to sign out. Please try again.');
      return;
    }
    lookupGeneration.current++;
    window.history.replaceState({}, '', '/');
    setAuthError(null);
    setIsOnboardingOpen(false);
    setActiveTab('dashboard');
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

  const handleOnboardingComplete = async (orgData: {
    name: string;
    slug?: string;
    workloadType: string;
    architectureTier: string;
    estimatedVolume: string;
  }) => {
    if (!user) return;
    const newOrg = await createOrganization(orgData.name, orgData.slug);
    localStorage.setItem(`rf_workload_${newOrg.id}`, orgData.workloadType);
    localStorage.setItem(`rf_tier_${newOrg.id}`, orgData.architectureTier);
    localStorage.setItem(`rf_volume_${newOrg.id}`, orgData.estimatedVolume);
    await loadUser();
    setSelectedOrgId(newOrg.id);
    await loadActiveOrg(newOrg.id);
    setIsOnboardingOpen(false);
    setActiveTab('dashboard');
    window.history.replaceState({}, '', dashboardPath('dashboard', newOrg.id));
  };

  // Public content can render while the API wakes up. Protected routes still
  // require a verified HttpOnly session before rendering any account data.
  const isPublicLanding = window.location.pathname === '/' || isLandingPreview;
  if (!user && !isPublicLanding && (isSyncing || authError)) {
    return <SessionLoading error={authError} onRetry={() => { void loadUser(); }} />;
  }

  if (!user || isLandingPreview) {
    return (
      <SignIn
        sessionPending={isSyncing}
        sessionError={authError}
        onRetrySession={() => { void loadUser(); }}
        onTokenSignIn={async (token) => {
          setSessionToken(token);
          setIsSyncing(true);
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
      {authError && <div role="alert" style={{position:"fixed",top:0,left:0,right:0,zIndex:10000,padding:12,background:"var(--bg-card)",color:"var(--text-primary)",textAlign:"center"}}>{authError} <button type="button" disabled={isSyncing} onClick={() => { void loadUser(); }}>Retry</button></div>}
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

        <main data-active-tab={activeTab} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-main)', minWidth: 0, width: '100%', transition: 'background-color 0.2s ease' }}>
          {activeOrg ? (
            <Suspense fallback={<p role="status" style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading your dashboard…</p>}>
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
            </Suspense>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-main)',
            }}>
              <div style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-main)',
                borderRadius: '16px',
                padding: '40px 32px',
                maxWidth: '440px',
                width: '100%',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  color: 'var(--text-primary)',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                  No Organization Selected
                </h2>
                <p style={{ fontSize: '13px', margin: 0, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Create or select an organization from the sidebar to manage identity, roles, and API keys.
                </p>
                <button
                  id="create-org-overview-btn"
                  onClick={() => setCreateOrgModalOpen(true)}
                  style={{
                    marginTop: '24px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-foreground)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 22px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-card)',
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  + Create Organization
                </button>
              </div>
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
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
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
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '28px 24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Organization</h3>
              <button
                onClick={() => setCreateOrgModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Organizations isolate tenant identities, API keys, webhook endpoints, and workflows.
            </p>

            {modalOrgError && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #DC2626', color: '#DC2626', fontSize: '12px', marginBottom: '16px' }}>
                {modalOrgError}
              </div>
            )}

            <form onSubmit={handleModalCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Organization Name *</label>
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
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-main)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Custom Slug (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. acme-corp"
                  value={modalOrgSlug}
                  onChange={(e) => setModalOrgSlug(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-main)',
                    color: 'var(--text-primary)',
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
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-main)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
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
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--accent-foreground)',
                    fontSize: '13px',
                    fontWeight: 600,
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

      {/* Organization Onboarding Modal */}
      {user && (
        <OrganizationOnboardingModal
          isOpen={isOnboardingOpen}
          userDisplayName={user.displayName}
          userEmail={user.email}
          onComplete={handleOnboardingComplete}
          onSkip={() => {
            setIsOnboardingOpen(false);
            window.history.replaceState({}, '', dashboardPath(activeTab, selectedOrgId));
          }}
        />
      )}
    </div>
  );
};
