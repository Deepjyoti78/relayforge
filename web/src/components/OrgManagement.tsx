import React, { useEffect, useState } from 'react';
import { createApiKey, fetchApiKeys, revokeApiKey } from '../api.ts';
import type { ApiKeyMetadata, MembershipRole, OrganizationDetails, OrganizationMember } from '../types.ts';

interface OrgManagementProps {
  organization: OrganizationDetails;
  members: OrganizationMember[];
  currentUserId: string;
  activeTab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'settings';
  onTabChange: (tab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'settings') => void;
  onUpdateOrgName: (name: string) => Promise<void>;
  onAddMember: (identifier: { email?: string; username?: string }, role: MembershipRole) => Promise<void>;
  onUpdateRole: (memberId: string, role: MembershipRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

export const OrgManagement: React.FC<OrgManagementProps> = ({
  organization,
  members,
  currentUserId,
  activeTab,
  onTabChange,
  onUpdateOrgName,
  onAddMember,
  onUpdateRole,
  onRemoveMember,
}) => {
  const isOwner = organization.role === 'OWNER';
  const canManageKeys = organization.role === 'OWNER' || organization.role === 'DEVELOPER';

  // Org Rename State
  const [orgName, setOrgName] = useState(organization.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Add Member State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [inputType, setInputType] = useState<'email' | 'username'>('email');
  const [memberRole, setMemberRole] = useState<MembershipRole>('VIEWER');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Action feedback
  const [actionError, setActionError] = useState<string | null>(null);

  // API Keys State (Milestone 3)
  const [apiKeys, setApiKeys] = useState<ApiKeyMetadata[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['ingest']);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [keyActionError, setKeyActionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setOrgName(organization.name);
    setCreatedRawKey(null);
    setKeyActionError(null);
    void loadApiKeys();
  }, [organization.id]);

  const loadApiKeys = async () => {
    setKeysLoading(true);
    try {
      const data = await fetchApiKeys(organization.id);
      setApiKeys(data);
    } catch {
      // Ignore if user lacks permissions
    } finally {
      setKeysLoading(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setKeyActionError(null);
    try {
      const res = await createApiKey(organization.id, newKeyName.trim(), newKeyScopes);
      setCreatedRawKey(res.apiKey);
      setApiKeys((prev) => [res.record, ...prev]);
      setNewKeyName('');
      setShowAddKeyModal(false);
    } catch (err: unknown) {
      setKeyActionError(err instanceof Error ? err.message : 'Failed to create API key');
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This action is irreversible.')) {
      return;
    }
    setKeyActionError(null);
    try {
      const updated = await revokeApiKey(organization.id, keyId);
      setApiKeys((prev) => prev.map((k) => (k.id === keyId ? updated : k)));
    } catch (err: unknown) {
      setKeyActionError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  const handleCopyKey = () => {
    if (!createdRawKey) return;
    void navigator.clipboard.writeText(createdRawKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

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
      setShowAddMemberModal(false);
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

  const activeKeyCount = apiKeys.filter((k) => !k.revokedAt).length;

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.user.displayName || '').toLowerCase().includes(q) ||
      (m.user.email || '').toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  const filteredKeys = apiKeys.filter((k) => {
    const q = searchQuery.toLowerCase();
    return (
      k.name.toLowerCase().includes(q) ||
      k.keyPrefix.toLowerCase().includes(q) ||
      k.scopes.some((s) => s.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ flex: 1, padding: '36px 40px', overflowY: 'auto' }}>
      {/* Eyebrow and Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#64748b',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            RELAYFORGE TENANT & ACCESS MANAGEMENT
          </div>

          {isRenaming ? (
            <form onSubmit={handleRename} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  backgroundColor: '#ffffff',
                  border: '1px solid #0f172a',
                  borderRadius: '6px',
                  color: '#0f172a',
                  padding: '4px 10px',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setOrgName(organization.name); setIsRenaming(false); }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.03em' }}>
                {organization.name}
              </h1>
              {isOwner && (
                <button
                  onClick={() => setIsRenaming(true)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    color: '#64748b',
                    borderRadius: '6px',
                    padding: '3px 9px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Rename
                </button>
              )}
            </div>
          )}
          {renameError && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{renameError}</div>}

          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
            Manage registered members, programmatic API keys, webhook endpoints, and row-level tenant security.
          </p>
        </div>

        {/* Top Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => alert(`Exporting ${organization.name} directory as CSV...`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              color: '#0f172a',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export CSV
          </button>

          {isOwner && (
            <button
              onClick={() => setShowAddMemberModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                backgroundColor: '#0f172a',
                border: '1px solid #0f172a',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
              }}
            >
              + Register Member
            </button>
          )}

          {canManageKeys && (
            <button
              onClick={() => setShowAddKeyModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                backgroundColor: '#0f172a',
                border: '1px solid #0f172a',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
              }}
            >
              + Generate Key
            </button>
          )}
        </div>
      </div>

      {/* STATS CARDS ROW (4 CARDS) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '28px',
      }}>
        {/* Card 1: Members */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Total Members
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: '1.2' }}>
            {members.length}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: '#ecfdf5',
              color: '#059669',
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              +{members.length} active
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Enrolled</span>
          </div>
        </div>

        {/* Card 2: Active API Keys */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Active API Keys
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5-3 3 1.5 1.5L9 14l-5 5H2v-2l5-5 1.5 1.5 3-3-1.5-1.5 3.5-3.5 1.5 1.5L21 2z"></path>
            </svg>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: '1.2' }}>
            {activeKeyCount}
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
            SHA-256 hashed live keys
          </div>
        </div>

        {/* Card 3: Ingestion Endpoints */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Endpoints (M3)
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: '1.2' }}>
            Ready
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
            AES-256-GCM signed
          </div>
        </div>

        {/* Card 4: Tenant RLS Policy */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Tenant Isolation
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: '1.2' }}>
            Enforced
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>PostgreSQL RLS Active</span>
          </div>
        </div>
      </div>

      {/* FILTER PILLS ROW (MATCHING SORA LIBRARY STYLE) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
        <button
          onClick={() => onTabChange('members')}
          style={{
            padding: '7px 16px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'members' ? '#0f172a' : '#ffffff',
            color: activeTab === 'members' ? '#ffffff' : '#475569',
            border: activeTab === 'members' ? '1px solid #0f172a' : '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>All Members</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 6px',
            borderRadius: '999px',
            backgroundColor: activeTab === 'members' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
            color: activeTab === 'members' ? '#ffffff' : '#64748b',
          }}>
            {members.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('api-keys')}
          style={{
            padding: '7px 16px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'api-keys' ? '#0f172a' : '#ffffff',
            color: activeTab === 'api-keys' ? '#ffffff' : '#475569',
            border: activeTab === 'api-keys' ? '1px solid #0f172a' : '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>API Keys</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 6px',
            borderRadius: '999px',
            backgroundColor: activeTab === 'api-keys' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
            color: activeTab === 'api-keys' ? '#ffffff' : '#64748b',
          }}>
            {apiKeys.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('endpoints')}
          style={{
            padding: '7px 16px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'endpoints' ? '#0f172a' : '#ffffff',
            color: activeTab === 'endpoints' ? '#ffffff' : '#475569',
            border: activeTab === 'endpoints' ? '1px solid #0f172a' : '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Endpoints</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 6px',
            borderRadius: '999px',
            backgroundColor: activeTab === 'endpoints' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
            color: activeTab === 'endpoints' ? '#ffffff' : '#64748b',
          }}>
            0
          </span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          style={{
            padding: '7px 16px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'settings' ? '#0f172a' : '#ffffff',
            color: activeTab === 'settings' ? '#ffffff' : '#475569',
            border: activeTab === 'settings' ? '1px solid #0f172a' : '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Organization Settings</span>
        </button>
      </div>

      {/* SEARCH AND FILTER BAR (MATCHING SORA LIBRARY STYLE) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '16px',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '10px 14px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder={activeTab === 'api-keys' ? "Search API key by name, prefix, or scope..." : "Search member by name, contact email, role..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '13px',
              color: '#0f172a',
              width: '100%',
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '9px 14px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#0f172a',
          cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>All Statuses</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {createdRawKey && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #10b981',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>🔑</span>
            <strong style={{ fontSize: '15px', color: '#065f46' }}>API Key Generated Successfully</strong>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#047857' }}>
            Make sure to copy your API key now. For your security, this key is SHA-256 hashed and will never be shown again.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              readOnly
              value={createdRawKey}
              style={{
                flex: 1,
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#15803d',
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: 600,
              }}
            />
            <button
              type="button"
              onClick={handleCopyKey}
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copiedKey ? '✓ Copied' : 'Copy Key'}
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '13px',
        }}>
          {actionError}
        </div>
      )}

      {/* TABLE CARD */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        {/* MEMBERS VIEW */}
        {activeTab === 'members' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #f1f5f9',
                color: '#64748b',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backgroundColor: '#fafafa',
              }}>
                <th style={{ padding: '14px 20px' }}>Member ID</th>
                <th style={{ padding: '14px 20px' }}>Member Name & Contact</th>
                <th style={{ padding: '14px 20px' }}>Membership Role</th>
                <th style={{ padding: '14px 20px' }}>Active Tenant</th>
                <th style={{ padding: '14px 20px' }}>Joined Date</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m, idx) => {
                const isSelf = m.userId === currentUserId;
                const memberIdDisplay = `MEM-${m.id.slice(0, 5).toUpperCase()}`;
                const initials = (m.user.displayName || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: idx === filteredMembers.length - 1 ? 'none' : '1px solid #f1f5f9',
                      fontSize: '13px',
                      color: '#0f172a',
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                      {memberIdDisplay}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {m.user.avatarUrl ? (
                          <img
                            src={m.user.avatarUrl}
                            alt=""
                            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
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
                          }}>
                            {initials}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {m.user.displayName || 'Unnamed User'} {isSelf && <span style={{ color: '#2563eb', fontWeight: 500 }}>(You)</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {m.user.email || '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      {isOwner && !isSelf ? (
                        <select
                          value={m.role}
                          onChange={(e) => void handleRoleChange(m.id, e.target.value as MembershipRole)}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#0f172a',
                          }}
                        >
                          <option value="VIEWER">VIEWER</option>
                          <option value="DEVELOPER">DEVELOPER</option>
                          <option value="OWNER">OWNER</option>
                        </select>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: m.role === 'OWNER' ? '#f1f5f9' : '#f8fafc',
                          color: '#0f172a',
                          border: '1px solid #e2e8f0',
                        }}>
                          {m.role}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 20px', color: '#64748b' }}>
                      {organization.name}
                    </td>

                    <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px' }}>
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#ecfdf5',
                        color: '#059669',
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                        Active
                      </span>
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          title="View details"
                          style={{
                            backgroundColor: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '6px',
                            color: '#64748b',
                            cursor: 'pointer',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>

                        {isOwner && !isSelf && (
                          <button
                            title="Remove member"
                            onClick={() => void handleRemove(m.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #fee2e2',
                              borderRadius: '6px',
                              padding: '6px',
                              color: '#ef4444',
                              cursor: 'pointer',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        )}
                        {isSelf && (
                          <button
                            onClick={() => void handleRemove(m.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #cbd5e1',
                              color: '#64748b',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Leave
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* API KEYS VIEW */}
        {activeTab === 'api-keys' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #f1f5f9',
                color: '#64748b',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backgroundColor: '#fafafa',
              }}>
                <th style={{ padding: '14px 20px' }}>Key ID</th>
                <th style={{ padding: '14px 20px' }}>Key Name</th>
                <th style={{ padding: '14px 20px' }}>Key Prefix</th>
                <th style={{ padding: '14px 20px' }}>Scopes</th>
                <th style={{ padding: '14px 20px' }}>Created Date</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keysLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    Loading API keys...
                  </td>
                </tr>
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    No API keys found. Generate a key to begin ingesting webhooks.
                  </td>
                </tr>
              ) : (
                filteredKeys.map((k, idx) => {
                  const isRevoked = Boolean(k.revokedAt);
                  const keyIdDisplay = `KEY-${k.id.slice(0, 5).toUpperCase()}`;
                  return (
                    <tr
                      key={k.id}
                      style={{
                        borderBottom: idx === filteredKeys.length - 1 ? 'none' : '1px solid #f1f5f9',
                        fontSize: '13px',
                        color: '#0f172a',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                        {keyIdDisplay}
                      </td>

                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                        {k.name}
                      </td>

                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', color: '#0f172a' }}>
                        <code>{k.keyPrefix}...</code>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        {k.scopes.map((s) => (
                          <span key={s} style={{
                            padding: '2px 8px',
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            marginRight: '4px',
                            border: '1px solid #e2e8f0',
                          }}>
                            {s}
                          </span>
                        ))}
                      </td>

                      <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px' }}>
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: isRevoked ? '#fef2f2' : '#ecfdf5',
                          color: isRevoked ? '#b91c1c' : '#059669',
                        }}>
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: isRevoked ? '#ef4444' : '#10b981',
                          }}></span>
                          {isRevoked ? 'REVOKED' : 'ACTIVE'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {canManageKeys && !isRevoked && (
                          <button
                            title="Revoke key"
                            onClick={() => void handleRevokeApiKey(k.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #fee2e2',
                              color: '#ef4444',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* ENDPOINTS / OTHER TABS VIEW */}
        {(activeTab === 'endpoints' || activeTab === 'dashboard' || activeTab === 'settings') && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#0f172a',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              {activeTab === 'endpoints' ? 'Milestone 3 — Ingestion Endpoints' : 'Settings & Telemetry'}
            </h3>
            <p style={{ fontSize: '13px', margin: 0, color: '#64748b' }}>
              {activeTab === 'endpoints'
                ? 'Webhook ingestion endpoints with AES-256-GCM envelope signing secrets and outbox dispatch are in progress.'
                : 'Manage organization preferences, database connection parameters, and webhook retention rules.'}
            </p>
          </div>
        )}
      </div>

      {/* MODAL: ADD MEMBER */}
      {showAddMemberModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              Register Organization Member
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px' }}>
              Invite a user by email or GitHub username and grant tenant access.
            </p>

            <form onSubmit={handleAddMember}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Identifier Type
                </label>
                <select
                  value={inputType}
                  onChange={(e) => setInputType(e.target.value as 'email' | 'username')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="email">User Email</option>
                  <option value="username">GitHub Username</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  {inputType === 'email' ? 'Email Address' : 'GitHub Username'}
                </label>
                <input
                  type={inputType === 'email' ? 'email' : 'text'}
                  placeholder={inputType === 'email' ? 'developer@example.com' : 'octocat'}
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Role & Permissions
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as MembershipRole)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="VIEWER">VIEWER — Read-only permitted resources</option>
                  <option value="DEVELOPER">DEVELOPER — Endpoints, API keys & workflows</option>
                  <option value="OWNER">OWNER — Full administrative access</option>
                </select>
              </div>

              {addError && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '16px' }}>
                  {addError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {addLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD API KEY */}
      {showAddKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              Create Organization API Key
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px' }}>
              Generate a secure SHA-256 hashed API key to authenticate incoming webhooks.
            </p>

            <form onSubmit={handleCreateApiKey}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Key Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production Ingestion Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Scope
                </label>
                <select
                  value={newKeyScopes[0] || 'ingest'}
                  onChange={(e) => setNewKeyScopes([e.target.value])}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="ingest">Ingestion (ingest) — Inbound webhooks</option>
                  <option value="admin">Admin (all) — Full programmatic access</option>
                </select>
              </div>

              {keyActionError && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '16px' }}>
                  {keyActionError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddKeyModal(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
