import React, { useEffect, useRef, useState } from 'react';
import { fetchMetrics, getApiBaseUrl } from '../api.ts';
import type { RealtimeTelemetryEvent, TelemetryMetrics } from '../types.ts';

interface MetricsDashboardProps {
  organizationId: string;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ organizationId }) => {
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowHours, setWindowHours] = useState<number>(24);
  const [streamEvents, setStreamEvents] = useState<RealtimeTelemetryEvent[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamPaused, setStreamPaused] = useState(false);
  const eventLogEndRef = useRef<HTMLDivElement>(null);

  const loadData = async (hours = windowHours) => {
    try {
      const data = await fetchMetrics(organizationId, hours);
      setMetrics(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load telemetry metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadData(windowHours);
    const interval = setInterval(() => {
      void loadData(windowHours);
    }, 15000);
    return () => clearInterval(interval);
  }, [organizationId, windowHours]);

  // Connect to SSE Real-time Telemetry Stream
  useEffect(() => {
    const sseUrl = `${getApiBaseUrl()}/v1/organizations/${organizationId}/telemetry/events/stream`;
    const eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.onopen = () => {
      setStreamConnected(true);
    };

    eventSource.onerror = () => {
      setStreamConnected(false);
    };

    eventSource.onmessage = (e) => {
      if (streamPaused) return;
      try {
        const parsed = JSON.parse(e.data) as RealtimeTelemetryEvent;
        if (parsed.type === 'ping') return;
        setStreamEvents((prev) => [parsed, ...prev.slice(0, 99)]);
      } catch {
        // Ignore parse error
      }
    };

    return () => {
      eventSource.close();
      setStreamConnected(false);
    };
  }, [organizationId, streamPaused]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Window Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#09090B', letterSpacing: '-0.02em' }}>
            Operational Metrics & Real-Time Telemetry
          </h2>
          <p style={{ fontSize: '12px', color: '#71717A', margin: '4px 0 0 0' }}>
            Quantile latencies, outbox processing rates, and live server-sent telemetry events.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[1, 6, 24, 168].map((hours) => (
            <button
              key={hours}
              onClick={() => {
                setWindowHours(hours);
                void loadData(hours);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 600,
                border: windowHours === hours ? '1px solid #09090B' : '1px solid #E5E7EB',
                backgroundColor: windowHours === hours ? '#09090B' : '#FFFFFF',
                color: windowHours === hours ? '#FFFFFF' : '#09090B',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {hours === 1 ? '1 Hour' : hours === 6 ? '6 Hours' : hours === 24 ? '24 Hours' : '7 Days'}
            </button>
          ))}
          <button
            onClick={() => void loadData()}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 600,
              border: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#09090B',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F4F4F6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#FEE2E2',
          border: '1px solid #FCA5A5',
          borderRadius: '10px',
          color: '#DC2626',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Latency Quantile Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase' }}>
            p50 Latency (Median)
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#09090B', marginTop: '6px' }}>
            {loading ? '...' : `${metrics?.delivery.latency.p50Ms ?? 0} ms`}
          </div>
          <div style={{ fontSize: '11px', color: '#71717A', marginTop: '4px' }}>
            Typical destination response time
          </div>
        </div>

        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase' }}>
            p95 Latency
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#09090B', marginTop: '6px' }}>
            {loading ? '...' : `${metrics?.delivery.latency.p95Ms ?? 0} ms`}
          </div>
          <div style={{ fontSize: '11px', color: '#71717A', marginTop: '4px' }}>
            95% of attempts completed within
          </div>
        </div>

        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase' }}>
            p99 Latency
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#09090B', marginTop: '6px' }}>
            {loading ? '...' : `${metrics?.delivery.latency.p99Ms ?? 0} ms`}
          </div>
          <div style={{ fontSize: '11px', color: '#71717A', marginTop: '4px' }}>
            Tail latency for slow destinations
          </div>
        </div>

        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#71717A', textTransform: 'uppercase' }}>
            Outbox Lag
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#09090B', marginTop: '6px' }}>
            {loading ? '...' : `${metrics?.outbox.oldestPendingLagSeconds ?? 0} s`}
          </div>
          <div style={{ fontSize: '11px', color: '#71717A', marginTop: '4px' }}>
            Pending backlog: {metrics?.outbox.pendingBacklogCount ?? 0}
          </div>
        </div>
      </div>

      {/* Throughput & Volume Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#71717A' }}>Ingested Webhooks</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#09090B', marginTop: '4px' }}>
            {metrics?.ingestion.totalEvents ?? 0}
          </div>
        </div>

        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#71717A' }}>Delivered Messages</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
            {metrics?.delivery.successCount ?? 0}
          </div>
        </div>

        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#71717A' }}>Delivery Success Rate</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#09090B', marginTop: '4px' }}>
            {metrics?.delivery.successRatePercentage ?? 100}%
          </div>
        </div>

        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#71717A' }}>Dead Letter Messages</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: (metrics?.outbox.dlqBacklogCount ?? 0) > 0 ? '#DC2626' : '#09090B', marginTop: '4px' }}>
            {metrics?.outbox.dlqBacklogCount ?? 0}
          </div>
        </div>
      </div>

      {/* Real-time SSE Telemetry Event Console */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: streamConnected ? '#16A34A' : '#F59E0B',
              boxShadow: streamConnected ? '0 0 6px rgba(22, 163, 74, 0.5)' : 'none',
            }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#09090B' }}>
              Live Telemetry Stream
            </span>
            <span style={{ fontSize: '11.5px', color: '#71717A' }}>
              ({streamConnected ? 'Connected via Redis Pub/Sub SSE' : 'Connecting...'})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setStreamPaused(!streamPaused)}
              style={{
                padding: '4px 12px',
                backgroundColor: streamPaused ? '#09090B' : '#FFFFFF',
                color: streamPaused ? '#FFFFFF' : '#09090B',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {streamPaused ? '▶ Resume Stream' : '⏸ Pause Stream'}
            </button>
            <button
              onClick={() => setStreamEvents([])}
              style={{
                padding: '4px 12px',
                backgroundColor: '#FFFFFF',
                color: '#71717A',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Clear Log
            </button>
          </div>
        </div>

        {/* Console Log Terminal */}
        <div style={{
          backgroundColor: '#09090B',
          border: '1px solid #202020',
          borderRadius: '10px',
          padding: '14px',
          height: '240px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {streamEvents.length === 0 ? (
            <div style={{ color: '#737373', textAlign: 'center', padding: '40px 0' }}>
              Listening for live pipeline events (webhooks, HTTP deliveries, workflow steps, DLQ routings)...
            </div>
          ) : (
            streamEvents.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.4 }}>
                <span style={{ color: '#737373', flexShrink: 0 }}>
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  flexShrink: 0,
                  backgroundColor:
                    ev.type === 'webhook.ingested'
                      ? '#1E2D22'
                      : ev.type === 'delivery.attempt'
                      ? '#1E232D'
                      : ev.type === 'workflow.step'
                      ? '#2A2035'
                      : ev.type === 'dlq.routed'
                      ? '#2D1E1E'
                      : '#202020',
                  color:
                    ev.type === 'webhook.ingested'
                      ? '#4ade80'
                      : ev.type === 'delivery.attempt'
                      ? '#E5E5E5'
                      : ev.type === 'workflow.step'
                      ? '#E5E5E5'
                      : ev.type === 'dlq.routed'
                      ? '#f87171'
                      : '#E5E5E5',
                }}>
                  {ev.type}
                </span>
                <span style={{ color: '#E5E5E5', wordBreak: 'break-all' }}>
                  {JSON.stringify(ev.payload)}
                </span>
              </div>
            ))
          )}
          <div ref={eventLogEndRef} />
        </div>
      </div>
    </div>
  );
};
