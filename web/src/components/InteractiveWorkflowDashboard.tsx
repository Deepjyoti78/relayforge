import React, { useState, useEffect, useRef } from 'react';

interface InteractiveWorkflowDashboardProps {
  onCardClick?: () => void;
}

// Particle representation on connector paths
interface EventParticle {
  id: number;
  type: 'webhook' | 'event-source' | 'retry' | 'dead-letter';
  progress: number; // 0 to 1
  color: string;
}

export const InteractiveWorkflowDashboard: React.FC<InteractiveWorkflowDashboardProps> = ({ onCardClick }) => {
  // Timeframe selector state
  const [timeframe, setTimeframe] = useState<'Last 24 hours' | 'Last 1 hour' | 'Last 7 days'>('Last 24 hours');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Live Statistics
  const [ingestedCount, setIngestedCount] = useState(248326);
  const [processedCount, setProcessedCount] = useState(246896);
  const [failedCount, setFailedCount] = useState(1430);

  // Currently highlighted left-side module:
  // 'webhooks' | 'event-sources' | 'workflows' | 'executions' | 'retries' | 'dead-letter' | null
  const [activeModule, setActiveModule] = useState<string | null>('executions');

  // Pipeline stage: 'idle' | 'receive' | 'process' | 'deliver' | 'deliver-retry-warn' | 'deliver-dlq-warn' | 'deliver-success'
  const [pipelineStage, setPipelineStage] = useState<'idle' | 'receive' | 'process' | 'deliver' | 'deliver-retry-warn' | 'deliver-dlq-warn' | 'deliver-success'>('deliver');
  const [arrow1Active, setArrow1Active] = useState(false);
  const [arrow2Active, setArrow2Active] = useState(false);

  // Traffic surge multiplier for throughput wave
  const [waveSurge, setWaveSurge] = useState(false);

  // Live particles travelling on the multi-branch connector
  const [particles, setParticles] = useState<EventParticle[]>([]);

  // Canvas ref for animated throughput chart
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Respect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  // =========================================================================
  // Master Orchestration Timeline (A: Webhook -> B: Multi-Source -> C: Workflow -> D: Retry -> E: Dead Letter)
  // =========================================================================
  useEffect(() => {
    if (prefersReducedMotion) return;

    let isMounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const schedule = (fn: () => void, delayMs: number) => {
      const id = setTimeout(() => {
        if (isMounted) fn();
      }, delayMs);
      timeouts.push(id);
      return id;
    };

    const runMasterSequence = () => {
      // ---------------------------------------------------------------------
      // STAGE A: Webhook Ingestion (0.0s – 3.2s)
      // ---------------------------------------------------------------------
      // 1. Highlight Webhooks module & emit particle
      setActiveModule('webhooks');
      const p1Id = Date.now() + Math.random();
      setParticles(prev => [...prev.slice(-4), { id: p1Id, type: 'webhook', progress: 0, color: '#F5E8D0' }]);

      // 2. Particle reaches Central Junction -> Enters Orders Workflow
      schedule(() => {
        setActiveModule('workflows');
        setPipelineStage('receive');
        setIngestedCount(c => c + 1);
      }, 950);

      // 3. Receive -> Process (Executions module activates)
      schedule(() => {
        setArrow1Active(true);
        setActiveModule('executions');
        setPipelineStage('process');
      }, 1650);

      schedule(() => setArrow1Active(false), 2100);

      // 4. Process -> Deliver
      schedule(() => {
        setArrow2Active(true);
        setPipelineStage('deliver');
      }, 2400);

      schedule(() => setArrow2Active(false), 2800);

      // 5. Successful Delivery confirmation
      schedule(() => {
        setPipelineStage('deliver-success');
        setProcessedCount(c => c + 1);
      }, 2900);

      schedule(() => {
        setPipelineStage('idle');
        setActiveModule(null);
      }, 3500);

      // ---------------------------------------------------------------------
      // STAGE B: Event Sources Traffic Burst (4.2s – 7.8s)
      // ---------------------------------------------------------------------
      schedule(() => {
        setActiveModule('event-sources');
        setWaveSurge(true);

        // Burst of particles: one from Event Sources, one from Webhooks
        const p2Id = Date.now() + Math.random();
        const p3Id = Date.now() + Math.random() + 1;
        setParticles(prev => [
          ...prev.slice(-4),
          { id: p2Id, type: 'event-source', progress: 0, color: '#E9D8B9' },
          { id: p3Id, type: 'webhook', progress: 0.12, color: '#F5E8D0' },
        ]);
      }, 4200);

      // Particles converge at junction & enter Receive
      schedule(() => {
        setActiveModule('workflows');
        setPipelineStage('receive');
        setIngestedCount(c => c + 2);
      }, 5150);

      // Fast-pipeline execution
      schedule(() => {
        setArrow1Active(true);
        setActiveModule('executions');
        setPipelineStage('process');
      }, 5850);

      schedule(() => setArrow1Active(false), 6300);

      schedule(() => {
        setArrow2Active(true);
        setPipelineStage('deliver-success');
        setProcessedCount(c => c + 2);
      }, 6550);

      schedule(() => {
        setArrow2Active(false);
        setPipelineStage('idle');
        setActiveModule(null);
        setWaveSurge(false);
      }, 7450);

      // ---------------------------------------------------------------------
      // STAGE D: Retries Scenario (8.4s – 12.0s)
      // ---------------------------------------------------------------------
      schedule(() => {
        setActiveModule('webhooks');
        const p4Id = Date.now() + Math.random();
        setParticles(prev => [...prev.slice(-4), { id: p4Id, type: 'webhook', progress: 0, color: '#F5E8D0' }]);
      }, 8400);

      schedule(() => {
        setPipelineStage('receive');
        setIngestedCount(c => c + 1);
      }, 9250);

      schedule(() => {
        setPipelineStage('process');
        setActiveModule('executions');
      }, 9850);

      // Transient delivery failure triggers Retry path
      schedule(() => {
        setPipelineStage('deliver-retry-warn');
        setActiveModule('retries');

        // Particle routes down to Retries module
        const retryPid = Date.now() + Math.random();
        setParticles(prev => [...prev.slice(-4), { id: retryPid, type: 'retry', progress: 0, color: '#FBBF24' }]);
      }, 10450);

      // Retries module absorbs and rebounds back through junction
      schedule(() => {
        setPipelineStage('process');
      }, 11150);

      // Second delivery attempt succeeds!
      schedule(() => {
        setPipelineStage('deliver-success');
        setProcessedCount(c => c + 1);
      }, 11650);

      schedule(() => {
        setPipelineStage('idle');
        setActiveModule(null);
      }, 12250);

      // ---------------------------------------------------------------------
      // STAGE E: Dead Letter Queue (DLQ) Scenario (12.8s – 16.0s)
      // ---------------------------------------------------------------------
      schedule(() => {
        setActiveModule('webhooks');
        const p5Id = Date.now() + Math.random();
        setParticles(prev => [...prev.slice(-4), { id: p5Id, type: 'webhook', progress: 0, color: '#F5E8D0' }]);
      }, 12800);

      schedule(() => {
        setPipelineStage('receive');
        setIngestedCount(c => c + 1);
      }, 13650);

      schedule(() => {
        setPipelineStage('process');
        setActiveModule('executions');
      }, 14150);

      // Permanent delivery failure -> Dead Letter routing
      schedule(() => {
        setPipelineStage('deliver-dlq-warn');
        setActiveModule('dead-letter');

        // Particle routes down to Dead Letter module
        const dlqPid = Date.now() + Math.random();
        setParticles(prev => [...prev.slice(-4), { id: dlqPid, type: 'dead-letter', progress: 0, color: '#F59E0B' }]);
      }, 14750);

      // Dead Letter absorbs permanently; update Failed stat
      schedule(() => {
        setFailedCount(c => c + 1);
      }, 15450);

      schedule(() => {
        setPipelineStage('idle');
        setActiveModule('webhooks');
        // Loop restart
        runMasterSequence();
      }, 16500);
    };

    // Kick off master sequence after subtle initial delay
    const initialId = setTimeout(runMasterSequence, 600);
    timeouts.push(initialId);

    return () => {
      isMounted = false;
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [prefersReducedMotion]);

  // =========================================================================
  // Continuous Particle Physics along Multi-Branch Connector
  // =========================================================================
  useEffect(() => {
    if (prefersReducedMotion) return;

    let animId: number;
    const step = () => {
      setParticles(prev =>
        prev
          .map(p => ({ ...p, progress: p.progress + 0.016 }))
          .filter(p => p.progress < 1.05)
      );
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion]);

  // Coordinate interpolator along straight-line orthogonal bus architecture:
  // Bus line is at x = 24
  // Main Entry to card is at y = 188
  const getParticleCoords = (type: EventParticle['type'], progress: number) => {
    const t = Math.max(0, Math.min(1, progress));

    if (type === 'webhook') {
      if (t <= 0.25) {
        const u = t / 0.25;
        return { x: u * 24, y: 44 };
      } else if (t <= 0.75) {
        const u = (t - 0.25) / 0.5;
        return { x: 24, y: 44 + u * (188 - 44) };
      } else {
        const u = (t - 0.75) / 0.25;
        return { x: 24 + u * 20, y: 188 };
      }
    } else if (type === 'event-source') {
      if (t <= 0.25) {
        const u = t / 0.25;
        return { x: u * 24, y: 82 };
      } else if (t <= 0.75) {
        const u = (t - 0.25) / 0.5;
        return { x: 24, y: 82 + u * (188 - 82) };
      } else {
        const u = (t - 0.75) / 0.25;
        return { x: 24 + u * 20, y: 188 };
      }
    } else if (type === 'retry') {
      if (t <= 0.25) {
        const u = t / 0.25;
        return { x: 44 - u * 20, y: 188 };
      } else if (t <= 0.75) {
        const u = (t - 0.25) / 0.5;
        return { x: 24, y: 188 + u * (256 - 188) };
      } else {
        const u = (t - 0.75) / 0.25;
        return { x: 24 - u * 24, y: 256 };
      }
    } else {
      if (t <= 0.25) {
        const u = t / 0.25;
        return { x: 44 - u * 20, y: 188 };
      } else if (t <= 0.75) {
        const u = (t - 0.25) / 0.5;
        return { x: 24, y: 188 + u * (294 - 188) };
      } else {
        const u = (t - 0.75) / 0.25;
        return { x: 24 - u * 24, y: 294 };
      }
    }
  };

  // =========================================================================
  // Real-Time Animated Telemetry Wave (Canvas 60fps)
  // =========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Base Wave points
      ctx.beginPath();
      ctx.moveTo(0, height);

      const points: Array<{ x: number; y: number }> = [];
      const numPoints = 28;
      const ampMultiplier = waveSurge ? 1.45 : 1.0;

      for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * width;
        // Organic undulating sine curve
        const wave1 = Math.sin((i * 0.32) - t * 0.026) * (9 * ampMultiplier);
        const wave2 = Math.cos((i * 0.55) + t * 0.016) * (5 * ampMultiplier);
        const wave3 = Math.sin((i * 0.18) - t * 0.008) * (6 * ampMultiplier);
        const y = height * 0.54 + wave1 + wave2 + wave3;
        points.push({ x, y });

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prev = points[i - 1];
          const midX = (prev.x + x) / 2;
          const midY = (prev.y + y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
      }

      ctx.lineTo(width, points[points.length - 1].y);
      ctx.lineTo(width, height);
      ctx.closePath();

      // Soft champagne gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, waveSurge ? 'rgba(233, 216, 185, 0.32)' : 'rgba(233, 216, 185, 0.22)');
      grad.addColorStop(0.5, 'rgba(233, 216, 185, 0.08)');
      grad.addColorStop(1, 'rgba(233, 216, 185, 0.00)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Golden cream stroke line
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (i === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          const prev = points[i - 1];
          const midX = (prev.x + pt.x) / 2;
          const midY = (prev.y + pt.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
      }
      ctx.strokeStyle = '#E9D8B9';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      if (!prefersReducedMotion) {
        t += waveSurge ? 1.4 : 1.0;
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion, waveSurge]);

  // Helper function to render a module button with active state detection
  const renderModuleButton = (
    key: string,
    label: string,
    icon: React.ReactNode,
    isAmberAccent = false
  ) => {
    const isActive = activeModule === key;
    const isWebhooksActive = key === 'webhooks' && activeModule === 'webhooks';

    // Webhooks active style is the prominent warm ivory pill
    if (isWebhooksActive) {
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setActiveModule(key); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            backgroundColor: '#F5E8D0',
            color: '#0D0C0B',
            border: 'none',
            borderRadius: '999px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '6px',
            boxShadow: '0 0 18px rgba(245, 232, 208, 0.65)',
            transform: 'scale(1.02)',
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {icon}
          <span>{label}</span>
        </button>
      );
    }

    // Dynamic styling when another module participates in the animation
    const isExecutionsActive = key === 'executions' && isActive;
    const activeBg = isAmberAccent ? 'rgba(245, 158, 11, 0.16)' : isExecutionsActive ? '#161513' : 'rgba(235, 225, 208, 0.15)';
    const activeBorder = isAmberAccent ? '1px solid #F59E0B' : isExecutionsActive ? '1px solid rgba(235, 225, 208, 0.55)' : '1px solid #E9D8B9';
    const activeColor = isAmberAccent ? '#FDE68A' : '#F5F0E7';
    const activeShadow = isAmberAccent ? '0 0 16px rgba(245, 158, 11, 0.45)' : isExecutionsActive ? '0 0 16px rgba(233, 216, 185, 0.3)' : '0 0 14px rgba(233, 216, 185, 0.35)';

    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setActiveModule(key); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          backgroundColor: isActive ? activeBg : '#161513',
          color: isActive ? activeColor : '#C2BCB2',
          border: isActive ? activeBorder : '1px solid rgba(235, 225, 208, 0.06)',
          borderRadius: '999px',
          padding: '7px 14px',
          fontSize: '12px',
          fontWeight: isActive ? 600 : 500,
          cursor: 'pointer',
          marginBottom: '6px',
          boxShadow: isActive ? activeShadow : 'none',
          transform: isActive ? 'scale(1.02) translateX(2px)' : 'scale(1)',
          transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <span style={{ color: isActive ? activeColor : '#858078', transition: 'color 0.2s ease', display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div
      onClick={onCardClick}
      className="rf-interactive-dashboard-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '750px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        gap: '0px',
        position: 'relative',
      }}>
        {/* ============================================================== */}
        {/* 1. LEFT SUB-PANEL: All 6 Event Processing Modules              */}
        {/* ============================================================== */}
        <div style={{
          width: '146px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '4px 0',
          zIndex: 10,
        }}>
          {/* GROUP 1: INGEST */}
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#858078',
              letterSpacing: '0.02em',
              marginBottom: '6px',
              paddingLeft: '4px',
            }}>
              Ingest
            </div>

            {/* Module 1: Webhooks */}
            {renderModuleButton(
              'webhooks',
              'Webhooks',
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="18" r="2.8" />
                <circle cx="18" cy="18" r="2.8" />
                <circle cx="12" cy="6" r="2.8" />
                <path d="M12 8.8v2.8a3 3 0 0 1-3 3H8.8" />
                <path d="M12 11.6a3 3 0 0 0 3 3h0.2" />
              </svg>
            )}

            {/* Module 2: Event Sources */}
            {renderModuleButton(
              'event-sources',
              'Event Sources',
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="6" r="2.5" />
                <circle cx="6" cy="18" r="2.5" />
                <path d="M6 15.5V11a4 4 0 0 1 4-4h5.5" />
              </svg>
            )}
          </div>

          {/* GROUP 2: PROCESS */}
          <div style={{ marginTop: '12px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#858078',
              letterSpacing: '0.02em',
              marginBottom: '6px',
              paddingLeft: '4px',
            }}>
              Process
            </div>

            {/* Module 3: Workflows */}
            {renderModuleButton(
              'workflows',
              'Workflows',
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 11a9 9 0 0 1 9 9" />
                <path d="M4 4a16 16 0 0 1 16 16" />
                <circle cx="5" cy="19" r="1.5" />
              </svg>
            )}

            {/* Module 4: Executions */}
            {renderModuleButton(
              'executions',
              'Executions',
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9.5" />
                <polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none" />
              </svg>
            )}
          </div>

          {/* GROUP 3: DELIVER */}
          <div style={{ marginTop: '12px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#858078',
              letterSpacing: '0.02em',
              marginBottom: '6px',
              paddingLeft: '4px',
            }}>
              Deliver
            </div>

            {/* Module 5: Retries */}
            {renderModuleButton(
              'retries',
              'Retries',
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.8 1.04 6.44 2.73" />
                <polyline points="21 3 21 8 16 8" />
              </svg>,
              true
            )}

            {/* Module 6: Dead Letter */}
            {renderModuleButton(
              'dead-letter',
              'Dead Letter',
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="13" x="3" y="5.5" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>,
              true
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. DOTTED CIRCUIT CONNECTOR BUS & EVENT PARTICLES             */}
        {/* ============================================================== */}
        <div style={{
          width: '44px',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg
            width="44"
            height="350"
            viewBox="0 0 44 350"
            fill="none"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {/* Main Straight Vertical Dashed Bus Line from Webhooks to Dead Letter */}
            <line
              x1="24"
              y1="44"
              x2="24"
              y2="294"
              stroke="rgba(235, 225, 208, 0.28)"
              strokeWidth="1.5"
              strokeDasharray="2.5 2.5"
            />

            {/* Tap 1: Webhooks -> Bus */}
            <line
              x1="0"
              y1="44"
              x2="24"
              y2="44"
              stroke={activeModule === 'webhooks' ? 'rgba(245, 232, 208, 0.65)' : 'rgba(235, 225, 208, 0.22)'}
              strokeWidth="1.5"
              strokeDasharray="2.5 2.5"
            />

            {/* Tap 2: Event Sources -> Bus */}
            <line
              x1="0"
              y1="82"
              x2="24"
              y2="82"
              stroke={activeModule === 'event-sources' ? 'rgba(233, 216, 185, 0.65)' : 'rgba(235, 225, 208, 0.22)'}
              strokeWidth="1.5"
              strokeDasharray="2.5 2.5"
            />

            {/* Tap 3: Workflows -> Bus */}
            <line
              x1="0"
              y1="150"
              x2="24"
              y2="150"
              stroke={activeModule === 'workflows' ? 'rgba(233, 216, 185, 0.65)' : 'rgba(235, 225, 208, 0.22)'}
              strokeWidth="1.5"
              strokeDasharray="2.5 2.5"
            />

            {/* Tap 4: Executions -> Bus -> Orders Workflow Card Entry */}
            <line
              x1="0"
              y1="188"
              x2="44"
              y2="188"
              stroke={activeModule === 'executions' || pipelineStage !== 'idle' ? 'rgba(235, 225, 208, 0.55)' : 'rgba(235, 225, 208, 0.28)'}
              strokeWidth="1.5"
              strokeDasharray="2.5 2.5"
            />

            {/* Tap 5: Bus -> Retries */}
            <line
              x1="0"
              y1="256"
              x2="24"
              y2="256"
              stroke={activeModule === 'retries' ? 'rgba(245, 158, 11, 0.7)' : 'rgba(235, 225, 208, 0.22)'}
              strokeWidth="1.5"
              strokeDasharray="2.5 2.5"
            />

            {/* Tap 6: Bus -> Dead Letter */}
            <line
              x1="0"
              y1="294"
              x2="24"
              y2="294"
              stroke={activeModule === 'dead-letter' ? 'rgba(245, 158, 11, 0.7)' : 'rgba(235, 225, 208, 0.22)'}
              strokeWidth="1.5"
              strokeDasharray="2.5 2.5"
            />

            {/* Node 1: Webhooks */}
            {activeModule === 'webhooks' ? (
              <g>
                <circle cx="24" cy="44" r="7" fill="rgba(245, 232, 208, 0.2)" />
                <circle cx="24" cy="44" r="3.5" fill="#F5E8D0" />
              </g>
            ) : (
              <circle cx="24" cy="44" r="2.5" fill="#141311" stroke="rgba(235, 225, 208, 0.45)" strokeWidth="1.2" />
            )}

            {/* Node 2: Event Sources */}
            {activeModule === 'event-sources' ? (
              <g>
                <circle cx="24" cy="82" r="7" fill="rgba(233, 216, 185, 0.2)" />
                <circle cx="24" cy="82" r="3.5" fill="#E9D8B9" />
              </g>
            ) : (
              <circle cx="24" cy="82" r="2.5" fill="#141311" stroke="rgba(235, 225, 208, 0.45)" strokeWidth="1.2" />
            )}

            {/* Node 3: Workflows */}
            {activeModule === 'workflows' ? (
              <g>
                <circle cx="24" cy="150" r="7" fill="rgba(233, 216, 185, 0.2)" />
                <circle cx="24" cy="150" r="3.5" fill="#E9D8B9" />
              </g>
            ) : (
              <circle cx="24" cy="150" r="2.5" fill="#141311" stroke="rgba(235, 225, 208, 0.45)" strokeWidth="1.2" />
            )}

            {/* Node 4: Executions / Main Entry (Glowing active junction) */}
            {activeModule === 'executions' || pipelineStage !== 'idle' ? (
              <g>
                <circle cx="24" cy="188" r="9" fill="rgba(233, 216, 185, 0.22)" />
                <circle cx="24" cy="188" r="4.2" fill="#F5E8D0" />
              </g>
            ) : (
              <circle cx="24" cy="188" r="2.8" fill="#141311" stroke="rgba(235, 225, 208, 0.5)" strokeWidth="1.2" />
            )}

            {/* Node 5: Retries */}
            {activeModule === 'retries' ? (
              <g>
                <circle cx="24" cy="256" r="7" fill="rgba(245, 158, 11, 0.25)" />
                <circle cx="24" cy="256" r="3.5" fill="#F59E0B" />
              </g>
            ) : (
              <circle cx="24" cy="256" r="2.5" fill="#141311" stroke="rgba(235, 225, 208, 0.45)" strokeWidth="1.2" />
            )}

            {/* Node 6: Dead Letter */}
            {activeModule === 'dead-letter' ? (
              <g>
                <circle cx="24" cy="294" r="7" fill="rgba(245, 158, 11, 0.25)" />
                <circle cx="24" cy="294" r="3.5" fill="#F59E0B" />
              </g>
            ) : (
              <circle cx="24" cy="294" r="2.5" fill="#141311" stroke="rgba(235, 225, 208, 0.45)" strokeWidth="1.2" />
            )}

            {/* Traveling Event Particles */}
            {particles.map(p => {
              const coords = getParticleCoords(p.type, p.progress);
              const opacity = Math.sin(Math.min(1, Math.max(0, p.progress)) * Math.PI);
              return (
                <g key={p.id}>
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="6.5"
                    fill={p.color}
                    opacity={opacity * 0.35}
                  />
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="3.2"
                    fill={p.color}
                    opacity={opacity}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* ============================================================== */}
        {/* 3. RIGHT SECTION: Orders Workflow Main Console Card           */}
        {/* ============================================================== */}
        <div style={{
          flex: 1,
          backgroundColor: '#141311',
          border: '1px solid rgba(235, 225, 208, 0.12)',
          borderRadius: '18px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65)',
          padding: '16px 20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative',
          overflow: 'hidden',
          minWidth: '0',
        }}>
          {/* Header Row: Title, Running Badge, Timeframe */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            {/* Title & Icon & Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  color: '#F5F0E7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="m12 2 10 5-10 5L2 7l10-5Z" />
                    <path d="m2 12 10 5 10-5" />
                    <path d="m2 17 10 5 10-5" />
                  </svg>
                </div>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#F5F0E7',
                  letterSpacing: '-0.01em',
                }}>
                  Orders Workflow
                </span>
              </div>

              {/* Status Badge: Running */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(132, 204, 22, 0.1)',
                border: '1px solid rgba(132, 204, 22, 0.28)',
                borderRadius: '999px',
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#A3E635',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#84CC16',
                  boxShadow: '0 0 8px #84CC16',
                  animation: prefersReducedMotion ? 'none' : 'rfPulseDot 1.8s ease-in-out infinite',
                }}></span>
                <span>Running</span>
              </div>
            </div>

            {/* Timeframe Selector Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#191816',
                  border: '1px solid rgba(235, 225, 208, 0.12)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  color: '#B5AEA3',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
              >
                <span>{timeframe}</span>
                <span style={{ fontSize: '9px', opacity: 0.7 }}>⌄</span>
              </button>

              {dropdownOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: '#1C1A17',
                    border: '1px solid rgba(235, 225, 208, 0.18)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                    zIndex: 50,
                    minWidth: '120px',
                    overflow: 'hidden',
                  }}
                >
                  {(['Last 1 hour', 'Last 24 hours', 'Last 7 days'] as const).map(option => (
                    <div
                      key={option}
                      onClick={() => { setTimeframe(option); setDropdownOpen(false); }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '11px',
                        color: timeframe === option ? '#E9D8B9' : '#B5AEA3',
                        backgroundColor: timeframe === option ? 'rgba(235, 225, 208, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        fontWeight: timeframe === option ? 600 : 500,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(235, 225, 208, 0.12)'; }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = timeframe === option ? 'rgba(235, 225, 208, 0.08)' : 'transparent';
                      }}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Statistics Row: Ingested, Processed, Failed */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
          }}>
            {/* Card 1: Ingested */}
            <div style={{
              backgroundColor: '#161513',
              border: pipelineStage === 'receive' ? '1px solid rgba(233, 216, 185, 0.35)' : '1px solid rgba(235, 225, 208, 0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              textAlign: 'left',
              transition: 'border-color 0.25s ease',
            }}>
              <div style={{ fontSize: '11px', color: '#858078', fontWeight: 500 }}>
                Ingested
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 700,
                color: pipelineStage === 'receive' ? '#E9D8B9' : '#F5F0E7',
                marginTop: '4px',
                lineHeight: 1,
                transition: 'color 0.2s ease',
              }}>
                {ingestedCount.toLocaleString()}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#84CC16',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 600,
              }}>
                <span>↑ +18.4%</span>
              </div>
            </div>

            {/* Card 2: Processed */}
            <div style={{
              backgroundColor: '#161513',
              border: (pipelineStage === 'deliver-success' || pipelineStage === 'deliver') ? '1px solid rgba(132, 204, 22, 0.45)' : '1px solid rgba(235, 225, 208, 0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              textAlign: 'left',
              transition: 'border-color 0.25s ease',
            }}>
              <div style={{ fontSize: '11px', color: '#858078', fontWeight: 500 }}>
                Processed
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 700,
                color: (pipelineStage === 'deliver-success' || pipelineStage === 'deliver') ? '#84CC16' : '#F5F0E7',
                marginTop: '4px',
                lineHeight: 1,
                transition: 'color 0.2s ease',
              }}>
                {processedCount.toLocaleString()}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#84CC16',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 600,
              }}>
                <span>↑ +18.1%</span>
              </div>
            </div>

            {/* Card 3: Failed */}
            <div style={{
              backgroundColor: '#161513',
              border: pipelineStage === 'deliver-dlq-warn' ? '1px solid #F59E0B' : '1px solid rgba(235, 225, 208, 0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              textAlign: 'left',
              transition: 'border-color 0.25s ease',
            }}>
              <div style={{ fontSize: '11px', color: '#858078', fontWeight: 500 }}>
                Failed
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 700,
                color: pipelineStage === 'deliver-dlq-warn' ? '#F59E0B' : '#F5F0E7',
                marginTop: '4px',
                lineHeight: 1,
                transition: 'color 0.2s ease',
              }}>
                {failedCount.toLocaleString()}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#84CC16',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 600,
              }}>
                <span>↓ -37.2%</span>
              </div>
            </div>
          </div>

          {/* Workflow Pipeline Sequence: Receive -> Process -> Deliver */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}>
            {/* Stage 1: Receive */}
            <div style={{
              flex: 1,
              backgroundColor: pipelineStage === 'receive' ? 'rgba(235, 225, 208, 0.14)' : '#161513',
              border: pipelineStage === 'receive' ? '1px solid #E9D8B9' : '1px solid rgba(235, 225, 208, 0.08)',
              boxShadow: pipelineStage === 'receive' ? '0 0 16px rgba(233, 216, 185, 0.35)' : 'none',
              borderRadius: '10px',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                color: pipelineStage === 'receive' ? '#E9D8B9' : '#C2BCB2',
                transform: pipelineStage === 'receive' ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s ease, color 0.2s ease',
                display: 'flex',
                alignItems: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 17v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2" />
                  <polyline points="7 11 12 16 17 11" />
                  <line x1="12" y1="4" x2="12" y2="16" />
                </svg>
              </div>
              <span style={{
                fontSize: '11.5px',
                fontWeight: pipelineStage === 'receive' ? 600 : 500,
                color: pipelineStage === 'receive' ? '#F5F0E7' : '#B5AEA3',
              }}>
                Receive
              </span>
            </div>

            {/* Connecting Arrow 1 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: arrow1Active ? '#E9D8B9' : '#666159',
              transform: arrow1Active ? 'translateX(2px)' : 'none',
              transition: 'all 0.18s ease',
              padding: '0 2px',
            }}>
              <svg width="22" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <polyline points="14 6 20 12 14 18" />
              </svg>
            </div>

            {/* Stage 2: Process */}
            <div style={{
              flex: 1,
              backgroundColor: pipelineStage === 'process' ? 'rgba(235, 225, 208, 0.14)' : '#161513',
              border: pipelineStage === 'process' ? '1px solid #E9D8B9' : '1px solid rgba(235, 225, 208, 0.08)',
              boxShadow: pipelineStage === 'process' ? '0 0 16px rgba(233, 216, 185, 0.35)' : 'none',
              borderRadius: '10px',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                color: pipelineStage === 'process' ? '#E9D8B9' : '#C2BCB2',
                display: 'flex',
                alignItems: 'center',
              }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation: pipelineStage === 'process' && !prefersReducedMotion ? 'rfSpinCog 2s linear infinite' : 'none',
                  }}
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <span style={{
                fontSize: '11.5px',
                fontWeight: pipelineStage === 'process' ? 600 : 500,
                color: pipelineStage === 'process' ? '#F5F0E7' : '#B5AEA3',
              }}>
                Process
              </span>
            </div>

            {/* Connecting Arrow 2 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: arrow2Active ? '#E9D8B9' : '#666159',
              transform: arrow2Active ? 'translateX(2px)' : 'none',
              transition: 'all 0.18s ease',
              padding: '0 2px',
            }}>
              <svg width="22" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <polyline points="14 6 20 12 14 18" />
              </svg>
            </div>

            {/* Stage 3: Deliver (Handles Idle, Active, Success Pop, Retry Warning, and DLQ warning) */}
            <div style={{
              flex: 1,
              backgroundColor:
                pipelineStage === 'deliver-success' || pipelineStage === 'deliver'
                  ? 'rgba(132, 204, 22, 0.08)'
                  : pipelineStage === 'deliver-retry-warn' || pipelineStage === 'deliver-dlq-warn'
                  ? 'rgba(245, 158, 11, 0.14)'
                  : '#161513',
              border:
                pipelineStage === 'deliver-success' || pipelineStage === 'deliver'
                  ? '1px solid #84CC16'
                  : pipelineStage === 'deliver-retry-warn' || pipelineStage === 'deliver-dlq-warn'
                  ? '1px solid #F59E0B'
                  : '1px solid rgba(235, 225, 208, 0.08)',
              boxShadow:
                pipelineStage === 'deliver-success' || pipelineStage === 'deliver'
                  ? '0 0 16px rgba(132, 204, 22, 0.28)'
                  : pipelineStage === 'deliver-retry-warn' || pipelineStage === 'deliver-dlq-warn'
                  ? '0 0 18px rgba(245, 158, 11, 0.4)'
                  : 'none',
              borderRadius: '10px',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                color:
                  pipelineStage === 'deliver-success' || pipelineStage === 'deliver'
                    ? '#84CC16'
                    : pipelineStage === 'deliver-retry-warn' || pipelineStage === 'deliver-dlq-warn'
                    ? '#FBBF24'
                    : '#C2BCB2',
                transform: pipelineStage === 'deliver-success' || pipelineStage === 'deliver' ? 'scale(1.12)' : 'scale(1)',
                transition: 'transform 0.2s ease, color 0.2s ease',
                display: 'flex',
                alignItems: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9.5" />
                  <polyline points="9 12 11.5 14.5 15.5 9.5" />
                </svg>
              </div>
              <span style={{
                fontSize: '11.5px',
                fontWeight: pipelineStage === 'deliver' || pipelineStage === 'deliver-success' ? 600 : 500,
                color:
                  pipelineStage === 'deliver-success' || pipelineStage === 'deliver'
                    ? '#84CC16'
                    : pipelineStage === 'deliver-retry-warn' || pipelineStage === 'deliver-dlq-warn'
                    ? '#FDE68A'
                    : '#B5AEA3',
              }}>
                Deliver
              </span>
            </div>
          </div>

          {/* Bottom Section: Animated Real-Time Throughput Graph */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '2px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={{
                fontSize: '11.5px',
                fontWeight: 500,
                color: '#858078',
              }}>
                Throughput
              </span>
              <span style={{
                fontSize: '11.5px',
                color: '#858078',
                fontWeight: 500,
              }}>
                Live Telemetry
              </span>
            </div>

            {/* Canvas for Smooth 60fps Champagne Wave Line */}
            <div style={{
              width: '100%',
              height: '68px',
              position: 'relative',
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: '#12110F',
              border: '1px solid rgba(235, 225, 208, 0.08)',
            }}>
              <canvas
                ref={canvasRef}
                width={520}
                height={68}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Animation Keyframes */}
      <style>{`
        @keyframes rfPulseDot {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.45;
            transform: scale(0.85);
          }
        }
        @keyframes rfSpinCog {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 680px) {
          .rf-interactive-dashboard-wrapper {
            max-width: 100% !important;
          }
          .rf-interactive-dashboard-wrapper > div {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .rf-interactive-dashboard-wrapper svg {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
