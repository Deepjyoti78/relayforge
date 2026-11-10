import { getApiBaseUrl, setSessionToken } from '../api.ts';
import React, { useState } from 'react';
import brandGraphic from '../assets/brand-graphic.png';
import dashboardGraphic from '../assets/orders-workflow-dashboard.png';

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
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {/* 1. TOP NAVBAR (MATCHING REFERENCE IMAGE 2) */}
      <header className="rf-landing-header" style={{
        height: '66px',
        borderBottom: '1px solid #141418',
        padding: '0 40px',
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
            color: '#000000',
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
          gap: '32px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#A1A1AA',
        }}>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#A1A1AA',
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
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
          >
            Product <span style={{ fontSize: '10px', opacity: 0.7 }}>⌄</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#A1A1AA',
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
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
          >
            Solutions <span style={{ fontSize: '10px', opacity: 0.7 }}>⌄</span>
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            style={{
              color: '#A1A1AA',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
          >
            Docs
          </a>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#A1A1AA',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '6px 0',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
          >
            Pricing
          </button>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#A1A1AA',
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
            onMouseLeave={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
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
            color: '#A1A1AA',
            backgroundColor: '#0E0E12',
            padding: '6px 14px',
            borderRadius: '999px',
            border: '1px solid #222228',
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
              color: '#D4D4D8',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 14px',
              borderRadius: '8px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#D4D4D8'; }}
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
              color: '#000000',
              border: 'none',
              borderRadius: '999px',
              padding: '10px 22px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(255, 255, 255, 0.18)',
              transition: 'all 0.16s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F0F0F0';
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
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '48px 40px 36px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div className="rf-hero-split-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)',
          gap: '48px',
          alignItems: 'center',
        }}>
          {/* Left Column: Pill, Two-Line Heading, Description, & Two Action Buttons */}
          <div style={{ textAlign: 'left' }}>
            {/* Pill: Durable Systems Engine */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 13px',
              borderRadius: '999px',
              backgroundColor: '#111115',
              border: '1px solid #26262E',
              fontSize: '12px',
              fontWeight: 500,
              color: '#D4D4D8',
              marginBottom: '20px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Durable Systems Engine</span>
            </div>

            {/* Heading IN EXACTLY TWO LINES - MATCHING IMAGE 2 */}
            <h1 style={{
              fontSize: 'clamp(28px, 2.7vw, 40px)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: '#FFFFFF',
              margin: '0 0 18px',
            }}>
              <span style={{ display: 'block', whiteSpace: 'nowrap' }}>Reliable Webhooks &amp;</span>
              <span style={{ display: 'block', whiteSpace: 'nowrap' }}>Sequential Workflows</span>
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: '14.5px',
              color: '#9CA3AF',
              maxWidth: '430px',
              lineHeight: 1.58,
              margin: '0 0 28px',
            }}>
              Ingest high-throughput events, execute durable multi-step pipelines, and guarantee at-least-once delivery with jittered exponential retries.
            </p>

            {/* Two Action Buttons side-by-side with exact theme */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {/* Primary White Button: Get Started → */}
              <button
                id="hero-signin-btn"
                onClick={() => setModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 26px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 14px rgba(255, 255, 255, 0.16)',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F0F0F0';
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span>Get Started</span>
                <span style={{ fontSize: '15px' }}>→</span>
              </button>

              {/* Secondary Dark Bordered Button: Explore Features */}
              <button
                onClick={() => {
                  const el = document.getElementById('rf-metrics-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else setModalOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  color: '#D4D4D8',
                  border: '1px solid #27272F',
                  borderRadius: '999px',
                  padding: '12px 24px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#15151A';
                  e.currentTarget.style.borderColor = '#3E3E48';
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = '#27272F';
                  e.currentTarget.style.color = '#D4D4D8';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Explore Features
              </button>
            </div>
          </div>

          {/* Right Column: Uploaded Dashboard Card (NO OUTER BOUNDARY) */}
          <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src={dashboardGraphic}
              alt="RelayForge Orders Workflow Dashboard"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                cursor: 'pointer',
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onClick={() => setModalOpen(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            />
          </div>
        </div>
      </section>

      {/* 3. SOCIAL PROOF / LOGOS BAR WITH CENTERED DIVIDER (MATCHING IMAGE 2) */}
      <section style={{
        maxWidth: '1280px',
        margin: '20px auto 36px',
        padding: '0 40px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Horizontal Divider Line with Centered Label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          marginBottom: '32px',
          width: '100%',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#1C1C22' }} />
          <span style={{
            fontSize: '12.5px',
            color: '#71717A',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>
            Trusted by engineering teams building reliable systems
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#1C1C22' }} />
        </div>

        {/* 6 Logos Row: Vercel, Render, PostgreSQL, Redis, Docker, Kubernetes */}
        <div className="rf-landing-logos" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(28px, 5.5vw, 76px)',
          flexWrap: 'wrap',
          color: '#A1A1AA',
        }}>
          {/* Vercel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 600, color: '#A1A1AA' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 22 20 2 20"></polygon>
            </svg>
            <span>Vercel</span>
          </div>

          {/* Render */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 600, color: '#A1A1AA' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z"></path>
            </svg>
            <span>Render</span>
          </div>

          {/* PostgreSQL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 600, color: '#A1A1AA' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            <span>PostgreSQL</span>
          </div>

          {/* Redis */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 600, color: '#A1A1AA' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <span>Redis</span>
          </div>

          {/* Docker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 600, color: '#A1A1AA' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="9" width="3" height="3"></rect>
              <rect x="8" y="9" width="3" height="3"></rect>
              <rect x="12" y="9" width="3" height="3"></rect>
              <rect x="8" y="5" width="3" height="3"></rect>
              <path d="M2 13c0 4 4 6 10 6s10-2 10-6c-2 0-3-1-4-1s-3 1-4 1H2z"></path>
            </svg>
            <span>Docker</span>
          </div>

          {/* Kubernetes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 600, color: '#A1A1AA' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '16px 40px 64px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div className="rf-value-props-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 3.2fr)',
          gap: '36px',
          alignItems: 'center',
        }}>
          {/* Left Title: 3 lines */}
          <div style={{ textAlign: 'left' }}>
            <h2 style={{
              fontSize: 'clamp(24px, 2.4vw, 32px)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: '#FFFFFF',
              margin: 0,
            }}>
              <span style={{ display: 'block' }}>Better delivery</span>
              <span style={{ display: 'block' }}>for event-driven</span>
              <span style={{ display: 'block' }}>systems</span>
            </h2>
          </div>

          {/* Right 4 Metric Value Cards */}
          <div className="rf-metric-cards-row" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '14px',
          }}>
            {/* Card 1: 8–12× */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#0C0C0F',
              border: '1px solid #1C1C22',
              borderRadius: '14px',
              padding: '24px 20px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                8–12×
              </div>
              <div style={{ fontSize: '12.5px', color: '#71717A', marginTop: '12px', lineHeight: 1.4, fontWeight: 500 }}>
                Higher processing reliability
              </div>
            </div>

            {/* Card 2: < 300 ms */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#0C0C0F',
              border: '1px solid #1E1E24',
              borderRadius: '14px',
              padding: '24px 20px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                &lt; 300 ms
              </div>
              <div style={{ fontSize: '12.5px', color: '#71717A', marginTop: '12px', lineHeight: 1.4, fontWeight: 500 }}>
                P99 pipeline latency
              </div>
            </div>

            {/* Card 3: 99.9% */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#0C0C0F',
              border: '1px solid #1C1C22',
              borderRadius: '14px',
              padding: '24px 20px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                99.9%
              </div>
              <div style={{ fontSize: '12.5px', color: '#71717A', marginTop: '12px', lineHeight: 1.4, fontWeight: 500 }}>
                At-least-once delivery
              </div>
            </div>

            {/* Card 4: 0 */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#0C0C0F',
              border: '1px solid #1C1C22',
              borderRadius: '14px',
              padding: '24px 20px',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                0
              </div>
              <div style={{ fontSize: '12.5px', color: '#71717A', marginTop: '12px', lineHeight: 1.4, fontWeight: 500 }}>
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
        @media (max-width: 1080px) {
          .rf-hero-split-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .rf-landing-nav-center {
            display: none !important;
          }
          .rf-value-props-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
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
