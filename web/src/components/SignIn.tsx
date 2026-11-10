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
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'webhooks' | 'events' | 'workflows' | 'executions' | 'retries' | 'dlq'>('webhooks');
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
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* 1. TOP NAVBAR (MATCHING IMAGE 2) */}
      <header className="rf-landing-header" style={{
        height: '72px',
        borderBottom: '1px solid #1A1A1E',
        padding: '0 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#000000',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            color: '#0A0A0A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(255, 255, 255, 0.15)',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            RELAYFORGE
          </span>
        </div>

        {/* Center Navigation Links (Product, Solutions, Docs, Pricing, Resources) */}
        <nav className="rf-landing-nav-center" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#A3A3A3',
        }}>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#A3A3A3',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 0',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A3A3A3'; }}
          >
            Product <span style={{ fontSize: '10px', opacity: 0.7 }}>⌄</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#A3A3A3',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 0',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A3A3A3'; }}
          >
            Solutions <span style={{ fontSize: '10px', opacity: 0.7 }}>⌄</span>
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            style={{
              color: '#A3A3A3',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A3A3A3'; }}
          >
            Docs
          </a>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#A3A3A3',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '6px 0',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A3A3A3'; }}
          >
            Pricing
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#A3A3A3',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 0',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A3A3A3'; }}
          >
            Resources <span style={{ fontSize: '10px', opacity: 0.7 }}>⌄</span>
          </button>
        </nav>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span className="rf-landing-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '12px',
            color: '#A3A3A3',
            backgroundColor: '#0F0F12',
            padding: '5px 13px',
            borderRadius: '999px',
            border: '1px solid #24242A',
            fontWeight: 500,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF', boxShadow: '0 0 6px rgba(255, 255, 255, 0.8)' }}></span>
            Production Ready v1.0
          </span>

          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#E5E5E5',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 14px',
              borderRadius: '8px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#E5E5E5'; }}
          >
            Sign In
          </button>

          <button
            id="open-signin-button"
            onClick={() => setModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: '999px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(255, 255, 255, 0.15)',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F7EFE2';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* 2. HERO SPLIT SECTION (EXACTLY MATCHING IMAGE 2) */}
      <section style={{
        maxWidth: '1320px',
        margin: '0 auto',
        padding: '60px 36px 40px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div className="rf-hero-split-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.32fr)',
          gap: '48px',
          alignItems: 'center',
        }}>
          {/* Left Column: Headline, Description & CTAs */}
          <div style={{ textAlign: 'left' }}>
            {/* Pill: Durable Systems Engine */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: '#121216',
              border: '1px solid #26262C',
              fontSize: '12px',
              fontWeight: 600,
              color: '#E5E5E5',
              marginBottom: '24px',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F7EFE2" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Durable Systems Engine</span>
            </div>

            {/* Giant Bold Headline matching Image 2 */}
            <h1 style={{
              fontSize: 'clamp(36px, 4.2vw, 56px)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.035em',
              color: '#FFFFFF',
              margin: '0 0 22px',
            }}>
              Reliable Webhooks &amp;<br />Sequential Workflows
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: '15px',
              color: '#A1A1AA',
              maxWidth: '460px',
              lineHeight: 1.6,
              margin: '0 0 32px',
            }}>
              Ingest high-throughput events, execute durable multi-step pipelines, and guarantee at-least-once delivery with jittered exponential retries.
            </p>

            {/* Two Action Buttons side-by-side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                id="hero-signin-btn"
                onClick={() => setModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#F7EFE2',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(247, 239, 226, 0.2)',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F7EFE2';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span>Get Started</span>
                <span style={{ fontSize: '15px' }}>→</span>
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('rf-metrics-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else setModalOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  color: '#E5E5E5',
                  border: '1px solid #2A2A30',
                  borderRadius: '999px',
                  padding: '12px 22px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#16161B';
                  e.currentTarget.style.borderColor = '#383842';
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  e.currentTarget.style.borderColor = '#2A2A30';
                  e.currentTarget.style.color = '#E5E5E5';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Explore Features
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Engine Architecture Showcase Card */}
          <div style={{
            backgroundColor: '#0C0C0F',
            border: '1px solid #1E1E24',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', gap: '20px', position: 'relative' }}>
              {/* Left Sub-panel: Pipeline Navigation List */}
              <div style={{
                width: '136px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                textAlign: 'left',
                position: 'relative',
              }}>
                {/* INGEST Group */}
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#71717A', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Ingest
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      onClick={() => setActiveWorkflowTab('webhooks')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: activeWorkflowTab === 'webhooks' ? '#F7EFE2' : 'transparent',
                        color: activeWorkflowTab === 'webhooks' ? '#0A0A0A' : '#A1A1AA',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: activeWorkflowTab === 'webhooks' ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                      </svg>
                      <span>Webhooks</span>
                    </button>
                    <button
                      onClick={() => setActiveWorkflowTab('events')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: activeWorkflowTab === 'events' ? '#202026' : 'transparent',
                        color: activeWorkflowTab === 'events' ? '#FFFFFF' : '#71717A',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <circle cx="19" cy="5" r="2"></circle>
                        <circle cx="5" cy="19" r="2"></circle>
                        <line x1="10.4" y1="13.6" x2="6.6" y2="17.4"></line>
                        <line x1="17.4" y1="6.6" x2="13.6" y2="10.4"></line>
                      </svg>
                      <span>Event Sources</span>
                    </button>
                  </div>
                </div>

                {/* PROCESS Group */}
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#71717A', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Process
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      onClick={() => setActiveWorkflowTab('workflows')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: activeWorkflowTab === 'workflows' ? '#202026' : 'transparent',
                        color: activeWorkflowTab === 'workflows' ? '#FFFFFF' : '#71717A',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
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
                      onClick={() => setActiveWorkflowTab('executions')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: activeWorkflowTab === 'executions' ? '#202026' : 'transparent',
                        color: activeWorkflowTab === 'executions' ? '#FFFFFF' : '#71717A',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polygon points="10 8 16 12 10 16 10 8"></polygon>
                      </svg>
                      <span>Executions</span>
                    </button>
                  </div>
                </div>

                {/* DELIVER Group */}
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: '#71717A', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Deliver
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      onClick={() => setActiveWorkflowTab('retries')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: activeWorkflowTab === 'retries' ? '#202026' : 'transparent',
                        color: activeWorkflowTab === 'retries' ? '#FFFFFF' : '#71717A',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                      </svg>
                      <span>Retries</span>
                    </button>
                    <button
                      onClick={() => setActiveWorkflowTab('dlq')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: activeWorkflowTab === 'dlq' ? '#202026' : 'transparent',
                        color: activeWorkflowTab === 'dlq' ? '#FFFFFF' : '#71717A',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                      </svg>
                      <span>Dead Letter</span>
                    </button>
                  </div>
                </div>

                {/* Connecting Wire Line with Node Dot */}
                <div style={{
                  position: 'absolute',
                  right: '-12px',
                  top: '15px',
                  bottom: '15px',
                  width: '1px',
                  borderRight: '1px dashed #2A2A32',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#F7EFE2',
                    boxShadow: '0 0 8px rgba(247, 239, 226, 0.8)',
                    marginLeft: '1px',
                  }} />
                </div>
              </div>

              {/* Right Main Engine Panel */}
              <div style={{
                flex: 1,
                minWidth: 0,
                backgroundColor: '#09090C',
                border: '1px solid #1C1C22',
                borderRadius: '16px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}>
                {/* Header Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #16161B',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                      <polyline points="2 17 12 22 22 17"></polyline>
                      <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>Orders Workflow</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(74, 222, 128, 0.1)',
                      border: '1px solid rgba(74, 222, 128, 0.25)',
                      color: '#4ADE80',
                      fontWeight: 700,
                    }}>
                      Running
                    </span>
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#A1A1AA',
                    backgroundColor: '#121217',
                    border: '1px solid #222228',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span>Last 24 hours</span>
                    <span style={{ fontSize: '9px' }}>⌄</span>
                  </div>
                </div>

                {/* 3 Metric Summary Boxes */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                }}>
                  {/* Ingested */}
                  <div style={{
                    backgroundColor: '#121217',
                    border: '1px solid #1C1C22',
                    borderRadius: '12px',
                    padding: '12px',
                    textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '11px', color: '#71717A', fontWeight: 600 }}>Ingested</div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', marginTop: '3px' }}>248,320</div>
                    <div style={{ fontSize: '10px', color: '#4ADE80', fontWeight: 600, marginTop: '3px' }}>↑ +18.4%</div>
                  </div>

                  {/* Processed */}
                  <div style={{
                    backgroundColor: '#121217',
                    border: '1px solid #1C1C22',
                    borderRadius: '12px',
                    padding: '12px',
                    textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '11px', color: '#71717A', fontWeight: 600 }}>Processed</div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', marginTop: '3px' }}>246,891</div>
                    <div style={{ fontSize: '10px', color: '#4ADE80', fontWeight: 600, marginTop: '3px' }}>↑ +18.1%</div>
                  </div>

                  {/* Failed */}
                  <div style={{
                    backgroundColor: '#121217',
                    border: '1px solid #1C1C22',
                    borderRadius: '12px',
                    padding: '12px',
                    textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '11px', color: '#71717A', fontWeight: 600 }}>Failed</div>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', marginTop: '3px' }}>1,429</div>
                    <div style={{ fontSize: '10px', color: '#F87171', fontWeight: 600, marginTop: '3px' }}>↓ -37.2%</div>
                  </div>
                </div>

                {/* Pipeline Flow Steps (Receive -> Process -> Deliver) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 4px',
                }}>
                  {/* Step 1: Receive */}
                  <div style={{
                    flex: 1,
                    backgroundColor: '#121217',
                    border: '1px solid #202026',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#E5E5E5',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <span>Receive</span>
                  </div>

                  <span style={{ color: '#52525B', fontSize: '14px' }}>→</span>

                  {/* Step 2: Process */}
                  <div style={{
                    flex: 1,
                    backgroundColor: '#121217',
                    border: '1px solid #202026',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#E5E5E5',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    <span>Process</span>
                  </div>

                  <span style={{ color: '#52525B', fontSize: '14px' }}>→</span>

                  {/* Step 3: Deliver (Active Highlighted Node matching Image 2) */}
                  <div style={{
                    flex: 1,
                    backgroundColor: '#121217',
                    border: '1.5px solid #E5DAC8',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    boxShadow: '0 0 14px rgba(229, 218, 200, 0.15)',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F7EFE2" strokeWidth="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>Deliver</span>
                  </div>
                </div>

                {/* Throughput Luminous Wave Chart matching Image 2 */}
                <div style={{ textAlign: 'left', marginTop: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#71717A', fontWeight: 600, marginBottom: '6px' }}>
                    Throughput
                  </div>
                  <div style={{
                    height: '52px',
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <svg
                      viewBox="0 0 460 52"
                      preserveAspectRatio="none"
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    >
                      <defs>
                        <linearGradient id="landingWaveGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C5A059" stopOpacity="0.45" />
                          <stop offset="60%" stopColor="#C5A059" stopOpacity="0.12" />
                          <stop offset="100%" stopColor="#C5A059" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,40 C50,42 80,34 130,34 C180,34 210,44 260,38 C310,32 350,20 400,24 C430,26 445,22 460,20 L460,52 L0,52 Z"
                        fill="url(#landingWaveGradient)"
                      />
                      <path
                        d="M0,40 C50,42 80,34 130,34 C180,34 210,44 260,38 C310,32 350,20 400,24 C430,26 445,22 460,20"
                        fill="none"
                        stroke="#F7EFE2"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SOCIAL PROOF / LOGOS BAR (MATCHING IMAGE 2) */}
      <section style={{
        maxWidth: '1320px',
        margin: '20px auto 40px',
        padding: '0 36px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Subtle center title */}
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#71717A',
          textAlign: 'center',
          marginBottom: '26px',
          letterSpacing: '-0.01em',
        }}>
          Trusted by engineering teams building reliable systems
        </div>

        {/* 6 Logos Row: Vercel, Render, PostgreSQL, Redis, Docker, Kubernetes */}
        <div className="rf-landing-logos" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(24px, 5vw, 68px)',
          flexWrap: 'wrap',
          color: '#A1A1AA',
        }}>
          {/* Vercel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#D4D4D8' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 22 20 2 20"></polygon>
            </svg>
            <span>Vercel</span>
          </div>

          {/* Render */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#D4D4D8' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z"></path>
            </svg>
            <span>Render</span>
          </div>

          {/* PostgreSQL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#D4D4D8' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            <span>PostgreSQL</span>
          </div>

          {/* Redis */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#D4D4D8' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <span>Redis</span>
          </div>

          {/* Docker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#D4D4D8' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="9" width="3" height="3"></rect>
              <rect x="8" y="9" width="3" height="3"></rect>
              <rect x="12" y="9" width="3" height="3"></rect>
              <rect x="8" y="5" width="3" height="3"></rect>
              <path d="M2 13c0 4 4 6 10 6s10-2 10-6c-2 0-3-1-4-1s-3 1-4 1H2z"></path>
            </svg>
            <span>Docker</span>
          </div>

          {/* Kubernetes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#D4D4D8' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9"></circle>
              <circle cx="12" cy="12" r="3"></circle>
              <line x1="12" y1="3" x2="12" y2="9"></line>
              <line x1="12" y1="15" x2="12" y2="21"></line>
              <line x1="3" y1="12" x2="9" y2="12"></line>
              <line x1="15" y1="12" x2="21" y2="12"></line>
            </svg>
            <span>Kubernetes</span>
          </div>
        </div>
      </section>

      {/* 4. VALUE PROPOSITION & METRICS GRID (MATCHING IMAGE 2) */}
      <section id="rf-metrics-section" style={{
        maxWidth: '1320px',
        margin: '0 auto',
        padding: '24px 36px 64px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div className="rf-value-props-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 3fr)',
          gap: '32px',
          alignItems: 'center',
        }}>
          {/* Left Title */}
          <div style={{ textAlign: 'left' }}>
            <h2 style={{
              fontSize: 'clamp(26px, 2.6vw, 34px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: '#FFFFFF',
              margin: 0,
            }}>
              Better delivery<br />for event-driven<br />systems
            </h2>
          </div>

          {/* Right 4 Metric Value Cards */}
          <div className="rf-metric-cards-row" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
          }}>
            {/* Card 1: 8–12× */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#0F0F12',
              border: '1px solid #1E1E24',
              borderRadius: '16px',
              padding: '26px 22px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>
                8–12×
              </div>
              <div style={{ fontSize: '13px', color: '#71717A', marginTop: '12px', lineHeight: 1.4, fontWeight: 500 }}>
                Higher processing reliability
              </div>
            </div>

            {/* Card 2: < 300 ms */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#0F0F12',
              border: '1px solid #1E1E24',
              borderRadius: '16px',
              padding: '26px 22px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>
                &lt; 300 ms
              </div>
              <div style={{ fontSize: '13px', color: '#71717A', marginTop: '12px', lineHeight: 1.4, fontWeight: 500 }}>
                P99 pipeline latency
              </div>
            </div>

            {/* Card 3: 99.9% */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#0F0F12',
              border: '1px solid #1E1E24',
              borderRadius: '16px',
              padding: '26px 22px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>
                99.9%
              </div>
              <div style={{ fontSize: '13px', color: '#71717A', marginTop: '12px', lineHeight: 1.4, fontWeight: 500 }}>
                At-least-once delivery
              </div>
            </div>

            {/* Card 4: 0 */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#0F0F12',
              border: '1px solid #1E1E24',
              borderRadius: '16px',
              padding: '26px 22px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>
                0
              </div>
              <div style={{ fontSize: '13px', color: '#71717A', marginTop: '12px', lineHeight: 1.4, fontWeight: 500 }}>
                Event loss under retries
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SPLIT-PANE SIGN-IN MODAL (AUTHENTICATION PORTAL) */}
      {modalOpen && (
        <div
          id="signin-modal-backdrop"
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
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
              backgroundColor: '#0E0E12',
              border: '1px solid #26262E',
              borderRadius: '20px',
              maxWidth: '860px',
              width: '100%',
              display: 'flex',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
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
                backgroundColor: '#1E1E24',
                border: '1px solid #2E2E38',
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
              borderRight: '1px solid #1E1E24',
              padding: '36px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              background: 'radial-gradient(circle at center, #1B1B20 0%, #000000 85%)',
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
              textAlign: 'left',
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

              {/* Developer Test Mode Session Input */}
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

      {/* Responsive Styles for Landing Page */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 1024px) {
          .rf-hero-split-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
          .rf-landing-nav-center {
            display: none !important;
          }
          .rf-value-props-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .rf-metric-cards-row {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .rf-landing-header {
            padding: 0 18px !important;
          }
          .rf-landing-badge {
            display: none !important;
          }
          .rf-metric-cards-row {
            grid-template-columns: 1fr !important;
          }
          #signin-modal-container {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  );
};
