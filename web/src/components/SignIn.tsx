import { getApiBaseUrl, setSessionToken } from '../api.ts';
import React, { useState } from 'react';
import brandGraphic from '../assets/brand-graphic.png';

interface SignInProps {
  onTokenSignIn?: (token: string) => void;
}

export const SignIn: React.FC<SignInProps> = ({ onTokenSignIn }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

  const apiBase = getApiBaseUrl();
  const startUrl = `${apiBase}/auth/github/start?redirect_uri=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    if (onTokenSignIn) {
      onTokenSignIn(manualToken.trim());
    } else {
      setSessionToken(manualToken.trim());
      window.location.reload();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* Top Navbar */}
      <header className="rf-landing-header" style={{
        height: '68px',
        borderBottom: '1px solid #202020',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#000000',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            backgroundColor: '#202020',
            border: '1px solid #2A2A2A',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              RELAYFORGE
            </div>
            <div style={{ fontSize: '10px', color: '#737373', letterSpacing: '0.04em', fontWeight: 600 }}>
              ENTERPRISE WEBHOOK GATEWAY
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="rf-landing-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#A3A3A3',
            backgroundColor: '#111111',
            padding: '5px 12px',
            borderRadius: '999px',
            border: '1px solid #202020',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF' }}></span>
            Production Ready v1.0
          </span>

          <button
            id="open-signin-button"
            onClick={() => setModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#FFFFFF',
              color: '#000000',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E5E5E5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Landing / Hero Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '999px',
          backgroundColor: '#111111',
          border: '1px solid #2A2A2A',
          fontSize: '12px',
          color: '#A3A3A3',
          marginBottom: '28px',
        }}>
          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Durable Systems Engine</span>
          <span>•</span>
          <span>SSRF DNS Pinning</span>
          <span>•</span>
          <span>Transactional Outbox</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 54px)',
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: '-0.04em',
          color: '#FFFFFF',
          margin: '0 0 20px',
        }}>
          Durable Webhooks &amp; Sequential Workflow Engine
        </h1>

        <p style={{
          fontSize: '17px',
          color: '#A3A3A3',
          maxWidth: '680px',
          lineHeight: 1.6,
          margin: '0 0 36px',
        }}>
          Ingest high-throughput payloads with sub-millisecond persistence, execute isolated sequential multi-step pipelines, and guarantee at-least-once delivery with jittered exponential retries.
        </p>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            id="hero-signin-btn"
            onClick={() => setModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FFFFFF',
              color: '#000000',
              border: 'none',
              borderRadius: '10px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(255, 255, 255, 0.12)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E5E5E5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Sign In to Console
          </button>
        </div>

        {/* Feature Grid Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          width: '100%',
          marginTop: '64px',
          textAlign: 'left',
        }}>
          <div style={{
            backgroundColor: '#111111',
            border: '1px solid #202020',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
              🛡️ Zero-Trust SSRF Defense
            </div>
            <div style={{ fontSize: '13px', color: '#A3A3A3', lineHeight: 1.5 }}>
              DNS rebinding and TOCTOU prevention with socket IP pinning and manual redirect rejection.
            </div>
          </div>

          <div style={{
            backgroundColor: '#111111',
            border: '1px solid #202020',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
              ⚡ Transactional Outbox
            </div>
            <div style={{ fontSize: '13px', color: '#A3A3A3', lineHeight: 1.5 }}>
              PostgreSQL ACID guarantees, lease tokens with fenced crash recovery, and zero message loss.
            </div>
          </div>

          <div style={{
            backgroundColor: '#111111',
            border: '1px solid #202020',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
              🔄 Sequential Orchestrator
            </div>
            <div style={{ fontSize: '13px', color: '#A3A3A3', lineHeight: 1.5 }}>
              Conditional branching, JSON transformations, rate limiting, and real-time SSE telemetry.
            </div>
          </div>
        </div>
      </main>

      {/* Split-Pane Sign-In Modal */}
      {modalOpen && (
        <div
          id="signin-modal-backdrop"
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            id="signin-modal-container"
            className="rf-signin-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#111111',
              border: '1px solid #2A2A2A',
              borderRadius: '20px',
              maxWidth: '860px',
              width: '100%',
              display: 'flex',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
              position: 'relative',
              flexDirection: 'row',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setModalOpen(false)}
              aria-label="Close modal"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                backgroundColor: '#202020',
                border: '1px solid #2A2A2A',
                color: '#A3A3A3',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 20,
                fontSize: '18px',
                lineHeight: 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#A3A3A3'; }}
            >
              ×
            </button>

            {/* Left Side: Uploaded Image Visual Panel */}
            <div className="rf-signin-modal-graphic" style={{
              flex: '1 1 48%',
              backgroundColor: '#000000',
              borderRight: '1px solid #202020',
              padding: '36px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              background: 'radial-gradient(circle at center, #1F1F24 0%, #000000 85%)',
            }}>
              <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}>
                <img
                  src={brandGraphic}
                  alt="RelayForge Design System Palette"
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '340px',
                    objectFit: 'contain',
                    borderRadius: '16px',
                    filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.65))',
                    border: '1px solid #202020',
                  }}
                />
                <div style={{
                  marginTop: '16px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#E5E5E5',
                  }}>
                    Monochromatic Precision
                  </div>
                  <div style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>
                    Engineered for zero cognitive overload
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Main Content */}
            <div className="rf-signin-modal-content" style={{
              flex: '1 1 52%',
              padding: '44px 36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#A3A3A3',
                marginBottom: '10px',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                }}></span>
                AUTHENTICATION PORTAL
              </div>

              <h2 style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                margin: '0 0 10px',
              }}>
                Welcome to RelayForge
              </h2>

              <p style={{
                fontSize: '13px',
                color: '#A3A3A3',
                lineHeight: 1.5,
                margin: '0 0 28px',
              }}>
                Sign in with GitHub to access tenant isolation, encrypted API keys, workflow orchestrations, and the Dead Letter Queue.
              </p>

              {/* GitHub OAuth Button */}
              <a
                id="github-oauth-button"
                href={startUrl}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  textDecoration: 'none',
                  padding: '13px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E5E5E5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </a>

              {/* Developer Test Mode Session Input (Disabled in Staging / Production) */}
              {isDev && (
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#A3A3A3',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '4px',
                  }}
                >
                  {showManualInput ? 'Hide developer token entry' : 'Direct Session Token Entry'}
                </button>

                {showManualInput && (
                  <form onSubmit={handleManualSubmit} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Paste session token..."
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      style={{
                        flex: 1,
                        backgroundColor: '#000000',
                        border: '1px solid #2A2A2A',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        color: '#FFFFFF',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#202020',
                        border: '1px solid #2A2A2A',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Authenticate
                    </button>
                  </form>
                )}
              </div>
              )}

              {/* Security Guardrails Footer */}
              <div style={{
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid #202020',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#737373',
              }}>
                <span>PostgreSQL RLS</span>
                <span>•</span>
                <span>SSRF Pinned</span>
                <span>•</span>
                <span>AES-256-GCM</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Modal Animation Style */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 768px) {
          #signin-modal-container {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  );
};
