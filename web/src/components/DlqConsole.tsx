import React, { useEffect, useState } from 'react';
import { bulkReplayDlq, fetchDlq, purgeDlqMessage } from '../api.ts';
import type { DlqFilterParams, DlqRecordItem } from '../types.ts';

interface DlqConsoleProps {
  organizationId: string;
  onRequestConfirm: (modal: {
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void> | void;
  }) => void;
}

export const DlqConsole: React.FC<DlqConsoleProps> = ({
  organizationId,
  onRequestConfirm,
}) => {
  const [records, setRecords] = useState<DlqRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [activeCategory, setActiveCategory] = useState<DlqFilterParams['errorCategory'] | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectRecord, setInspectRecord] = useState<DlqRecordItem | null>(null);

  const loadDlq = async () => {
    setLoading(true);
    try {
      const data = await fetchDlq(organizationId, {
        errorCategory: activeCategory === 'ALL' ? undefined : activeCategory,
        search: searchQuery.trim() || undefined,
        limit: 50,
      });
      setRecords(data.records);
      setTotal(data.total);
      setError(null);
      setSelectedIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch DLQ records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDlq();
  }, [organizationId, activeCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadDlq();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkReplayClick = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    onRequestConfirm({
      title: `Replay ${ids.length} Dead-Letter Message(s)`,
      message: `Are you sure you want to re-queue ${ids.length} message(s) back into the transactional outbox? All messages with unexpired worker leases will remain protected.`,
      confirmLabel: `Replay ${ids.length} Messages`,
      confirmVariant: 'primary',
      onConfirm: async () => {
        try {
          const res = await bulkReplayDlq(organizationId, ids);
          setActionSuccess(`Successfully queued ${res.replayedCount} message(s) for immediate outbox re-dispatch.`);
          void loadDlq();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to replay messages');
        }
      },
    });
  };

  const handlePurgeClick = (record: DlqRecordItem) => {
    onRequestConfirm({
      title: 'Purge Dead-Letter Message',
      message: `Are you sure you want to permanently delete outbox message ${record.id}? This action cannot be undone.`,
      confirmLabel: 'Purge Permanently',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await purgeDlqMessage(organizationId, record.id);
          setActionSuccess(`Message ${record.id.slice(0, 8)}... permanently purged.`);
          void loadDlq();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to purge message');
        }
      },
    });
  };

  const categories: Array<{ id: DlqFilterParams['errorCategory'] | 'ALL'; label: string }> = [
    { id: 'ALL', label: 'All Messages' },
    { id: 'EXHAUSTED_RETRIES', label: 'Exhausted Retries' },
    { id: 'PERMANENT_HTTP', label: 'Permanent HTTP (4xx)' },
    { id: 'TIMEOUT', label: 'Timeouts (408/504)' },
    { id: 'SSRF_BLOCKED', label: 'SSRF Blocked' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Eyebrow & Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            Dead Letter Queue (DLQ) & Bulk Remediation
          </h2>
          <p style={{ fontSize: '12px', color: '#A3A3A3', margin: '4px 0 0 0' }}>
            Inspect undeliverable webhook dispatches, filter by failure classification, and trigger bulk atomic replay.
          </p>
        </div>

        {/* Bulk Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            disabled={selectedIds.size === 0}
            onClick={handleBulkReplayClick}
            style={{
              padding: '9px 18px',
              backgroundColor: selectedIds.size > 0 ? '#FFFFFF' : '#202020',
              color: selectedIds.size > 0 ? '#000000' : '#737373',
              border: selectedIds.size > 0 ? 'none' : '1px solid #2A2A2A',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: selectedIds.size > 0 ? '0 2px 10px rgba(0, 0, 0, 0.3)' : 'none',
            }}
          >
            <span>↻ Bulk Replay</span>
            {selectedIds.size > 0 && (
              <span style={{
                backgroundColor: '#000000',
                color: '#FFFFFF',
                borderRadius: '999px',
                padding: '1px 6px',
                fontSize: '10px',
              }}>
                {selectedIds.size}
              </span>
            )}
          </button>

          <button
            onClick={() => void loadDlq()}
            style={{
              padding: '9px 16px',
              backgroundColor: '#202020',
              color: '#FFFFFF',
              border: '1px solid #2A2A2A',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div style={{
          padding: '10px 14px',
          backgroundColor: '#1E2D22',
          border: '1px solid #2B4232',
          borderRadius: '10px',
          color: '#4ade80',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '14px' }}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px 14px',
          backgroundColor: '#2A1C1C',
          border: '1px solid #442A2A',
          borderRadius: '10px',
          color: '#f87171',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Filter Chips & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: activeCategory === cat.id ? '#FFFFFF' : '#161616',
                color: activeCategory === cat.id ? '#000000' : '#A3A3A3',
                border: activeCategory === cat.id ? '1px solid transparent' : '1px solid #2A2A2A',
                whiteSpace: 'nowrap',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search by Outbox / Event UUID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '6px 14px',
              backgroundColor: '#0A0A0A',
              border: '1px solid #2A2A2A',
              borderRadius: '999px',
              color: '#FFFFFF',
              fontSize: '12px',
              width: '260px',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 14px',
              backgroundColor: '#202020',
              border: '1px solid #2A2A2A',
              borderRadius: '999px',
              color: '#FFFFFF',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Table Container */}
      <div style={{
        backgroundColor: '#161616',
        border: '1px solid #2A2A2A',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2A2A2A', backgroundColor: '#0A0A0A' }}>
                <th style={{ padding: '12px 16px', width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedIds.size === records.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 14px', color: '#A3A3A3', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
                  Outbox ID / Event
                </th>
                <th style={{ padding: '12px 14px', color: '#A3A3A3', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
                  Target Destination
                </th>
                <th style={{ padding: '12px 14px', color: '#A3A3A3', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
                  Last Status / Error
                </th>
                <th style={{ padding: '12px 14px', color: '#A3A3A3', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
                  Attempts
                </th>
                <th style={{ padding: '12px 14px', color: '#A3A3A3', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
                  Dead-Lettered At
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#A3A3A3', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#A3A3A3' }}>
                    Loading dead-letter queue records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#737373' }}>
                    No dead-letter messages found matching criteria. Total DLQ backlog: {total}
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid #2A2A2A',
                      backgroundColor: selectedIds.has(r.id) ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelectOne(r.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#FFFFFF' }}>
                        {r.id.slice(0, 8)}...
                      </div>
                      <div style={{ fontSize: '11px', color: '#737373', fontFamily: 'monospace' }}>
                        ev: {r.eventId.slice(0, 8)}...
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {r.destinationName ? (
                        <>
                          <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{r.destinationName}</div>
                          <div style={{ fontSize: '11px', color: '#A3A3A3', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.destinationUrl}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#737373' }}>Default Org Targets</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: '#2A1C1C',
                          color: '#f87171',
                        }}>
                          {r.lastStatusCode ? `HTTP ${r.lastStatusCode}` : 'DISPATCH FAILED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#A3A3A3', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {r.lastErrorDescription || 'Max retry attempts exhausted'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#E5E5E5' }}>
                      {r.attemptCount} / {r.maxRetries}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#A3A3A3', fontSize: '11px' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => setInspectRecord(r)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#202020',
                            border: '1px solid #2A2A2A',
                            borderRadius: '999px',
                            color: '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handlePurgeClick(r)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'transparent',
                            border: '1px solid #442A2A',
                            borderRadius: '999px',
                            color: '#f87171',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal */}
      {inspectRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(14, 14, 16, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 90,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#161616',
            borderRadius: '20px',
            border: '1px solid #2A2A2A',
            width: '100%',
            maxWidth: '640px',
            padding: '28px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Dead Letter Message Details
                </h3>
                <p style={{ fontSize: '12px', color: '#A3A3A3', margin: '4px 0 0 0', fontFamily: 'monospace' }}>
                  ID: {inspectRecord.id}
                </p>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#A3A3A3',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase' }}>
                  Error Description
                </label>
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: '#2A1C1C',
                  border: '1px solid #442A2A',
                  borderRadius: '8px',
                  color: '#f87171',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  marginTop: '4px',
                }}>
                  {inspectRecord.lastErrorDescription || 'Max retry attempts exhausted without success.'}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#A3A3A3', textTransform: 'uppercase' }}>
                  Payload Snapshot
                </label>
                <pre style={{
                  padding: '12px',
                  backgroundColor: '#000000',
                  border: '1px solid #2A2A2A',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  overflowX: 'auto',
                  marginTop: '4px',
                  maxHeight: '200px',
                }}>
                  {JSON.stringify(inspectRecord.payloadSummary, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setInspectRecord(null)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#202020',
                  border: '1px solid #2A2A2A',
                  borderRadius: '999px',
                  color: '#FFFFFF',
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
