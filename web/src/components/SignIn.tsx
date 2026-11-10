import { getApiBaseUrl, setSessionToken } from '../api.ts';
import React, { useState } from 'react';
import brandGraphic from '../assets/brand-graphic.png';
import dashboardGraphic from '../assets/relayforge_workflow_dashboard_right.png';

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
      backgroundColor: '#0D0C0B',
      color: '#F5F0E7',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      {/* 1. TOP NAVBAR */}
      <header className="rf-landing-header" style={{
        width: '100%',
        backgroundColor: '#0D0C0B',
        borderBottom: '1px solid rgba(235, 225, 208, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="rf-landing-container" style={{
          maxWidth: '1480px',
          margin: '0 auto',
          padding: '0 clamp(24px, 4vw, 56px)',
          height: '74px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          width: '100%',
        }}>
          {/* Brand Logo & Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#F5F0E7',
              color: '#0D0C0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(245, 240, 231, 0.15)',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.02em', color: '#F5F0E7' }}>
              RELAYFORGE
            </span>
          </div>

          {/* Center Navigation Links (Product, Solutions, Docs, Pricing, Resources) */}
          <nav className="rf-landing-nav-center" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '36px',
            fontSize: '15px',
            fontWeight: 500,
            color: '#B5AEA3',
          }}>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#B5AEA3',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 0',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              Product <span style={{ fontSize: '11px', opacity: 0.7 }}>⌄</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#B5AEA3',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 0',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              Solutions <span style={{ fontSize: '11px', opacity: 0.7 }}>⌄</span>
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#B5AEA3',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              Docs
            </a>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#B5AEA3',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '6px 0',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              Pricing
            </button>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#B5AEA3',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 0',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              Resources <span style={{ fontSize: '11px', opacity: 0.7 }}>⌄</span>
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="rf-landing-badge" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#B5AEA3',
              backgroundColor: 'rgba(235, 225, 208, 0.05)',
              padding: '7px 16px',
              borderRadius: '999px',
              border: '1px solid rgba(235, 225, 208, 0.14)',
              fontWeight: 500,
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#E9D8B9',
                boxShadow: '0 0 8px rgba(233, 216, 185, 0.8)',
              }}></span>
              Production Ready v1.0
            </span>

            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#F5F0E7',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '8px 14px',
                borderRadius: '8px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#E9D8B9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
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
                backgroundColor: '#F5F0E7',
                color: '#0D0C0B',
                border: 'none',
                borderRadius: '999px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(245, 240, 231, 0.12)',
                transition: 'all 0.16s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F5F0E7';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SPLIT SECTION */}
      <section style={{
        width: '100%',
        maxWidth: '1480px',
        margin: '0 auto',
        padding: 'clamp(48px, 5.5vw, 76px) clamp(24px, 4vw, 56px) clamp(36px, 4vw, 52px)',
        boxSizing: 'border-box',
      }}>
        <div className="rf-hero-split-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)',
          gap: 'clamp(40px, 4.5vw, 68px)',
          alignItems: 'center',
        }}>
          {/* Left Column: Pill, Two-Line Heading, Description, & Two Action Buttons */}
          <div style={{ textAlign: 'left' }}>
            {/* Pill: Durable Systems Engine */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: 'rgba(235, 225, 208, 0.05)',
              border: '1px solid rgba(235, 225, 208, 0.16)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#E9D8B9',
              marginBottom: '24px',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E9D8B9" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Durable Systems Engine</span>
            </div>

            {/* Dominant Heading in Exactly Two Lines (52–58px on Large Desktop) */}
            <h1 className="rf-hero-headline" style={{
              fontSize: 'clamp(36px, 3.8vw, 56px)',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              color: '#F5F0E7',
              margin: '0 0 24px',
            }}>
              <span className="rf-headline-line-1" style={{ display: 'block', whiteSpace: 'nowrap' }}>Reliable Webhooks &amp;</span>
              <span className="rf-headline-line-2" style={{ display: 'block', whiteSpace: 'nowrap' }}>Sequential Workflows</span>
            </h1>

            {/* Supporting Description (18–20px) */}
            <p style={{
              fontSize: 'clamp(16px, 1.25vw, 19px)',
              color: '#B5AEA3',
              maxWidth: '520px',
              lineHeight: 1.58,
              margin: '0 0 36px',
            }}>
              Ingest high-throughput events, execute durable multi-step pipelines, and guarantee at-least-once delivery with jittered exponential retries.
            </p>

            {/* Two Action Buttons side-by-side with exact theme */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {/* Primary Warm Ivory Button: Get Started → */}
              <button
                id="hero-signin-btn"
                onClick={() => setModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#F5F0E7',
                  color: '#0D0C0B',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '14px 30px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(245, 240, 231, 0.16)',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 24px rgba(245, 240, 231, 0.28)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F5F0E7';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(245, 240, 231, 0.16)';
                }}
              >
                <span>Get Started</span>
                <span style={{ fontSize: '16px' }}>→</span>
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
                  backgroundColor: 'rgba(235, 225, 208, 0.04)',
                  color: '#F5F0E7',
                  border: '1px solid rgba(235, 225, 208, 0.18)',
                  borderRadius: '999px',
                  padding: '14px 28px',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(235, 225, 208, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(235, 225, 208, 0.32)';
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(235, 225, 208, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(235, 225, 208, 0.18)';
                  e.currentTarget.style.color = '#F5F0E7';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Explore Features
              </button>
            </div>
          </div>

          {/* Right Column: Workflow Dashboard Visual (Crisp Native Border, No Double Boundary) */}
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
                maxWidth: '780px',
                height: 'auto',
                display: 'block',
                border: 'none',
                outline: 'none',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), 0 0 1px rgba(235, 225, 208, 0.12)',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onClick={() => setModalOpen(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 32px 76px rgba(0, 0, 0, 0.85), 0 0 16px rgba(233, 216, 185, 0.14)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 24px 64px rgba(0, 0, 0, 0.7), 0 0 1px rgba(235, 225, 208, 0.12)';
              }}
            />
          </div>
        </div>
      </section>

      {/* 3. TRUSTED TECHNOLOGY SECTION */}
      <section style={{
        width: '100%',
        maxWidth: '1480px',
        margin: 'clamp(40px, 4.5vw, 64px) auto clamp(48px, 5vw, 72px)',
        padding: '0 clamp(24px, 4vw, 56px)',
        boxSizing: 'border-box',
      }}>
        {/* Horizontal Divider Line with Centered Label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          marginBottom: '40px',
          width: '100%',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(235, 225, 208, 0.12)' }} />
          <span style={{
            fontSize: '13.5px',
            color: '#858078',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}>
            Trusted by engineering teams building reliable systems
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(235, 225, 208, 0.12)' }} />
        </div>

        {/* 6 Logos Row: Vercel, Render, PostgreSQL, Redis, Docker, Kubernetes */}
        <div className="rf-landing-logos" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '28px',
          width: '100%',
          color: '#B5AEA3',
        }}>
          {/* Vercel */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 22 20 2 20"></polygon>
            </svg>
            <span>Vercel</span>
          </div>

          {/* Render */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z"></path>
            </svg>
            <span>Render</span>
          </div>

          {/* PostgreSQL */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            <span>PostgreSQL</span>
          </div>

          {/* Redis */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <span>Redis</span>
          </div>

          {/* Docker */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="9" width="3" height="3"></rect>
              <rect x="8" y="9" width="3" height="3"></rect>
              <rect x="12" y="9" width="3" height="3"></rect>
              <rect x="8" y="5" width="3" height="3"></rect>
              <path d="M2 13c0 4 4 6 10 6s10-2 10-6c-2 0-3-1-4-1s-3 1-4 1H2z"></path>
            </svg>
            <span>Docker</span>
          </div>

          {/* Kubernetes */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* 4. VALUE PROPOSITION & METRICS GRID */}
      <section id="rf-metrics-section" style={{
        width: '100%',
        maxWidth: '1480px',
        margin: '0 auto',
        padding: '0 clamp(24px, 4vw, 56px) clamp(64px, 7vw, 96px)',
        boxSizing: 'border-box',
      }}>
        <div className="rf-value-props-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 3.4fr)',
          gap: '44px',
          alignItems: 'center',
        }}>
          {/* Left Title: 3 lines (32–36px) */}
          <div style={{ textAlign: 'left' }}>
            <h2 style={{
              fontSize: 'clamp(28px, 2.5vw, 36px)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: '#F5F0E7',
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
            gap: '18px',
          }}>
            {/* Card 1: 8–12× */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#151412',
              border: '1px solid rgba(235, 225, 208, 0.12)',
              borderRadius: '16px',
              padding: '30px 24px',
              textAlign: 'left',
              minHeight: '144px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: '34px', fontWeight: 800, color: '#F5F0E7', lineHeight: 1 }}>
                8–12×
              </div>
              <div style={{ fontSize: '13.5px', color: '#858078', marginTop: '14px', lineHeight: 1.45, fontWeight: 500 }}>
                Higher processing reliability
              </div>
            </div>

            {/* Card 2: < 300 ms */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#151412',
              border: '1px solid rgba(235, 225, 208, 0.12)',
              borderRadius: '16px',
              padding: '30px 24px',
              textAlign: 'left',
              minHeight: '144px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: '34px', fontWeight: 800, color: '#F5F0E7', lineHeight: 1 }}>
                &lt; 300 ms
              </div>
              <div style={{ fontSize: '13.5px', color: '#858078', marginTop: '14px', lineHeight: 1.45, fontWeight: 500 }}>
                P99 pipeline latency
              </div>
            </div>

            {/* Card 3: 99.9% */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#151412',
              border: '1px solid rgba(235, 225, 208, 0.12)',
              borderRadius: '16px',
              padding: '30px 24px',
              textAlign: 'left',
              minHeight: '144px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: '34px', fontWeight: 800, color: '#F5F0E7', lineHeight: 1 }}>
                99.9%
              </div>
              <div style={{ fontSize: '13.5px', color: '#858078', marginTop: '14px', lineHeight: 1.45, fontWeight: 500 }}>
                At-least-once delivery
              </div>
            </div>

            {/* Card 4: 0 */}
            <div className="rf-card-hover" style={{
              backgroundColor: '#151412',
              border: '1px solid rgba(235, 225, 208, 0.12)',
              borderRadius: '16px',
              padding: '30px 24px',
              textAlign: 'left',
              minHeight: '144px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: '34px', fontWeight: 800, color: '#F5F0E7', lineHeight: 1 }}>
                0
              </div>
              <div style={{ fontSize: '13.5px', color: '#858078', marginTop: '14px', lineHeight: 1.45, fontWeight: 500 }}>
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
            backgroundColor: 'rgba(13, 12, 11, 0.85)',
            backdropFilter: 'blur(10px)',
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
              backgroundColor: '#151412',
              border: '1px solid rgba(235, 225, 208, 0.16)',
              borderRadius: '20px',
              maxWidth: '860px',
              width: '100%',
              display: 'flex',
              overflow: 'hidden',
              boxShadow: '0 28px 72px rgba(0, 0, 0, 0.85)',
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
                backgroundColor: 'rgba(235, 225, 208, 0.08)',
                border: '1px solid rgba(235, 225, 208, 0.16)',
                color: '#B5AEA3',
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
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F5F0E7';
                e.currentTarget.style.backgroundColor = 'rgba(235, 225, 208, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#B5AEA3';
                e.currentTarget.style.backgroundColor = 'rgba(235, 225, 208, 0.08)';
              }}
            >
              ×
            </button>

            {/* Left Side: Uploaded Image Visual Panel */}
            <div className="rf-signin-modal-graphic" style={{
              flex: '1 1 48%',
              backgroundColor: '#0D0C0B',
              borderRight: '1px solid rgba(235, 225, 208, 0.1)',
              padding: '36px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              background: 'radial-gradient(circle at center, #1C1A17 0%, #0D0C0B 85%)',
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
                    border: '1px solid rgba(235, 225, 208, 0.12)',
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
                    color: '#F5F0E7',
                  }}>
                    Monochromatic Precision
                  </div>
                  <div style={{ fontSize: '11px', color: '#858078', marginTop: '4px' }}>
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
                letterSpacing: '0.06em',
                color: '#E9D8B9',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#E9D8B9' }}></span>
                AUTHENTICATION PORTAL
              </div>

              <h2 style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#F5F0E7',
                margin: '0 0 10px',
                letterSpacing: '-0.02em',
              }}>
                Welcome to RelayForge
              </h2>

              <p style={{
                fontSize: '13px',
                color: '#B5AEA3',
                lineHeight: 1.5,
                margin: '0 0 24px',
              }}>
                Sign in with GitHub to access tenant isolation, encrypted API keys, workflow orchestrations, and the Dead Letter Queue.
              </p>

              {/* GitHub OAuth Primary Button */}
              <a
                id="github-signin-link"
                href={startUrl}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  backgroundColor: '#F5F0E7',
                  color: '#0D0C0B',
                  textDecoration: 'none',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(245, 240, 231, 0.12)',
                  transition: 'all 0.16s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F5F0E7';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path>
                </svg>
                <span>Continue with GitHub</span>
              </a>

              {/* Dev Mode Session Token Fallback */}
              {isDev && (
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <button
                    onClick={() => setShowManualInput(!showManualInput)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#858078',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: '4px',
                    }}
                  >
                    Direct Session Token Entry
                  </button>

                  {showManualInput && (
                    <form onSubmit={handleManualSubmit} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Paste developer JWT token"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        style={{
                          flex: 1,
                          backgroundColor: '#0D0C0B',
                          border: '1px solid rgba(235, 225, 208, 0.2)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          color: '#F5F0E7',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#1C1A17',
                          border: '1px solid rgba(235, 225, 208, 0.2)',
                          color: '#F5F0E7',
                          borderRadius: '8px',
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
                borderTop: '1px solid rgba(235, 225, 208, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#858078',
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
        @media (max-width: 1100px) {
          .rf-hero-split-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
          .rf-landing-nav-center {
            display: none !important;
          }
          .rf-value-props-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .rf-metric-cards-row {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .rf-landing-logos {
            justifyContent: center !important;
            gap: 36px !important;
          }
        }
        @media (max-width: 640px) {
          .rf-landing-container {
            padding: 0 20px !important;
          }
          .rf-landing-badge {
            display: none !important;
          }
          .rf-metric-cards-row {
            grid-template-columns: 1fr !important;
          }
          .rf-headline-line-1, .rf-headline-line-2 {
            white-space: normal !important;
          }
          #signin-modal-container {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  );
};
