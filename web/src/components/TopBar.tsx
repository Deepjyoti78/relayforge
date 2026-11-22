import React from 'react';
import type { OrganizationDetails, UserProfile } from '../types.ts';

interface TopBarProps {
  user: UserProfile;
  organization: OrganizationDetails | null;
  activeTab: string;
  onOpenMobileMenu?: () => void;
  onOpenProfile?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  organization,
  activeTab,
  onOpenMobileMenu,
  onOpenProfile,
}) => {
  const getTabLabel = () => {
    switch (activeTab) {
      case 'members':
        return 'Members Directory';
      case 'api-keys':
        return 'API Keys & Secrets';
      case 'endpoints':
        return 'Ingestion Endpoints';
      case 'destinations':
        return 'Destinations & SSRF Registry';
      case 'deliveries':
        return 'Delivery History & Real-Time Attempts';
      case 'workflows':
        return 'Sequential Workflows & Orchestration';
      case 'metrics':
        return 'Operational Metrics & Telemetry Stream';
      case 'dlq':
        return 'Dead Letter Queue & Bulk Replay';
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
    <header
      className="rf-topbar"
      style={{
        height: '56px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <style>{`
        .rf-topbar-notification-btn,
        .rf-topbar-docs-btn {
          display: flex !important;
        }
        @media (max-width: 768px) {
          .rf-topbar {
            padding: 0 12px !important;
            height: 52px !important;
            gap: 10px !important;
          }
          .rf-topbar-left {
            flex-shrink: 0 !important;
          }
          .rf-topbar-breadcrumbs {
            display: none !important;
          }
          .rf-topbar-tools {
            flex: 1 !important;
            min-width: 0 !important;
            gap: 10px !important;
            justify-content: flex-end !important;
          }
          .rf-topbar-search {
            flex: 1 !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            padding: 6px 12px !important;
          }
          .rf-topbar-kbd {
            display: none !important;
          }
          .rf-topbar-notification-btn,
          .rf-topbar-docs-btn {
            display: none !important;
          }
          .rf-topbar-avatar-btn {
            flex-shrink: 0 !important;
          }
        }
      `}</style>

      {/* Left: Mobile Toggle + Breadcrumbs */}
      <div className="rf-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flexShrink: 0 }}>
        {/* Mobile Hamburger Button */}
        <button
          onClick={onOpenMobileMenu}
          className="rf-mobile-menu-btn"
          aria-label="Open Navigation Menu"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            color: '#09090B',
            padding: '6px 8px',
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Breadcrumbs matching D2 style */}
        <div
          className="rf-topbar-breadcrumbs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#71717A',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ color: '#71717A' }}>Organizations</span>
          <span style={{ color: '#D1D5DB' }}>›</span>
          <span style={{ fontWeight: 600, color: '#09090B' }}>
            {organization ? organization.name : 'Select Org'}
          </span>
          <span style={{ color: '#D1D5DB' }}>›</span>
          <span style={{ color: '#09090B', fontWeight: 500 }}>
            {getTabLabel()}
          </span>
        </div>
      </div>

      {/* Right Tools */}
      <div
        className="rf-topbar-tools"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {/* Search bar */}
        <div
          className="rf-topbar-search"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#F4F4F6',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '6px 12px',
            width: '260px',
            boxSizing: 'border-box',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search resources, keys, docs..."
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '12px',
              color: '#09090B',
              width: '100%',
              minWidth: 0,
            }}
          />
          <kbd
            className="rf-topbar-kbd"
            style={{
              fontSize: '10px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '4px',
              padding: '2px 5px',
              color: '#71717A',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 1px rgba(0, 0, 0, 0.05)',
            }}
          >
            ⌘ K
          </kbd>
        </div>

        {/* Notification Bell Button */}
        <button
          className="rf-topbar-notification-btn"
          title="Notifications"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#71717A',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#09090B';
            e.currentTarget.style.backgroundColor = '#F4F4F6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#71717A';
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>

        {/* Public docs button */}
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="rf-topbar-docs-btn"
          style={{
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            fontSize: '12px',
            color: '#09090B',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'all 0.15s ease',
            flexShrink: 0,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F4F4F6';
            e.currentTarget.style.borderColor = '#D1D5DB';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#E5E7EB';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span className="rf-topbar-pill-text">Docs</span>
        </a>

        {/* User avatar */}
        <button
          className="rf-topbar-avatar-btn"
          onClick={onOpenProfile}
          title="View profile details"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: onOpenProfile ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (onOpenProfile) e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            if (onOpenProfile) e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              style={{ width: '30px', height: '30px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #E5E7EB' }}
            />
          ) : (
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: '#EAEAEB',
              border: '1px solid #E5E7EB',
              color: '#09090B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
            }}>
              {getInitials(user.displayName, user.email)}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
