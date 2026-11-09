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
      backgroundColor: '#0A0A0A',
      borderBottom: '1px solid #202020',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: '#F7EFE2', color: '#121214', display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#121214" strokeWidth="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: '18px', color: '#FFFFFF', letterSpacing: '-0.5px' }}>
          RelayForge
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: '#141414',
          color: '#A3A3A3',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid #2A2A2A',
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
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #2A2A2A' }}
            />
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#2A2A2A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '13px',
              color: '#E5E5E5',
            }}>
              {(user.displayName || user.email || 'U')[0]?.toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
              {user.displayName || 'Developer'}
            </span>
            {user.email && (
              <span style={{ fontSize: '12px', color: '#737373' }}>
                {user.email}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            padding: '6px 14px',
            backgroundColor: '#202020',
            color: '#A3A3A3',
            border: '1px solid #2A2A2A',
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
