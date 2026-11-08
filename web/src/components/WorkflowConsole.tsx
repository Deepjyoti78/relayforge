import React, { useState } from 'react';
import {
  createWorkflow,
  fetchExecution,
  publishWorkflowVersion,
  resumeExecution,
  updateWorkflow,
  validateWorkflowDefinition,
} from '../api.ts';
import type {
  DestinationMetadata,
  EndpointMetadata,
  OrganizationDetails,
  WorkflowConditionRule,
  WorkflowDefinitionDto,
  WorkflowExecutionMetadata,
  WorkflowMetadata,
} from '../types.ts';

interface WorkflowConsoleProps {
  organization: OrganizationDetails;
  workflows: WorkflowMetadata[];
  executions: WorkflowExecutionMetadata[];
  endpoints: EndpointMetadata[];
  destinations: DestinationMetadata[];
  canManage: boolean;
  onRefreshWorkflows: () => Promise<void>;
  onRefreshExecutions: () => Promise<void>;
  onRequestConfirm: (options: {
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void> | void;
  }) => void;
}

export const WorkflowConsole: React.FC<WorkflowConsoleProps> = ({
  organization,
  workflows,
  executions,
  endpoints,
  destinations,
  canManage,
  onRefreshWorkflows,
  onRefreshExecutions,
  onRequestConfirm,
}) => {
  const [subTab, setSubTab] = useState<'workflows' | 'executions' | 'builder'>('workflows');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [newWorkflowEndpointId, setNewWorkflowEndpointId] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Builder / Editor State
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowMetadata | null>(null);
  const [builderEndpointId, setBuilderEndpointId] = useState('');
  const [builderEventType, setBuilderEventType] = useState('payment.succeeded');

  // Condition node state
  const [hasCondition, setHasCondition] = useState(true);
  const [conditionLogic, setConditionLogic] = useState<'ALL' | 'ANY'>('ALL');
  const [conditionRules, setConditionRules] = useState<WorkflowConditionRule[]>([
    { field: 'customer.tier', operator: 'equals', value: 'enterprise' },
  ]);

  // Transform node state
  const [hasTransform, setHasTransform] = useState(true);
  const [transformFields, setTransformFields] = useState<Array<{ target: string; source: string }>>([
    { target: 'recipient_email', source: 'customer.email' },
    { target: 'total_amount', source: 'amount' },
    { target: 'routed_by', source: 'metadata.source' },
  ]);

  // Actions node state (1 to 5 actions)
  const [actions, setActions] = useState<Array<{
    nodeId: string;
    destinationId: string;
    httpMethod: 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GET';
    maxRetries: number;
    initialBackoffMs: number;
  }>>([
    { nodeId: 'action_1', destinationId: '', httpMethod: 'POST', maxRetries: 3, initialBackoffMs: 500 },
  ]);

  // Validation & Publishing State
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    definitionHash?: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);

  // Execution Detail Drawer State
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecutionMetadata | null>(null);
  const [executionDetailLoading, setExecutionDetailLoading] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  const openBuilder = (wf: WorkflowMetadata) => {
    setActiveWorkflow(wf);
    setBuilderEndpointId(wf.endpointId || (endpoints.length > 0 ? endpoints[0].id : ''));
    setValidationResult(null);
    setBuilderError(null);
    setPublishMessage(null);

    // If workflow has an active version, populate builder from definition
    if (wf.activeVersion?.definition) {
      const def = wf.activeVersion.definition;
      setBuilderEventType(def.trigger?.eventType || 'payment.succeeded');
      if (def.conditionGroup && def.conditionGroup.rules.length > 0) {
        setHasCondition(true);
        setConditionLogic(def.conditionGroup.logic || 'ALL');
        setConditionRules(def.conditionGroup.rules);
      } else {
        setHasCondition(false);
      }

      if (def.transform?.fields) {
        setHasTransform(true);
        const mapped = Object.entries(def.transform.fields).map(([target, source]) => ({ target, source }));
        setTransformFields(mapped.length > 0 ? mapped : [{ target: 'data', source: 'data' }]);
      } else {
        setHasTransform(false);
      }

      if (def.actions && def.actions.length > 0) {
        setActions(def.actions.map((act) => ({
          nodeId: act.nodeId,
          destinationId: act.destinationId,
          httpMethod: act.httpMethod || 'POST',
          maxRetries: act.retryPolicy?.maxRetries ?? 3,
          initialBackoffMs: act.retryPolicy?.initialBackoffMs ?? 500,
        })));
      }
    } else {
      // Default initial configuration
      setHasCondition(true);
      setHasTransform(true);
      if (destinations.length > 0 && actions[0] && !actions[0].destinationId) {
        setActions([{ ...actions[0], destinationId: destinations[0].id }]);
      }
    }

    setSubTab('builder');
  };

  const buildDefinitionPayload = (): WorkflowDefinitionDto => {
    const def: WorkflowDefinitionDto = {
      trigger: {
        nodeId: 'trigger_1',
        endpointId: builderEndpointId || undefined,
        eventType: builderEventType || undefined,
      },
      actions: actions.map((act) => ({
        nodeId: act.nodeId,
        destinationId: act.destinationId,
        httpMethod: act.httpMethod,
        retryPolicy: {
          maxRetries: act.maxRetries,
          initialBackoffMs: act.initialBackoffMs,
          maxBackoffMs: 30000,
          backoffMultiplier: 2,
        },
      })),
    };

    if (hasCondition && conditionRules.length > 0) {
      def.conditionGroup = {
        nodeId: 'condition_1',
        logic: conditionLogic,
        rules: conditionRules.map(r => ({
          field: r.field.trim(),
          operator: r.operator,
          value: r.value,
        })),
      };
    }

    if (hasTransform && transformFields.length > 0) {
      const fieldMap: Record<string, string> = {};
      for (const tf of transformFields) {
        if (tf.target.trim() && tf.source.trim()) {
          fieldMap[tf.target.trim()] = tf.source.trim();
        }
      }
      def.transform = {
        nodeId: 'transform_1',
        type: 'map',
        fields: fieldMap,
      };
    }

    return def;
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    setBuilderError(null);
    try {
      const def = buildDefinitionPayload();
      const res = await validateWorkflowDefinition(organization.id, def);
      setValidationResult(res);
    } catch (err: unknown) {
      setBuilderError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!activeWorkflow) return;
    setIsPublishing(true);
    setBuilderError(null);
    setPublishMessage(null);
    try {
      const def = buildDefinitionPayload();
      const res = await publishWorkflowVersion(organization.id, activeWorkflow.id, def);
      setPublishMessage(`Version ${res.versionNumber} published & active (SHA-256: ${res.definitionHash.slice(0, 10)}...)`);
      await onRefreshWorkflows();
    } catch (err: unknown) {
      setBuilderError(err instanceof Error ? err.message : 'Publishing failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const created = await createWorkflow(organization.id, {
        name: newWorkflowName.trim(),
        description: newWorkflowDescription.trim() || undefined,
        endpointId: newWorkflowEndpointId || undefined,
      });
      await onRefreshWorkflows();
      setShowCreateModal(false);
      setNewWorkflowName('');
      setNewWorkflowDescription('');
      setNewWorkflowEndpointId('');
      openBuilder(created);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleStatus = (wf: WorkflowMetadata) => {
    const nextStatus = wf.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    onRequestConfirm({
      title: `${nextStatus === 'ACTIVE' ? 'Activate' : 'Pause'} Workflow`,
      message: `Are you sure you want to change workflow '${wf.name}' status to ${nextStatus}?`,
      confirmLabel: nextStatus === 'ACTIVE' ? 'Activate' : 'Pause Workflow',
      confirmVariant: nextStatus === 'ACTIVE' ? 'primary' : 'warning',
      onConfirm: async () => {
        await updateWorkflow(organization.id, wf.id, { status: nextStatus });
        await onRefreshWorkflows();
      },
    });
  };

  const handleInspectExecution = async (executionId: string) => {
    setExecutionDetailLoading(true);
    setSelectedExecution(null);
    try {
      const full = await fetchExecution(organization.id, executionId);
      setSelectedExecution(full);
    } catch {
      // Fallback to list item
      const found = executions.find(e => e.id === executionId);
      if (found) setSelectedExecution(found);
    } finally {
      setExecutionDetailLoading(false);
    }
  };

  const handleResume = (executionId: string) => {
    onRequestConfirm({
      title: 'Resume Failed Workflow Execution',
      message: 'This will re-queue the execution to resume strictly from the failed step. Previously completed steps will NOT be re-executed.',
      confirmLabel: 'Resume Execution',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setIsResuming(true);
        setResumeNotice(null);
        try {
          const res = await resumeExecution(organization.id, executionId);
          setResumeNotice(`Execution resumed successfully (${res.status}).`);
          await onRefreshExecutions();
          if (selectedExecution?.id === executionId) {
            void handleInspectExecution(executionId);
          }
        } finally {
          setIsResuming(false);
        }
      },
    });
  };

  const addActionStep = () => {
    if (actions.length >= 5) return;
    const nextNum = actions.length + 1;
    const defaultDest = destinations.length > 0 ? destinations[0].id : '';
    setActions([...actions, {
      nodeId: `action_${nextNum}`,
      destinationId: defaultDest,
      httpMethod: 'POST',
      maxRetries: 3,
      initialBackoffMs: 500,
    }]);
  };

  const removeActionStep = (index: number) => {
    if (actions.length <= 1) return;
    setActions(actions.filter((_, i) => i !== index));
  };

  const addConditionRule = () => {
    setConditionRules([...conditionRules, { field: '', operator: 'equals', value: '' }]);
  };

  const removeConditionRule = (index: number) => {
    setConditionRules(conditionRules.filter((_, i) => i !== index));
  };

  const addTransformField = () => {
    setTransformFields([...transformFields, { target: '', source: '' }]);
  };

  const removeTransformField = (index: number) => {
    setTransformFields(transformFields.filter((_, i) => i !== index));
  };

  const filteredWorkflows = workflows.filter(wf => {
    const q = searchQuery.toLowerCase();
    return (
      wf.name.toLowerCase().includes(q) ||
      (wf.description && wf.description.toLowerCase().includes(q)) ||
      wf.id.toLowerCase().includes(q)
    );
  });

  const filteredExecutions = executions.filter(ex => {
    const q = searchQuery.toLowerCase();
    return (
      ex.id.toLowerCase().includes(q) ||
      ex.eventId.toLowerCase().includes(q) ||
      ex.status.toLowerCase().includes(q)
    );
  });

  const renderStatusPill = (status: string) => {
    let bg = '#232327';
    let text = '#9A9AA6';
    let dot = '#9A9AA6';

    if (status === 'ACTIVE' || status === 'SUCCEEDED') {
      bg = '#14291E';
      text = '#34D399';
      dot = '#10B981';
    } else if (status === 'FAILED') {
      bg = '#2B171A';
      text = '#F87171';
      dot = '#EF4444';
    } else if (status === 'RETRY_WAIT' || status === 'PAUSED') {
      bg = '#2B2416';
      text = '#FBBF24';
      dot = '#F59E0B';
    } else if (status === 'RUNNING' || status === 'QUEUED') {
      bg = '#1B2433';
      text = '#60A5FA';
      dot = '#3B82F6';
    } else if (status === 'FILTERED' || status === 'SKIPPED') {
      bg = '#232327';
      text = '#C9C9D2';
      dot = '#63636E';
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: bg,
        color: text,
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot }}></span>
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      {/* Sub-Header Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid #232327',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setSubTab('workflows')}
            style={{
              padding: '8px 18px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: subTab === 'workflows' ? '#F2F2F5' : '#232327',
              color: subTab === 'workflows' ? '#0E0E10' : '#C9C9D2',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Workflows ({workflows.length})
          </button>
          <button
            onClick={() => setSubTab('executions')}
            style={{
              padding: '8px 18px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: subTab === 'executions' ? '#F2F2F5' : '#232327',
              color: subTab === 'executions' ? '#0E0E10' : '#C9C9D2',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Execution Lineage ({executions.length})
          </button>
          {activeWorkflow && (
            <button
              onClick={() => setSubTab('builder')}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: subTab === 'builder' ? '#F2F2F5' : '#232327',
                color: subTab === 'builder' ? '#0E0E10' : '#C9C9D2',
                border: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Visual Builder: {activeWorkflow.name}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => { void onRefreshWorkflows(); void onRefreshExecutions(); }}
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#232327',
              color: '#F2F2F5',
              border: '1px solid #3E3E45',
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: '#F2F2F5',
                color: '#0E0E10',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              + Create Workflow
            </button>
          )}
        </div>
      </div>

      {resumeNotice && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          backgroundColor: '#14291E',
          border: '1px solid #10B981',
          color: '#34D399',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          ✓ {resumeNotice}
        </div>
      )}

      {/* Search Bar for Workflows and Executions */}
      {subTab !== 'builder' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#232327',
          border: '1px solid #3E3E45',
          borderRadius: '999px',
          padding: '10px 20px',
        }}>
          <span style={{ color: '#63636E', fontSize: '13px' }}>🔍</span>
          <input
            type="text"
            placeholder={subTab === 'workflows' ? 'Search workflows by name, description, ID...' : 'Search executions by ID, event ID, status...'}
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
      )}

      {/* VIEW 1: WORKFLOWS LIST */}
      {subTab === 'workflows' && (
        <div>
          {filteredWorkflows.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: '#1E1E22',
              border: '1px dashed #3E3E45',
              borderRadius: '16px',
              color: '#9A9AA6',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#F2F2F5', margin: '0 0 6px' }}>
                No Sequential Workflows Configured
              </h3>
              <p style={{ fontSize: '13px', margin: '0 0 18px', maxWidth: '420px', marginInline: 'auto' }}>
                Compose durable multi-step delivery pipelines with webhook triggers, condition branching, bounded JSON transformations, and HTTP delivery targets.
              </p>
              {canManage && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#F2F2F5',
                    color: '#0E0E10',
                    fontWeight: 700,
                    borderRadius: '999px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  + Create Your First Workflow
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {filteredWorkflows.map((wf) => {
                const ep = endpoints.find(e => e.id === wf.endpointId);
                const hasActiveVersion = !!wf.activeVersionId;
                const actionCount = wf.activeVersion?.definition?.actions?.length ?? 0;
                return (
                  <div
                    key={wf.id}
                    style={{
                      backgroundColor: '#1E1E22',
                      border: '1px solid #3E3E45',
                      borderRadius: '16px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#F2F2F5', margin: '0 0 4px' }}>
                            {wf.name}
                          </h4>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#63636E' }}>
                            {wf.id.slice(0, 8)}...
                          </span>
                        </div>
                        {renderStatusPill(wf.status)}
                      </div>

                      {wf.description && (
                        <p style={{ fontSize: '12px', color: '#9A9AA6', margin: '0 0 14px', lineHeight: 1.4 }}>
                          {wf.description}
                        </p>
                      )}

                      {/* Workflow Metadata Strip */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '10px 12px',
                        backgroundColor: '#141418',
                        borderRadius: '10px',
                        fontSize: '11px',
                        marginBottom: '16px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#63636E' }}>Trigger Endpoint:</span>
                          <span style={{ color: '#C9C9D2', fontFamily: 'monospace' }}>
                            {ep ? ep.name : (wf.endpointId ? wf.endpointId.slice(0, 8) : 'Any')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#63636E' }}>Active Version:</span>
                          <span style={{ color: hasActiveVersion ? '#34D399' : '#FBBF24', fontWeight: 600 }}>
                            {wf.activeVersion ? `v${wf.activeVersion.versionNumber}` : 'Draft (Unpublished)'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#63636E' }}>Sequential Actions:</span>
                          <span style={{ color: '#C9C9D2' }}>
                            {actionCount} configured
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button
                        onClick={() => openBuilder(wf)}
                        style={{
                          flex: 1,
                          padding: '8px 14px',
                          backgroundColor: '#232327',
                          color: '#F2F2F5',
                          border: '1px solid #3E3E45',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Visual Flow Builder →
                      </button>
                      {canManage && (
                        <button
                          onClick={() => handleToggleStatus(wf)}
                          style={{
                            padding: '8px 14px',
                            backgroundColor: wf.status === 'ACTIVE' ? '#2B2416' : '#14291E',
                            color: wf.status === 'ACTIVE' ? '#FBBF24' : '#34D399',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {wf.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: EXECUTION LINEAGE & HISTORY */}
      {subTab === 'executions' && (
        <div>
          {filteredExecutions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '50px 20px',
              backgroundColor: '#1E1E22',
              borderRadius: '16px',
              color: '#9A9AA6',
            }}>
              No workflow executions recorded yet. Send a test webhook to trigger execution.
            </div>
          ) : (
            <div style={{
              backgroundColor: '#1E1E22',
              border: '1px solid #3E3E45',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #232327', color: '#63636E', textTransform: 'uppercase', fontSize: '11px' }}>
                    <th style={{ padding: '12px 16px' }}>Execution ID</th>
                    <th style={{ padding: '12px 16px' }}>Event ID</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Step</th>
                    <th style={{ padding: '12px 16px' }}>Started</th>
                    <th style={{ padding: '12px 16px' }}>Completed</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExecutions.map((ex) => (
                    <tr
                      key={ex.id}
                      style={{ borderBottom: '1px solid #232327', color: '#F2F2F5' }}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                        {ex.id.slice(0, 8)}...
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#9A9AA6' }}>
                        {ex.eventId.slice(0, 8)}...
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {renderStatusPill(ex.status)}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#C9C9D2' }}>
                        Step {ex.currentStep}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#9A9AA6' }}>
                        {ex.startedAt ? new Date(ex.startedAt).toLocaleTimeString() : 'Queued'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#9A9AA6' }}>
                        {ex.completedAt ? new Date(ex.completedAt).toLocaleTimeString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => void handleInspectExecution(ex.id)}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#232327',
                              border: '1px solid #3E3E45',
                              borderRadius: '6px',
                              color: '#F2F2F5',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Inspect Lineage
                          </button>
                          {(ex.status === 'FAILED' || ex.status === 'RETRY_WAIT') && canManage && (
                            <button
                              onClick={() => handleResume(ex.id)}
                              disabled={isResuming}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#14291E',
                                border: '1px solid #10B981',
                                borderRadius: '6px',
                                color: '#34D399',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Resume
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: VISUAL SEQUENTIAL WORKFLOW BUILDER */}
      {subTab === 'builder' && activeWorkflow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Builder Top Bar */}
          <div style={{
            backgroundColor: '#1E1E22',
            border: '1px solid #3E3E45',
            borderRadius: '16px',
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#F2F2F5', margin: 0 }}>
                  {activeWorkflow.name}
                </h3>
                {renderStatusPill(activeWorkflow.status)}
              </div>
              <p style={{ fontSize: '12px', color: '#9A9AA6', margin: '4px 0 0' }}>
                Sequential Pipeline DAG: Trigger → Conditions → JSON Transformer → Sequential HTTP Deliveries
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => void handleValidate()}
                disabled={isValidating}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#232327',
                  border: '1px solid #3E3E45',
                  borderRadius: '999px',
                  color: '#F2F2F5',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isValidating ? 'Validating...' : '✓ Validate Definition'}
              </button>

              {canManage && (
                <button
                  onClick={() => void handlePublish()}
                  disabled={isPublishing}
                  style={{
                    padding: '9px 20px',
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
                  {isPublishing ? 'Publishing...' : '🚀 Publish & Activate Version'}
                </button>
              )}
            </div>
          </div>

          {publishMessage && (
            <div style={{
              padding: '12px 18px',
              borderRadius: '10px',
              backgroundColor: '#14291E',
              border: '1px solid #10B981',
              color: '#34D399',
              fontSize: '13px',
              fontWeight: 600,
            }}>
              ✓ {publishMessage}
            </div>
          )}

          {builderError && (
            <div style={{
              padding: '12px 18px',
              borderRadius: '10px',
              backgroundColor: '#2B171A',
              border: '1px solid #EF4444',
              color: '#F87171',
              fontSize: '13px',
            }}>
              ✗ {builderError}
            </div>
          )}

          {validationResult && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: validationResult.valid ? '#14291E' : '#2B171A',
              border: `1px solid ${validationResult.valid ? '#10B981' : '#EF4444'}`,
              color: validationResult.valid ? '#34D399' : '#F87171',
              fontSize: '13px',
            }}>
              {validationResult.valid ? (
                <div>
                  <strong>✓ Definition Valid!</strong> Ready for publication. SHA-256 Digest:{' '}
                  <code>{validationResult.definitionHash}</code>
                </div>
              ) : (
                <div>
                  <strong>✗ Validation Failed:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                    {validationResult.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* VISUAL FLOW DIAGRAM CANVAS */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '24px 0',
          }}>
            {/* NODE 1: WEBHOOK TRIGGER */}
            <div style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: '#1E1E22',
              border: '1px solid #3E3E45',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⚡</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#F2F2F5' }}>Step 0: Webhook Trigger</span>
                </div>
                <span style={{ fontSize: '11px', color: '#9A9AA6', backgroundColor: '#141418', padding: '3px 8px', borderRadius: '6px' }}>
                  trigger_1
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                    Ingestion Endpoint
                  </label>
                  <select
                    value={builderEndpointId}
                    onChange={(e) => setBuilderEndpointId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#141418',
                      border: '1px solid #3E3E45',
                      borderRadius: '8px',
                      color: '#F2F2F5',
                      fontSize: '12px',
                    }}
                  >
                    <option value="">Any Endpoint (Unbounded)</option>
                    {endpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.name} ({ep.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#9A9AA6', marginBottom: '6px' }}>
                    Matching Event Type (Optional)
                  </label>
                  <input
                    type="text"
                    value={builderEventType}
                    onChange={(e) => setBuilderEventType(e.target.value)}
                    placeholder="e.g. payment.succeeded or *"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#141418',
                      border: '1px solid #3E3E45',
                      borderRadius: '8px',
                      color: '#F2F2F5',
                      fontSize: '12px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Downward Connector Arrow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#63636E' }}>
              <div style={{ width: '2px', height: '20px', backgroundColor: '#3E3E45' }}></div>
              <span>▼</span>
            </div>

            {/* NODE 2: CONDITIONS GROUP */}
            <div style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: '#1E1E22',
              border: `1px solid ${hasCondition ? '#3E3E45' : '#232327'}`,
              borderRadius: '16px',
              padding: '20px',
              opacity: hasCondition ? 1 : 0.6,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔍</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#F2F2F5' }}>Step 1: Condition Filter</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '12px', color: '#9A9AA6', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hasCondition}
                      onChange={(e) => setHasCondition(e.target.checked)}
                    />
                    Enable Conditions
                  </label>
                  {hasCondition && (
                    <select
                      value={conditionLogic}
                      onChange={(e) => setConditionLogic(e.target.value as 'ALL' | 'ANY')}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#141418',
                        border: '1px solid #3E3E45',
                        borderRadius: '6px',
                        color: '#F2F2F5',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      <option value="ALL">Match ALL Rules (AND)</option>
                      <option value="ANY">Match ANY Rule (OR)</option>
                    </select>
                  )}
                </div>
              </div>

              {hasCondition && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {conditionRules.map((r, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Path e.g. customer.tier"
                        value={r.field}
                        onChange={(e) => {
                          const updated = [...conditionRules];
                          updated[idx] = { ...updated[idx]!, field: e.target.value };
                          setConditionRules(updated);
                        }}
                        style={{
                          flex: 2,
                          padding: '7px 10px',
                          backgroundColor: '#141418',
                          border: '1px solid #3E3E45',
                          borderRadius: '6px',
                          color: '#F2F2F5',
                          fontSize: '12px',
                        }}
                      />
                      <select
                        value={r.operator}
                        onChange={(e) => {
                          const updated = [...conditionRules];
                          updated[idx] = { ...updated[idx]!, operator: e.target.value as any };
                          setConditionRules(updated);
                        }}
                        style={{
                          flex: 1.5,
                          padding: '7px 8px',
                          backgroundColor: '#141418',
                          border: '1px solid #3E3E45',
                          borderRadius: '6px',
                          color: '#F2F2F5',
                          fontSize: '11px',
                        }}
                      >
                        <option value="equals">equals (==)</option>
                        <option value="not_equals">not_equals (!=)</option>
                        <option value="greater_than">greater_than (&gt;)</option>
                        <option value="less_than">less_than (&lt;)</option>
                        <option value="exists">exists</option>
                        <option value="not_exists">not_exists</option>
                        <option value="contains">contains</option>
                      </select>
                      {r.operator !== 'exists' && r.operator !== 'not_exists' && (
                        <input
                          type="text"
                          placeholder="Value e.g. enterprise"
                          value={String(r.value ?? '')}
                          onChange={(e) => {
                            const updated = [...conditionRules];
                            updated[idx] = { ...updated[idx]!, value: e.target.value };
                            setConditionRules(updated);
                          }}
                          style={{
                            flex: 2,
                            padding: '7px 10px',
                            backgroundColor: '#141418',
                            border: '1px solid #3E3E45',
                            borderRadius: '6px',
                            color: '#F2F2F5',
                            fontSize: '12px',
                          }}
                        />
                      )}
                      <button
                        onClick={() => removeConditionRule(idx)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#232327',
                          border: '1px solid #3E3E45',
                          borderRadius: '6px',
                          color: '#F87171',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addConditionRule}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#232327',
                      border: '1px dashed #3E3E45',
                      borderRadius: '6px',
                      color: '#9A9AA6',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: 'fit-content',
                    }}
                  >
                    + Add Condition Rule
                  </button>
                </div>
              )}
            </div>

            {/* Downward Connector Arrow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#63636E' }}>
              <div style={{ width: '2px', height: '20px', backgroundColor: '#3E3E45' }}></div>
              <span>▼</span>
            </div>

            {/* NODE 3: JSON TRANSFORMER */}
            <div style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: '#1E1E22',
              border: `1px solid ${hasTransform ? '#3E3E45' : '#232327'}`,
              borderRadius: '16px',
              padding: '20px',
              opacity: hasTransform ? 1 : 0.6,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔄</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#F2F2F5' }}>Step 2: JSON Transformation</span>
                </div>
                <label style={{ fontSize: '12px', color: '#9A9AA6', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hasTransform}
                    onChange={(e) => setHasTransform(e.target.checked)}
                  />
                  Enable Transform
                </label>
              </div>

              {hasTransform && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#9A9AA6', marginBottom: '2px' }}>
                    Map incoming payload fields to target payload keys:
                  </div>
                  {transformFields.map((tf, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Target Key e.g. recipient_email"
                        value={tf.target}
                        onChange={(e) => {
                          const updated = [...transformFields];
                          updated[idx] = { ...updated[idx]!, target: e.target.value };
                          setTransformFields(updated);
                        }}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          backgroundColor: '#141418',
                          border: '1px solid #3E3E45',
                          borderRadius: '6px',
                          color: '#F2F2F5',
                          fontSize: '12px',
                        }}
                      />
                      <span style={{ color: '#63636E' }}>←</span>
                      <input
                        type="text"
                        placeholder="Source Path e.g. customer.email"
                        value={tf.source}
                        onChange={(e) => {
                          const updated = [...transformFields];
                          updated[idx] = { ...updated[idx]!, source: e.target.value };
                          setTransformFields(updated);
                        }}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          backgroundColor: '#141418',
                          border: '1px solid #3E3E45',
                          borderRadius: '6px',
                          color: '#F2F2F5',
                          fontSize: '12px',
                        }}
                      />
                      <button
                        onClick={() => removeTransformField(idx)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#232327',
                          border: '1px solid #3E3E45',
                          borderRadius: '6px',
                          color: '#F87171',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addTransformField}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#232327',
                      border: '1px dashed #3E3E45',
                      borderRadius: '6px',
                      color: '#9A9AA6',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: 'fit-content',
                    }}
                  >
                    + Add Field Mapping
                  </button>
                </div>
              )}
            </div>

            {/* Downward Connector Arrow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#63636E' }}>
              <div style={{ width: '2px', height: '20px', backgroundColor: '#3E3E45' }}></div>
              <span>▼</span>
            </div>

            {/* NODE 4..N: SEQUENTIAL HTTP ACTIONS */}
            <div style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: '#1E1E22',
              border: '1px solid #3E3E45',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🚀</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#F2F2F5' }}>
                    Step 3: Sequential HTTP Deliveries ({actions.length}/5)
                  </span>
                </div>
                {actions.length < 5 && (
                  <button
                    onClick={addActionStep}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: '#232327',
                      border: '1px solid #3E3E45',
                      borderRadius: '6px',
                      color: '#F2F2F5',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Sequential Action
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {actions.map((act, idx) => (
                  <div
                    key={act.nodeId}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#141418',
                      border: '1px solid #232327',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#C9C9D2' }}>
                        Action #{idx + 1} ({act.nodeId})
                      </span>
                      {actions.length > 1 && (
                        <button
                          onClick={() => removeActionStep(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#F87171',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#9A9AA6', marginBottom: '4px' }}>
                          SSRF-Protected Destination Target
                        </label>
                        <select
                          value={act.destinationId}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx] = { ...updated[idx]!, destinationId: e.target.value };
                            setActions(updated);
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            borderRadius: '6px',
                            color: '#F2F2F5',
                            fontSize: '11px',
                          }}
                        >
                          <option value="">Select Destination Target...</option>
                          {destinations.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.url})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#9A9AA6', marginBottom: '4px' }}>
                          Method
                        </label>
                        <select
                          value={act.httpMethod}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx] = { ...updated[idx]!, httpMethod: e.target.value as any };
                            setActions(updated);
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            borderRadius: '6px',
                            color: '#F2F2F5',
                            fontSize: '11px',
                          }}
                        >
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#9A9AA6', marginBottom: '4px' }}>
                          Max Retries
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={act.maxRetries}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx] = { ...updated[idx]!, maxRetries: parseInt(e.target.value) || 3 };
                            setActions(updated);
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            borderRadius: '6px',
                            color: '#F2F2F5',
                            fontSize: '11px',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#9A9AA6', marginBottom: '4px' }}>
                          Backoff (ms)
                        </label>
                        <input
                          type="number"
                          step="100"
                          value={act.initialBackoffMs}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx] = { ...updated[idx]!, initialBackoffMs: parseInt(e.target.value) || 500 };
                            setActions(updated);
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0E0E10',
                            border: '1px solid #3E3E45',
                            borderRadius: '6px',
                            color: '#F2F2F5',
                            fontSize: '11px',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE WORKFLOW */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#1E1E22',
            border: '1px solid #3E3E45',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#F2F2F5', margin: '0 0 8px' }}>
              Create Sequential Workflow
            </h3>
            <p style={{ fontSize: '13px', color: '#9A9AA6', margin: '0 0 20px' }}>
              Define an orchestrated multi-step workflow attached to your ingestion endpoints and destinations.
            </p>

            {createError && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#2B171A',
                border: '1px solid #EF4444',
                color: '#F87171',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '16px',
              }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#C9C9D2', marginBottom: '6px' }}>
                  Workflow Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Payment Sequential Sync"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#141418',
                    border: '1px solid #3E3E45',
                    borderRadius: '8px',
                    color: '#F2F2F5',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#C9C9D2', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe what this workflow accomplishes..."
                  value={newWorkflowDescription}
                  onChange={(e) => setNewWorkflowDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#141418',
                    border: '1px solid #3E3E45',
                    borderRadius: '8px',
                    color: '#F2F2F5',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    resize: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#C9C9D2', marginBottom: '6px' }}>
                  Trigger Webhook Endpoint (Optional)
                </label>
                <select
                  value={newWorkflowEndpointId}
                  onChange={(e) => setNewWorkflowEndpointId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#141418',
                    border: '1px solid #3E3E45',
                    borderRadius: '8px',
                    color: '#F2F2F5',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Select Endpoint (or bind later)...</option>
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.name} ({ep.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'transparent',
                    color: '#9A9AA6',
                    border: '1px solid #3E3E45',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#F2F2F5',
                    color: '#0E0E10',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {createLoading ? 'Creating...' : 'Create Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EXECUTION LINEAGE & STEP CHECKPOINT INSPECTOR */}
      {selectedExecution && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px',
        }}>
          <div style={{
            backgroundColor: '#1E1E22',
            border: '1px solid #3E3E45',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#F2F2F5', margin: 0 }}>
                    Execution Lineage Inspector
                  </h3>
                  {renderStatusPill(selectedExecution.status)}
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#9A9AA6', marginTop: '4px' }}>
                  ID: {selectedExecution.id} | Event: {selectedExecution.eventId}
                </div>
              </div>
              <button
                onClick={() => setSelectedExecution(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9A9AA6',
                  fontSize: '20px',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {selectedExecution.failureReason && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#2B171A',
                border: '1px solid #EF4444',
                color: '#F87171',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '16px',
              }}>
                <strong>Failure Reason:</strong> {selectedExecution.failureReason}
              </div>
            )}

            {executionDetailLoading && (
              <div style={{ color: '#9A9AA6', fontSize: '12px', padding: '10px', textAlign: 'center' }}>
                Fetching latest step checkpoints...
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#C9C9D2', marginBottom: '10px' }}>
                Step Checkpoints & Execution Timeline:
              </div>

              {(!selectedExecution.steps || selectedExecution.steps.length === 0) ? (
                <div style={{ color: '#9A9AA6', fontSize: '12px', padding: '16px', textAlign: 'center' }}>
                  No step checkpoints recorded yet for this execution.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedExecution.steps.map((st, idx) => (
                    <div
                      key={st.id || idx}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#141418',
                        border: '1px solid #232327',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#F2F2F5', backgroundColor: '#232327', padding: '2px 8px', borderRadius: '4px' }}>
                            #{idx} {st.stepType}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#9A9AA6' }}>
                            {st.nodeId}
                          </span>
                        </div>
                        {renderStatusPill(st.status)}
                      </div>

                      <div style={{ fontSize: '11px', color: '#9A9AA6', display: 'flex', gap: '16px', marginBottom: '8px' }}>
                        <span>Attempts: {st.attemptCount}</span>
                        <span>Completed: {st.completedAt ? new Date(st.completedAt).toLocaleTimeString() : 'In Progress'}</span>
                      </div>

                      {st.outputSnapshot !== undefined && st.outputSnapshot !== null && (
                        <div>
                          <span style={{ fontSize: '10px', color: '#63636E', textTransform: 'uppercase', fontWeight: 700 }}>
                            Output Snapshot:
                          </span>
                          <pre style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            backgroundColor: '#0E0E10',
                            padding: '8px',
                            borderRadius: '6px',
                            color: '#F2F2F5',
                            margin: '4px 0 0',
                            overflowX: 'auto',
                          }}>
                            {JSON.stringify(st.outputSnapshot, null, 2)}
                          </pre>
                        </div>
                      )}

                      {st.errorDetails !== undefined && st.errorDetails !== null && (
                        <div style={{ marginTop: '8px' }}>
                          <span style={{ fontSize: '10px', color: '#EF4444', textTransform: 'uppercase', fontWeight: 700 }}>
                            Error Details:
                          </span>
                          <pre style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            backgroundColor: '#2B171A',
                            padding: '8px',
                            borderRadius: '6px',
                            color: '#F87171',
                            margin: '4px 0 0',
                            overflowX: 'auto',
                          }}>
                            {JSON.stringify(st.errorDetails, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #232327' }}>
              {(selectedExecution.status === 'FAILED' || selectedExecution.status === 'RETRY_WAIT') && canManage ? (
                <button
                  onClick={() => handleResume(selectedExecution.id)}
                  disabled={isResuming}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#14291E',
                    border: '1px solid #10B981',
                    borderRadius: '8px',
                    color: '#34D399',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isResuming ? 'Resuming...' : '▶ Resume Execution (Skip Completed Steps)'}
                </button>
              ) : (
                <div></div>
              )}

              <button
                onClick={() => setSelectedExecution(null)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#232327',
                  border: '1px solid #3E3E45',
                  borderRadius: '8px',
                  color: '#F2F2F5',
                  fontSize: '12px',
                  fontWeight: 600,
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
