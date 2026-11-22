import React, { useEffect, useRef, useState } from 'react';
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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

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
      gap: isCollapsedMode ? '0' : '10px',
      width: isCollapsedMode ? '36px' : '100%',
      height: isCollapsedMode ? '36px' : 'auto',
      padding: isCollapsedMode ? '0' : '8px 12px',
      borderRadius: '8px',
      fontSize: '12.5px',
      fontWeight: isActive ? 600 : 500,
      backgroundColor: isActive ? '#FFFFFF' : 'transparent',
      color: isActive ? '#09090B' : '#52525B',
      border: isActive ? '1px solid #E5E7EB' : '1px solid transparent',
      cursor: 'pointer',
      textAlign: 'left' as const,
      transition: 'all 0.15s ease',
      boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
      margin: isCollapsedMode ? '0 auto' : '0',
      flexShrink: 0,
      position: 'relative' as const,
      fontFamily: "'JetBrains Mono', monospace",
    };
  };

  const getBadgeStyle = (tab: string) => {
    const isActive = activeTab === tab;
    return {
      fontSize: '9.5px',
      fontWeight: 700,
      backgroundColor: isActive ? '#F4F4F6' : '#EAEAEB',
      color: isActive ? '#09090B' : '#71717A',
      padding: '2px 6px',
      borderRadius: '6px',
      border: '1px solid #E5E7EB',
      fontFamily: "'JetBrains Mono', monospace",
    };
  };

  const sidebarContent = (
    <aside style={{
      width: isMobile ? '280px' : (isCollapsed ? '68px' : '260px'),
      backgroundColor: '#F4F4F6',
      borderRight: '1px solid #E5E7EB',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0,
      position: isMobile ? 'fixed' : 'relative',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: isMobile ? 100 : 1,
      boxShadow: isMobile ? '0 0 30px rgba(0, 0, 0, 0.15)' : 'none',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'visible',
    }}>
      {/* Brand Header */}
      <div style={{
        padding: isCollapsedMode ? '16px 0 12px' : '18px 16px 14px',
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
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            border: '1px solid #09090B',
            backgroundColor: '#09090B',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          {!isCollapsedMode && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#09090B', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
                RELAYFORGE
              </div>
              <div style={{ fontSize: '11px', color: '#71717A', fontWeight: 500 }}>
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
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              color: '#71717A',
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
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#09090B';
              e.currentTarget.style.borderColor = '#D1D5DB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#71717A';
              e.currentTarget.style.borderColor = '#E5E7EB';
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
              color: '#71717A',
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
      <div style={{ flex: 1, overflowY: 'auto', padding: isCollapsedMode ? '8px 0' : '10px 12px', width: '100%', boxSizing: 'border-box' }}>
        {/* Section: MAIN MENU */}
        <div style={{ marginBottom: '18px' }}>
          {!isCollapsedMode ? (
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#71717A',
              textTransform: 'uppercase',
              padding: '0 8px 8px',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Main
            </div>
          ) : (
            <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 14px 10px' }} />
          )}

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Overview / Dashboard */}
            <button
              onClick={() => handleTabClick('dashboard')}
              className={`rf-nav-item ${activeTab === 'dashboard' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
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
              className={`rf-nav-item ${activeTab === 'members' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
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
              className={`rf-nav-item ${activeTab === 'api-keys' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
              style={{
                ...getNavItemStyle('api-keys'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="API Keys"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              className={`rf-nav-item ${activeTab === 'endpoints' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
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
              className={`rf-nav-item ${activeTab === 'destinations' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
              style={{
                ...getNavItemStyle('destinations'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Destinations"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              className={`rf-nav-item ${activeTab === 'deliveries' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
              style={{
                ...getNavItemStyle('deliveries'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Delivery History"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              className={`rf-nav-item ${activeTab === 'workflows' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
              style={{
                ...getNavItemStyle('workflows'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Workflows"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              className={`rf-nav-item ${activeTab === 'metrics' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
              style={{
                ...getNavItemStyle('metrics'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Metrics & Streams"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              className={`rf-nav-item ${activeTab === 'dlq' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
              style={{
                ...getNavItemStyle('dlq'),
                justifyContent: isCollapsedMode ? 'center' : 'space-between',
              }}
              title="Dead Letter Queue"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        <div style={{ marginBottom: '18px' }}>
          {!isCollapsedMode ? (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 8px 8px',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#71717A',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                ORGANIZATIONS
              </span>
              <button
                onClick={() => (onOpenCreateModal ? onOpenCreateModal() : setIsCreatingOrg((prev) => !prev))}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  color: '#09090B',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  padding: '2px 7px',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                }}
              >
                + New
              </button>
            </div>
          ) : (
            <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 14px 10px' }} />
          )}

          {/* Quick Create Organization Form (Only expanded) */}
          {!isCollapsedMode && isCreatingOrg && (
            <form onSubmit={handleCreateSubmit} style={{
              padding: '12px',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E5E7EB',
              marginBottom: '10px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
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
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F8F9FA',
                  color: '#09090B',
                  fontSize: '12px',
                  marginBottom: '6px',
                  boxSizing: 'border-box',
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
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F8F9FA',
                  color: '#09090B',
                  fontSize: '12px',
                  marginBottom: '8px',
                  boxSizing: 'border-box',
                }}
              />
              {createError && (
                <div style={{ color: '#DC2626', fontSize: '11px', marginBottom: '6px' }}>
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
                    border: '1px solid #E5E7EB',
                    color: '#71717A',
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
                    backgroundColor: '#09090B',
                    color: '#FFFFFF',
                    fontWeight: 600,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {organizations.length === 0 ? (
              !isCollapsedMode ? (
                <div style={{ padding: '6px 8px', fontSize: '12px', color: '#71717A', fontFamily: "'JetBrains Mono', monospace" }}>
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
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                        border: isSelected ? '1px solid #E5E7EB' : '1px solid transparent',
                        color: isSelected ? '#09090B' : '#71717A',
                        cursor: 'pointer',
                        margin: '0 auto',
                        boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                      color: '#09090B',
                      border: isSelected ? '1px solid #E5E7EB' : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{ color: isSelected ? '#09090B' : '#71717A', flexShrink: 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                          <polyline points="2 17 12 22 22 17"></polyline>
                          <polyline points="2 12 12 17 22 12"></polyline>
                        </svg>
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#09090B', fontSize: '12.5px', lineHeight: 1.2 }}>{org.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#71717A', fontWeight: 400, marginTop: '1px' }}>
                          {org.slug}.rlf
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '9.5px',
                        fontWeight: 600,
                        backgroundColor: '#F4F4F6',
                        color: '#52525B',
                        padding: '1.5px 6px',
                        borderRadius: '4px',
                        border: '1px solid #E5E7EB',
                      }}>
                        {org.role}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2.5">
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
              color: '#71717A',
              textTransform: 'uppercase',
              padding: '0 8px 8px',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Administration
            </div>
          ) : (
            <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 14px 10px' }} />
          )}

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => handleTabClick('settings')}
              className={`rf-nav-item ${activeTab === 'settings' ? "rf-nav-item-active" : ""} ${isCollapsedMode ? "rf-nav-collapsed" : ""}`}
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

      {/* User Footer Profile & Popover (NavUser style matching D2) */}
      <div
        ref={profileMenuRef}
        style={{
          padding: isCollapsedMode ? '10px 0' : '10px 12px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsedMode ? 'center' : 'space-between',
          backgroundColor: '#F4F4F6',
          width: '100%',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Upward Opening Popover Menu (Matching D2 NavUser in Image 10) */}
        {isProfileMenuOpen && (
          <div
            className="rf-modal-animate"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: isCollapsedMode ? '64px' : '10px',
              width: isCollapsedMode ? '230px' : 'calc(100% - 20px)',
              minWidth: '220px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              padding: '6px',
              zIndex: 100,
            }}
          >
            {/* Popover Header with User Details */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
            }}>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #E5E7EB', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#EAEAEB',
                  border: '1px solid #E5E7EB',
                  color: '#09090B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {getInitials(user.displayName, user.email)}
                </div>
              )}
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#09090B', lineHeight: '1.2' }}>
                  {user.displayName || 'Deepjyoti'}
                </div>
                <div style={{ fontSize: '11px', color: '#71717A', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email || 'developer@relayforge.dev'}
                </div>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }} />

            {/* Menu Action: Profile */}
            <button
              onClick={() => {
                setIsProfileMenuOpen(false);
                if (onOpenProfile) onOpenProfile();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#09090B',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F4F4F6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>Profile</span>
            </button>

            {/* Menu Action: Notifications */}
            <button
              onClick={() => {
                setIsProfileMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#09090B',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F4F4F6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span>Notifications</span>
            </button>

            <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '4px 0' }} />

            {/* Menu Action: Sign out */}
            <button
              onClick={() => {
                setIsProfileMenuOpen(false);
                onLogout();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        )}

        {/* User Account Trigger Button */}
        {isCollapsedMode ? (
          <div
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            title={`${user.displayName || 'Developer'} (${user.email || 'developer@relayforge'})`}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #E5E7EB' }}
              />
            ) : (
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: isProfileMenuOpen ? '#FFFFFF' : '#EAEAEB',
                border: '1px solid #E5E7EB',
                color: '#09090B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: isProfileMenuOpen ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                {getInitials(user.displayName, user.email)}
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            title="Account Menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: '8px',
              backgroundColor: isProfileMenuOpen ? '#FFFFFF' : 'transparent',
              border: isProfileMenuOpen ? '1px solid #E5E7EB' : '1px solid transparent',
              boxShadow: isProfileMenuOpen ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isProfileMenuOpen) e.currentTarget.style.backgroundColor = '#EAEAEB';
            }}
            onMouseLeave={(e) => {
              if (!isProfileMenuOpen) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', minWidth: 0 }}>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #E5E7EB', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#EAEAEB',
                  border: '1px solid #E5E7EB',
                  color: '#09090B',
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
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#09090B', lineHeight: '1.2' }}>
                  {user.displayName || 'Deepjyoti'}
                </div>
                <div style={{ fontSize: '11px', color: '#71717A', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email || 'developer@relayforge.dev'}
                </div>
              </div>
            </div>

            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#71717A"
              strokeWidth="2"
              style={{
                flexShrink: 0,
                transform: isProfileMenuOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            >
              <polyline points="7 15 12 10 17 15"></polyline>
            </svg>
          </div>
        )}
      </div>
    </aside>
  );

  return sidebarContent;
};
