import React, { useState, useEffect, useRef } from 'react';

interface InteractiveWorkflowDashboardProps {
  onCardClick?: () => void;
}

export const InteractiveWorkflowDashboard: React.FC<InteractiveWorkflowDashboardProps> = ({ onCardClick }) => {
  // Active Navigation item on left
  const [activeNav, setActiveNav] = useState<'webhooks' | 'event-sources' | 'workflows' | 'executions' | 'retries' | 'dead-letter'>('webhooks');
  
  // Timeframe selector state
  const [timeframe, setTimeframe] = useState<'Last 24 hours' | 'Last 1 hour' | 'Last 7 days'>('Last 24 hours');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Live Statistics
  const [ingestedCount, setIngestedCount] = useState(248320);
  const [processedCount, setProcessedCount] = useState(246891);
  const [failedCount, setFailedCount] = useState(1429);

  // Pipeline active stage: 'idle' | 'receive' | 'process' | 'deliver'
  const [activeStage, setActiveStage] = useState<'idle' | 'receive' | 'process' | 'deliver'>('idle');
  const [arrow1Active, setArrow1Active] = useState(false);
  const [arrow2Active, setArrow2Active] = useState(false);

  // Particle positions along the connector (0 to 1 progress)
  const [particles, setParticles] = useState<Array<{ id: number; progress: number; speed: number }>>([]);
  const [webhookPulse, setWebhookPulse] = useState(false);

  // Canvas ref for animated throughput chart
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Respect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  }, []);

  // 1. Pipeline State Machine: Ingestion -> Receive -> Process -> Deliver
  useEffect(() => {
    if (prefersReducedMotion) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const runPipelineCycle = () => {
      if (!isMounted) return;

      // 1. Ingest event departing Webhooks
      setWebhookPulse(true);
      setTimeout(() => setWebhookPulse(false), 350);

      // Add particle
      const pId = Date.now() + Math.random();
      setParticles(prev => [...prev.slice(-3), { id: pId, progress: 0, speed: 0.016 }]);

      // Random burst: occasionally spawn a second particle
      if (Math.random() > 0.65) {
        setTimeout(() => {
          if (!isMounted) return;
          const burstId = Date.now() + Math.random();
          setParticles(prev => [...prev.slice(-3), { id: burstId, progress: 0, speed: 0.018 }]);
        }, 180);
      }

      // 2. Reach Receive Stage
      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        setActiveStage('receive');
        setIngestedCount(prev => prev + 1);

        // 3. Move from Receive to Process
        timeoutId = setTimeout(() => {
          if (!isMounted) return;
          setArrow1Active(true);
          setActiveStage('process');

          setTimeout(() => setArrow1Active(false), 450);

          // 4. Move from Process to Deliver
          timeoutId = setTimeout(() => {
            if (!isMounted) return;
            setArrow2Active(true);
            setActiveStage('deliver');

            setTimeout(() => setArrow2Active(false), 450);

            // 5. Delivery Confirmation & Increment Processed
            timeoutId = setTimeout(() => {
              if (!isMounted) return;
              setProcessedCount(prev => prev + 1);

              // Rare failure simulation (1 in 40 events)
              if (Math.random() < 0.025) {
                setFailedCount(prev => prev + 1);
              }

              // Idle pause before next cycle
              timeoutId = setTimeout(() => {
                if (!isMounted) return;
                setActiveStage('idle');

                // Schedule next cycle with slight natural variance (2.2s - 3.4s)
                const nextDelay = 2200 + Math.random() * 1200;
                timeoutId = setTimeout(runPipelineCycle, nextDelay);
              }, 400);
            }, 600);
          }, 850);
        }, 650);
      }, 750);
    };

    // Initial trigger
    const initialTimer = setTimeout(runPipelineCycle, 900);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearTimeout(timeoutId);
    };
  }, [prefersReducedMotion]);

  // 2. Continuous Particle Motion along connector
  useEffect(() => {
    if (prefersReducedMotion) return;

    let animId: number;
    const updateParticles = () => {
      setParticles(prev =>
        prev
          .map(p => ({ ...p, progress: p.progress + p.speed }))
          .filter(p => p.progress < 1.05)
      );
      animId = requestAnimationFrame(updateParticles);
    };

    animId = requestAnimationFrame(updateParticles);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion]);

  // 3. Smooth Animated Throughput Canvas Wave
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

      // Sine wave with slight harmonics for realistic telemetry
      const points: Array<{ x: number; y: number }> = [];
      const numPoints = 32;

      for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * width;
        // Natural telemetry wave curve
        const wave1 = Math.sin((i * 0.35) - t * 0.028) * 11;
        const wave2 = Math.cos((i * 0.6) + t * 0.018) * 5;
        const wave3 = Math.sin((i * 0.15) - t * 0.01) * 7;
        const y = height * 0.52 + wave1 + wave2 + wave3;
        points.push({ x, y });
        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          // Smooth quadratic curve between points
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
      grad.addColorStop(0, 'rgba(233, 216, 185, 0.28)');
      grad.addColorStop(0.5, 'rgba(233, 216, 185, 0.10)');
      grad.addColorStop(1, 'rgba(233, 216, 185, 0.00)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Golden cream stroke
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
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Moving active telemetry scanner highlight
      const scanProgress = (t * 0.015) % 1;
      const scanIdx = Math.floor(scanProgress * (points.length - 1));
      const scanPt = points[scanIdx] || points[0];

      // Subtle glow around scanner point
      ctx.beginPath();
      ctx.arc(scanPt.x, scanPt.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(233, 216, 185, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(scanPt.x, scanPt.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#E9D8B9';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (!prefersReducedMotion) {
        t += 1;
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion]);

  // Helper to interpolate position along the connector curve
  // Path starts at (4, 44), curves down to (26, 148), then to (48, 148)
  const getParticleCoords = (p: number) => {
    // Cubic bezier approx for connector curve
    const clamped = Math.max(0, Math.min(1, p));
    if (clamped <= 0.65) {
      // Curve down from Webhooks button to central node
      const sub = clamped / 0.65;
      const x = 4 + sub * 22;
      const y = 44 + (Math.sin(sub * Math.PI * 0.5) * 104);
      return { x, y };
    } else {
      // Move from central node into main card
      const sub = (clamped - 0.65) / 0.35;
      const x = 26 + sub * 22;
      const y = 148;
      return { x, y };
    }
  };

  return (
    <div
      onClick={onCardClick}
      className="rf-interactive-dashboard-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '780px',
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
        {/* 1. LEFT SUB-PANEL: Ingest, Process, Deliver Navigation         */}
        {/* ============================================================== */}
        <div style={{
          width: '136px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '12px 0',
          zIndex: 10,
        }}>
          {/* Section 1: Ingest */}
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#858078',
              letterSpacing: '0.04em',
              marginBottom: '6px',
              paddingLeft: '4px',
            }}>
              Ingest
            </div>

            {/* Active Webhooks Button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveNav('webhooks'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                width: '100%',
                backgroundColor: activeNav === 'webhooks' ? '#F5E8D0' : 'rgba(235, 225, 208, 0.04)',
                color: activeNav === 'webhooks' ? '#0D0C0B' : '#B5AEA3',
                border: activeNav === 'webhooks' ? 'none' : '1px solid rgba(235, 225, 208, 0.1)',
                borderRadius: '999px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '6px',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: webhookPulse ? '0 0 14px rgba(245, 232, 208, 0.6)' : activeNav === 'webhooks' ? '0 2px 8px rgba(245, 232, 208, 0.15)' : 'none',
                transform: webhookPulse ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="18" cy="18" r="3"></circle>
                <circle cx="6" cy="6" r="3"></circle>
                <path d="M18 15V9a6 6 0 0 0-6-6H6"></path>
              </svg>
              <span>Webhooks</span>
            </button>

            {/* Event Sources Button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveNav('event-sources'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                width: '100%',
                backgroundColor: activeNav === 'event-sources' ? '#F5E8D0' : 'rgba(235, 225, 208, 0.04)',
                color: activeNav === 'event-sources' ? '#0D0C0B' : '#B5AEA3',
                border: activeNav === 'event-sources' ? 'none' : '1px solid rgba(235, 225, 208, 0.1)',
                borderRadius: '999px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 11a9 9 0 0 1 9 9"></path>
                <path d="M4 4a16 16 0 0 1 16 16"></path>
                <circle cx="5" cy="19" r="1"></circle>
              </svg>
              <span>Event Sources</span>
            </button>
          </div>

          {/* Section 2: Process */}
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#858078',
              letterSpacing: '0.04em',
              marginBottom: '6px',
              paddingLeft: '4px',
            }}>
              Process
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveNav('workflows'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                width: '100%',
                backgroundColor: activeNav === 'workflows' ? '#F5E8D0' : 'rgba(235, 225, 208, 0.04)',
                color: activeNav === 'workflows' ? '#0D0C0B' : '#B5AEA3',
                border: activeNav === 'workflows' ? 'none' : '1px solid rgba(235, 225, 208, 0.1)',
                borderRadius: '999px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
                marginBottom: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              <span>Workflows</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveNav('executions'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                width: '100%',
                backgroundColor: activeNav === 'executions' ? '#F5E8D0' : 'rgba(235, 225, 208, 0.04)',
                color: activeNav === 'executions' ? '#0D0C0B' : '#B5AEA3',
                border: activeNav === 'executions' ? 'none' : '1px solid rgba(235, 225, 208, 0.1)',
                borderRadius: '999px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
              </svg>
              <span>Executions</span>
            </button>
          </div>

          {/* Section 3: Deliver */}
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#858078',
              letterSpacing: '0.04em',
              marginBottom: '6px',
              paddingLeft: '4px',
            }}>
              Deliver
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveNav('retries'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                width: '100%',
                backgroundColor: activeNav === 'retries' ? '#F5E8D0' : 'rgba(235, 225, 208, 0.04)',
                color: activeNav === 'retries' ? '#0D0C0B' : '#B5AEA3',
                border: activeNav === 'retries' ? 'none' : '1px solid rgba(235, 225, 208, 0.1)',
                borderRadius: '999px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
                marginBottom: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              <span>Retries</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveNav('dead-letter'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                width: '100%',
                backgroundColor: activeNav === 'dead-letter' ? '#F5E8D0' : 'rgba(235, 225, 208, 0.04)',
                color: activeNav === 'dead-letter' ? '#0D0C0B' : '#B5AEA3',
                border: activeNav === 'dead-letter' ? 'none' : '1px solid rgba(235, 225, 208, 0.1)',
                borderRadius: '999px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <span>Dead Letter</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. DASHED CONNECTOR & TRAVELING INGESTION PARTICLES            */}
        {/* ============================================================== */}
        <div style={{
          width: '52px',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg
            width="52"
            height="360"
            viewBox="0 0 52 360"
            fill="none"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {/* Dashed connector from Webhooks button curving to central node */}
            <path
              d="M 4 44 C 20 44, 26 100, 26 148 L 52 148"
              stroke="rgba(235, 225, 208, 0.28)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              fill="none"
            />
            {/* Mirror dashed lower bracket */}
            <path
              d="M 4 252 C 20 252, 26 196, 26 148"
              stroke="rgba(235, 225, 208, 0.22)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              fill="none"
            />

            {/* Central Connection Dot */}
            <circle cx="26" cy="148" r="8" fill="rgba(233, 216, 185, 0.12)" />
            <circle cx="26" cy="148" r="4" fill="#E9D8B9" />

            {/* Glowing Traveling Event Particles */}
            {particles.map(p => {
              const coords = getParticleCoords(p.progress);
              const opacity = Math.sin(Math.min(1, Math.max(0, p.progress)) * Math.PI);
              return (
                <g key={p.id}>
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="6"
                    fill="rgba(245, 232, 208, 0.35)"
                    opacity={opacity}
                  />
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r="3.2"
                    fill="#F5E8D0"
                    opacity={opacity}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* ============================================================== */}
        {/* 3. MAIN WORKFLOW DASHBOARD CONSOLE CARD                        */}
        {/* ============================================================== */}
        <div style={{
          flex: 1,
          backgroundColor: '#151412',
          border: '1px solid rgba(235, 225, 208, 0.12)',
          borderRadius: '18px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), 0 0 1px rgba(235, 225, 208, 0.12)',
          padding: '16px 20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          minWidth: '0',
        }}>
          {/* Top Bar: Title, Running Badge, and Timeframe Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            {/* Title & Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                color: '#E9D8B9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
              </div>
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#F5F0E7',
                letterSpacing: '-0.01em',
              }}>
                Orders Workflow
              </span>
            </div>

            {/* Center Status Badge: Running */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(163, 230, 53, 0.08)',
              border: '1px solid rgba(163, 230, 53, 0.25)',
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
                backgroundColor: '#A3E635',
                boxShadow: '0 0 8px #A3E635',
                animation: prefersReducedMotion ? 'none' : 'rfPulseDot 1.8s ease-in-out infinite',
              }}></span>
              <span>Running</span>
            </div>

            {/* Right Dropdown: Timeframe */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(235, 225, 208, 0.04)',
                  border: '1px solid rgba(235, 225, 208, 0.12)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
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
              backgroundColor: '#100F0D',
              border: '1px solid rgba(235, 225, 208, 0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              textAlign: 'left',
              transition: 'border-color 0.2s ease',
            }}>
              <div style={{ fontSize: '10.5px', color: '#858078', fontWeight: 500 }}>
                Ingested
              </div>
              <div style={{
                fontSize: '17px',
                fontWeight: 800,
                color: '#F5F0E7',
                marginTop: '4px',
                lineHeight: 1,
              }}>
                {ingestedCount.toLocaleString()}
              </div>
              <div style={{
                fontSize: '10.5px',
                color: '#A3E635',
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
              backgroundColor: '#100F0D',
              border: activeStage === 'deliver' ? '1px solid rgba(233, 216, 185, 0.35)' : '1px solid rgba(235, 225, 208, 0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              textAlign: 'left',
              transition: 'all 0.25s ease',
            }}>
              <div style={{ fontSize: '10.5px', color: '#858078', fontWeight: 500 }}>
                Processed
              </div>
              <div style={{
                fontSize: '17px',
                fontWeight: 800,
                color: activeStage === 'deliver' ? '#E9D8B9' : '#F5F0E7',
                marginTop: '4px',
                lineHeight: 1,
                transition: 'color 0.2s ease',
              }}>
                {processedCount.toLocaleString()}
              </div>
              <div style={{
                fontSize: '10.5px',
                color: '#A3E635',
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
              backgroundColor: '#100F0D',
              border: '1px solid rgba(235, 225, 208, 0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '10.5px', color: '#858078', fontWeight: 500 }}>
                Failed
              </div>
              <div style={{
                fontSize: '17px',
                fontWeight: 800,
                color: '#F5F0E7',
                marginTop: '4px',
                lineHeight: 1,
              }}>
                {failedCount.toLocaleString()}
              </div>
              <div style={{
                fontSize: '10.5px',
                color: '#B5AEA3',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 500,
              }}>
                <span>↓ −37.2%</span>
              </div>
            </div>
          </div>

          {/* Pipeline Stages Execution Row: Receive → Process → Deliver */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '4px 0',
          }}>
            {/* Stage 1: Receive */}
            <div style={{
              flex: 1,
              backgroundColor: activeStage === 'receive' ? 'rgba(235, 225, 208, 0.12)' : '#100F0D',
              border: activeStage === 'receive' ? '1px solid #E9D8B9' : '1px solid rgba(235, 225, 208, 0.1)',
              boxShadow: activeStage === 'receive' ? '0 0 16px rgba(233, 216, 185, 0.35)' : 'none',
              borderRadius: '10px',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                color: activeStage === 'receive' ? '#E9D8B9' : '#B5AEA3',
                transform: activeStage === 'receive' ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.2s ease, color 0.2s ease',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: activeStage === 'receive' ? 700 : 500,
                color: activeStage === 'receive' ? '#F5F0E7' : '#B5AEA3',
              }}>
                Receive
              </span>
            </div>

            {/* Connecting Arrow 1 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: arrow1Active ? '#E9D8B9' : 'rgba(235, 225, 208, 0.25)',
              transform: arrow1Active ? 'translateX(2px)' : 'none',
              transition: 'all 0.18s ease',
              padding: '0 2px',
            }}>
              <svg width="18" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>

            {/* Stage 2: Process */}
            <div style={{
              flex: 1,
              backgroundColor: activeStage === 'process' ? 'rgba(235, 225, 208, 0.12)' : '#100F0D',
              border: activeStage === 'process' ? '1px solid #E9D8B9' : '1px solid rgba(235, 225, 208, 0.1)',
              boxShadow: activeStage === 'process' ? '0 0 16px rgba(233, 216, 185, 0.35)' : 'none',
              borderRadius: '10px',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                color: activeStage === 'process' ? '#E9D8B9' : '#B5AEA3',
                animation: activeStage === 'process' && !prefersReducedMotion ? 'rfSpinCog 2s linear infinite' : 'none',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: activeStage === 'process' ? 700 : 500,
                color: activeStage === 'process' ? '#F5F0E7' : '#B5AEA3',
              }}>
                Process
              </span>
            </div>

            {/* Connecting Arrow 2 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: arrow2Active ? '#E9D8B9' : 'rgba(235, 225, 208, 0.25)',
              transform: arrow2Active ? 'translateX(2px)' : 'none',
              transition: 'all 0.18s ease',
              padding: '0 2px',
            }}>
              <svg width="18" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>

            {/* Stage 3: Deliver */}
            <div style={{
              flex: 1,
              backgroundColor: activeStage === 'deliver' ? 'rgba(235, 225, 208, 0.15)' : '#100F0D',
              border: activeStage === 'deliver' ? '1px solid #E9D8B9' : '1px solid rgba(235, 225, 208, 0.1)',
              boxShadow: activeStage === 'deliver' ? '0 0 20px rgba(233, 216, 185, 0.4)' : 'none',
              borderRadius: '10px',
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                color: activeStage === 'deliver' ? '#E9D8B9' : '#B5AEA3',
                transform: activeStage === 'deliver' ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.2s ease, color 0.2s ease',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: activeStage === 'deliver' ? 700 : 500,
                color: activeStage === 'deliver' ? '#F5F0E7' : '#B5AEA3',
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
              marginBottom: '4px',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#858078',
                letterSpacing: '0.02em',
              }}>
                Throughput
              </span>
              <span style={{
                fontSize: '10px',
                color: '#858078',
                fontWeight: 500,
              }}>
                Live Telemetry
              </span>
            </div>

            {/* Canvas for Smooth 60fps Champagne Wave Line */}
            <div style={{
              width: '100%',
              height: '76px',
              position: 'relative',
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: '#100F0D',
              border: '1px solid rgba(235, 225, 208, 0.06)',
            }}>
              <canvas
                ref={canvasRef}
                width={520}
                height={76}
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

      {/* Embedded Animations Keyframes */}
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
