import React, { useState } from 'react';
import type { UserOrganization, UserProfile } from '../types.ts';

interface SidebarProps {
  user: UserProfile;
  organizations: UserOrganization[];
  selectedOrgId: string | null;
  activeTab: string;
  onSelectOrg: (orgId: string) => void;
  onCreateOrg: (name: string, slug?: string) => Promise<void>;
  onTabChange: (tab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'settings') => void;
  onLogout: () => void;
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
}) => {
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <aside style={{
      width: '260px',
      backgroundColor: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0,
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            border: '1px solid #0f172a',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
              RELAYFORGE
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
              Management Console
            </div>
          </div>
        </div>

        <button
          title="Sidebar Collapse"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      {/* Nav Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {/* MAIN MENU */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#94a3b8',
            textTransform: 'uppercase',
            padding: '0 8px',
            marginBottom: '6px',
          }}>
            Main Menu
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Dashboard */}
            <button
              onClick={() => onTabChange('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'dashboard' ? 600 : 500,
                color: activeTab === 'dashboard' ? '#0f172a' : '#475569',
                backgroundColor: activeTab === 'dashboard' ? '#f8fafc' : 'transparent',
                border: activeTab === 'dashboard' ? '1px solid #e2e8f0' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span>Dashboard</span>
            </button>

            {/* Members */}
            <button
              onClick={() => onTabChange('members')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'members' ? 600 : 500,
                color: activeTab === 'members' ? '#0f172a' : '#475569',
                backgroundColor: activeTab === 'members' ? '#f8fafc' : 'transparent',
                border: activeTab === 'members' ? '1px solid #e2e8f0' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Members</span>
            </button>

            {/* API Keys */}
            <button
              onClick={() => onTabChange('api-keys')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'api-keys' ? 600 : 500,
                color: activeTab === 'api-keys' ? '#0f172a' : '#475569',
                backgroundColor: activeTab === 'api-keys' ? '#f8fafc' : 'transparent',
                border: activeTab === 'api-keys' ? '1px solid #e2e8f0' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5-3 3 1.5 1.5L9 14l-5 5H2v-2l5-5 1.5 1.5 3-3-1.5-1.5 3.5-3.5 1.5 1.5L21 2z"></path>
                </svg>
                <span>API Keys</span>
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 5px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                borderRadius: '4px',
              }}>
                M3
              </span>
            </button>

            {/* Endpoints */}
            <button
              onClick={() => onTabChange('endpoints')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'endpoints' ? 600 : 500,
                color: activeTab === 'endpoints' ? '#0f172a' : '#475569',
                backgroundColor: activeTab === 'endpoints' ? '#f8fafc' : 'transparent',
                border: activeTab === 'endpoints' ? '1px solid #e2e8f0' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <span>Endpoints</span>
            </button>
          </nav>
        </div>

        {/* ORGANIZATIONS (TENANCY) */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#94a3b8',
              textTransform: 'uppercase',
            }}>
              Organizations
            </span>
            <button
              onClick={() => setIsCreatingOrg(!isCreatingOrg)}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#0f172a',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                padding: '1px 6px',
                cursor: 'pointer',
              }}
            >
              + New
            </button>
          </div>

          {/* Inline Create Form */}
          {isCreatingOrg && (
            <form onSubmit={handleCreateSubmit} style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '10px',
            }}>
              <input
                type="text"
                placeholder="Org Name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                  marginBottom: '8px',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                placeholder="slug (optional)"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                  marginBottom: '8px',
                  outline: 'none',
                }}
              />
              {createError && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '8px' }}>
                  {createError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    flex: 1,
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '5px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {createLoading ? '...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingOrg(false)}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Org List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {organizations.map((org) => {
              const isSelected = org.id === selectedOrgId;
              return (
                <button
                  key={org.id}
                  onClick={() => onSelectOrg(org.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? '#0f172a' : '#475569',
                    backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                    border: isSelected ? '1px solid #cbd5e1' : '1px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#0f172a' : '#cbd5e1',
                    }}></div>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {org.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: isSelected ? '#0f172a' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#64748b',
                    fontWeight: 600,
                  }}>
                    {org.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ADMINISTRATION */}
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#94a3b8',
            textTransform: 'uppercase',
            padding: '0 8px',
            marginBottom: '6px',
          }}>
            Administration
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button
              onClick={() => onTabChange('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: activeTab === 'settings' ? 600 : 500,
                color: activeTab === 'settings' ? '#0f172a' : '#475569',
                backgroundColor: activeTab === 'settings' ? '#f8fafc' : 'transparent',
                border: activeTab === 'settings' ? '1px solid #e2e8f0' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Footer Profile */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#0f172a',
              color: '#ffffff',
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
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName || 'Developer'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email || 'Admin'}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </aside>
  );
};
