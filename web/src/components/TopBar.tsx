import React from 'react';
import type { OrganizationDetails, UserProfile } from '../types.ts';

interface TopBarProps {
  user: UserProfile;
  organization: OrganizationDetails | null;
  activeTab: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  organization,
  activeTab,
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
      backgroundColor: '#232327',
      borderBottom: '1px solid #3E3E45',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 20,
    }}>
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#9A9AA6' }}>
        <span>Organizations</span>
        <span style={{ color: '#63636E' }}>›</span>
        <span style={{ fontWeight: 600, color: '#F2F2F5' }}>
          {organization ? organization.name : 'Select Org'}
        </span>
        <span style={{ color: '#63636E' }}>›</span>
        <span style={{ color: '#C9C9D2' }}>
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
          backgroundColor: '#0E0E10',
          border: '1px solid #3E3E45',
          borderRadius: '8px',
          padding: '6px 12px',
          width: '260px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#63636E" strokeWidth="2.5">
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
              color: '#F2F2F5',
              width: '100%',
            }}
          />
          <kbd style={{
            fontSize: '10px',
            backgroundColor: '#232327',
            border: '1px solid #3E3E45',
            borderRadius: '4px',
            padding: '2px 5px',
            color: '#9A9AA6',
            fontFamily: 'monospace',
          }}>
            ⌘K
          </kbd>
        </div>

        {/* Status pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid #3E3E45',
          backgroundColor: '#0E0E10',
          fontSize: '12px',
          color: '#C9C9D2',
          fontWeight: 500,
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
          }}></span>
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
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #3E3E45',
            backgroundColor: 'transparent',
            fontSize: '12px',
            color: '#9A9AA6',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#F2F2F5';
            e.currentTarget.style.backgroundColor = '#2C2C31';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#9A9AA6';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span>Docs</span>
        </a>

        {/* User avatar badge */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid #3E3E45',
            }}
          />
        ) : (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#0E0E10',
            border: '1px solid #3E3E45',
            color: '#F2F2F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            {getInitials(user.displayName, user.email)}
          </div>
        )}
      </div>
    </header>
  );
};
