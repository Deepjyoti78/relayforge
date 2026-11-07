import React from 'react';
import type { OrganizationDetails, UserProfile } from '../types.ts';

interface TopBarProps {
  user: UserProfile;
  organization: OrganizationDetails | null;
  activeTab: string;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  organization,
  activeTab,
  onLogout,
}) => {
  const getTabLabel = () => {
    switch (activeTab) {
      case 'members':
        return 'Members Directory';
      case 'api-keys':
        return 'API Keys & Secrets';
      case 'endpoints':
        return 'Ingestion Endpoints';
      case 'settings':
        return 'Settings';
      default:
        return 'Overview';
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

  return (
    <header style={{
      height: '60px',
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 20,
    }}>
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
        <span>Organizations</span>
        <span>›</span>
        <span style={{ fontWeight: 600, color: '#0f172a' }}>
          {organization ? organization.name : 'Select Org'}
        </span>
        <span>›</span>
        <span style={{ color: '#0f172a' }}>
          {getTabLabel()}
        </span>
      </div>

      {/* Right Tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Search bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '6px 12px',
          width: '260px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search resources, keys..."
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '12px',
              color: '#0f172a',
              width: '100%',
            }}
          />
          <kbd style={{
            fontSize: '10px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            padding: '1px 5px',
            color: '#64748b',
            fontFamily: 'inherit',
          }}>
            ⌘K
          </kbd>
        </div>

        {/* Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: 500,
          color: '#0f172a',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '6px 12px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
          <span>RLS Active</span>
        </div>

        {/* Public docs button */}
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#475569',
            textDecoration: 'none',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '6px 12px',
            fontWeight: 500,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Public Site
        </a>

        {/* User avatar circle */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName || 'User'}
            title={`${user.displayName || 'User'} (${user.email || ''})`}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
            onClick={onLogout}
          />
        ) : (
          <div
            title={`${user.displayName || 'User'} (${user.email || ''}) — Click to sign out`}
            onClick={onLogout}
            style={{
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
              cursor: 'pointer',
            }}
          >
            {getInitials(user.displayName, user.email)}
          </div>
        )}
      </div>
    </header>
  );
};
