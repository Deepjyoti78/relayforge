import React, { useState } from 'react';
import type { UserOrganization, UserProfile } from '../types.ts';

interface SidebarProps {
  user: UserProfile;
  organizations: UserOrganization[];
  selectedOrgId: string | null;
  activeTab: string;
  onSelectOrg: (orgId: string) => void;
  onCreateOrg: (name: string, slug?: string) => Promise<void>;
  onTabChange: (tab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'destinations' | 'deliveries' | 'workflows' | 'metrics' | 'dlq' | 'settings') => void;
  onLogout: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenCreateModal?: () => void;
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  organizations,
  selectedOrgId,
  activeTab,
  onSelectOrg,
  onCreateOrg,
  onTabChange,
  onLogout,
  isMobile = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
  onOpenCreateModal,
  onOpenProfile,
}) => {
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isCollapsedMode = isCollapsed && !isMobile;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreateError(null);
    setCreateLoading(true);
    try {
      await onCreateOrg(newOrgName.trim(), newOrgSlug.trim() || undefined);
      setNewOrgName('');
      setNewOrgSlug('');
      setIsCreatingOrg(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleTabClick = (tab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'destinations' | 'deliveries' | 'workflows' | 'metrics' | 'dlq' | 'settings') => {
    onTabChange(tab);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleOrgClick = (orgId: string) => {
    onSelectOrg(orgId);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'RF';
  };

  const getNavItemStyle = (tab: string) => {
    const isActive = activeTab === tab;
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: isCollapsedMode ? 'center' : 'flex-start',
      gap: isCollapsedMode ? '0' : '12px',
      width: isCollapsedMode ? '42px' : '100%',
      height: isCollapsedMode ? '42px' : 'auto',
      padding: isCollapsedMode ? '0' : '9px 14px',
      borderRadius: isCollapsedMode ? '12px' : '999px',
      fontSize: '13px',
      fontWeight: isActive ? 700 : 500,
      backgroundColor: isActive ? '#F7EFE2' : 'transparent',
      color: isActive ? '#121214' : '#9A9AA6',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left' as const,
      transition: 'all 0.15s ease',
      boxShadow: isActive ? '0 2px 10px rgba(0, 0, 0, 0.25)' : 'none',
      margin: isCollapsedMode ? '0 auto' : '0',
      flexShrink: 0,
      position: 'relative' as const,
    };
  };

  const getBadgeStyle = (tab: string) => {
    const isActive = activeTab === tab;
    return {
      fontSize: '10px',
      fontWeight: 700,
      backgroundColor: isActive ? '#E5DAC8' : '#202028',
      color: isActive ? '#121214' : '#8E8E9B',
      padding: '2px 7px',
      borderRadius: '999px',
      border: isActive ? '1px solid #D8CBB6' : '1px solid #2E2E38',
    };
  };

  const sidebarContent = (
    <aside style={{
      width: isMobile ? '280px' : (isCollapsed ? '68px' : '260px'),
      backgroundColor: '#141419',
      borderRight: '1px solid #202028',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0,
      position: isMobile ? 'fixed' : 'relative',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: isMobile ? 100 : 1,
      boxShadow: isMobile ? '0 0 35px rgba(0, 0, 0, 0.7)' : 'none',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
    }}>
      {/* Brand Header */}
      <div style={{
        padding: isCollapsedMode ? '18px 0 12px' : '20px 20px 16px',
        borderBottom: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsedMode ? 'center' : 'space-between',
        flexDirection: isCollapsedMode ? 'column' : 'row',
        gap: isCollapsedMode ? '10px' : '0',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: '1px solid #E5DAC8',
            backgroundColor: '#F7EFE2',
            color: '#121214',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          {!isCollapsedMode && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#F2F2F5', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
                RELAYFORGE
              </div>
              <div style={{ fontSize: '11px', color: '#9A9AA6', fontWeight: 500 }}>
                Management Console
              </div>
            </div>
          )}
        </div>

        {!isMobile && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: '#1A1A22',
              border: '1px solid #282834',
              color: '#9A9AA6',
              borderRadius: '8px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.15s ease',
              padding: 0,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F2F2F5';
              e.currentTarget.style.borderColor = '#4A4A58';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9A9AA6';
              e.currentTarget.style.borderColor = '#282834';
            }}
          >
            {isCollapsed ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7"></polyline>
                <polyline points="18 17 13 12 18 7"></polyline>
              </svg>
            )}
          </button>
        )}

        {isMobile && (
          <button
            onClick={onCloseMobile}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9A9AA6',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isCollapsedMode ? '10px 0' : '14px 12px', width: '100%', boxSizing: 'border-box' }}>
        {/* Section: MAIN MENU */}
        <div style={{ marginBottom: '20px' }}>
          {!isCollapsedMode ? (
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#63636E',
              textTransform: 'uppercase',
              padding: '0 10px 10px',
            }}>
              Main
            </div>
          ) : (
            <div style={{ height: '1px', backgroundColor: '#202028', margin: '4px 14px 12px' }} />
          )}

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Overview / Dashboard */}
            <button
              onClick={() => handleTabClick('dashboard')}
              style={getNavItemStyle('dashboard')}
              title="Overview"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              {!isCollapsedMode && <span>Overview</span>}
            </button>

            {/* Members Directory */}
            <button
              onClick={() => handleTabClick('members')}
              style={getNavItemStyle('members')}
              title="Members Directory"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              {!isCollapsedMode && <span>Members Directory</span>}
            </button>

            {/* API Keys */}
            <button
              onClick={() => handleTabClick('api-keys')}
              style={{
                ...getNavItemStyle('api-keys'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="API Keys"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5-3 3 1.5 1.5L9 14l-5 5H2v-2l5-5 1.5 1.5 3-3-1.5-1.5 3.5-3.5 1.5 1.5L21 2z"></path>
                </svg>
                {!isCollapsedMode && <span>API Keys</span>}
              </div>
              {!isCollapsedMode && (
                <span style={getBadgeStyle('api-keys')}>
                  M3
                </span>
              )}
            </button>

            {/* Ingestion Endpoints */}
            <button
              onClick={() => handleTabClick('endpoints')}
              style={getNavItemStyle('endpoints')}
              title="Ingestion Endpoints"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              {!isCollapsedMode && <span>Ingestion Endpoints</span>}
            </button>

            {/* Destinations & SSRF Registry (Milestone 3 Option 1) */}
            <button
              onClick={() => handleTabClick('destinations')}
              style={{
                ...getNavItemStyle('destinations'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Destinations"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="22" y1="12" x2="18" y2="12"></line>
                  <line x1="6" y1="12" x2="2" y2="12"></line>
                  <line x1="12" y1="6" x2="12" y2="2"></line>
                  <line x1="12" y1="22" x2="12" y2="18"></line>
                </svg>
                {!isCollapsedMode && <span>Destinations</span>}
              </div>
              {!isCollapsedMode && (
                <span style={getBadgeStyle('destinations')}>
                  M3
                </span>
              )}
            </button>

            {/* Deliveries & Outbox Pipeline (Milestone 3 Option 2) */}
            <button
              onClick={() => handleTabClick('deliveries')}
              style={{
                ...getNavItemStyle('deliveries'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Delivery History"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                {!isCollapsedMode && <span>Delivery History</span>}
              </div>
              {!isCollapsedMode && (
                <span style={getBadgeStyle('deliveries')}>
                  M3
                </span>
              )}
            </button>

            {/* Sequential Workflows Engine (Milestone 4) */}
            <button
              onClick={() => handleTabClick('workflows')}
              style={{
                ...getNavItemStyle('workflows'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Workflows"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <rect x="3" y="3" width="6" height="6" rx="1"></rect>
                  <rect x="15" y="15" width="6" height="6" rx="1"></rect>
                  <path d="M6 9v3a3 3 0 0 0 3 3h6"></path>
                  <polyline points="15 12 18 15 15 18"></polyline>
                </svg>
                {!isCollapsedMode && <span>Workflows</span>}
              </div>
              {!isCollapsedMode && (
                <span style={getBadgeStyle('workflows')}>
                  M4
                </span>
              )}
            </button>

            {/* Metrics (M5) */}
            <button
              onClick={() => handleTabClick('metrics')}
              style={{
                ...getNavItemStyle('metrics'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Metrics & Streams"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M18 20V10"></path>
                  <path d="M12 20V4"></path>
                  <path d="M6 20v-6"></path>
                </svg>
                {!isCollapsedMode && <span>Metrics & Streams</span>}
              </div>
              {!isCollapsedMode && (
                <span style={getBadgeStyle('metrics')}>
                  M5
                </span>
              )}
            </button>

            {/* Dead Letter Queue (M5) */}
            <button
              onClick={() => handleTabClick('dlq')}
              style={{
                ...getNavItemStyle('dlq'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Dead Letter Queue"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                </svg>
                {!isCollapsedMode && <span>Dead Letter Queue</span>}
              </div>
              {!isCollapsedMode && (
                <span style={getBadgeStyle('dlq')}>
                  M5
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Section: ORGANIZATIONS */}
        <div style={{ marginBottom: '20px' }}>
          {!isCollapsedMode ? (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 10px 10px',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#63636E',
                textTransform: 'uppercase',
              }}>
                ORGANIZATIONS
              </span>
              <button
                onClick={() => (onOpenCreateModal ? onOpenCreateModal() : setIsCreatingOrg((prev) => !prev))}
                style={{
                  backgroundColor: '#1C1C24',
                  border: '1px solid #282834',
                  color: '#F2F2F5',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '999px',
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                + New
              </button>
            </div>
          ) : (
            <div style={{ height: '1px', backgroundColor: '#202028', margin: '4px 14px 12px' }} />
          )}

          {/* Quick Create Organization Form (Only expanded) */}
          {!isCollapsedMode && isCreatingOrg && (
            <form onSubmit={handleCreateSubmit} style={{
              padding: '12px',
              backgroundColor: '#1A1A22',
              borderRadius: '12px',
              border: '1px solid #2E2E3C',
              marginBottom: '10px',
            }}>
              <input
                type="text"
                placeholder="Organization Name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #3E3E45',
                  backgroundColor: '#0E0E10',
                  color: '#F2F2F5',
                  fontSize: '12px',
                  marginBottom: '6px',
                }}
              />
              <input
                type="text"
                placeholder="Slug (optional)"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #3E3E45',
                  backgroundColor: '#0E0E10',
                  color: '#F2F2F5',
                  fontSize: '12px',
                  marginBottom: '8px',
                }}
              />
              {createError && (
                <div style={{ color: '#f87171', fontSize: '11px', marginBottom: '6px' }}>
                  {createError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreatingOrg(false)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    backgroundColor: 'transparent',
                    border: '1px solid #3E3E45',
                    color: '#9A9AA6',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    padding: '4px 12px',
                    fontSize: '11px',
                    backgroundColor: '#F2F2F5',
                    color: '#0E0E10',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  {createLoading ? '...' : 'Create'}
                </button>
              </div>
            </form>
          )}

          {/* Organization list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {organizations.length === 0 ? (
              !isCollapsedMode ? (
                <div style={{ padding: '8px 10px', fontSize: '12px', color: '#63636E' }}>
                  No organizations yet.
                </div>
              ) : null
            ) : (
              organizations.map((org) => {
                const isSelected = org.id === selectedOrgId;
                if (isCollapsedMode) {
                  return (
                    <button
                      key={org.id}
                      onClick={() => handleOrgClick(org.id)}
                      title={`${org.name} (${org.role})`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        backgroundColor: isSelected ? '#1E1E28' : 'transparent',
                        border: isSelected ? '1px solid #363648' : '1px solid transparent',
                        color: isSelected ? '#D4AF78' : '#8E8E9B',
                        cursor: 'pointer',
                        margin: '0 auto',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                      </svg>
                    </button>
                  );
                }

                return (
                  <button
                    key={org.id}
                    onClick={() => handleOrgClick(org.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      backgroundColor: isSelected ? '#191922' : 'transparent',
                      color: '#F4F4F7',
                      border: isSelected ? '1px solid #2B2B38' : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 10px rgba(0,0,0,0.35)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ color: isSelected ? '#D4AF78' : '#63636E', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                          <polyline points="2 17 12 22 22 17"></polyline>
                          <polyline points="2 12 12 17 22 12"></polyline>
                        </svg>
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#F4F4F7', fontSize: '13px', lineHeight: 1.2 }}>{org.name}</div>
                        <div style={{ fontSize: '11px', color: '#63636E', fontWeight: 400, marginTop: '2px' }}>
                          {org.slug}.rlf
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: '#202028',
                        color: '#C9C9D2',
                        padding: '2px 7px',
                        borderRadius: '999px',
                        border: '1px solid #2E2E38',
                      }}>
                        {org.role}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#63636E" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Section: ADMINISTRATION */}
        <div>
          {!isCollapsedMode ? (
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#63636E',
              textTransform: 'uppercase',
              padding: '0 10px 10px',
            }}>
              Administration
            </div>
          ) : (
            <div style={{ height: '1px', backgroundColor: '#202028', margin: '4px 14px 12px' }} />
          )}

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => handleTabClick('settings')}
              style={getNavItemStyle('settings')}
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              {!isCollapsedMode && <span>Settings</span>}
            </button>
          </nav>
        </div>
      </div>

      {/* User Footer Profile & Logout */}
      <div style={{
        padding: isCollapsedMode ? '14px 0' : '14px 16px',
        borderTop: '1px solid #202028',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsedMode ? 'center' : 'space-between',
        backgroundColor: '#141419',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {isCollapsedMode ? (
          <div
            onClick={onOpenProfile}
            title={`${user.displayName || 'Developer'} (${user.email || 'developer@relayforge'})`}
            style={{
              cursor: onOpenProfile ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #3E3E45' }}
              />
            ) : (
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#202028',
                border: '1px solid #3E3E45',
                color: '#F2F2F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
              }}>
                {getInitials(user.displayName, user.email)}
              </div>
            )}
          </div>
        ) : (
          <>
            <div
              onClick={onOpenProfile}
              title="View profile details"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                overflow: 'hidden',
                cursor: onOpenProfile ? 'pointer' : 'default',
                padding: '4px 6px',
                borderRadius: '8px',
                transition: 'background-color 0.15s ease',
                flex: 1,
                minWidth: 0,
              }}
              onMouseEnter={(e) => {
                if (onOpenProfile) e.currentTarget.style.backgroundColor = '#1C1C24';
              }}
              onMouseLeave={(e) => {
                if (onOpenProfile) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #3E3E45', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#202028',
                  border: '1px solid #3E3E45',
                  color: '#F2F2F5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {getInitials(user.displayName, user.email)}
                </div>
              )}
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#F2F2F5', lineHeight: '1.2' }}>
                  {user.displayName || 'Developer'}
                </div>
                <div style={{ fontSize: '11px', color: '#9A9AA6', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email || 'developer@relayforge'}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign out"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9A9AA6',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </>
        )}
      </div>
    </aside>
  );

  return sidebarContent;
};
