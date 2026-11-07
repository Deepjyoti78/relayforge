import React, { useState } from 'react';
import type { MembershipRole, OrganizationDetails, OrganizationMember } from '../types.ts';

interface OrgManagementProps {
  organization: OrganizationDetails;
  members: OrganizationMember[];
  currentUserId: string;
  onUpdateOrgName: (name: string) => Promise<void>;
  onAddMember: (identifier: { email?: string; username?: string }, role: MembershipRole) => Promise<void>;
  onUpdateRole: (memberId: string, role: MembershipRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

export const OrgManagement: React.FC<OrgManagementProps> = ({
  organization,
  members,
  currentUserId,
  onUpdateOrgName,
  onAddMember,
  onUpdateRole,
  onRemoveMember,
}) => {
  const isOwner = organization.role === 'OWNER';

  // Org Rename State
  const [orgName, setOrgName] = useState(organization.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Add Member State
  const [memberInput, setMemberInput] = useState('');
  const [inputType, setInputType] = useState<'email' | 'username'>('email');
  const [memberRole, setMemberRole] = useState<MembershipRole>('VIEWER');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Action feedback
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || orgName === organization.name) {
      setIsRenaming(false);
      return;
    }
    setRenameError(null);
    try {
      await onUpdateOrgName(orgName.trim());
      setIsRenaming(false);
    } catch (err: unknown) {
      setRenameError(err instanceof Error ? err.message : 'Failed to update name');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberInput.trim()) return;
    setAddError(null);
    setAddLoading(true);
    try {
      const identifier = inputType === 'email'
        ? { email: memberInput.trim() }
        : { username: memberInput.trim() };
      await onAddMember(identifier, memberRole);
      setMemberInput('');
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: MembershipRole) => {
    setActionError(null);
    try {
      await onUpdateRole(memberId, newRole);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  const handleRemove = async (memberId: string) => {
    setActionError(null);
    try {
      await onRemoveMember(memberId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
      {/* Org Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid #1f2937',
        paddingBottom: '24px',
        marginBottom: '32px',
      }}>
        <div>
          {isRenaming ? (
            <form onSubmit={handleRename} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  backgroundColor: '#0f172a',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '4px 10px',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setOrgName(organization.name); setIsRenaming(false); }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#374151',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                {organization.name}
              </h1>
              {isOwner && (
                <button
                  onClick={() => setIsRenaming(true)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #374151',
                    color: '#94a3b8',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Rename
                </button>
              )}
            </div>
          )}
          {renameError && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{renameError}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Slug: <code>{organization.slug}</code>
            </span>
            <span style={{ fontSize: '13px', color: '#64748b' }}>•</span>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Your Role: <strong style={{ color: '#93c5fd' }}>{organization.role}</strong>
            </span>
          </div>
        </div>
      </div>

      {actionError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '13px',
        }}>
          {actionError}
        </div>
      )}

      {/* Add Member Section (Owners only) */}
      {isOwner && (
        <div style={{
          backgroundColor: '#161e2e',
          border: '1px solid #283548',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '32px',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 12px' }}>
            Add Organization Member
          </h3>
          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select
              value={inputType}
              onChange={(e) => setInputType(e.target.value as 'email' | 'username')}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              <option value="email">User Email</option>
              <option value="username">GitHub Username</option>
            </select>
            <input
              type="text"
              placeholder={inputType === 'email' ? 'developer@example.com' : 'octocat'}
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              required
              style={{
                flex: 1,
                minWidth: '200px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            />
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as MembershipRole)}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              <option value="VIEWER">VIEWER (Read-only)</option>
              <option value="DEVELOPER">DEVELOPER (Configuration)</option>
              <option value="OWNER">OWNER (Full Admin)</option>
            </select>
            <button
              type="submit"
              disabled={addLoading}
              style={{
                padding: '8px 18px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {addLoading ? 'Adding...' : 'Add Member'}
            </button>
          </form>
          {addError && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>{addError}</div>}
        </div>
      )}

      {/* Members Table */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>
          Members ({members.length})
        </h3>
        <div style={{
          backgroundColor: '#161e2e',
          border: '1px solid #283548',
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#111827', borderBottom: '1px solid #283548', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>User</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                return (
                  <tr key={member.id} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {member.user.avatarUrl ? (
                          <img
                            src={member.user.avatarUrl}
                            alt=""
                            style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                          />
                        ) : (
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}>
                            {(member.user.displayName || member.user.email || 'U')[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                            {member.user.displayName || 'Developer'} {isSelf && <span style={{ color: '#60a5fa', fontSize: '11px' }}>(You)</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      {member.user.email || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isOwner ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as MembershipRole)}
                          style={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            color: '#e2e8f0',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          <option value="OWNER">OWNER</option>
                          <option value="DEVELOPER">DEVELOPER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      ) : (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#1f2937',
                          color: '#93c5fd',
                          padding: '3px 8px',
                          borderRadius: '4px',
                        }}>
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {(isOwner || isSelf) && (
                        <button
                          onClick={() => handleRemove(member.id)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'transparent',
                            color: '#f87171',
                            border: '1px solid #7f1d1d',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {isSelf ? 'Leave' : 'Remove'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
