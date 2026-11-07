import React, { useState } from 'react';
import type { UserOrganization } from '../types.ts';

interface OrgSelectorProps {
  organizations: UserOrganization[];
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string) => void;
  onCreateOrg: (name: string, slug?: string) => Promise<void>;
}

export const OrgSelector: React.FC<OrgSelectorProps> = ({
  organizations,
  selectedOrgId,
  onSelectOrg,
  onCreateOrg,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await onCreateOrg(name.trim(), slug.trim() || undefined);
      setName('');
      setSlug('');
      setIsCreating(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER':
        return { backgroundColor: '#3b82f6', color: '#ffffff' };
      case 'DEVELOPER':
        return { backgroundColor: '#10b981', color: '#ffffff' };
      default:
        return { backgroundColor: '#475569', color: '#f8fafc' };
    }
  };

  return (
    <div style={{
      width: '280px',
      backgroundColor: '#111827',
      borderRight: '1px solid #1f2937',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      height: 'calc(100vh - 65px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: 0, fontWeight: 700 }}>
          Organizations
        </h2>
        <button
          onClick={() => { setIsCreating(!isCreating); setError(null); }}
          style={{
            fontSize: '12px',
            backgroundColor: isCreating ? '#374151' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {isCreating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <input
            type="text"
            placeholder="Organization Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              padding: '6px 10px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#f8fafc',
              fontSize: '13px',
            }}
          />
          <input
            type="text"
            placeholder="Slug (optional)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{
              padding: '6px 10px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#f8fafc',
              fontSize: '13px',
            }}
          />
          {error && <div style={{ color: '#ef4444', fontSize: '11px' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Creating...' : 'Create Org'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
        {organizations.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px', padding: '8px' }}>
            No organizations yet. Create one to get started.
          </div>
        ) : (
          organizations.map((org) => {
            const isSelected = org.id === selectedOrgId;
            return (
              <button
                key={org.id}
                onClick={() => onSelectOrg(org.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: isSelected ? '#1e293b' : 'transparent',
                  border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#f8fafc' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {org.name}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    /{org.slug}
                  </span>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  ...getRoleBadgeStyle(org.role),
                }}>
                  {org.role}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
