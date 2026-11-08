import React, { useEffect, useState } from 'react';
import {
  createApiKey,
  createDestination,
  createEndpoint,
  deleteDestination,
  deleteEndpoint,
  fetchApiKeys,
  fetchDeliveries,
  fetchDestinations,
  fetchEndpoints,
  replayDelivery,
  revokeApiKey,
  rotateEndpointSecret,
  testDestinationPing,
  updateDestination,
} from '../api.ts';
import type {
  ApiKeyMetadata,
  DeliveryAttemptMetadata,
  DestinationMetadata,
  EndpointMetadata,
  MembershipRole,
  OrganizationDetails,
  OrganizationMember,
} from '../types.ts';

interface OrgManagementProps {
  organization: OrganizationDetails;
  members: OrganizationMember[];
  currentUserId: string;
  activeTab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'destinations' | 'deliveries' | 'settings';
  onTabChange: (tab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'destinations' | 'deliveries' | 'settings') => void;
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
  const isDeveloper = organization.role === 'DEVELOPER';
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

  // API Keys State (Milestone 3 Phase 1)
  const [apiKeys, setApiKeys] = useState<ApiKeyMetadata[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['ingest']);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [keyActionError, setKeyActionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Endpoints State (Milestone 3 Phase 2 & 3)
  const [endpoints, setEndpoints] = useState<EndpointMetadata[]>([]);
  const [endpointsLoading, setEndpointsLoading] = useState(false);
  const [showAddEndpointModal, setShowAddEndpointModal] = useState(false);
  const [newEndpointName, setNewEndpointName] = useState('');
  const [newEndpointSlug, setNewEndpointSlug] = useState('');
  const [createdRawSecret, setCreatedRawSecret] = useState<string | null>(null);
  const [endpointActionError, setEndpointActionError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);

  // Destinations State (Milestone 3 Option 1)
  const [destinations, setDestinations] = useState<DestinationMetadata[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(false);
  const [showAddDestinationModal, setShowAddDestinationModal] = useState(false);
  const [newDestinationName, setNewDestinationName] = useState('');
  const [newDestinationUrl, setNewDestinationUrl] = useState('');
  const [newDestinationMethod, setNewDestinationMethod] = useState('POST');
  const [newDestinationRateLimit, setNewDestinationRateLimit] = useState(50);
  const [newDestinationTimeout, setNewDestinationTimeout] = useState(10000);
  const [destinationActionError, setDestinationActionError] = useState<string | null>(null);

  // Deliveries State (Milestone 3 Option 2)
  const [deliveries, setDeliveries] = useState<DeliveryAttemptMetadata[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [pingLoadingId, setPingLoadingId] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<{ id: string; status: 'SUCCESS' | 'FAILED'; text: string } | null>(null);
  const [replayingDeliveryId, setReplayingDeliveryId] = useState<string | null>(null);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);
  const [selectedAttemptForModal, setSelectedAttemptForModal] = useState<DeliveryAttemptMetadata | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);

  useEffect(() => {
    setOrgName(organization.name);
    setCreatedRawKey(null);
    setCreatedRawSecret(null);
    setKeyActionError(null);
    setEndpointActionError(null);
    setDestinationActionError(null);
    setPingResult(null);
    void loadApiKeys();
    void loadEndpoints();
    void loadDestinations();
    void loadDeliveries();
  }, [organization.id]);

  const loadDeliveries = async () => {
    setDeliveriesLoading(true);
    try {
      const data = await fetchDeliveries(organization.id);
      setDeliveries(data);
    } catch {
      // Ignore if user lacks permissions
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const handleTestDestinationPing = async (destId: string) => {
    setPingLoadingId(destId);
    setPingResult(null);
    try {
      const attempt = await testDestinationPing(organization.id, destId);
      setDeliveries((prev) => [attempt, ...prev]);
      setPingResult({
        id: destId,
        status: attempt.status,
        text: attempt.status === 'SUCCESS'
          ? `✓ 200 OK (${attempt.latencyMs}ms)`
          : `✗ ${attempt.errorDescription || `HTTP ${attempt.statusCode}`}`,
      });
    } catch (err: unknown) {
      setPingResult({
        id: destId,
        status: 'FAILED',
        text: err instanceof Error ? err.message : 'Ping test failed',
      });
    } finally {
      setPingLoadingId(null);
    }
  };

  const handleReplay = async (deliveryId: string) => {
    setReplayingDeliveryId(deliveryId);
    setDestinationActionError(null);
    try {
      const res = await replayDelivery(organization.id, deliveryId);
      setReplayMessage(`Delivery re-queued (Outbox: ${res.outboxMessageId.slice(0, 8)})`);
      setTimeout(() => setReplayMessage(null), 4000);
      void loadDeliveries();
    } catch (err: unknown) {
      setDestinationActionError(err instanceof Error ? err.message : 'Failed to replay delivery');
    } finally {
      setReplayingDeliveryId(null);
    }
  };

  const loadDestinations = async () => {
    setDestinationsLoading(true);
    try {
      const data = await fetchDestinations(organization.id);
      setDestinations(data);
    } catch {
      // Ignore if user lacks permissions
    } finally {
      setDestinationsLoading(false);
    }
  };

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

  const loadEndpoints = async () => {
    setEndpointsLoading(true);
    try {
      const data = await fetchEndpoints(organization.id);
      setEndpoints(data);
    } catch {
      // Ignore if user lacks permissions
    } finally {
      setEndpointsLoading(false);
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

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEndpointName.trim()) return;
    setEndpointActionError(null);
    try {
      const res = await createEndpoint(organization.id, newEndpointName.trim(), newEndpointSlug.trim() || undefined);
      setCreatedRawSecret(res.signingSecret);
      setEndpoints((prev) => [res.endpoint, ...prev]);
      setNewEndpointName('');
      setNewEndpointSlug('');
      setShowAddEndpointModal(false);
    } catch (err: unknown) {
      setEndpointActionError(err instanceof Error ? err.message : 'Failed to create endpoint');
    }
  };

  const handleRotateSecret = async (endpointId: string) => {
    if (!window.confirm('Rotate webhook signing secret? Previous signatures will no longer be accepted.')) {
      return;
    }
    setEndpointActionError(null);
    try {
      const res = await rotateEndpointSecret(organization.id, endpointId);
      setCreatedRawSecret(res.signingSecret);
      setEndpoints((prev) => prev.map((ep) => (ep.id === endpointId ? res.endpoint : ep)));
    } catch (err: unknown) {
      setEndpointActionError(err instanceof Error ? err.message : 'Failed to rotate secret');
    }
  };

  const handleDeleteEndpoint = async (endpointId: string) => {
    if (!window.confirm('Are you sure you want to delete this endpoint? Inbound webhooks sent to it will be rejected.')) {
      return;
    }
    setEndpointActionError(null);
    try {
      await deleteEndpoint(organization.id, endpointId);
      setEndpoints((prev) => prev.filter((ep) => ep.id !== endpointId));
    } catch (err: unknown) {
      setEndpointActionError(err instanceof Error ? err.message : 'Failed to delete endpoint');
    }
  };

  const handleCreateDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestinationName.trim() || !newDestinationUrl.trim()) return;
    setDestinationActionError(null);
    try {
      const created = await createDestination(organization.id, newDestinationName.trim(), newDestinationUrl.trim(), {
        httpMethod: newDestinationMethod,
        rateLimitPerSecond: Number(newDestinationRateLimit),
        timeoutMs: Number(newDestinationTimeout),
      });
      setDestinations((prev) => [created, ...prev]);
      setNewDestinationName('');
      setNewDestinationUrl('');
      setShowAddDestinationModal(false);
    } catch (err: unknown) {
      setDestinationActionError(err instanceof Error ? err.message : 'Failed to create destination');
    }
  };

  const handleDeleteDestination = async (destinationId: string) => {
    if (!window.confirm('Are you sure you want to delete this destination target? Webhooks will no longer be forwarded to it.')) {
      return;
    }
    setDestinationActionError(null);
    try {
      await deleteDestination(organization.id, destinationId);
      setDestinations((prev) => prev.filter((d) => d.id !== destinationId));
    } catch (err: unknown) {
      setDestinationActionError(err instanceof Error ? err.message : 'Failed to delete destination');
    }
  };

  const handleToggleDestinationStatus = async (destination: DestinationMetadata) => {
    setDestinationActionError(null);
    try {
      const updated = await updateDestination(organization.id, destination.id, {
        isActive: !destination.isActive,
      });
      setDestinations((prev) => prev.map((d) => (d.id === destination.id ? updated : d)));
    } catch (err: unknown) {
      setDestinationActionError(err instanceof Error ? err.message : 'Failed to update destination');
    }
  };

  const handleCopyText = (text: string, isSecret = false, urlId?: string) => {
    navigator.clipboard.writeText(text);
    if (isSecret) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else if (urlId) {
      setCopiedUrlId(urlId);
      setTimeout(() => setCopiedUrlId(null), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
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
      setRenameError(err instanceof Error ? err.message : 'Failed to update organization name');
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberInput.trim()) return;
    setAddError(null);
    setAddLoading(true);
    try {
      const identifier = inputType === 'email' ? { email: memberInput.trim() } : { username: memberInput.trim() };
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

  const filteredEndpoints = endpoints.filter((ep) => {
    const q = searchQuery.toLowerCase();
    return (
      ep.name.toLowerCase().includes(q) ||
      ep.slug.toLowerCase().includes(q) ||
      ep.id.toLowerCase().includes(q)
    );
  });

  const filteredDestinations = destinations.filter((d) => {
    const q = searchQuery.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.url.toLowerCase().includes(q) ||
      d.httpMethod.toLowerCase().includes(q)
    );
  });

  const filteredDeliveries = deliveries.filter((att) => {
    const q = searchQuery.toLowerCase();
    return (
      att.id.toLowerCase().includes(q) ||
      att.requestUrl.toLowerCase().includes(q) ||
      att.status.toLowerCase().includes(q) ||
      (att.statusCode !== null && String(att.statusCode).includes(q)) ||
      (att.errorDescription !== null && att.errorDescription.toLowerCase().includes(q))
    );
  });

  return (
    <div className="rf-main-content">
      {/* Eyebrow and Page Title */}
      <div className="rf-header-row">
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#9A9AA6',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            RELAYFORGE TENANT & INGESTION CONSOLE
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
                  backgroundColor: '#0E0E10',
                  border: '1px solid #3E3E45',
                  borderRadius: '8px',
                  color: '#F2F2F5',
                  padding: '4px 12px',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '7px 16px',
                  backgroundColor: '#F2F2F5',
                  color: '#0E0E10',
                  border: 'none',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setOrgName(organization.name); setIsRenaming(false); }}
                style={{
                  padding: '7px 14px',
                  backgroundColor: 'transparent',
                  color: '#9A9AA6',
                  border: '1px solid #3E3E45',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{
                fontSize: '26px',
                fontWeight: 800,
                color: '#F2F2F5',
                margin: 0,
                letterSpacing: '-0.02em',
              }}>
                {organization.name}
              </h1>
              {isOwner && (
                <button
                  onClick={() => setIsRenaming(true)}
                  style={{
                    backgroundColor: '#232327',
                    border: '1px solid #3E3E45',
                    color: '#C9C9D2',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '999px',
                    padding: '3px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Rename
                </button>
              )}
            </div>
          )}

          <p style={{
            fontSize: '13px',
            color: '#9A9AA6',
            margin: '6px 0 0 0',
          }}>
            Manage members, high-throughput webhook ingestion endpoints, and AES-256-GCM signing secrets.
          </p>
          {renameError && (
            <div style={{ color: '#f87171', fontSize: '12px', marginTop: '6px' }}>
              {renameError}
            </div>
          )}
        </div>

        {/* Top Action Buttons */}
        <div className="rf-header-btn-wrap" style={{ display: 'flex', gap: '10px' }}>
          {isOwner && activeTab === 'members' && (
            <button
              onClick={() => setShowAddMemberModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 22px',
                backgroundColor: '#F2F2F5',
                border: 'none',
                borderRadius: '999px',
                color: '#0E0E10',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              + Register Member
            </button>
          )}

          {canManageKeys && activeTab === 'api-keys' && (
            <button
              onClick={() => setShowAddKeyModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 22px',
                backgroundColor: '#F2F2F5',
                border: 'none',
                borderRadius: '999px',
                color: '#0E0E10',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              + Generate Key
            </button>
          )}

          {canManageKeys && activeTab === 'endpoints' && (
            <button
              onClick={() => setShowAddEndpointModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 22px',
                backgroundColor: '#F2F2F5',
                border: 'none',
                borderRadius: '999px',
                color: '#0E0E10',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              + New Endpoint
            </button>
          )}
        </div>
      </div>

      {/* STATS CARDS ROW (EXACT DESIGN MATCHING 7a30a006.jpg) */}
      <div className="rf-stats-grid">
        {/* Card 1: Members (Light Surface) */}
        <div style={{
          backgroundColor: '#F2F2F5',
          border: 'none',
          borderRadius: '20px',
          padding: '22px 24px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0E0E10', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              TOTAL MEMBERS
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E0E10" strokeWidth="2.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#0E0E10', lineHeight: '1.2' }}>
            {members.length}
          </div>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#0E0E10',
              color: '#F2F2F5',
              padding: '2px 8px',
              borderRadius: '999px',
            }}>
              +{members.length} active
            </span>
            <span style={{ fontSize: '11px', color: '#63636E', fontWeight: 500 }}>Enrolled</span>
          </div>
        </div>

        {/* Card 2: Active API Keys (Light Surface) */}
        <div style={{
          backgroundColor: '#F2F2F5',
          border: 'none',
          borderRadius: '20px',
          padding: '22px 24px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0E0E10', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ACTIVE API KEYS
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E0E10" strokeWidth="2.2">
              <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5-3 3 1.5 1.5L9 14l-5 5H2v-2l5-5 1.5 1.5 3-3-1.5-1.5 3.5-3.5 1.5 1.5L21 2z"></path>
            </svg>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#0E0E10', lineHeight: '1.2' }}>
            {activeKeyCount}
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#63636E', fontWeight: 500 }}>
            SHA-256 hashed live keys
          </div>
        </div>

        {/* Card 3: Ingestion Endpoints (Dark Surface) */}
        <div style={{
          backgroundColor: '#232327',
          border: '1px solid #3E3E45',
          borderRadius: '20px',
          padding: '22px 24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ENDPOINTS (M3)
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9AA6" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#F2F2F5', lineHeight: '1.2' }}>
            {endpoints.length}
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#9A9AA6', fontWeight: 500 }}>
            AES-256-GCM signed
          </div>
        </div>

        {/* Card 4: Tenant Isolation (Dark Surface) */}
        <div style={{
          backgroundColor: '#232327',
          border: '1px solid #3E3E45',
          borderRadius: '20px',
          padding: '22px 24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              TENANT ISOLATION
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9AA6" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#F2F2F5', lineHeight: '1.2' }}>
            Enforced
          </div>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span style={{ fontSize: '11px', color: '#9A9AA6', fontWeight: 500 }}>• PostgreSQL RLS Active</span>
          </div>
        </div>
      </div>

      {/* FILTER PILLS ROW (ROUNDED PILLS) */}
      <div className="rf-filter-pills">
        <button
          onClick={() => onTabChange('members')}
          style={{
            padding: '7px 18px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'members' ? '#F2F2F5' : '#232327',
            color: activeTab === 'members' ? '#0E0E10' : '#C9C9D2',
            border: activeTab === 'members' ? '1px solid transparent' : '1px solid #3E3E45',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span>All Members</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeTab === 'members' ? '#0E0E10' : '#3E3E45',
            color: '#F2F2F5',
            fontWeight: 700,
          }}>
            {members.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('api-keys')}
          style={{
            padding: '7px 18px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'api-keys' ? '#F2F2F5' : '#232327',
            color: activeTab === 'api-keys' ? '#0E0E10' : '#C9C9D2',
            border: activeTab === 'api-keys' ? '1px solid transparent' : '1px solid #3E3E45',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span>API Keys</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeTab === 'api-keys' ? '#0E0E10' : '#3E3E45',
            color: '#F2F2F5',
            fontWeight: 700,
          }}>
            {apiKeys.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('endpoints')}
          style={{
            padding: '7px 18px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'endpoints' ? '#F2F2F5' : '#232327',
            color: activeTab === 'endpoints' ? '#0E0E10' : '#C9C9D2',
            border: activeTab === 'endpoints' ? '1px solid transparent' : '1px solid #3E3E45',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Endpoints</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeTab === 'endpoints' ? '#0E0E10' : '#3E3E45',
            color: '#F2F2F5',
            fontWeight: 700,
          }}>
            {endpoints.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('destinations')}
          style={{
            padding: '7px 18px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'destinations' ? '#F2F2F5' : '#232327',
            color: activeTab === 'destinations' ? '#0E0E10' : '#C9C9D2',
            border: activeTab === 'destinations' ? '1px solid transparent' : '1px solid #3E3E45',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Destinations</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeTab === 'destinations' ? '#0E0E10' : '#3E3E45',
            color: '#F2F2F5',
            fontWeight: 700,
          }}>
            {destinations.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('deliveries')}
          style={{
            padding: '7px 18px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'deliveries' ? '#F2F2F5' : '#232327',
            color: activeTab === 'deliveries' ? '#0E0E10' : '#C9C9D2',
            border: activeTab === 'deliveries' ? '1px solid transparent' : '1px solid #3E3E45',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Deliveries</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '999px',
            backgroundColor: activeTab === 'deliveries' ? '#0E0E10' : '#3E3E45',
            color: '#F2F2F5',
            fontWeight: 700,
          }}>
            {deliveries.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          style={{
            padding: '7px 18px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeTab === 'settings' ? '#F2F2F5' : '#232327',
            color: activeTab === 'settings' ? '#0E0E10' : '#C9C9D2',
            border: activeTab === 'settings' ? '1px solid transparent' : '1px solid #3E3E45',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Settings</span>
        </button>
      </div>

      {/* SEARCH BAR (ROUNDED PILL MATCHING 7a30a006.jpg) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#232327',
          border: '1px solid #3E3E45',
          borderRadius: '999px',
          padding: '12px 22px',
          boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#63636E" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder={
              activeTab === 'api-keys'
                ? 'Search API key by name, prefix, or scope...'
                : activeTab === 'endpoints'
                ? 'Search endpoint by name, slug, or ID...'
                : activeTab === 'destinations'
                ? 'Search destination by name, URL, or method...'
                : activeTab === 'deliveries'
                ? 'Search deliveries by ID, URL, status code, or error...'
                : 'Search member by name, contact email, role...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '13px',
              color: '#F2F2F5',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* FEEDBACK BANNER: CREATED RAW API KEY */}
      {createdRawKey && (
        <div style={{
          backgroundColor: '#1A1A1E',
          border: '1px solid #3E3E45',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F2F2F5', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
            <span>🔑 API Key Generated Successfully</span>
          </div>
          <p style={{ fontSize: '13px', color: '#9A9AA6', margin: '0 0 14px' }}>
            Make sure to copy your API key now. For your security, this key is SHA-256 hashed and will never be shown again.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              readOnly
              value={createdRawKey}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '13px',
                padding: '10px 14px',
                backgroundColor: '#0E0E10',
                border: '1px solid #3E3E45',
                borderRadius: '8px',
                color: '#F2F2F5',
              }}
            />
            <button
              onClick={() => handleCopyText(createdRawKey)}
              style={{
                padding: '10px 18px',
                backgroundColor: copiedKey ? '#3E3E45' : '#F2F2F5',
                color: copiedKey ? '#F2F2F5' : '#0E0E10',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {copiedKey ? '✓ Copied' : 'Copy Key'}
            </button>
            <button
              onClick={() => setCreatedRawKey(null)}
              style={{
                padding: '10px 14px',
                backgroundColor: 'transparent',
                color: '#9A9AA6',
                border: '1px solid #3E3E45',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* FEEDBACK BANNER: CREATED RAW SIGNING SECRET (PHASE 2 & 3) */}
      {createdRawSecret && (
        <div style={{
          backgroundColor: '#1A1A1E',
          border: '1px solid #3E3E45',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F2F2F5', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
            <span>🔒 Webhook Signing Secret Generated (AES-256-GCM)</span>
          </div>
          <p style={{ fontSize: '13px', color: '#9A9AA6', margin: '0 0 14px' }}>
            Make sure to copy your webhook signing secret now. It is encrypted in the database using envelope encryption and cannot be shown again.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              readOnly
              value={createdRawSecret}
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '13px',
                padding: '10px 14px',
                backgroundColor: '#0E0E10',
                border: '1px solid #3E3E45',
                borderRadius: '8px',
                color: '#F2F2F5',
              }}
            />
            <button
              onClick={() => handleCopyText(createdRawSecret, true)}
              style={{
                padding: '10px 18px',
                backgroundColor: copiedSecret ? '#3E3E45' : '#F2F2F5',
                color: copiedSecret ? '#F2F2F5' : '#0E0E10',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {copiedSecret ? '✓ Copied' : 'Copy Secret'}
            </button>
            <button
              onClick={() => setCreatedRawSecret(null)}
              style={{
                padding: '10px 14px',
                backgroundColor: 'transparent',
                color: '#9A9AA6',
                border: '1px solid #3E3E45',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div style={{
          backgroundColor: '#2A1C1C',
          border: '1px solid #552B2B',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '20px',
        }}>
          {actionError}
        </div>
      )}

      {endpointActionError && (
        <div style={{
          backgroundColor: '#2A1C1C',
          border: '1px solid #552B2B',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '20px',
        }}>
          {endpointActionError}
        </div>
      )}

      {destinationActionError && (
        <div style={{
          backgroundColor: '#2A1C1C',
          border: '1px solid #552B2B',
          color: '#f87171',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '20px',
        }}>
          {destinationActionError}
        </div>
      )}

      {replayMessage && (
        <div style={{
          backgroundColor: '#1E2D22',
          border: '1px solid #2B4232',
          color: '#4ade80',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>🔄</span>
          <span>{replayMessage}</span>
        </div>
      )}

      {/* TABLE CONTAINER */}
      <div className="rf-table-responsive">
        {/* MEMBERS VIEW */}
        {activeTab === 'members' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '680px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #3E3E45',
                color: '#9A9AA6',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backgroundColor: '#1E1E22',
              }}>
                <th style={{ padding: '16px 22px' }}>Member ID</th>
                <th style={{ padding: '16px 22px' }}>Member Name & Contact</th>
                <th style={{ padding: '16px 22px' }}>Role</th>
                <th style={{ padding: '16px 22px' }}>Enrolled Date</th>
                <th style={{ padding: '16px 22px' }}>Status</th>
                <th style={{ padding: '16px 22px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: '#63636E' }}>
                    No members match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m, idx) => {
                  const isCurrent = m.userId === currentUserId;
                  const memberIdDisplay = `MEM-${m.userId.slice(0, 5).toUpperCase()}`;
                  const isMenuOpen = activeMenuMemberId === m.id;

                  return (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: idx === filteredMembers.length - 1 ? 'none' : '1px solid #2C2C32',
                        fontSize: '13px',
                        color: '#F2F2F5',
                      }}
                    >
                      <td style={{ padding: '16px 22px', fontFamily: 'monospace', fontSize: '12px', color: '#9A9AA6' }}>
                        {memberIdDisplay}
                      </td>

                      <td style={{ padding: '16px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {m.user.avatarUrl ? (
                            <img
                              src={m.user.avatarUrl}
                              alt=""
                              style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #3E3E45' }}
                            />
                          ) : (
                            <div style={{
                              width: '34px',
                              height: '34px',
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
                              {(m.user.displayName || m.user.email || 'U').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: '#F2F2F5' }}>
                              {m.user.displayName || 'Unnamed Developer'} {isCurrent && <span style={{ color: '#9A9AA6', fontWeight: 400 }}>(You)</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9A9AA6' }}>
                              {m.user.email || 'No public email'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '16px 22px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 14px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#35353C',
                          color: '#F2F2F5',
                          letterSpacing: '0.04em',
                        }}>
                          {m.role}
                        </span>
                      </td>

                      <td style={{ padding: '16px 22px', color: '#9A9AA6', fontSize: '12px' }}>
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>

                      <td style={{ padding: '16px 22px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: '#16161A',
                          color: '#F2F2F5',
                          border: '1px solid #33333A',
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                          Active
                        </span>
                      </td>

                      <td style={{ padding: '16px 22px', textAlign: 'right', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            title="Member Actions"
                            onClick={() => setActiveMenuMemberId(isMenuOpen ? null : m.id)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: isMenuOpen ? '#3E3E45' : 'transparent',
                              border: '1px solid transparent',
                              color: '#C9C9D2',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#3E3E45';
                            }}
                            onMouseLeave={(e) => {
                              if (!isMenuOpen) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="2"></circle>
                              <circle cx="6" cy="12" r="2"></circle>
                              <circle cx="18" cy="12" r="2"></circle>
                            </svg>
                          </button>

                          {/* Action Popover Menu */}
                          {isMenuOpen && (
                            <div style={{
                              position: 'absolute',
                              right: '22px',
                              top: '52px',
                              backgroundColor: '#1E1E22',
                              border: '1px solid #3E3E45',
                              borderRadius: '12px',
                              padding: '8px',
                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                              zIndex: 30,
                              minWidth: '180px',
                              textAlign: 'left',
                            }}>
                              {isOwner && !isCurrent ? (
                                <>
                                  <div style={{ fontSize: '11px', color: '#9A9AA6', padding: '4px 8px', fontWeight: 600 }}>
                                    Change Role:
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '6px' }}>
                                    {(['OWNER', 'DEVELOPER', 'VIEWER'] as MembershipRole[]).map((r) => (
                                      <button
                                        key={r}
                                        onClick={() => {
                                          void handleRoleChange(m.id, r);
                                          setActiveMenuMemberId(null);
                                        }}
                                        style={{
                                          padding: '6px 8px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          backgroundColor: m.role === r ? '#2A2A30' : 'transparent',
                                          color: '#F2F2F5',
                                          border: 'none',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          fontWeight: m.role === r ? 700 : 500,
                                        }}
                                      >
                                        {r} {m.role === r ? '✓' : ''}
                                      </button>
                                    ))}
                                  </div>
                                  <div style={{ height: '1px', backgroundColor: '#3E3E45', margin: '4px 0' }} />
                                  <button
                                    onClick={() => {
                                      void handleRemove(m.id);
                                      setActiveMenuMemberId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      backgroundColor: 'transparent',
                                      color: '#f87171',
                                      border: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Remove Member
                                  </button>
                                </>
                              ) : isCurrent && !isOwner ? (
                                <button
                                  onClick={() => {
                                    void handleRemove(m.id);
                                    setActiveMenuMemberId(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    backgroundColor: 'transparent',
                                    color: '#f87171',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontWeight: 600,
                                  }}
                                >
                                  Leave Organization
                                </button>
                              ) : (
                                <div style={{ fontSize: '12px', color: '#9A9AA6', padding: '6px 8px' }}>
                                  No actions available for Organization Owner.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* API KEYS VIEW */}
        {activeTab === 'api-keys' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '720px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #3E3E45',
                color: '#9A9AA6',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backgroundColor: '#1E1E22',
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
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#63636E' }}>
                    Loading API keys...
                  </td>
                </tr>
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#63636E' }}>
                    No API keys found. Generate a key to begin authenticating requests.
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
                        borderBottom: idx === filteredKeys.length - 1 ? 'none' : '1px solid #2C2C32',
                        fontSize: '13px',
                        color: '#F2F2F5',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#9A9AA6' }}>
                        {keyIdDisplay}
                      </td>

                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                        {k.name}
                      </td>

                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', color: '#C9C9D2' }}>
                        <code>{k.keyPrefix}...</code>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        {k.scopes.map((s) => (
                          <span key={s} style={{
                            padding: '2px 8px',
                            backgroundColor: '#0E0E10',
                            color: '#F2F2F5',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            marginRight: '4px',
                            border: '1px solid #3E3E45',
                          }}>
                            {s}
                          </span>
                        ))}
                      </td>

                      <td style={{ padding: '14px 20px', color: '#9A9AA6', fontSize: '12px' }}>
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
                          backgroundColor: isRevoked ? '#2A1C1C' : '#1E2D22',
                          color: isRevoked ? '#f87171' : '#4ade80',
                          border: isRevoked ? '1px solid #442A2A' : '1px solid #2B4232',
                        }}>
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: isRevoked ? '#f87171' : '#4ade80',
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
                              border: '1px solid #4A2828',
                              color: '#f87171',
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

        {/* ENDPOINTS VIEW (MILESTONE 3 PHASE 2 & 3) */}
        {activeTab === 'endpoints' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #3E3E45',
                color: '#9A9AA6',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backgroundColor: '#1E1E22',
              }}>
                <th style={{ padding: '16px 22px' }}>Endpoint ID</th>
                <th style={{ padding: '16px 22px' }}>Name & Slug</th>
                <th style={{ padding: '16px 22px' }}>Ingestion URL</th>
                <th style={{ padding: '16px 22px' }}>Signing Secret</th>
                <th style={{ padding: '16px 22px' }}>Created</th>
                <th style={{ padding: '16px 22px' }}>Status</th>
                <th style={{ padding: '16px 22px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpointsLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#63636E' }}>
                    Loading ingestion endpoints...
                  </td>
                </tr>
              ) : filteredEndpoints.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#63636E' }}>
                    No ingestion endpoints created yet. Click "+ New Endpoint" to begin accepting webhooks.
                  </td>
                </tr>
              ) : (
                filteredEndpoints.map((ep, idx) => {
                  const ingestUrl = `http://127.0.0.1:3100/v1/ingest/${ep.id}`;
                  const isCopied = copiedUrlId === ep.id;
                  const epIdDisplay = `EP-${ep.id.slice(0, 5).toUpperCase()}`;

                  return (
                    <tr
                      key={ep.id}
                      style={{
                        borderBottom: idx === filteredEndpoints.length - 1 ? 'none' : '1px solid #2C2C32',
                        fontSize: '13px',
                        color: '#F2F2F5',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#9A9AA6' }}>
                        {epIdDisplay}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{ep.name}</div>
                        <div style={{ fontSize: '11px', color: '#9A9AA6', fontFamily: 'monospace' }}>/{ep.slug}</div>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code style={{
                            fontSize: '11px',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            color: '#F2F2F5',
                          }}>
                            {`/v1/ingest/${ep.id.slice(0, 8)}...`}
                          </code>
                          <button
                            onClick={() => handleCopyText(ingestUrl, false, ep.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: isCopied ? '#4ade80' : '#9A9AA6',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '2px 6px',
                            }}
                          >
                            {isCopied ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </td>

                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#C9C9D2' }}>
                        <code>{ep.secretPreview}...</code>
                      </td>

                      <td style={{ padding: '14px 20px', color: '#9A9AA6', fontSize: '12px' }}>
                        {new Date(ep.createdAt).toLocaleDateString()}
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
                          backgroundColor: ep.isActive ? '#1E2D22' : '#2A1C1C',
                          color: ep.isActive ? '#4ade80' : '#f87171',
                          border: ep.isActive ? '1px solid #2B4232' : '1px solid #442A2A',
                        }}>
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: ep.isActive ? '#4ade80' : '#f87171',
                          }}></span>
                          {ep.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {canManageKeys && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              title="Rotate signing secret"
                              onClick={() => void handleRotateSecret(ep.id)}
                              style={{
                                backgroundColor: 'transparent',
                                border: '1px solid #3E3E45',
                                color: '#C9C9D2',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Rotate
                            </button>
                            <button
                              title="Delete endpoint"
                              onClick={() => void handleDeleteEndpoint(ep.id)}
                              style={{
                                backgroundColor: 'transparent',
                                border: '1px solid #4A2828',
                                color: '#f87171',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* DESTINATIONS VIEW (MILESTONE 3 OPTION 1: SSRF PROTECTED) */}
        {activeTab === 'destinations' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #3E3E45',
                color: '#9A9AA6',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backgroundColor: '#1E1E22',
              }}>
                <th style={{ padding: '16px 22px' }}>Destination ID</th>
                <th style={{ padding: '16px 22px' }}>Name & Method</th>
                <th style={{ padding: '16px 22px' }}>Target URL (SSRF Protected)</th>
                <th style={{ padding: '16px 22px' }}>Rate Limit & Timeout</th>
                <th style={{ padding: '16px 22px' }}>Created</th>
                <th style={{ padding: '16px 22px' }}>Status</th>
                <th style={{ padding: '16px 22px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {destinationsLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#63636E' }}>
                    Loading destination targets...
                  </td>
                </tr>
              ) : filteredDestinations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#63636E' }}>
                    No destination targets registered yet. Click "+ New Destination" to configure webhook forward targets.
                  </td>
                </tr>
              ) : (
                filteredDestinations.map((d, idx) => {
                  const destIdDisplay = `DEST-${d.id.slice(0, 5).toUpperCase()}`;

                  return (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom: idx === filteredDestinations.length - 1 ? 'none' : '1px solid #2C2C32',
                        fontSize: '13px',
                        color: '#F2F2F5',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#9A9AA6' }}>
                        {destIdDisplay}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div style={{ marginTop: '3px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            color: '#F2F2F5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            {d.httpMethod}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code style={{
                            fontSize: '12px',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            color: '#F2F2F5',
                            maxWidth: '320px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                          }}>
                            {d.url}
                          </code>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '999px',
                            backgroundColor: '#1E2D22',
                            color: '#4ade80',
                            border: '1px solid #2B4232',
                            whiteSpace: 'nowrap',
                          }}>
                            ✓ SSRF Safe
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '14px 20px', color: '#C9C9D2', fontSize: '12px' }}>
                        <div>{d.rateLimitPerSecond} req/sec</div>
                        <div style={{ fontSize: '11px', color: '#9A9AA6' }}>{d.timeoutMs}ms timeout</div>
                      </td>

                      <td style={{ padding: '14px 20px', color: '#9A9AA6', fontSize: '12px' }}>
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <button
                          onClick={() => canManageKeys && void handleToggleDestinationStatus(d)}
                          disabled={!canManageKeys}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: d.isActive ? '#1E2D22' : '#2A1C1C',
                            color: d.isActive ? '#4ade80' : '#f87171',
                            border: d.isActive ? '1px solid #2B4232' : '1px solid #442A2A',
                            cursor: canManageKeys ? 'pointer' : 'default',
                          }}
                        >
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: d.isActive ? '#4ade80' : '#f87171',
                          }}></span>
                          {d.isActive ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {canManageKeys && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                            {pingResult?.id === d.id && (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: pingResult.status === 'SUCCESS' ? '#4ade80' : '#f87171',
                                whiteSpace: 'nowrap',
                              }}>
                                {pingResult.text}
                              </span>
                            )}
                            <button
                              title="Send test webhook delivery to destination"
                              disabled={pingLoadingId === d.id}
                              onClick={() => void handleTestDestinationPing(d.id)}
                              style={{
                                backgroundColor: '#232327',
                                border: '1px solid #3E3E45',
                                color: pingLoadingId === d.id ? '#9A9AA6' : '#F2F2F5',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: pingLoadingId === d.id ? 'default' : 'pointer',
                              }}
                            >
                              {pingLoadingId === d.id ? 'Pinging...' : '⚡ Ping'}
                            </button>
                            <button
                              title="Delete destination"
                              onClick={() => void handleDeleteDestination(d.id)}
                              style={{
                                backgroundColor: 'transparent',
                                border: '1px solid #4A2828',
                                color: '#f87171',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* DELIVERIES & ATTEMPTS VIEW (MILESTONE 3 OPTION 2) */}
        {activeTab === 'deliveries' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #3E3E45',
                color: '#9A9AA6',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backgroundColor: '#1E1E22',
              }}>
                <th style={{ padding: '16px 22px' }}>Attempt ID</th>
                <th style={{ padding: '16px 22px' }}>Status & Code</th>
                <th style={{ padding: '16px 22px' }}>Destination Target</th>
                <th style={{ padding: '16px 22px' }}>Latency</th>
                <th style={{ padding: '16px 22px' }}>Attempted At</th>
                <th style={{ padding: '16px 22px', textAlign: 'right' }}>Payload & Headers</th>
              </tr>
            </thead>
            <tbody>
              {deliveriesLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#63636E' }}>
                    Loading delivery attempt history...
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#63636E' }}>
                    No delivery attempts logged yet. Test a destination using "⚡ Ping" or ingest an inbound webhook.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((att, idx) => {
                  const attemptIdDisplay = `ATT-${att.id.slice(0, 5).toUpperCase()}`;
                  const isSuccess = att.status === 'SUCCESS';

                  return (
                    <tr
                      key={att.id}
                      style={{
                        borderBottom: idx === filteredDeliveries.length - 1 ? 'none' : '1px solid #2C2C32',
                        fontSize: '13px',
                        color: '#F2F2F5',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#9A9AA6' }}>
                        {attemptIdDisplay}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isSuccess ? '#1E2D22' : '#2A1C1C',
                          color: isSuccess ? '#4ade80' : '#f87171',
                          border: isSuccess ? '1px solid #2B4232' : '1px solid #442A2A',
                        }}>
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: isSuccess ? '#4ade80' : '#f87171',
                          }}></span>
                          {att.statusCode ? `HTTP ${att.statusCode}` : att.status}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            color: '#F2F2F5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            {att.requestMethod}
                          </span>
                          <code style={{
                            fontSize: '12px',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            color: '#F2F2F5',
                            maxWidth: '300px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                          }}>
                            {att.requestUrl}
                          </code>
                        </div>
                        {att.errorDescription && (
                          <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>
                            {att.errorDescription}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: '#232327',
                          color: '#C9C9D2',
                          border: '1px solid #3E3E45',
                        }}>
                          {att.latencyMs} ms
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', color: '#9A9AA6', fontSize: '12px' }}>
                        {new Date(att.createdAt).toLocaleTimeString()} · {new Date(att.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {(isOwner || isDeveloper) && (
                            <button
                              onClick={() => void handleReplay(att.id)}
                              disabled={replayingDeliveryId === att.id}
                              title="Re-enqueue event delivery attempt"
                              style={{
                                backgroundColor: replayingDeliveryId === att.id ? '#3E3E45' : '#232327',
                                border: '1px solid #3E3E45',
                                color: '#F2F2F5',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: replayingDeliveryId === att.id ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>🔄</span>
                              <span>{replayingDeliveryId === att.id ? '...' : 'Replay'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedAttemptForModal(att)}
                            style={{
                              backgroundColor: '#232327',
                              border: '1px solid #3E3E45',
                              color: '#F2F2F5',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Inspect Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* SETTINGS / DASHBOARD VIEW */}
        {(activeTab === 'dashboard' || activeTab === 'settings') && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9A9AA6' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#0E0E10',
              border: '1px solid #3E3E45',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#F2F2F5',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: '#F2F2F5' }}>
              Organization Settings & Architecture
            </h3>
            <p style={{ fontSize: '13px', margin: 0, color: '#9A9AA6' }}>
              PostgreSQL Row-Level Security isolation is active. Slug: <code>{organization.slug}</code>
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
          backgroundColor: 'rgba(14, 14, 16, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#1E1E22',
            borderRadius: '20px',
            border: '1px solid #3E3E45',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#F2F2F5' }}>
              Register Organization Member
            </h3>
            <p style={{ fontSize: '13px', color: '#9A9AA6', margin: '0 0 20px' }}>
              Invite a collaborator to access organization resources and pipelines.
            </p>

            <form onSubmit={handleAddMemberSubmit}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <select
                  value={inputType}
                  onChange={(e) => setInputType(e.target.value as 'email' | 'username')}
                  style={{
                    padding: '9px 12px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                >
                  <option value="email">User Email</option>
                  <option value="username">GitHub Username</option>
                </select>
                <input
                  type={inputType === 'email' ? 'email' : 'text'}
                  placeholder={inputType === 'email' ? 'developer@example.com' : 'octocat'}
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '9px 14px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                  Assigned Role
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as MembershipRole)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                >
                  <option value="VIEWER">VIEWER (Read-only)</option>
                  <option value="DEVELOPER">DEVELOPER (Create Keys & Endpoints)</option>
                  <option value="OWNER">OWNER (Full Admin)</option>
                </select>
              </div>

              {addError && (
                <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '16px' }}>
                  {addError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'transparent',
                    border: '1px solid #3E3E45',
                    borderRadius: '999px',
                    color: '#9A9AA6',
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
                    padding: '9px 22px',
                    backgroundColor: '#F2F2F5',
                    border: 'none',
                    borderRadius: '999px',
                    color: '#0E0E10',
                    fontSize: '13px',
                    fontWeight: 700,
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
          backgroundColor: 'rgba(14, 14, 16, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#1E1E22',
            borderRadius: '20px',
            border: '1px solid #3E3E45',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#F2F2F5' }}>
              Create Organization API Key
            </h3>
            <p style={{ fontSize: '13px', color: '#9A9AA6', margin: '0 0 20px' }}>
              Generate a secure SHA-256 hashed API key to authenticate programmatic requests.
            </p>

            <form onSubmit={handleCreateApiKey}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
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
                    padding: '9px 14px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                  Scope
                </label>
                <select
                  value={newKeyScopes[0] || 'ingest'}
                  onChange={(e) => setNewKeyScopes([e.target.value])}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                >
                  <option value="ingest">Ingestion (ingest) — Inbound webhooks</option>
                  <option value="admin">Admin (all) — Full programmatic access</option>
                </select>
              </div>

              {keyActionError && (
                <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '16px' }}>
                  {keyActionError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddKeyModal(false)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'transparent',
                    border: '1px solid #3E3E45',
                    borderRadius: '999px',
                    color: '#9A9AA6',
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
                    padding: '9px 22px',
                    backgroundColor: '#F2F2F5',
                    border: 'none',
                    borderRadius: '999px',
                    color: '#0E0E10',
                    fontSize: '13px',
                    fontWeight: 700,
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

      {/* MODAL: ADD ENDPOINT (MILESTONE 3 PHASE 2) */}
      {showAddEndpointModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(14, 14, 16, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#1E1E22',
            borderRadius: '20px',
            border: '1px solid #3E3E45',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#F2F2F5' }}>
              Create Ingestion Endpoint
            </h3>
            <p style={{ fontSize: '13px', color: '#9A9AA6', margin: '0 0 20px' }}>
              Register a dedicated webhook ingestion endpoint. A unique AES-256-GCM signing secret will be generated.
            </p>

            <form onSubmit={handleCreateEndpoint}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                  Endpoint Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stripe Webhooks, GitHub Events"
                  value={newEndpointName}
                  onChange={(e) => setNewEndpointName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                  Slug (Optional URL identifier)
                </label>
                <input
                  type="text"
                  placeholder="e.g. stripe-production"
                  value={newEndpointSlug}
                  onChange={(e) => setNewEndpointSlug(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#63636E', marginTop: '4px', display: 'block' }}>
                  Leave empty to automatically generate a unique slug.
                </span>
              </div>

              {endpointActionError && (
                <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '16px' }}>
                  {endpointActionError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddEndpointModal(false)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'transparent',
                    border: '1px solid #3E3E45',
                    borderRadius: '999px',
                    color: '#9A9AA6',
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
                    padding: '9px 22px',
                    backgroundColor: '#F2F2F5',
                    border: 'none',
                    borderRadius: '999px',
                    color: '#0E0E10',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Create Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD DESTINATION (MILESTONE 3 OPTION 1) */}
      {showAddDestinationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(14, 14, 16, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#1E1E22',
            borderRadius: '20px',
            border: '1px solid #3E3E45',
            width: '100%',
            maxWidth: '500px',
            padding: '28px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#F2F2F5' }}>
              Register Destination Target
            </h3>
            <p style={{ fontSize: '13px', color: '#9A9AA6', margin: '0 0 20px' }}>
              Register a webhook delivery destination. Targets are protected against SSRF attacks (private IPs, loopback, and cloud metadata are strictly blocked).
            </p>

            <form onSubmit={handleCreateDestination}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                  Destination Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary Customer Webhook, Analytics Ingest"
                  value={newDestinationName}
                  onChange={(e) => setNewDestinationName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                  Target Webhook URL (SSRF Protected)
                </label>
                <input
                  type="url"
                  placeholder="https://api.example.com/webhooks"
                  value={newDestinationUrl}
                  onChange={(e) => setNewDestinationUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    border: '1px solid #3E3E45',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#0E0E10',
                    color: '#F2F2F5',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#63636E', marginTop: '4px', display: 'block' }}>
                  Only public HTTP/HTTPS URLs allowed. RFC 1918 private subnets and 169.254.169.254 metadata are rejected.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                    HTTP Method
                  </label>
                  <select
                    value={newDestinationMethod}
                    onChange={(e) => setNewDestinationMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      border: '1px solid #3E3E45',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: '#0E0E10',
                      color: '#F2F2F5',
                    }}
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                    Rate Limit (req/s)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={newDestinationRateLimit}
                    onChange={(e) => setNewDestinationRateLimit(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      border: '1px solid #3E3E45',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: '#0E0E10',
                      color: '#F2F2F5',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    min={500}
                    max={60000}
                    step={500}
                    value={newDestinationTimeout}
                    onChange={(e) => setNewDestinationTimeout(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      border: '1px solid #3E3E45',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: '#0E0E10',
                      color: '#F2F2F5',
                    }}
                  />
                </div>
              </div>

              {destinationActionError && (
                <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '16px' }}>
                  {destinationActionError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddDestinationModal(false)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'transparent',
                    border: '1px solid #3E3E45',
                    borderRadius: '999px',
                    color: '#9A9AA6',
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
                    padding: '9px 22px',
                    backgroundColor: '#F2F2F5',
                    border: 'none',
                    borderRadius: '999px',
                    color: '#0E0E10',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save Destination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT DELIVERY ATTEMPT (MILESTONE 3 OPTION 2) */}
      {selectedAttemptForModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(14, 14, 16, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#1E1E22',
            borderRadius: '20px',
            border: '1px solid #3E3E45',
            width: '100%',
            maxWidth: '650px',
            padding: '28px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#F2F2F5' }}>
                Delivery Attempt Details
              </h3>
              <button
                onClick={() => setSelectedAttemptForModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9A9AA6',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#141416', padding: '10px 14px', borderRadius: '10px', border: '1px solid #2C2C32' }}>
                <span style={{ fontSize: '11px', color: '#9A9AA6', display: 'block' }}>Status & Latency</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: selectedAttemptForModal.status === 'SUCCESS' ? '#4ade80' : '#f87171' }}>
                  {selectedAttemptForModal.statusCode ? `HTTP ${selectedAttemptForModal.statusCode}` : selectedAttemptForModal.status} · {selectedAttemptForModal.latencyMs}ms
                </span>
              </div>
              <div style={{ backgroundColor: '#141416', padding: '10px 14px', borderRadius: '10px', border: '1px solid #2C2C32' }}>
                <span style={{ fontSize: '11px', color: '#9A9AA6', display: 'block' }}>Target URL</span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#F2F2F5', wordBreak: 'break-all' }}>
                  {selectedAttemptForModal.requestMethod} {selectedAttemptForModal.requestUrl}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#9A9AA6', marginBottom: '6px' }}>
                Request Headers (including Outbound HMAC Signature)
              </label>
              <pre style={{
                backgroundColor: '#0E0E10',
                border: '1px solid #3E3E45',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                color: '#C9C9D2',
                overflowX: 'auto',
                margin: 0,
              }}>
                {JSON.stringify(selectedAttemptForModal.requestHeaders, null, 2)}
              </pre>
            </div>

            {selectedAttemptForModal.responseHeaders && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#9A9AA6', marginBottom: '6px' }}>
                  Response Headers
                </label>
                <pre style={{
                  backgroundColor: '#0E0E10',
                  border: '1px solid #3E3E45',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '11px',
                  color: '#C9C9D2',
                  overflowX: 'auto',
                  margin: 0,
                }}>
                  {JSON.stringify(selectedAttemptForModal.responseHeaders, null, 2)}
                </pre>
              </div>
            )}

            {selectedAttemptForModal.responseBodyPreview && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#9A9AA6', marginBottom: '6px' }}>
                  Response Body Preview
                </label>
                <pre style={{
                  backgroundColor: '#0E0E10',
                  border: '1px solid #3E3E45',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '11px',
                  color: '#F2F2F5',
                  overflowX: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  maxHeight: '160px',
                }}>
                  {selectedAttemptForModal.responseBodyPreview}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              {(isOwner || isDeveloper) && (
                <button
                  onClick={() => {
                    const id = selectedAttemptForModal.id;
                    setSelectedAttemptForModal(null);
                    void handleReplay(id);
                  }}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#232327',
                    color: '#F2F2F5',
                    border: '1px solid #3E3E45',
                    borderRadius: '999px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🔄</span>
                  <span>Replay Delivery</span>
                </button>
              )}
              <button
                onClick={() => setSelectedAttemptForModal(null)}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#F2F2F5',
                  color: '#0E0E10',
                  border: 'none',
                  borderRadius: '999px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
