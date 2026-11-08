import React, { useEffect, useRef, useState } from 'react';
import { fetchMetrics } from '../api.ts';
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
    const sseUrl = `/v1/organizations/${organizationId}/telemetry/events/stream`;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Window Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#F2F2F5', letterSpacing: '-0.02em' }}>
            Operational Metrics & Real-Time Telemetry
          </h2>
          <p style={{ fontSize: '12px', color: '#9A9AA6', margin: '4px 0 0 0' }}>
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
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                border: windowHours === hours ? '1px solid transparent' : '1px solid #3E3E45',
                backgroundColor: windowHours === hours ? '#F2F2F5' : '#1A1A1E',
                color: windowHours === hours ? '#0E0E10' : '#9A9AA6',
                cursor: 'pointer',
              }}
            >
              {hours === 1 ? '1 Hour' : hours === 6 ? '6 Hours' : hours === 24 ? '24 Hours' : '7 Days'}
            </button>
          ))}
          <button
            onClick={() => void loadData()}
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 600,
              border: '1px solid #3E3E45',
              backgroundColor: '#232327',
              color: '#F2F2F5',
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#2A1C1C',
          border: '1px solid #442A2A',
          borderRadius: '12px',
          color: '#f87171',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Latency Quantile Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
      }}>
        <div style={{
          backgroundColor: '#1E1E22',
          border: '1px solid #3E3E45',
          borderRadius: '16px',
          padding: '18px 20px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6', textTransform: 'uppercase' }}>
            p50 Latency (Median)
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#F2F2F5', marginTop: '6px' }}>
            {loading ? '...' : `${metrics?.delivery.latency.p50Ms ?? 0} ms`}
          </div>
          <div style={{ fontSize: '11px', color: '#63636E', marginTop: '4px' }}>
            Typical destination response time
          </div>
        </div>

        <div style={{
          backgroundColor: '#1E1E22',
          border: '1px solid #3E3E45',
          borderRadius: '16px',
          padding: '18px 20px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6', textTransform: 'uppercase' }}>
            p95 Latency
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#F2F2F5', marginTop: '6px' }}>
            {loading ? '...' : `${metrics?.delivery.latency.p95Ms ?? 0} ms`}
          </div>
          <div style={{ fontSize: '11px', color: '#63636E', marginTop: '4px' }}>
            95% of attempts completed within
          </div>
        </div>

        <div style={{
          backgroundColor: '#1E1E22',
          border: '1px solid #3E3E45',
          borderRadius: '16px',
          padding: '18px 20px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6', textTransform: 'uppercase' }}>
            p99 Latency
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#F2F2F5', marginTop: '6px' }}>
            {loading ? '...' : `${metrics?.delivery.latency.p99Ms ?? 0} ms`}
          </div>
          <div style={{ fontSize: '11px', color: '#63636E', marginTop: '4px' }}>
            Tail latency for slow destinations
          </div>
        </div>

        <div style={{
          backgroundColor: '#1E1E22',
          border: '1px solid #3E3E45',
          borderRadius: '16px',
          padding: '18px 20px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6', textTransform: 'uppercase' }}>
            Outbox Lag
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#F2F2F5', marginTop: '6px' }}>
            {loading ? '...' : `${metrics?.outbox.oldestPendingLagSeconds ?? 0} s`}
          </div>
          <div style={{ fontSize: '11px', color: '#63636E', marginTop: '4px' }}>
            Pending backlog: {metrics?.outbox.pendingBacklogCount ?? 0}
          </div>
        </div>
      </div>

      {/* Throughput & Volume Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
      }}>
        <div style={{
          backgroundColor: '#1A1A1E',
          border: '1px solid #2C2C32',
          borderRadius: '16px',
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6' }}>Ingested Webhooks</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#F2F2F5', marginTop: '4px' }}>
            {metrics?.ingestion.totalEvents ?? 0}
          </div>
        </div>

        <div style={{
          backgroundColor: '#1A1A1E',
          border: '1px solid #2C2C32',
          borderRadius: '16px',
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6' }}>Delivered Messages</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#4ade80', marginTop: '4px' }}>
            {metrics?.delivery.successCount ?? 0}
          </div>
        </div>

        <div style={{
          backgroundColor: '#1A1A1E',
          border: '1px solid #2C2C32',
          borderRadius: '16px',
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6' }}>Delivery Success Rate</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#F2F2F5', marginTop: '4px' }}>
            {metrics?.delivery.successRatePercentage ?? 100}%
          </div>
        </div>

        <div style={{
          backgroundColor: '#1A1A1E',
          border: '1px solid #2C2C32',
          borderRadius: '16px',
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9AA6' }}>Dead Letter Messages</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: (metrics?.outbox.dlqBacklogCount ?? 0) > 0 ? '#f87171' : '#F2F2F5', marginTop: '4px' }}>
            {metrics?.outbox.dlqBacklogCount ?? 0}
          </div>
        </div>
      </div>

      {/* Real-time SSE Telemetry Event Console */}
      <div style={{
        backgroundColor: '#121215',
        border: '1px solid #2C2C32',
        borderRadius: '16px',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: streamConnected ? '#10b981' : '#f59e0b',
              boxShadow: streamConnected ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
            }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#F2F2F5' }}>
              Live Telemetry Stream
            </span>
            <span style={{ fontSize: '11px', color: '#9A9AA6' }}>
              ({streamConnected ? 'Connected via Redis Pub/Sub SSE' : 'Connecting...'})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setStreamPaused(!streamPaused)}
              style={{
                padding: '4px 10px',
                backgroundColor: streamPaused ? '#F2F2F5' : '#232327',
                color: streamPaused ? '#0E0E10' : '#9A9AA6',
                border: '1px solid #3E3E45',
                borderRadius: '999px',
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
                padding: '4px 10px',
                backgroundColor: 'transparent',
                color: '#63636E',
                border: '1px solid #2C2C32',
                borderRadius: '999px',
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
          border: '1px solid #232327',
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
            <div style={{ color: '#63636E', textAlign: 'center', padding: '40px 0' }}>
              Listening for live pipeline events (webhooks, HTTP deliveries, workflow steps, DLQ routings)...
            </div>
          ) : (
            streamEvents.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.4 }}>
                <span style={{ color: '#63636E', flexShrink: 0 }}>
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
                      : '#232327',
                  color:
                    ev.type === 'webhook.ingested'
                      ? '#4ade80'
                      : ev.type === 'delivery.attempt'
                      ? '#60a5fa'
                      : ev.type === 'workflow.step'
                      ? '#c084fc'
                      : ev.type === 'dlq.routed'
                      ? '#f87171'
                      : '#C9C9D2',
                }}>
                  {ev.type}
                </span>
                <span style={{ color: '#C9C9D2', wordBreak: 'break-all' }}>
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
