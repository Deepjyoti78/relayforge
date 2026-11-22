import React, { useState } from 'react';
import type { UserProfile } from '../types.ts';

interface ProfileModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onLogout,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen) return null;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback
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

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Recently';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-main)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          color: 'var(--text-primary)',
          position: 'relative',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Header with Title and Close Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              User Profile
            </span>
            <span style={{
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '999px',
              backgroundColor: '#16A34A',
              color: '#F5F0E7',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#F5F0E7' }}></span>
              Active Session
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            ✕
          </button>
        </div>

        {/* User Avatar + Identity Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px',
          backgroundColor: 'var(--bg-input)',
          borderRadius: '12px',
          border: '1px solid var(--border-main)',
          marginBottom: '20px',
        }}>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--border-main)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-hover)',
              border: '1px solid var(--border-main)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px',
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {getInitials(user.displayName, user.email)}
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.2' }}>
              {user.displayName || 'Developer'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', wordBreak: 'break-all' }}>
              {user.email || 'No public email provided'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-hover)',
                padding: '2px 8px',
                borderRadius: '6px',
              }}>
                Authenticated User
              </span>
            </div>
          </div>
        </div>

        {/* Information Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {/* User ID Field */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Account ID
              </span>
              <button
                onClick={handleCopyId}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copiedId ? '#16A34A' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {copiedId ? '✓ Copied' : 'Copy ID'}
              </button>
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-main)',
              borderRadius: '8px',
              padding: '9px 12px',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.id}
            </div>
          </div>

          {/* Member Since Field */}
          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Member Since
            </span>
            <div style={{
              fontSize: '13px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-main)',
              borderRadius: '8px',
              padding: '9px 12px',
              color: 'var(--text-primary)',
            }}>
              {formattedDate}
            </div>
          </div>

          {/* Organizations Membership Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Organizations ({user.organizations?.length ?? 0})
              </span>
            </div>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              borderRadius: '8px',
              padding: '8px 12px',
              maxHeight: '140px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              {(!user.organizations || user.organizations.length === 0) ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
                  No organizations enrolled yet.
                </div>
              ) : (
                user.organizations.map((org) => (
                  <div
                    key={org.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 4px',
                      borderBottom: '1px solid var(--border-main)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {org.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        /{org.slug}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: '1px solid var(--border-main)',
                    }}>
                      {org.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-main)',
          gap: '12px',
        }}>
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            style={{
              padding: '9px 18px',
              backgroundColor: '#DC2626',
              border: 'none',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#B91C1C';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#DC2626';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sign Out</span>
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '9px 20px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-main)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
