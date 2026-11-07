import React from 'react';
import type { UserProfile } from '../types.ts';

interface UserProfileProps {
  user: UserProfile;
  onLogout: () => void;
}

export const UserProfileBar: React.FC<UserProfileProps> = ({ user, onLogout }) => {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      backgroundColor: '#111827',
      borderBottom: '1px solid #1f2937',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: '18px', color: '#f8fafc', letterSpacing: '-0.5px' }}>
          RelayForge
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: '#1e293b',
          color: '#94a3b8',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid #334155',
        }}>
          Milestone 2
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName || 'User'}
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #374151' }}
            />
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '13px',
              color: '#e2e8f0',
            }}>
              {(user.displayName || user.email || 'U')[0]?.toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>
              {user.displayName || 'Developer'}
            </span>
            {user.email && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {user.email}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            padding: '6px 14px',
            backgroundColor: '#1f2937',
            color: '#cbd5e1',
            border: '1px solid #374151',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
};
