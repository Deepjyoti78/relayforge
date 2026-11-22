import React, { useEffect, useRef, useState } from 'react';
import type { OrganizationDetails, UserProfile } from '../types.ts';
import {
  applyTheme,
  getStoredTheme,
  getStoredThemeMode,
  THEME_OPTIONS,
  type ThemeMode,
  type ThemeName,
} from '../theme.ts';

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
  const [activeTheme, setActiveTheme] = useState<ThemeName>(getStoredTheme);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // Synchronize and apply theme to <html> / DOM
  useEffect(() => {
    applyTheme(activeTheme, themeMode);
  }, [activeTheme, themeMode]);

  // Click outside to dismiss theme menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setIsThemeDropdownOpen(false);
      }
    };
    if (isThemeDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isThemeDropdownOpen]);

  // Keyboard shortcut listener: Cmd/Ctrl+Shift+D or TT
  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      // Cmd/Ctrl + Shift + D toggles theme mode (dark/light)
      if (e.key.toLowerCase() === 'd' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setThemeMode((prev) => {
          const next = prev === 'dark' ? 'light' : 'dark';
          applyTheme(activeTheme, next);
          return next;
        });
        return;
      }

      // 't' then 't' in quick succession opens theme selector
      const now = Date.now();
      if (e.key.toLowerCase() === 't' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (lastKey === 't' && now - lastKeyTime < 450) {
          e.preventDefault();
          setIsThemeDropdownOpen((prev) => !prev);
          lastKey = '';
        } else {
          lastKey = 't';
          lastKeyTime = now;
        }
      } else {
        lastKey = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTheme]);

  const handleSelectTheme = (themeId: ThemeName) => {
    setActiveTheme(themeId);
    applyTheme(themeId, themeMode);
    setIsThemeDropdownOpen(false);
  };

  const handleToggleThemeMode = () => {
    const nextMode: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
    applyTheme(activeTheme, nextMode);
  };

  const currentThemeObj = THEME_OPTIONS.find((t) => t.id === activeTheme) || THEME_OPTIONS[0];

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
        backgroundColor: 'var(--bg-topbar)',
        borderBottom: '1px solid var(--border-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        boxSizing: 'border-box',
        width: '100%',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
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
            gap: 8px !important;
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
            gap: 6px !important;
            justify-content: flex-end !important;
          }
          .rf-topbar-search {
            display: none !important;
          }
          .rf-topbar-kbd {
            display: none !important;
          }
          .rf-topbar-notification-btn,
          .rf-topbar-docs-btn {
            display: none !important;
          }
          .rf-theme-shortcut-badge {
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
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-main)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            padding: '6px 8px',
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'var(--shadow-card)',
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
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Organizations</span>
          <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>›</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {organization ? organization.name : 'Select Org'}
          </span>
          <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
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
          gap: '8px',
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
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-main)',
            borderRadius: '8px',
            padding: '6px 12px',
            width: '240px',
            boxSizing: 'border-box',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
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
              color: 'var(--text-primary)',
              width: '100%',
              minWidth: 0,
            }}
          />
          <kbd
            className="rf-topbar-kbd"
            style={{
              fontSize: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              borderRadius: '4px',
              padding: '2px 5px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 1px rgba(0, 0, 0, 0.05)',
            }}
          >
            ⌘ K
          </kbd>
        </div>

        {/* 🎨 Theme Selector Dropdown Button (Vercel, Supabase, Claude) */}
        <div style={{ position: 'relative' }} ref={themeDropdownRef}>
          <button
            onClick={() => setIsThemeDropdownOpen((prev) => !prev)}
            title="Theme Selector (Press 'T T' to toggle)"
            aria-label="Theme selector"
            aria-expanded={isThemeDropdownOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-main)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-card)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-main)';
            }}
          >
            {/* Palette Icon matching D2 */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={currentThemeObj.accentColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="13.5" cy="6.5" r=".5" fill={currentThemeObj.accentColor}></circle>
              <circle cx="17.5" cy="10.5" r=".5" fill={currentThemeObj.accentColor}></circle>
              <circle cx="8.5" cy="7.5" r=".5" fill={currentThemeObj.accentColor}></circle>
              <circle cx="6.5" cy="12.5" r=".5" fill={currentThemeObj.accentColor}></circle>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
            </svg>

            <span>{currentThemeObj.name}</span>

            <span
              className="rf-theme-shortcut-badge"
              style={{
                fontSize: '9.5px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-main)',
                borderRadius: '4px',
                padding: '1px 4px',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              TT
            </span>

            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                transform: isThemeDropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {/* Theme Dropdown Menu */}
          {isThemeDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-main)',
                borderRadius: '10px',
                padding: '6px',
                minWidth: '200px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.18)',
                zIndex: 60,
                animation: 'rfFadeIn 0.15s ease both',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  padding: '4px 8px 6px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border-main)',
                  marginBottom: '4px',
                }}
              >
                Select Theme (3 Options)
              </div>

              {THEME_OPTIONS.map((theme) => {
                const isSelected = activeTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: theme.accentColor,
                          display: 'inline-block',
                          boxShadow: `0 0 0 2px ${isSelected ? theme.accentColor : 'transparent'}`,
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: isSelected ? 700 : 500 }}>{theme.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{theme.tagline}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.accentColor} strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ☀️/🌙 Theme Mode Toggle Button (Black mode / White mode) */}
        <button
          onClick={handleToggleThemeMode}
          title={themeMode === 'dark' ? 'Switch to White Mode (⌘⇧D)' : 'Switch to Black Mode (⌘⇧D)'}
          aria-label="Toggle theme mode (dark/light)"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-card)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-muted)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-main)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {themeMode === 'dark' ? (
            /* Sun Icon (for Dark/Black mode) */
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            /* Moon / Brightness Icon (for White mode) */
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>

        {/* Notification Bell Button */}
        <button
          className="rf-topbar-notification-btn"
          title="Notifications"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-main)',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            boxShadow: 'var(--shadow-card)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--text-muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'var(--border-main)';
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
            border: '1px solid var(--border-main)',
            backgroundColor: 'var(--bg-card)',
            fontSize: '12px',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'all 0.15s ease',
            flexShrink: 0,
            boxShadow: 'var(--shadow-card)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.borderColor = 'var(--text-muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-card)';
            e.currentTarget.style.borderColor = 'var(--border-main)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span className="rf-topbar-pill-text">Docs</span>
        </a>

        {/* User avatar button */}
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
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                objectFit: 'cover',
                border: '1px solid var(--border-main)',
              }}
            />
          ) : (
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-hover)',
                border: '1px solid var(--border-main)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {getInitials(user.displayName, user.email)}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
