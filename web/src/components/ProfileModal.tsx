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
        backgroundColor: 'rgba(10, 10, 12, 0.75)',
        backdropFilter: 'blur(6px)',
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
          backgroundColor: '#161616',
          border: '1px solid #2A2A2A',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
          color: '#FFFFFF',
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
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#A3A3A3', textTransform: 'uppercase' }}>
              User Profile
            </span>
            <span style={{
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: '#16161A',
              border: '1px solid #2A2A2A',
              color: '#10b981',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
              Active Session
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#A3A3A3',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#A3A3A3'}
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
          backgroundColor: '#111111',
          borderRadius: '16px',
          border: '1px solid #2A2A2A',
          marginBottom: '20px',
        }}>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #2A2A2A',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#000000',
              border: '2px solid #2A2A2A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 800,
              flexShrink: 0,
            }}>
              {getInitials(user.displayName, user.email)}
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', lineHeight: '1.2' }}>
              {user.displayName || 'Developer'}
            </div>
            <div style={{ fontSize: '13px', color: '#A3A3A3', marginTop: '3px', wordBreak: 'break-all' }}>
              {user.email || 'No public email provided'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#E5E5E5',
                backgroundColor: '#202020',
                padding: '2px 8px',
                borderRadius: '6px',
              }}>
                GitHub OAuth
              </span>
            </div>
          </div>
        </div>

        {/* Information Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {/* User ID Field */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase' }}>
                Account ID
              </span>
              <button
                onClick={handleCopyId}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copiedId ? '#10b981' : '#A3A3A3',
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
              backgroundColor: '#000000',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              padding: '9px 12px',
              color: '#E5E5E5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.id}
            </div>
          </div>

          {/* Member Since Field */}
          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase', marginBottom: '6px' }}>
              Member Since
            </span>
            <div style={{
              fontSize: '13px',
              backgroundColor: '#000000',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              padding: '9px 12px',
              color: '#FFFFFF',
            }}>
              {formattedDate}
            </div>
          </div>

          {/* Organizations Membership Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase' }}>
                Organizations ({user.organizations?.length ?? 0})
              </span>
            </div>
            <div style={{
              backgroundColor: '#000000',
              border: '1px solid #2A2A2A',
              borderRadius: '10px',
              padding: '8px 12px',
              maxHeight: '140px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              {(!user.organizations || user.organizations.length === 0) ? (
                <div style={{ fontSize: '12px', color: '#737373', padding: '6px 0' }}>
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
                      borderBottom: '1px solid #161616',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                        {org.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#737373' }}>
                        /{org.slug}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: '#202020',
                      color: '#E5E5E5',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: '1px solid #2A2A2A',
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
          borderTop: '1px solid #2A2A2A',
          gap: '12px',
        }}>
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            style={{
              padding: '9px 18px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sign Out</span>
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '9px 22px',
              backgroundColor: '#FFFFFF',
              border: 'none',
              color: '#000000',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
