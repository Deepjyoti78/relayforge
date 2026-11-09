import React, { useEffect, useState } from 'react';
import {
  getApiBaseUrl,
  createApiKey,
  createDestination,
  createEndpoint,
  deleteDestination,
  deleteEndpoint,
  fetchApiKeys,
  fetchDeliveries,
  fetchDestinations,
  fetchEndpoints,
  fetchExecutions,
  fetchWorkflows,
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
  WorkflowExecutionMetadata,
  WorkflowMetadata,
} from '../types.ts';
import { DlqConsole } from './DlqConsole.tsx';
import { MetricsDashboard } from './MetricsDashboard.tsx';
import { WorkflowConsole } from './WorkflowConsole.tsx';

interface OrgManagementProps {
  organization: OrganizationDetails;
  members: OrganizationMember[];
  currentUserId: string;
  activeTab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'destinations' | 'deliveries' | 'workflows' | 'metrics' | 'dlq' | 'settings';
  onTabChange: (tab: 'dashboard' | 'members' | 'api-keys' | 'endpoints' | 'destinations' | 'deliveries' | 'workflows' | 'metrics' | 'dlq' | 'settings') => void;
  onUpdateOrgName: (name: string) => Promise<void>;
  onDeleteOrg?: (orgId: string) => Promise<void>;
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
  onDeleteOrg,
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

  const handleDeleteOrgConfirm = async () => {
    if (!onDeleteOrg) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete organization "${organization.name}"?\n\nThis will remove all API keys, endpoints, destinations, and delivery history. This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await onDeleteOrg(organization.id);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete organization');
    }
  };

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

  // Sequential Workflows & Execution Lineage State (Milestone 4)
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [, setWorkflowsLoading] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecutionMetadata[]>([]);
  const [, setExecutionsLoading] = useState(false);

  // Inbound Webhook Simulator State (Milestone 3 Option 3 / Step 7)
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [simulatorEndpointId, setSimulatorEndpointId] = useState<string>('');
  const [simulatorEventType, setSimulatorEventType] = useState('payment.succeeded');
  const [simulatorIdempotencyKey, setSimulatorIdempotencyKey] = useState(`idem_${Math.random().toString(36).substring(2, 10)}`);
  const [simulatorPayload, setSimulatorPayload] = useState(JSON.stringify({
    event: 'payment.succeeded',
    amount: 4900,
    currency: 'USD',
    customer: {
      id: 'cus_9821',
      name: 'Jane Doe',
      email: 'jane@example.com'
    },
    metadata: {
      source: 'RelayForge Console',
      env: 'production'
    }
  }, null, 2));
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatorError, setSimulatorError] = useState<string | null>(null);
  const [simulatorResult, setSimulatorResult] = useState<{
    success: boolean;
    eventId: string;
    status: string;
    receivedAt: string;
    signature: string;
  } | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const openSimulator = (endpointId?: string) => {
    const targetId = endpointId || (endpoints.length > 0 ? endpoints[0].id : '');
    setSimulatorEndpointId(targetId);
    setSimulatorResult(null);
    setSimulatorError(null);
    setSimulatorIdempotencyKey(`idem_${Math.random().toString(36).substring(2, 10)}`);
    setShowSimulatorModal(true);
  };

  const handleRunSimulator = async () => {
    if (!simulatorEndpointId) {
      setSimulatorError('Please select an ingestion endpoint.');
      return;
    }

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(simulatorPayload);
    } catch {
      setSimulatorError('Invalid JSON payload format. Please check syntax.');
      return;
    }

    setSimulatorLoading(true);
    setSimulatorError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/ingest/simulate/${simulatorEndpointId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventType: simulatorEventType,
          idempotencyKey: simulatorIdempotencyKey || undefined,
          payload: parsedPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Simulation failed with HTTP status ${res.status}`);
      }

      const data = await res.json();
      setSimulatorResult({
        success: true,
        eventId: data.eventId,
        status: data.status,
        receivedAt: data.receivedAt,
        signature: data.signature,
      });

      // Refresh deliveries in background so user can see it right away
      void loadDeliveries();
    } catch (err: unknown) {
      setSimulatorError(err instanceof Error ? err.message : 'Unknown simulation error');
    } finally {
      setSimulatorLoading(false);
    }
  };

  const setSimulatorPreset = (type: string) => {
    setSimulatorEventType(type);
    setSimulatorIdempotencyKey(`idem_${Math.random().toString(36).substring(2, 10)}`);
    if (type === 'payment.succeeded') {
      setSimulatorPayload(JSON.stringify({
        event: 'payment.succeeded',
        amount: 4900,
        currency: 'USD',
        customer: { id: 'cus_9821', name: 'Jane Doe', email: 'jane@example.com' },
        metadata: { source: 'RelayForge Console' }
      }, null, 2));
    } else if (type === 'user.signup') {
      setSimulatorPayload(JSON.stringify({
        event: 'user.signup',
        user: { id: 'usr_4102', email: 'dev@relayforge.io', plan: 'enterprise' },
        timestamp: new Date().toISOString()
      }, null, 2));
    } else if (type === 'order.fulfilled') {
      setSimulatorPayload(JSON.stringify({
        event: 'order.fulfilled',
        orderId: 'ord_7718',
        trackingNumber: 'TRK-98127391',
        itemsCount: 3
      }, null, 2));
    }
  };

  const handleCopyCurl = () => {
    const ep = endpoints.find(e => e.id === simulatorEndpointId);
    const ingestUrl = ep
      ? `http://127.0.0.1:3100/v1/ingest/${ep.id}`
      : 'http://127.0.0.1:3100/v1/ingest/<ENDPOINT_ID>';

    const inlinePayload = simulatorPayload.replace(/\r?\n/g, '').replace(/\s+/g, ' ');
    const curlCmd = `curl -X POST "${ingestUrl}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Event-Type: ${simulatorEventType}" \\\n  -H "X-Idempotency-Key: ${simulatorIdempotencyKey}" \\\n  -d '${inlinePayload}'`;

    void navigator.clipboard.writeText(curlCmd);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  // Generic In-App Confirmation Modal (Replaces all browser popups)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  const executeConfirmedAction = async () => {
    if (!confirmModal) return;
    setIsConfirmLoading(true);
    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } catch {
      // Handlers set their own action error state
    } finally {
      setIsConfirmLoading(false);
    }
  };

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
    void loadWorkflows();
    void loadExecutions();
  }, [organization.id]);

  const loadWorkflows = async () => {
    setWorkflowsLoading(true);
    try {
      const data = await fetchWorkflows(organization.id);
      setWorkflows(data);
    } catch {
      // Ignore if user lacks permissions
    } finally {
      setWorkflowsLoading(false);
    }
  };

  const loadExecutions = async () => {
    setExecutionsLoading(true);
    try {
      const data = await fetchExecutions(organization.id);
      setExecutions(data);
    } catch {
      // Ignore if user lacks permissions
    } finally {
      setExecutionsLoading(false);
    }
  };

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

  const promptRevokeApiKey = (key: ApiKeyMetadata) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoke API Key',
      message: `Are you sure you want to revoke API key "${key.name}" (${key.keyPrefix}...)? This action is permanent and cannot be undone. Any service utilizing this key will immediately be denied access.`,
      confirmLabel: 'Revoke Key',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setKeyActionError(null);
        try {
          const updated = await revokeApiKey(organization.id, key.id);
          setApiKeys((prev) => prev.map((k) => (k.id === key.id ? updated : k)));
        } catch (err: unknown) {
          setKeyActionError(err instanceof Error ? err.message : 'Failed to revoke API key');
        }
      },
    });
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

  const promptRotateSecret = (endpoint: EndpointMetadata) => {
    setConfirmModal({
      isOpen: true,
      title: 'Rotate Webhook Signing Secret',
      message: `Are you sure you want to rotate the HMAC signing secret for endpoint "${endpoint.name}" (${endpoint.slug})? Previous webhook signatures will immediately fail verification until downstream services adopt the new secret.`,
      confirmLabel: 'Rotate Secret',
      confirmVariant: 'warning',
      onConfirm: async () => {
        setEndpointActionError(null);
        try {
          const res = await rotateEndpointSecret(organization.id, endpoint.id);
          setCreatedRawSecret(res.signingSecret);
          setEndpoints((prev) => prev.map((ep) => (ep.id === endpoint.id ? res.endpoint : ep)));
        } catch (err: unknown) {
          setEndpointActionError(err instanceof Error ? err.message : 'Failed to rotate secret');
        }
      },
    });
  };

  const promptDeleteEndpoint = (endpoint: EndpointMetadata) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Ingestion Endpoint',
      message: `Are you sure you want to delete endpoint "${endpoint.name}" (${endpoint.slug})? Inbound webhooks directed to this endpoint will immediately be rejected.`,
      confirmLabel: 'Delete Endpoint',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setEndpointActionError(null);
        try {
          await deleteEndpoint(organization.id, endpoint.id);
          setEndpoints((prev) => prev.filter((ep) => ep.id !== endpoint.id));
        } catch (err: unknown) {
          setEndpointActionError(err instanceof Error ? err.message : 'Failed to delete endpoint');
        }
      },
    });
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

  const promptDeleteDestination = (destination: DestinationMetadata) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Destination Target',
      message: `Are you sure you want to delete destination target "${destination.name}" (${destination.url})? Webhooks will no longer be forwarded to this target.`,
      confirmLabel: 'Delete Destination',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setDestinationActionError(null);
        try {
          await deleteDestination(organization.id, destination.id);
          setDestinations((prev) => prev.filter((d) => d.id !== destination.id));
        } catch (err: unknown) {
          setDestinationActionError(err instanceof Error ? err.message : 'Failed to delete destination');
        }
      },
    });
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

  const promptRemoveMember = (member: OrganizationMember) => {
    const memberName = member.user.displayName || member.user.email || 'this member';
    setConfirmModal({
      isOpen: true,
      title: 'Remove Member',
      message: `Are you sure you want to remove ${memberName} from "${organization.name}"? They will immediately lose access to organization resources.`,
      confirmLabel: 'Remove Member',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setActionError(null);
        try {
          await onRemoveMember(member.id);
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : 'Failed to remove member');
        }
      },
    });
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

  const getTabButtonStyle = (isActive: boolean) => ({
    padding: '8px 18px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: isActive ? '#F7EFE2' : '#0A0A0A',
    color: isActive ? '#0A0A0A' : '#A3A3A3',
    border: isActive ? '1px solid transparent' : '1px solid #202020',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  });

  const getTabBadgeStyle = (isActive: boolean) => ({
    fontSize: '11px',
    padding: '1px 7px',
    borderRadius: '999px',
    backgroundColor: isActive ? '#E7DDD0' : '#161616',
    color: isActive ? '#0A0A0A' : '#A3A3A3',
    fontWeight: 700,
  });

  return (
    <div className="rf-main-content" style={{ position: 'relative' }}>
      <div key={activeTab} className="rf-page-animate" style={{ width: '100%' }}>
      
      {/* Eyebrow and Page Title */}
      <div className="rf-header-row">
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#A3A3A3',
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
                  backgroundColor: '#000000',
                  border: '1px solid #2A2A2A',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  padding: '4px 12px',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '7px 16px',
                  backgroundColor: '#F7EFE2', color: '#121214', border: 'none', borderRadius: '999px',
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
                  color: '#A3A3A3',
                  border: '1px solid #2A2A2A',
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
                color: '#FFFFFF',
                margin: 0,
                letterSpacing: '-0.02em',
              }}>
                {organization.name}
              </h1>
              {isOwner && (
                <button
                  onClick={() => setIsRenaming(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#111111',
                    border: '1px solid #2A2A2A',
                    color: '#E5E5E5',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '999px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#202020'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#111111'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  <span>Rename</span>
                </button>
              )}
              {isOwner && onDeleteOrg && (
                <button
                  onClick={() => void handleDeleteOrgConfirm()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '999px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'; }}
                  title="Permanently delete this organization"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>Delete Org</span>
                </button>
              )}
            </div>
          )}

          <p style={{
            fontSize: '13px',
            color: '#A3A3A3',
            margin: '6px 0 0 0',
          }}>
            {activeTab === 'dashboard'
              ? 'Tenant overview, system metrics, credential counts, and pipeline architecture.'
              : activeTab === 'members'
              ? 'Manage registered team members, membership roles, and administrative rights.'
              : activeTab === 'api-keys'
              ? 'Manage scoped organization API keys for high-throughput ingestion authentication.'
              : activeTab === 'endpoints'
              ? 'Manage webhook ingestion endpoints and rotate AES-256-GCM signing secrets.'
              : activeTab === 'destinations'
              ? 'Configure outbound destination targets with private network SSRF protection.'
              : activeTab === 'deliveries'
              ? 'Monitor transactional outbox deliveries, exponential retries, and dead letters.'
              : activeTab === 'workflows'
              ? 'Compose sequential pipelines: Webhook trigger → Conditions → JSON transform → HTTP actions.'
              : activeTab === 'metrics'
              ? 'Real-time telemetry streams, latency quantiles (p50/p95/p99), and outbox backlog rates.'
              : activeTab === 'dlq'
              ? 'Dead Letter Queue management, error category filtering, and atomic bulk message replay.'
              : 'Organization parameters, slug identifier, and Row-Level Security isolation.'}
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
                backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
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
                backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              + Generate Key
            </button>
          )}

          {activeTab === 'endpoints' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => openSimulator()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  backgroundColor: '#202020',
                  border: '1px solid #2A2A2A',
                  borderRadius: '999px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>⚡</span>
                <span>Test Webhook</span>
              </button>
              {canManageKeys && (
                <button
                  onClick={() => setShowAddEndpointModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 22px',
                    backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
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
          )}

          {canManageKeys && activeTab === 'destinations' && (
            <button
              onClick={() => setShowAddDestinationModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 22px',
                backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              + Add Destination
            </button>
          )}

          {activeTab === 'deliveries' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => openSimulator()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                }}
              >
                <span>⚡</span>
                <span>Send Test Webhook</span>
              </button>
              <button
                onClick={() => void loadDeliveries()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  backgroundColor: '#202020',
                  border: '1px solid #2A2A2A',
                  borderRadius: '999px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ↻ Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4 SUMMARY STAT CARDS FOR MEMBERS DIRECTORY */}
      {activeTab === 'members' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '26px',
        }}>
          {/* Total Members - High Contrast Ivory Surface matching reference */}
          <div style={{
            backgroundColor: '#F7EFE2',
            border: '1px solid #E5DAC8',
            borderRadius: '16px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1 }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(18, 18, 20, 0.08)',
                border: '1px solid rgba(18, 18, 20, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0A0A0A',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#0A0A0A', lineHeight: '1.2' }}>
                  {members.length}
                </div>
                <div style={{ fontSize: '13px', color: '#737373', fontWeight: 600, marginTop: '2px' }}>
                  Total Members
                </div>
              </div>
            </div>
            {/* Watermark silhouette icon on right */}
            <svg
              width="68"
              height="68"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0A0A0A"
              strokeWidth="1.2"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: 0.12,
                pointerEvents: 'none',
              }}
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>

          {/* Owners */}
          <div style={{
            backgroundColor: '#121217',
            border: '1px solid #202020',
            borderRadius: '16px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#111111',
              border: '1px solid #202020',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#C5A059',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.2' }}>
                {Math.max(1, members.filter((m) => m.role === 'OWNER').length)}
              </div>
              <div style={{ fontSize: '13px', color: '#A3A3A3', fontWeight: 500, marginTop: '2px' }}>
                Owners
              </div>
            </div>
          </div>

          {/* Active Members */}
          <div style={{
            backgroundColor: '#121217',
            border: '1px solid #202020',
            borderRadius: '16px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#111111',
              border: '1px solid #202020',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9"></polyline>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.2' }}>
                {Math.max(1, members.length)}
              </div>
              <div style={{ fontSize: '13px', color: '#A3A3A3', fontWeight: 500, marginTop: '2px' }}>
                Active Members
              </div>
            </div>
          </div>

          {/* Invitations Pending */}
          <div style={{
            backgroundColor: '#121217',
            border: '1px solid #202020',
            borderRadius: '16px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#111111',
              border: '1px solid #202020',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#A3A3A3',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.2' }}>
                0
              </div>
              <div style={{ fontSize: '13px', color: '#A3A3A3', fontWeight: 500, marginTop: '2px' }}>
                Invitations Pending
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATS CARDS ROW (SHOWN ONLY IN OVERVIEW SECTION - EXACTLY MATCHING IMAGE 2) */}
      {activeTab === 'dashboard' && (
        <div className="rf-stats-grid">
          {/* Card 1: TOTAL MEMBERS (Active Highlight Surface: Warm Ivory Cream #F7EFE2) */}
          <div
            onClick={() => onTabChange('members')}
            title="Click to view Members Directory"
            style={{
              backgroundColor: '#F7EFE2',
              border: '1px solid #E5DAC8',
              borderRadius: '20px',
              padding: '22px 24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              minWidth: 0,
              boxSizing: 'border-box',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#121214" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#121214', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  TOTAL MEMBERS
                </span>
              </div>
              <div style={{ fontSize: '34px', fontWeight: 800, color: '#121214', lineHeight: '1.1' }}>
                {members.length}
              </div>
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: '#121214',
                  color: '#4ADE80',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  ↑ {members.length} active
                </span>
                <span style={{ fontSize: '11px', color: '#737373', fontWeight: 600 }}>Enrolled</span>
              </div>
            </div>

            {/* Subtle Watermark on right matching Image 2 */}
            <div style={{
              position: 'absolute',
              right: '12px',
              bottom: '10px',
              opacity: 0.15,
              pointerEvents: 'none',
              color: '#121214',
            }}>
              <svg width="74" height="74" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <path d="M20 8v6M23 11h-6"></path>
              </svg>
            </div>
          </div>

          {/* Card 2: ACTIVE API KEYS (Dark Surface matching Image 2) */}
          <div
            onClick={() => onTabChange('api-keys')}
            title="Click to manage API Keys"
            style={{
              backgroundColor: '#111111',
              border: '1px solid #202020',
              borderRadius: '20px',
              padding: '22px 24px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5-3 3 1.5 1.5L9 14l-5 5H2v-2l5-5 1.5 1.5 3-3-1.5-1.5 3.5-3.5 1.5 1.5L21 2z"></path>
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#A3A3A3', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                ACTIVE API KEYS
              </span>
            </div>
            <div style={{ fontSize: '34px', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.1' }}>
              {activeKeyCount}
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#737373', fontWeight: 500 }}>
              SHA-256 hashed live keys
            </div>
          </div>

          {/* Card 3: Ingestion Endpoints (Dark Surface matching Image 2) */}
          <div
            onClick={() => onTabChange('endpoints')}
            title="Click to view Endpoints"
            style={{
              backgroundColor: '#111111',
              border: '1px solid #202020',
              borderRadius: '20px',
              padding: '22px 24px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A3A3A3', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                ENDPOINTS (M3)
              </span>
            </div>
            <div style={{ fontSize: '34px', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.1' }}>
              {endpoints.length}
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#737373', fontWeight: 500 }}>
              AES-256-GCM signed
            </div>
          </div>

          {/* Card 4: Tenant Isolation (Dark Surface matching Image 2) */}
          <div
            onClick={() => onTabChange('settings')}
            title="Click to view Architecture & Settings"
            style={{
              backgroundColor: '#111111',
              border: '1px solid #202020',
              borderRadius: '20px',
              padding: '22px 24px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A3A3A3', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                TENANT ISOLATION
              </span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.2' }}>
              Enforced
            </div>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }}></span>
              <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: 500 }}>PostgreSQL RLS Active</span>
            </div>
          </div>
        </div>
      )}

      {/* FILTER PILLS ROW (ROUNDED PILLS - SHOWN IN TAB VIEWS) */}
      {activeTab !== 'dashboard' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px' }}>
          <div
            id="rf-tab-strip-container"
            className="rf-filter-pills"
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingBottom: '4px',
              marginBottom: 0,
              flex: 1,
            }}
          >
            <button className="rf-pill-btn" onClick={() => onTabChange('members')} style={getTabButtonStyle(activeTab === 'members')}>
              <span>All Members</span>
              <span style={getTabBadgeStyle(activeTab === 'members')}>{members.length}</span>
            </button>

            <button className="rf-pill-btn" onClick={() => onTabChange('api-keys')} style={getTabButtonStyle(activeTab === 'api-keys')}>
              <span>API Keys</span>
              <span style={getTabBadgeStyle(activeTab === 'api-keys')}>{apiKeys.length}</span>
            </button>

            <button className="rf-pill-btn" onClick={() => onTabChange('endpoints')} style={getTabButtonStyle(activeTab === 'endpoints')}>
              <span>Endpoints</span>
              <span style={getTabBadgeStyle(activeTab === 'endpoints')}>{endpoints.length}</span>
            </button>

            <button className="rf-pill-btn" onClick={() => onTabChange('destinations')} style={getTabButtonStyle(activeTab === 'destinations')}>
              <span>Destinations</span>
              <span style={getTabBadgeStyle(activeTab === 'destinations')}>{destinations.length}</span>
            </button>

            <button className="rf-pill-btn" onClick={() => onTabChange('deliveries')} style={getTabButtonStyle(activeTab === 'deliveries')}>
              <span>Deliveries</span>
              <span style={getTabBadgeStyle(activeTab === 'deliveries')}>{deliveries.length}</span>
            </button>

            <button className="rf-pill-btn" onClick={() => onTabChange('workflows')} style={getTabButtonStyle(activeTab === 'workflows')}>
              <span>Workflows (M4)</span>
              <span style={getTabBadgeStyle(activeTab === 'workflows')}>{workflows.length}</span>
            </button>

            <button className="rf-pill-btn" onClick={() => onTabChange('metrics')} style={getTabButtonStyle(activeTab === 'metrics')}>
              <span>Metrics (M5)</span>
              <span style={getTabBadgeStyle(activeTab === 'metrics')}>0</span>
            </button>

            <button className="rf-pill-btn" onClick={() => onTabChange('dlq')} style={getTabButtonStyle(activeTab === 'dlq')}>
              <span>Dead Letter Queue (M5)</span>
              <span style={getTabBadgeStyle(activeTab === 'dlq')}>0</span>
            </button>

            <button className="rf-pill-btn" onClick={() => onTabChange('settings')} style={getTabButtonStyle(activeTab === 'settings')}>
              <span>Settings</span>
            </button>
          </div>
          <button
            title="Scroll tabs forward"
            onClick={() => {
              const el = document.getElementById('rf-tab-strip-container');
              if (el) el.scrollBy({ left: 180, behavior: 'smooth' });
            }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#0A0A0A',
              border: '1px solid #202020',
              color: '#A3A3A3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#202020'; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0A0A0A'; e.currentTarget.style.color = '#A3A3A3'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      )}

      {/* SEARCH & FILTER ACTION BAR (MATCHING REFERENCE IMAGE) */}
      {activeTab !== 'dashboard' && activeTab !== 'settings' && activeTab !== 'workflows' && activeTab !== 'metrics' && activeTab !== 'dlq' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '22px',
          flexWrap: 'wrap',
        }}>
          {/* Main Search Input */}
          <div style={{
            flex: 1,
            minWidth: '260px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#121217',
            border: '1px solid #202020',
            borderRadius: '999px',
            padding: '10px 20px',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.25)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2.2">
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
                color: '#FFFFFF',
                width: '100%',
              }}
            />
          </div>

          {/* Filters Pill Button */}
          <button
            title="Toggle filter criteria"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: '#0A0A0A',
              border: '1px solid #202020',
              borderRadius: '999px',
              color: '#E5E5E5',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2A2A2A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#202020';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Filters</span>
          </button>

          {/* Sort Pill Button */}
          <button
            title="Sort members"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: '#0A0A0A',
              border: '1px solid #202020',
              borderRadius: '999px',
              color: '#E5E5E5',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2A2A2A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#202020';
            }}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>⇅</span>
            <span>Sort: Enrolled Date</span>
            <span style={{ fontSize: '11px', color: '#A3A3A3' }}>⌄</span>
          </button>
        </div>
      )}

      {/* FEEDBACK BANNER: CREATED RAW API KEY */}
      {createdRawKey && (
        <div style={{
          backgroundColor: '#161616',
          border: '1px solid #2A2A2A',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
            <span>🔑 API Key Generated Successfully</span>
          </div>
          <p style={{ fontSize: '13px', color: '#A3A3A3', margin: '0 0 14px' }}>
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
                backgroundColor: '#000000',
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                color: '#FFFFFF',
              }}
            />
            <button
              onClick={() => handleCopyText(createdRawKey)}
              style={{
                padding: '10px 18px',
                backgroundColor: copiedKey ? '#2A2A2A' : '#FFFFFF',
                color: copiedKey ? '#FFFFFF' : '#000000',
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
                color: '#A3A3A3',
                border: '1px solid #2A2A2A',
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
          backgroundColor: '#161616',
          border: '1px solid #2A2A2A',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
            <span>🔒 Webhook Signing Secret Generated (AES-256-GCM)</span>
          </div>
          <p style={{ fontSize: '13px', color: '#A3A3A3', margin: '0 0 14px' }}>
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
                backgroundColor: '#000000',
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                color: '#FFFFFF',
              }}
            />
            <button
              onClick={() => handleCopyText(createdRawSecret, true)}
              style={{
                padding: '10px 18px',
                backgroundColor: copiedSecret ? '#2A2A2A' : '#FFFFFF',
                color: copiedSecret ? '#FFFFFF' : '#000000',
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
                color: '#A3A3A3',
                border: '1px solid #2A2A2A',
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

      {/* TABLE CONTAINER FOR DIRECTORY / LOG VIEWS */}
      {activeTab !== 'dashboard' && activeTab !== 'settings' && activeTab !== 'workflows' && (
        <div className="rf-table-responsive">
          {/* MEMBERS VIEW (MATCHING PIXEL REFERENCE) */}
          {activeTab === 'members' && (
            <div style={{
              backgroundColor: '#0A0A0A',
              border: '1px solid #161616',
              borderRadius: '16px',
              overflow: 'visible',
            }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid #202020',
                    color: '#A3A3A3',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    backgroundColor: '#0A0A0A',
                  }}>
                    <th style={{ width: '44px', padding: '16px 20px', textAlign: 'center', borderTopLeftRadius: '16px' }}>
                      <input
                        type="checkbox"
                        style={{
                          accentColor: '#C5A059',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          width: '15px',
                          height: '15px',
                        }}
                      />
                    </th>
                    <th style={{ padding: '16px 18px' }}>Member ID</th>
                    <th style={{ padding: '16px 18px' }}>Member Name & Contact</th>
                    <th style={{ padding: '16px 18px' }}>Role</th>
                    <th style={{ padding: '16px 18px' }}>Enrolled Date</th>
                    <th style={{ padding: '16px 18px' }}>Status</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right', borderTopRightRadius: '16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '52px 20px', textAlign: 'center', color: '#737373', fontSize: '13px' }}>
                        No members match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m, idx) => {
                      const isCurrent = m.userId === currentUserId;
                      const memberIdDisplay = `MEM-${m.userId.slice(0, 5).toUpperCase()}`;
                      const isMenuOpen = activeMenuMemberId === m.id;
                      const enrolledDate = new Date(m.joinedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });

                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: idx === filteredMembers.length - 1 ? 'none' : '1px solid #161616',
                            fontSize: '13px',
                            color: '#FFFFFF',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {/* Checkbox Column */}
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              style={{
                                accentColor: '#C5A059',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                width: '15px',
                                height: '15px',
                              }}
                            />
                          </td>

                          {/* Member ID Monospace Badge */}
                          <td style={{ padding: '16px 18px' }}>
                            <span style={{
                              display: 'inline-block',
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#A3A3A3',
                              backgroundColor: '#111111',
                              border: '1px solid #202020',
                              borderRadius: '999px',
                              padding: '3px 12px',
                            }}>
                              {memberIdDisplay}
                            </span>
                          </td>

                          {/* Member Name & Contact */}
                          <td style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {m.user.avatarUrl ? (
                                <img
                                  src={m.user.avatarUrl}
                                  alt=""
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '1px solid #2A2A2A',
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  backgroundColor: '#111111',
                                  border: '1px solid #2A2A2A',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                }}>
                                  {(m.user.displayName || m.user.email || 'U').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{m.user.displayName || 'Deepjyoti'}</span>
                                  {isCurrent && <span style={{ color: '#A3A3A3', fontWeight: 400, fontSize: '12px' }}>(You)</span>}
                                </div>
                                <div style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '1px' }}>
                                  {m.user.email || 'deepjyoti478@gmail.com'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td style={{ padding: '16px 18px' }}>
                            {m.role === 'OWNER' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 12px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 800,
                                backgroundColor: '#F7EFE2',
                                color: '#0A0A0A',
                                letterSpacing: '0.04em',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                              }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#C5A059" stroke="#9A7B44" strokeWidth="1.5">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                </svg>
                                <span>OWNER</span>
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: '#161616',
                                border: '1px solid #2A2A2A',
                                color: '#E5E5E5',
                                letterSpacing: '0.04em',
                              }}>
                                {m.role}
                              </span>
                            )}
                          </td>

                          {/* Enrolled Date */}
                          <td style={{ padding: '16px 18px', color: '#A3A3A3', fontSize: '13px' }}>
                            {enrolledDate}
                          </td>

                          {/* Status Pill with Glowing Green Dot */}
                          <td style={{ padding: '16px 18px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '7px',
                              padding: '4px 12px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: '#0A0A0A',
                              color: '#FFFFFF',
                              border: '1px solid #202020',
                            }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#10b981',
                                boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
                              }}></span>
                              Active
                            </span>
                          </td>

                          {/* Actions Button */}
                          <td style={{ padding: '16px 20px', textAlign: 'right', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                title="Member Actions"
                                onClick={() => setActiveMenuMemberId(isMenuOpen ? null : m.id)}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: isMenuOpen ? '#202020' : '#0A0A0A',
                                  border: '1px solid #202020',
                                  color: '#E5E5E5',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#202020';
                                  e.currentTarget.style.borderColor = '#2A2A2A';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isMenuOpen) {
                                    e.currentTarget.style.backgroundColor = '#0A0A0A';
                                    e.currentTarget.style.borderColor = '#202020';
                                  }
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="12" r="2"></circle>
                                  <circle cx="6" cy="12" r="2"></circle>
                                  <circle cx="18" cy="12" r="2"></circle>
                                </svg>
                              </button>

                              {/* Action Popover Menu */}
                              {isMenuOpen && (
                                <>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuMemberId(null);
                                    }}
                                    style={{
                                      position: 'fixed',
                                      inset: 0,
                                      zIndex: 998,
                                    }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    right: '20px',
                                    top: '46px',
                                    backgroundColor: '#111111',
                                    border: '1px solid #2A2A2A',
                                    borderRadius: '12px',
                                    padding: '8px',
                                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85)',
                                    zIndex: 9999,
                                    minWidth: '205px',
                                    textAlign: 'left',
                                  }}>
                                    {isOwner && !isCurrent ? (
                                      <>
                                        <div style={{ fontSize: '11px', color: '#A3A3A3', padding: '4px 8px', fontWeight: 600 }}>
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
                                                backgroundColor: m.role === r ? '#202020' : 'transparent',
                                                color: '#FFFFFF',
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
                                        <div style={{ height: '1px', backgroundColor: '#2A2A2A', margin: '4px 0' }} />
                                        <button
                                          onClick={() => {
                                            promptRemoveMember(m);
                                            setActiveMenuMemberId(null);
                                          }}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
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
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                          </svg>
                                          <span>Remove Member</span>
                                        </button>
                                      </>
                                    ) : isCurrent && isOwner ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          fontSize: '12px',
                                          color: '#E5E5E5',
                                          padding: '7px 10px',
                                          fontWeight: 600,
                                        }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="2">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                          </svg>
                                          <span>Organization Owner</span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            setIsRenaming(true);
                                            setActiveMenuMemberId(null);
                                          }}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '7px 10px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            backgroundColor: 'transparent',
                                            color: '#E5E5E5',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            width: '100%',
                                            transition: 'background-color 0.15s ease',
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#202020'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 20h9"></path>
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                          </svg>
                                          <span>Rename Organization</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            onTabChange('settings');
                                            setActiveMenuMemberId(null);
                                          }}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '7px 10px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            backgroundColor: 'transparent',
                                            color: '#E5E5E5',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            width: '100%',
                                            transition: 'background-color 0.15s ease',
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#202020'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="3"></circle>
                                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                          </svg>
                                          <span>Organization Settings</span>
                                        </button>
                                        {onDeleteOrg && (
                                          <>
                                            <div style={{ height: '1px', backgroundColor: '#2A2A2A', margin: '4px 0' }} />
                                            <button
                                              onClick={() => {
                                                setActiveMenuMemberId(null);
                                                void handleDeleteOrgConfirm();
                                              }}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                width: '100%',
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                backgroundColor: 'transparent',
                                                color: '#f87171',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                fontWeight: 500,
                                                transition: 'background-color 0.15s ease',
                                              }}
                                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'; }}
                                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                            >
                                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                              </svg>
                                              <span>Delete Organization</span>
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ) : isCurrent && !isOwner ? (
                                      <button
                                        onClick={() => {
                                          promptRemoveMember(m);
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
                                      <div style={{ fontSize: '12px', color: '#A3A3A3', padding: '6px 8px' }}>
                                        No actions available
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderTop: '1px solid #161616',
                backgroundColor: '#121217',
                color: '#A3A3A3',
                fontSize: '13px',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
              }}>
                <div>
                  Showing 1-{Math.max(1, filteredMembers.length)} of {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    disabled
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      border: '1px solid #202020',
                      backgroundColor: '#0A0A0A',
                      color: '#737373',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'not-allowed',
                      fontSize: '13px',
                    }}
                  >
                    &lt;
                  </button>
                  <button
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#F7EFE2',
                      color: '#0A0A0A',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    1
                  </button>
                  <button
                    disabled
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      border: '1px solid #202020',
                      backgroundColor: '#0A0A0A',
                      color: '#737373',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'not-allowed',
                      fontSize: '13px',
                    }}
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* API KEYS VIEW */}
        {activeTab === 'api-keys' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '720px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #2A2A2A',
                color: '#A3A3A3',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backgroundColor: '#161616',
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
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
                    Loading API keys...
                  </td>
                </tr>
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
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
                        borderBottom: idx === filteredKeys.length - 1 ? 'none' : '1px solid #2A2A2A',
                        fontSize: '13px',
                        color: '#FFFFFF',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#A3A3A3' }}>
                        {keyIdDisplay}
                      </td>

                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                        {k.name}
                      </td>

                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', color: '#E5E5E5' }}>
                        <code>{k.keyPrefix}...</code>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        {k.scopes.map((s) => (
                          <span key={s} style={{
                            padding: '2px 8px',
                            backgroundColor: '#000000',
                            color: '#FFFFFF',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            marginRight: '4px',
                            border: '1px solid #2A2A2A',
                          }}>
                            {s}
                          </span>
                        ))}
                      </td>

                      <td style={{ padding: '14px 20px', color: '#A3A3A3', fontSize: '12px' }}>
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
                            onClick={() => promptRevokeApiKey(k)}
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
                borderBottom: '1px solid #2A2A2A',
                color: '#A3A3A3',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backgroundColor: '#161616',
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
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
                    Loading ingestion endpoints...
                  </td>
                </tr>
              ) : filteredEndpoints.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
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
                        borderBottom: idx === filteredEndpoints.length - 1 ? 'none' : '1px solid #2A2A2A',
                        fontSize: '13px',
                        color: '#FFFFFF',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#A3A3A3' }}>
                        {epIdDisplay}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{ep.name}</div>
                        <div style={{ fontSize: '11px', color: '#A3A3A3', fontFamily: 'monospace' }}>/{ep.slug}</div>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code style={{
                            fontSize: '11px',
                            backgroundColor: '#000000',
                            border: '1px solid #2A2A2A',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            color: '#FFFFFF',
                          }}>
                            {`/v1/ingest/${ep.id.slice(0, 8)}...`}
                          </code>
                          <button
                            onClick={() => handleCopyText(ingestUrl, false, ep.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: isCopied ? '#4ade80' : '#A3A3A3',
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

                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#E5E5E5' }}>
                        <code>{ep.secretPreview}...</code>
                      </td>

                      <td style={{ padding: '14px 20px', color: '#A3A3A3', fontSize: '12px' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            title="Test inbound webhook simulation"
                            onClick={() => openSimulator(ep.id)}
                            style={{
                              backgroundColor: '#202020',
                              border: '1px solid #2A2A2A',
                              color: '#FFFFFF',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            ⚡ Test
                          </button>
                          {canManageKeys && (
                            <>
                              <button
                                title="Rotate signing secret"
                                onClick={() => promptRotateSecret(ep)}
                                style={{
                                  backgroundColor: 'transparent',
                                  border: '1px solid #2A2A2A',
                                  color: '#E5E5E5',
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
                                onClick={() => promptDeleteEndpoint(ep)}
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
                            </>
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

        {/* DESTINATIONS VIEW (MILESTONE 3 OPTION 1: SSRF PROTECTED) */}
        {activeTab === 'destinations' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid #2A2A2A',
                color: '#A3A3A3',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backgroundColor: '#161616',
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
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
                    Loading destination targets...
                  </td>
                </tr>
              ) : filteredDestinations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
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
                        borderBottom: idx === filteredDestinations.length - 1 ? 'none' : '1px solid #2A2A2A',
                        fontSize: '13px',
                        color: '#FFFFFF',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#A3A3A3' }}>
                        {destIdDisplay}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div style={{ marginTop: '3px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            backgroundColor: '#000000',
                            border: '1px solid #2A2A2A',
                            color: '#FFFFFF',
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
                            backgroundColor: '#000000',
                            border: '1px solid #2A2A2A',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            color: '#FFFFFF',
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

                      <td style={{ padding: '14px 20px', color: '#E5E5E5', fontSize: '12px' }}>
                        <div>{d.rateLimitPerSecond} req/sec</div>
                        <div style={{ fontSize: '11px', color: '#A3A3A3' }}>{d.timeoutMs}ms timeout</div>
                      </td>

                      <td style={{ padding: '14px 20px', color: '#A3A3A3', fontSize: '12px' }}>
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
                                backgroundColor: '#202020',
                                border: '1px solid #2A2A2A',
                                color: pingLoadingId === d.id ? '#A3A3A3' : '#FFFFFF',
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
                              onClick={() => promptDeleteDestination(d)}
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
                borderBottom: '1px solid #2A2A2A',
                color: '#A3A3A3',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                backgroundColor: '#161616',
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
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
                    Loading delivery attempt history...
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
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
                        borderBottom: idx === filteredDeliveries.length - 1 ? 'none' : '1px solid #2A2A2A',
                        fontSize: '13px',
                        color: '#FFFFFF',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#A3A3A3' }}>
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
                            backgroundColor: '#000000',
                            border: '1px solid #2A2A2A',
                            color: '#FFFFFF',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            {att.requestMethod}
                          </span>
                          <code style={{
                            fontSize: '12px',
                            backgroundColor: '#000000',
                            border: '1px solid #2A2A2A',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            color: '#FFFFFF',
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
                          backgroundColor: '#202020',
                          color: '#E5E5E5',
                          border: '1px solid #2A2A2A',
                        }}>
                          {att.latencyMs} ms
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', color: '#A3A3A3', fontSize: '12px' }}>
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
                                backgroundColor: replayingDeliveryId === att.id ? '#2A2A2A' : '#202020',
                                border: '1px solid #2A2A2A',
                                color: '#FFFFFF',
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
                              backgroundColor: '#202020',
                              border: '1px solid #2A2A2A',
                              color: '#FFFFFF',
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
        </div>
      )}

      {/* SEQUENTIAL WORKFLOWS VIEW (MILESTONE 4) */}
      {activeTab === 'workflows' && (
        <WorkflowConsole
          organization={organization}
          workflows={workflows}
          executions={executions}
          endpoints={endpoints}
          destinations={destinations}
          canManage={canManageKeys}
          onRefreshWorkflows={loadWorkflows}
          onRefreshExecutions={loadExecutions}
          onRequestConfirm={(opts) => setConfirmModal({ ...opts, isOpen: true })}
        />
      )}

      {/* OPERATIONAL METRICS & REAL-TIME TELEMETRY (MILESTONE 5) */}
      {activeTab === 'metrics' && (
        <MetricsDashboard organizationId={organization.id} />
      )}

      {/* DEAD LETTER QUEUE & BULK REMEDIATION (MILESTONE 5) */}
      {activeTab === 'dlq' && (
        <DlqConsole
          organizationId={organization.id}
          onRequestConfirm={(opts) => setConfirmModal({ ...opts, isOpen: true })}
        />
      )}

      {/* OVERVIEW DASHBOARD VIEW (ACTIVE WHEN activeTab === 'dashboard' - EXACTLY MATCHING IMAGE 2) */}
      {activeTab === 'dashboard' && (
        <div style={{ padding: '8px 0 24px', width: '100%', boxSizing: 'border-box' }}>
          {/* Header Row: Tenant Operations & Quick Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            marginTop: '8px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              Tenant Operations
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#737373' }}>
              Quick Actions
            </span>
          </div>

          {/* Quick Navigation Cards Grid (4 columns matching Image 2) */}
          <div className="rf-nav-grid">
            {/* Box 1: Members Directory */}
            <div style={{
              backgroundColor: '#111111',
              border: '1px solid #202020',
              borderRadius: '16px',
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '170px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                    </svg>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>Members Directory</span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#181818', border: '1px solid #262626', color: '#A3A3A3', fontWeight: 600 }}>
                    {members.length} enrolled
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#737373', margin: 0, lineHeight: 1.5 }}>
                  Manage member permissions, RBAC roles (Owner, Developer, Member), and invitations.
                </p>
              </div>
              <button
                onClick={() => onTabChange('members')}
                style={{
                  marginTop: '18px',
                  padding: '9px 18px',
                  backgroundColor: '#F7EFE2',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#121214',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: 'fit-content',
                  transition: 'opacity 0.15s ease',
                }}
              >
                View Directory →
              </button>
            </div>

            {/* Box 2: API Keys */}
            <div style={{
              backgroundColor: '#111111',
              border: '1px solid #202020',
              borderRadius: '16px',
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '170px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="2">
                      <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5-3 3 1.5 1.5L9 14l-5 5H2v-2l5-5 1.5 1.5 3-3-1.5-1.5 3.5-3.5 1.5 1.5L21 2z"></path>
                    </svg>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>API Keys & Credentials</span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#181818', border: '1px solid #262626', color: '#A3A3A3', fontWeight: 600 }}>
                    {activeKeyCount} active
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#737373', margin: 0, lineHeight: 1.5 }}>
                  High-throughput ingestion keys with SHA-256 database hashing and instant revocation.
                </p>
              </div>
              <button
                onClick={() => onTabChange('api-keys')}
                style={{
                  marginTop: '18px',
                  padding: '9px 18px',
                  backgroundColor: '#F7EFE2',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#121214',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: 'fit-content',
                  transition: 'opacity 0.15s ease',
                }}
              >
                Manage API Keys →
              </button>
            </div>

            {/* Box 3: Endpoints */}
            <div style={{
              backgroundColor: '#111111',
              border: '1px solid #202020',
              borderRadius: '16px',
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '170px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>Webhook Ingestion</span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#181818', border: '1px solid #262626', color: '#A3A3A3', fontWeight: 600 }}>
                    {endpoints.length} endpoints
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#737373', margin: 0, lineHeight: 1.5 }}>
                  Dedicated tenant endpoints secured by rotated AES-256-CCM signing secrets.
                </p>
              </div>
              <button
                onClick={() => onTabChange('endpoints')}
                style={{
                  marginTop: '18px',
                  padding: '9px 18px',
                  backgroundColor: '#F7EFE2',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#121214',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: 'fit-content',
                  transition: 'opacity 0.15s ease',
                }}
              >
                Configure Endpoints →
              </button>
            </div>

            {/* Box 4: Deliveries & Pipeline */}
            <div style={{
              backgroundColor: '#111111',
              border: '1px solid #202020',
              borderRadius: '16px',
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '170px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>Deliveries & DLQ</span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#181818', border: '1px solid #262626', color: '#A3A3A3', fontWeight: 600 }}>
                    {deliveries.length} logs
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#737373', margin: 0, lineHeight: 1.5 }}>
                  Durable HTTP outbox worker, exponential retry, and dead letter routing.
                </p>
              </div>
              <button
                onClick={() => onTabChange('deliveries')}
                style={{
                  marginTop: '18px',
                  padding: '9px 18px',
                  backgroundColor: '#F7EFE2',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#121214',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: 'fit-content',
                  transition: 'opacity 0.15s ease',
                }}
              >
                Inspect Deliveries →
              </button>
            </div>
          </div>

          {/* Sequential Workflows (M4) Feature Banner matching Image 2 */}
          <div style={{
            backgroundColor: '#111111',
            border: '1px solid #202020',
            borderRadius: '16px',
            padding: '20px 24px',
            marginTop: '20px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#F7EFE2',
                color: '#121214',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
                    Sequential Workflow Execution Engine (M4)
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#181818',
                    border: '1px solid #262626',
                    color: '#4ADE80',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ADE80' }}></span>
                    Active
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0', lineHeight: 1.4 }}>
                  Compose multi-step pipelines: Webhook trigger → Conditions → JSON transformation → Sequential HTTP deliveries with resume checkpointing.
                </p>
              </div>
            </div>
            <button
              onClick={() => onTabChange('workflows')}
              style={{
                padding: '9px 20px',
                backgroundColor: '#F7EFE2',
                color: '#121214',
                border: 'none',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.15s ease',
              }}
            >
              Open Workflow Console →
            </button>
          </div>

          {/* Architecture Banner matching Image 2 */}
          <div style={{
            backgroundColor: '#111111',
            border: '1px solid #202020',
            borderRadius: '16px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#34D399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                PostgreSQL Row-Level Security Enforced
              </div>
              <p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0', lineHeight: 1.4 }}>
                Organization slug: {organization.slug} · {organization.id.slice(0, 8)} (Tenant ID: {organization.id}). All queries and outbox workers execute with strict tenant isolation.
              </p>
            </div>
          </div>
        </div>
      )}

        {/* SETTINGS VIEW (ACTIVE WHEN activeTab === 'settings') */}
        {activeTab === 'settings' && (
          <div style={{ padding: '40px 20px', maxWidth: '640px', margin: '0 auto', textAlign: 'left' }}>
            <div style={{
              backgroundColor: '#161616',
              border: '1px solid #2A2A2A',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#FFFFFF' }}>
                Organization Parameters
              </h3>
              <p style={{ fontSize: '13px', color: '#A3A3A3', margin: '0 0 20px' }}>
                Manage configuration and security policies for {organization.name}.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Organization ID
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={organization.id}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      padding: '10px 14px',
                      backgroundColor: '#000000',
                      border: '1px solid #2A2A2A',
                      borderRadius: '8px',
                      color: '#A3A3A3',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Tenant URL Slug
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={organization.slug}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      padding: '10px 14px',
                      backgroundColor: '#000000',
                      border: '1px solid #2A2A2A',
                      borderRadius: '8px',
                      color: '#A3A3A3',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Tenant Isolation Mode
                  </label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    backgroundColor: '#000000',
                    border: '1px solid #2A2A2A',
                    borderRadius: '8px',
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                      Enforced (PostgreSQL Row-Level Security)
                    </span>
                  </div>
                </div>

                {isOwner && onDeleteOrg && (
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '20px',
                    borderTop: '1px solid #2A2A2A',
                  }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Danger Zone
                    </label>
                    <p style={{ fontSize: '12px', color: '#A3A3A3', margin: '0 0 14px' }}>
                      Permanently delete this organization, along with all associated API keys, endpoints, destinations, and delivery history.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleDeleteOrgConfirm()}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #ef4444',
                        color: '#f87171',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Delete Organization
                    </button>
                  </div>
                )}
              </div>
            </div>
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
            backgroundColor: '#161616',
            borderRadius: '20px',
            border: '1px solid #2A2A2A',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#FFFFFF' }}>
              Register Organization Member
            </h3>
            <p style={{ fontSize: '13px', color: '#A3A3A3', margin: '0 0 20px' }}>
              Invite a collaborator to access organization resources and pipelines.
            </p>

            <form onSubmit={handleAddMemberSubmit}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <select
                  value={inputType}
                  onChange={(e) => setInputType(e.target.value as 'email' | 'username')}
                  style={{
                    padding: '9px 12px',
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
                  Assigned Role
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as MembershipRole)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '999px',
                    color: '#A3A3A3',
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
                    backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
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
            backgroundColor: '#161616',
            borderRadius: '20px',
            border: '1px solid #2A2A2A',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#FFFFFF' }}>
              Create Organization API Key
            </h3>
            <p style={{ fontSize: '13px', color: '#A3A3A3', margin: '0 0 20px' }}>
              Generate a secure SHA-256 hashed API key to authenticate programmatic requests.
            </p>

            <form onSubmit={handleCreateApiKey}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
                  Scope
                </label>
                <select
                  value={newKeyScopes[0] || 'ingest'}
                  onChange={(e) => setNewKeyScopes([e.target.value])}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '999px',
                    color: '#A3A3A3',
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
                    backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
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
            backgroundColor: '#161616',
            borderRadius: '20px',
            border: '1px solid #2A2A2A',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#FFFFFF' }}>
              Create Ingestion Endpoint
            </h3>
            <p style={{ fontSize: '13px', color: '#A3A3A3', margin: '0 0 20px' }}>
              Register a dedicated webhook ingestion endpoint. A unique AES-256-GCM signing secret will be generated.
            </p>

            <form onSubmit={handleCreateEndpoint}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#737373', marginTop: '4px', display: 'block' }}>
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '999px',
                    color: '#A3A3A3',
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
                    backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
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
            backgroundColor: '#161616',
            borderRadius: '20px',
            border: '1px solid #2A2A2A',
            width: '100%',
            maxWidth: '500px',
            padding: '28px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#FFFFFF' }}>
              Register Destination Target
            </h3>
            <p style={{ fontSize: '13px', color: '#A3A3A3', margin: '0 0 20px' }}>
              Register a webhook delivery destination. Targets are protected against SSRF attacks (private IPs, loopback, and cloud metadata are strictly blocked).
            </p>

            <form onSubmit={handleCreateDestination}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#737373', marginTop: '4px', display: 'block' }}>
                  Only public HTTP/HTTPS URLs allowed. RFC 1918 private subnets and 169.254.169.254 metadata are rejected.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
                    HTTP Method
                  </label>
                  <select
                    value={newDestinationMethod}
                    onChange={(e) => setNewDestinationMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      border: '1px solid #2A2A2A',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: '#000000',
                      color: '#FFFFFF',
                    }}
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
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
                      border: '1px solid #2A2A2A',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: '#000000',
                      color: '#FFFFFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A3A3A3', marginBottom: '6px' }}>
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
                      border: '1px solid #2A2A2A',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: '#000000',
                      color: '#FFFFFF',
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
                    border: '1px solid #2A2A2A',
                    borderRadius: '999px',
                    color: '#A3A3A3',
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
                    backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
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
            backgroundColor: '#161616',
            borderRadius: '20px',
            border: '1px solid #2A2A2A',
            width: '100%',
            maxWidth: '650px',
            padding: '28px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                Delivery Attempt Details
              </h3>
              <button
                onClick={() => setSelectedAttemptForModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#A3A3A3',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#0A0A0A', padding: '10px 14px', borderRadius: '10px', border: '1px solid #2A2A2A' }}>
                <span style={{ fontSize: '11px', color: '#A3A3A3', display: 'block' }}>Status & Latency</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: selectedAttemptForModal.status === 'SUCCESS' ? '#4ade80' : '#f87171' }}>
                  {selectedAttemptForModal.statusCode ? `HTTP ${selectedAttemptForModal.statusCode}` : selectedAttemptForModal.status} · {selectedAttemptForModal.latencyMs}ms
                </span>
              </div>
              <div style={{ backgroundColor: '#0A0A0A', padding: '10px 14px', borderRadius: '10px', border: '1px solid #2A2A2A' }}>
                <span style={{ fontSize: '11px', color: '#A3A3A3', display: 'block' }}>Target URL</span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#FFFFFF', wordBreak: 'break-all' }}>
                  {selectedAttemptForModal.requestMethod} {selectedAttemptForModal.requestUrl}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#A3A3A3', marginBottom: '6px' }}>
                Request Headers (including Outbound HMAC Signature)
              </label>
              <pre style={{
                backgroundColor: '#000000',
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                color: '#E5E5E5',
                overflowX: 'auto',
                margin: 0,
              }}>
                {JSON.stringify(selectedAttemptForModal.requestHeaders, null, 2)}
              </pre>
            </div>

            {selectedAttemptForModal.responseHeaders && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#A3A3A3', marginBottom: '6px' }}>
                  Response Headers
                </label>
                <pre style={{
                  backgroundColor: '#000000',
                  border: '1px solid #2A2A2A',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '11px',
                  color: '#E5E5E5',
                  overflowX: 'auto',
                  margin: 0,
                }}>
                  {JSON.stringify(selectedAttemptForModal.responseHeaders, null, 2)}
                </pre>
              </div>
            )}

            {selectedAttemptForModal.responseBodyPreview && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#A3A3A3', marginBottom: '6px' }}>
                  Response Body Preview
                </label>
                <pre style={{
                  backgroundColor: '#000000',
                  border: '1px solid #2A2A2A',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '11px',
                  color: '#FFFFFF',
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
                    backgroundColor: '#202020',
                    color: '#FFFFFF',
                    border: '1px solid #2A2A2A',
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
                  backgroundColor: '#F7EFE2', color: '#121214', border: 'none', borderRadius: '999px',
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

      {/* MODAL: INBOUND WEBHOOK SIMULATOR (MILESTONE 3 OPTION 3 / STEP 7) */}
      {showSimulatorModal && (
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
            backgroundColor: '#161616',
            borderRadius: '20px',
            border: '1px solid #2A2A2A',
            width: '100%',
            maxWidth: '680px',
            padding: '28px',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#000000',
                  border: '1px solid #2A2A2A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  ⚡
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: '#FFFFFF' }}>
                    Inbound Webhook Simulator
                  </h3>
                  <p style={{ fontSize: '12px', color: '#A3A3A3', margin: 0 }}>
                    Simulate authenticated webhook ingestion, HMAC-SHA256 signature verification, and outbox dispatch.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulatorModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#A3A3A3',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Target Endpoint Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase', marginBottom: '6px' }}>
                Target Ingestion Endpoint
              </label>
              {endpoints.length === 0 ? (
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#2A1C1C',
                  border: '1px solid #442A2A',
                  borderRadius: '8px',
                  color: '#f87171',
                  fontSize: '12px',
                }}>
                  No ingestion endpoints available. Create an endpoint first to simulate webhooks.
                </div>
              ) : (
                <select
                  value={simulatorEndpointId}
                  onChange={(e) => setSimulatorEndpointId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #2A2A2A',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.name} (/{ep.slug}) — ID: {ep.id.slice(0, 8)}...
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Preset Event Types Bar */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase', marginBottom: '6px' }}>
                Sample Event Presets
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSimulatorPreset('payment.succeeded')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: simulatorEventType === 'payment.succeeded' ? '#FFFFFF' : '#202020',
                    color: simulatorEventType === 'payment.succeeded' ? '#000000' : '#E5E5E5',
                    border: '1px solid #2A2A2A',
                  }}
                >
                  ⚡ payment.succeeded
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorPreset('user.signup')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: simulatorEventType === 'user.signup' ? '#FFFFFF' : '#202020',
                    color: simulatorEventType === 'user.signup' ? '#000000' : '#E5E5E5',
                    border: '1px solid #2A2A2A',
                  }}
                >
                  👤 user.signup
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorPreset('order.fulfilled')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: simulatorEventType === 'order.fulfilled' ? '#FFFFFF' : '#202020',
                    color: simulatorEventType === 'order.fulfilled' ? '#000000' : '#E5E5E5',
                    border: '1px solid #2A2A2A',
                  }}
                >
                  📦 order.fulfilled
                </button>
              </div>
            </div>

            {/* Event Type & Idempotency Key */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase', marginBottom: '6px' }}>
                  X-Event-Type Header
                </label>
                <input
                  type="text"
                  value={simulatorEventType}
                  onChange={(e) => setSimulatorEventType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #2A2A2A',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase' }}>
                    Idempotency Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setSimulatorIdempotencyKey(`idem_${Math.random().toString(36).substring(2, 10)}`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#A3A3A3',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    🎲 Regenerate
                  </button>
                </div>
                <input
                  type="text"
                  value={simulatorIdempotencyKey}
                  onChange={(e) => setSimulatorIdempotencyKey(e.target.value)}
                  placeholder="e.g. idem_a1b2c3d4"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #2A2A2A',
                    borderRadius: '8px',
                    fontSize: '13px',
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>

            {/* JSON Payload Editor */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase', marginBottom: '6px' }}>
                Webhook Body (JSON Payload)
              </label>
              <textarea
                rows={6}
                value={simulatorPayload}
                onChange={(e) => setSimulatorPayload(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  border: '1px solid #2A2A2A',
                  borderRadius: '8px',
                  padding: '12px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  lineHeight: '1.4',
                }}
              />
            </div>

            {/* Error Message */}
            {simulatorError && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#2A1C1C',
                border: '1px solid #442A2A',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '12px',
                marginBottom: '16px',
              }}>
                {simulatorError}
              </div>
            )}

            {/* Simulation Result Receipt Card */}
            {simulatorResult && (
              <div style={{
                backgroundColor: '#0A0A0A',
                border: '1px solid #2A2A2A',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: simulatorResult.status === 'duplicate' ? '#2B2314' : '#1E2D22',
                      color: simulatorResult.status === 'duplicate' ? '#f59e0b' : '#4ade80',
                      border: simulatorResult.status === 'duplicate' ? '1px solid #4D3C1D' : '1px solid #2B4232',
                    }}>
                      {simulatorResult.status === 'duplicate' ? 'HTTP 200 (DUPLICATE)' : 'HTTP 202 ACCEPTED'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#A3A3A3' }}>
                      {simulatorResult.status === 'duplicate' ? 'Idempotently deduplicated' : 'Outbox message queued'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSimulatorModal(false);
                      onTabChange('deliveries');
                      void loadDeliveries();
                    }}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: '#202020',
                      border: '1px solid #2A2A2A',
                      borderRadius: '999px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    View in Deliveries →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: '#737373', display: 'block' }}>Event ID</span>
                    <code style={{ color: '#FFFFFF' }}>{simulatorResult.eventId}</code>
                  </div>
                  <div>
                    <span style={{ color: '#737373', display: 'block' }}>HMAC Signature</span>
                    <code style={{ color: '#A3A3A3' }}>{simulatorResult.signature.slice(0, 24)}...</code>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={handleCopyCurl}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#202020',
                  border: '1px solid #2A2A2A',
                  borderRadius: '999px',
                  color: copiedCurl ? '#4ade80' : '#E5E5E5',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedCurl ? '✓ cURL Copied' : 'Copy cURL Command'}
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSimulatorModal(false)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'transparent',
                    border: '1px solid #2A2A2A',
                    borderRadius: '999px',
                    color: '#A3A3A3',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={simulatorLoading || endpoints.length === 0}
                  onClick={() => void handleRunSimulator()}
                  style={{
                    padding: '9px 24px',
                    backgroundColor: '#F7EFE2', border: 'none', borderRadius: '999px', color: '#121214',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: simulatorLoading || endpoints.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                    opacity: simulatorLoading || endpoints.length === 0 ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {simulatorLoading ? 'Ingesting...' : '⚡ Send Test Webhook'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM CONFIRMATION DIALOG (REPLACES ALL BROWSER POPUPS) */}
      {confirmModal && confirmModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(14, 14, 16, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#161616',
            borderRadius: '20px',
            border: '1px solid #2A2A2A',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: confirmModal.confirmVariant === 'warning' ? '#2B2314' : '#2A1C1C',
                border: confirmModal.confirmVariant === 'warning' ? '1px solid #4D3C1D' : '1px solid #442A2A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: confirmModal.confirmVariant === 'warning' ? '#f59e0b' : '#f87171',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: '#FFFFFF' }}>
                  {confirmModal.title}
                </h3>
                <p style={{ fontSize: '13px', color: '#A3A3A3', margin: 0, lineHeight: 1.5 }}>
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                type="button"
                disabled={isConfirmLoading}
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#202020',
                  border: '1px solid #2A2A2A',
                  borderRadius: '999px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isConfirmLoading ? 'not-allowed' : 'pointer',
                  opacity: isConfirmLoading ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConfirmLoading}
                onClick={() => void executeConfirmedAction()}
                style={{
                  padding: '10px 22px',
                  backgroundColor: confirmModal.confirmVariant === 'warning' ? '#d97706' : '#dc2626',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isConfirmLoading ? 'not-allowed' : 'pointer',
                  boxShadow: confirmModal.confirmVariant === 'warning'
                    ? '0 2px 10px rgba(217, 119, 6, 0.35)'
                    : '0 2px 10px rgba(220, 38, 38, 0.35)',
                  opacity: isConfirmLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isConfirmLoading && (
                  <div style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                )}
                <span>{confirmModal.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
