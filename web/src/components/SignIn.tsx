import { getApiBaseUrl, setSessionToken } from '../api.ts';
import React, { useState, useEffect } from 'react';
import brandGraphic from '../assets/brand-graphic.png';
import { InteractiveWorkflowDashboard } from './InteractiveWorkflowDashboard.tsx';

interface SignInProps {
  onTokenSignIn?: (token: string) => void;
}

export const SignIn: React.FC<SignInProps> = ({ onTokenSignIn }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Scroll Reveal Observer for landing page cards and elements
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('rf-in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.08,
      }
    );

    const elements = document.querySelectorAll('.rf-scroll-reveal, .rf-scroll-card');
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('rf-in-view');
      } else {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, []);

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
          <div className="rf-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="rf-brand-icon" style={{
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
            <span className="rf-brand-title" style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.02em', color: '#F5F0E7' }}>
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

          {/* Right Action Buttons & Mobile Hamburger */}
          <div className="rf-header-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              className="rf-header-signin-btn"
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
              className="rf-header-get-started-btn"
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

            {/* Mobile Hamburger Toggle Button */}
            <button
              className="rf-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(235, 225, 208, 0.06)',
                border: '1px solid rgba(235, 225, 208, 0.16)',
                color: '#F5F0E7',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {mobileMenuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"></line>
                  <line x1="4" y1="12" x2="20" y2="12"></line>
                  <line x1="4" y1="18" x2="20" y2="18"></line>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer Menu */}
        {mobileMenuOpen && (
          <div className="rf-mobile-drawer" style={{
            position: 'absolute',
            top: '74px',
            left: 0,
            right: 0,
            backgroundColor: '#12110F',
            borderBottom: '1px solid rgba(235, 225, 208, 0.16)',
            padding: '20px 24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 49,
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.85)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => { setMobileMenuOpen(false); setModalOpen(true); }}
                style={{ background: 'none', border: 'none', color: '#F5F0E7', textAlign: 'left', padding: '10px 4px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
              >
                Product
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); setModalOpen(true); }}
                style={{ background: 'none', border: 'none', color: '#F5F0E7', textAlign: 'left', padding: '10px 4px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
              >
                Solutions
              </button>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: '#F5F0E7', textDecoration: 'none', padding: '10px 4px', fontSize: '16px', fontWeight: 600 }}
              >
                Docs
              </a>
              <button
                onClick={() => { setMobileMenuOpen(false); setModalOpen(true); }}
                style={{ background: 'none', border: 'none', color: '#F5F0E7', textAlign: 'left', padding: '10px 4px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
              >
                Pricing
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); setOverviewModalOpen(true); }}
                style={{ background: 'none', border: 'none', color: '#E9D8B9', textAlign: 'left', padding: '10px 4px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Watch 90s Overview</span>
                <span style={{ fontSize: '12px' }}>▶</span>
              </button>
            </div>
            <div style={{ height: '1px', backgroundColor: 'rgba(235, 225, 208, 0.12)', margin: '4px 0' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setMobileMenuOpen(false); setModalOpen(true); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(235, 225, 208, 0.06)',
                  border: '1px solid rgba(235, 225, 208, 0.2)',
                  color: '#F5F0E7',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); setModalOpen(true); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '999px',
                  backgroundColor: '#F5F0E7',
                  border: 'none',
                  color: '#0D0C0B',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SPLIT SECTION */}
      <section style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: 'clamp(40px, 5vw, 68px) clamp(20px, 4vw, 52px) clamp(30px, 3.5vw, 48px)',
        boxSizing: 'border-box',
      }}>
        <div className="rf-hero-split-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)',
          gap: 'clamp(36px, 4vw, 64px)',
          alignItems: 'center',
        }}>
          {/* Left Column: Pill, Two-Line Heading, Description, & Two Action Buttons */}
          <div className="rf-scroll-reveal" style={{ textAlign: 'left', minWidth: 0 }}>
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
              fontSize: 'clamp(34px, 3.8vw, 54px)',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              color: '#F5F0E7',
              margin: '0 0 24px',
            }}>
              <span className="rf-headline-line-1" style={{ display: 'block' }}>Reliable Webhooks &amp;</span>
              <span className="rf-headline-line-2" style={{ display: 'block' }}>Sequential Workflows</span>
            </h1>

            {/* Supporting Description (18–20px) */}
            <p className="rf-hero-desc" style={{
              fontSize: 'clamp(15px, 1.25vw, 18px)',
              color: '#B5AEA3',
              maxWidth: '520px',
              lineHeight: 1.58,
              margin: '0 0 36px',
            }}>
              Ingest high-throughput events, execute durable multi-step pipelines, and guarantee at-least-once delivery with jittered exponential retries.
            </p>

            {/* Two Action Buttons side-by-side with exact theme */}
            <div className="rf-hero-buttons" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
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

          {/* Right Column: Live Interactive Animated Workflow Dashboard */}
          <div className="rf-hero-dashboard-col rf-scroll-card rf-stagger-1" style={{
            position: 'relative',
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <InteractiveWorkflowDashboard onCardClick={() => setModalOpen(true)} />
          </div>
        </div>
      </section>

      {/* 3. TRUSTED TECHNOLOGY SECTION */}
      <section style={{
        width: '100%',
        maxWidth: '1400px',
        margin: 'clamp(28px, 3.5vw, 48px) auto 20px',
        padding: '0 clamp(20px, 4vw, 52px)',
        boxSizing: 'border-box',
      }}>
        {/* Horizontal Divider Line with Centered Label */}
        <div className="rf-scroll-reveal" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          marginBottom: '32px',
          width: '100%',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(235, 225, 208, 0.12)' }} />
          <span style={{
            fontSize: '13px',
            color: '#858078',
            fontWeight: 500,
            textAlign: 'center',
            letterSpacing: '0.01em',
            padding: '0 8px',
          }}>
            Trusted by engineering teams building reliable systems
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(235, 225, 208, 0.12)' }} />
        </div>

        {/* 6 Logos Row: Vercel, Render, PostgreSQL, Redis, Docker, Kubernetes */}
        <div className="rf-landing-logos rf-scroll-reveal rf-stagger-1" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '24px',
          width: '100%',
          color: '#B5AEA3',
        }}>
          {/* Vercel */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
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
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z"></path>
            </svg>
            <span>Render</span>
          </div>

          {/* PostgreSQL */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            <span>PostgreSQL</span>
          </div>

          {/* Redis */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <span>Redis</span>
          </div>

          {/* Docker */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* 4. MAIN COMPARISON SECTION: RAW EVENTS TO RELIABLE WORKFLOWS */}
      <section id="rf-metrics-section" style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '36px clamp(20px, 4vw, 52px) 56px',
        boxSizing: 'border-box',
      }}>
        {/* Centered Introductory Section */}
        <div className="rf-scroll-reveal" style={{ textAlign: 'center', margin: '0 auto', maxWidth: '780px', padding: '0 12px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#B5AEA3',
            marginBottom: '16px',
          }}>
            EVENT PROCESSING PLATFORM
          </div>

          <h2 className="rf-comparison-heading" style={{
            fontSize: 'clamp(30px, 3.6vw, 48px)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.025em',
            color: '#F5F0E7',
            margin: '0 0 18px',
          }}>
            <span className="rf-go-from-line-1" style={{ display: 'block' }}>Go from &ldquo;Raw events&rdquo; to</span>
            <span className="rf-go-from-line-2" style={{ display: 'block' }}>&ldquo;Reliable workflows&rdquo;</span>
          </h2>

          <p style={{
            fontSize: 'clamp(14.5px, 1.15vw, 16.5px)',
            color: '#B5AEA3',
            lineHeight: 1.6,
            maxWidth: '620px',
            margin: '0 auto 28px',
          }}>
            Ingest, process, and deliver events at scale with durable workflows, retries, and guaranteed delivery.
          </p>

          <button
            onClick={() => setOverviewModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#F5F0E7',
              color: '#0D0C0B',
              border: 'none',
              borderRadius: '999px',
              padding: '12px 26px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(245, 240, 231, 0.16)',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F5F0E7';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>Watch a 90s Overview</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>

        {/* Side-by-Side Comparison Panels */}
        <div className="rf-comparison-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '24px',
          maxWidth: '100%',
          margin: '40px auto 0',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Left Panel: The usual approach */}
          <div className="rf-scroll-card rf-comparison-card" style={{
            backgroundColor: '#141311',
            border: '1px solid rgba(235, 225, 208, 0.1)',
            borderRadius: '20px',
            padding: '32px 28px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}>
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#F5F0E7',
                margin: '0 0 20px',
                letterSpacing: '-0.01em',
              }}>
                The usual approach
              </h3>

              {/* Horizontal flow: Event → Custom Code → Queues → Manual Retry */}
              <div className="rf-flow-container" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                minHeight: '76px',
                padding: '0 clamp(12px, 2vw, 22px)',
                backgroundColor: '#0D0C0B',
                borderRadius: '12px',
                border: '1px solid rgba(235, 225, 208, 0.08)',
                marginBottom: '28px',
                boxSizing: 'border-box',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}>
                {/* Event */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '42px', flexShrink: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#1A1917',
                    border: '1px solid rgba(235, 225, 208, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#858078',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '11px', color: '#858078', fontWeight: 500 }}>Event</span>
                </div>

                <span style={{ color: 'rgba(235, 225, 208, 0.28)', fontSize: '13px', flexShrink: 0 }}>→</span>

                {/* Custom Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '64px', flexShrink: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#1A1917',
                    border: '1px solid rgba(235, 225, 208, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#858078',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '11px', color: '#858078', fontWeight: 500, whiteSpace: 'nowrap' }}>Custom Code</span>
                </div>

                <span style={{ color: 'rgba(235, 225, 208, 0.28)', fontSize: '13px', flexShrink: 0 }}>→</span>

                {/* Queues */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '42px', flexShrink: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#1A1917',
                    border: '1px solid rgba(235, 225, 208, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#858078',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="12" cy="5" rx="9" ry="3" />
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '11px', color: '#858078', fontWeight: 500 }}>Queues</span>
                </div>

                <span style={{ color: 'rgba(235, 225, 208, 0.28)', fontSize: '13px', flexShrink: 0 }}>→</span>

                {/* Manual Retry */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '64px', flexShrink: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#1A1917',
                    border: '1px solid rgba(235, 225, 208, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#858078',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '11px', color: '#858078', fontWeight: 500, whiteSpace: 'nowrap' }}>Manual Retry</span>
                </div>
              </div>

              {/* 4 Problems */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  'Build and maintain the plumbing',
                  'Handle retries and failures yourself',
                  'Limited visibility and tracing',
                  'Harder to scale and keep reliable',
                ].map((text, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ color: '#E06C55', fontSize: '13px', lineHeight: '20px', fontWeight: 700, flexShrink: 0 }}>
                      ✕
                    </div>
                    <span style={{ fontSize: '13.5px', color: '#B5AEA3', lineHeight: '20px' }}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: With RelayForge */}
          <div className="rf-scroll-card rf-comparison-card rf-stagger-2" style={{
            backgroundColor: '#151412',
            border: '1px solid rgba(233, 216, 185, 0.32)',
            borderRadius: '20px',
            padding: '32px 28px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(233, 216, 185, 0.05)',
            boxSizing: 'border-box',
          }}>
            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#F5F0E7',
                margin: '0 0 20px',
                letterSpacing: '-0.01em',
              }}>
                With RelayForge
              </h3>

              {/* Horizontal flow: Event → RelayForge → Your Systems */}
              <div className="rf-flow-container" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                minHeight: '76px',
                padding: '0 clamp(14px, 2vw, 30px)',
                backgroundColor: '#0D0C0B',
                borderRadius: '12px',
                border: '1px solid rgba(235, 225, 208, 0.08)',
                marginBottom: '28px',
                boxSizing: 'border-box',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}>
                {/* Event */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '42px', flexShrink: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#1A1917',
                    border: '1px solid rgba(235, 225, 208, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#858078',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '11px', color: '#858078', fontWeight: 500 }}>Event</span>
                </div>

                <span style={{ color: 'rgba(235, 225, 208, 0.28)', fontSize: '13px', flexShrink: 0 }}>→</span>

                {/* RelayForge (Central Highlighted Element) */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: '#1C1A17',
                  border: '1px solid #E9D8B9',
                  borderRadius: '10px',
                  padding: '6px 20px',
                  boxShadow: '0 0 16px rgba(233, 216, 185, 0.16)',
                  flexShrink: 0,
                }}>
                  <div style={{ color: '#E9D8B9', display: 'flex', alignItems: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#F5F0E7', fontWeight: 700, letterSpacing: '0.01em' }}>RelayForge</span>
                </div>

                <span style={{ color: 'rgba(235, 225, 208, 0.28)', fontSize: '13px', flexShrink: 0 }}>→</span>

                {/* Your Systems */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '64px', flexShrink: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#1A1917',
                    border: '1px solid rgba(235, 225, 208, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#858078',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="12" cy="5" rx="9" ry="3" />
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '11px', color: '#858078', fontWeight: 500, whiteSpace: 'nowrap' }}>Your System</span>
                </div>
              </div>

              {/* 4 Advantages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  'Durable, multi-step workflows',
                  'Built-in retries and dead letter handling',
                  'End-to-end visibility and telemetry',
                  'Scales reliably with your workload',
                ].map((text, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ color: '#84CC16', fontSize: '14px', lineHeight: '20px', fontWeight: 700, flexShrink: 0 }}>
                      ✓
                    </div>
                    <span style={{ fontSize: '13.5px', color: '#F5F0E7', fontWeight: 500, lineHeight: '20px' }}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Impact Section: Better insights. Bigger impact. */}
        <div className="rf-impact-container rf-scroll-reveal" style={{ textAlign: 'center', margin: '76px auto 0', width: '100%', boxSizing: 'border-box' }}>
          <h2 style={{
            fontSize: 'clamp(26px, 2.8vw, 38px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#F5F0E7',
            margin: '0 0 12px',
          }}>
            Better insights. Bigger impact.
          </h2>

          <p style={{
            fontSize: '15px',
            color: '#B5AEA3',
            lineHeight: 1.6,
            maxWidth: '580px',
            margin: '0 auto 36px',
          }}>
            RelayForge gives you the reliability and visibility to turn events into measurable business outcomes.
          </p>

          {/* 4 Metric Blocks */}
          <div className="rf-impact-metrics-row" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '18px',
            width: '100%',
          }}>
            {[
              { value: '8–12×', label: 'Higher processing reliability' },
              { value: '< 300 ms', label: 'P99 pipeline latency' },
              { value: '99.9%', label: 'At-least-once delivery' },
              { value: '0', label: 'Event loss under retries' },
            ].map((metric, idx) => (
              <div key={idx} className={`rf-scroll-card rf-impact-card rf-stagger-${idx + 1}`} style={{
                backgroundColor: '#141311',
                border: '1px solid rgba(235, 225, 208, 0.1)',
                borderRadius: '16px',
                padding: '24px 22px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '118px',
                boxSizing: 'border-box',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#F5F0E7', lineHeight: 1 }}>
                  {metric.value}
                </div>
                <div style={{ fontSize: '13px', color: '#858078', fontWeight: 500, lineHeight: 1.4 }}>
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Demo Section: See RelayForge in Action */}
        <div className="rf-demo-panel rf-scroll-card" style={{
          width: '100%',
          margin: '76px auto 0',
          backgroundColor: '#141311',
          border: '1px solid rgba(235, 225, 208, 0.12)',
          borderRadius: '24px',
          padding: '48px clamp(28px, 4vw, 64px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)',
          gap: '36px',
          alignItems: 'center',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Left Content */}
          <div className="rf-demo-content-col rf-scroll-reveal" style={{ textAlign: 'left', zIndex: 2 }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#858078',
              marginBottom: '14px',
            }}>
              SEE IT IN ACTION
            </div>

            <h3 style={{
              fontSize: 'clamp(28px, 3.2vw, 42px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: '#F5F0E7',
              margin: '0 0 18px',
            }}>
              See RelayForge<br />
              in action
            </h3>

            <p style={{
              fontSize: '15px',
              color: '#B5AEA3',
              lineHeight: 1.6,
              maxWidth: '430px',
              margin: '0 0 32px',
            }}>
              Explore a live demo to see how events flow through workflows, retries, and delivery with full visibility.
            </p>

            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#EFE4D0',
                color: '#0D0C0B',
                border: 'none',
                borderRadius: '999px',
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#EFE4D0';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Get Demo
            </button>
          </div>

          {/* Right Geometric Illustration: 3D Isometric Cube Matching Reference */}
          <div className="rf-demo-illustration-col rf-scroll-reveal rf-stagger-2" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            height: '330px',
            width: '100%',
          }}>
            <svg width="460" height="330" viewBox="0 0 460 330" fill="none" style={{ width: '100%', maxWidth: '460px', height: 'auto', overflow: 'visible' }}>
              <defs>
                {/* Radial Glow on Top Surface */}
                <radialGradient id="rfCubeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#EFE1C6" stopOpacity="0.45" />
                  <stop offset="45%" stopColor="#E9D8B9" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#E9D8B9" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background Isometric Perspective Floor Grid Lines (Slope = +0.5) */}
              <line x1="120" y1="0" x2="480" y2="180" stroke="rgba(235, 225, 208, 0.06)" strokeWidth="1" />
              <line x1="-20" y1="0" x2="480" y2="250" stroke="rgba(235, 225, 208, 0.08)" strokeWidth="1" />
              <line x1="-20" y1="65" x2="480" y2="315" stroke="rgba(235, 225, 208, 0.08)" strokeWidth="1" />
              <line x1="-20" y1="130" x2="380" y2="330" stroke="rgba(235, 225, 208, 0.07)" strokeWidth="1" />
              <line x1="-20" y1="195" x2="250" y2="330" stroke="rgba(235, 225, 208, 0.05)" strokeWidth="1" />

              {/* Background Isometric Perspective Floor Grid Lines (Slope = -0.5) */}
              <line x1="-20" y1="180" x2="340" y2="0" stroke="rgba(235, 225, 208, 0.06)" strokeWidth="1" />
              <line x1="-20" y1="245" x2="480" y2="-5" stroke="rgba(235, 225, 208, 0.08)" strokeWidth="1" />
              <line x1="-20" y1="310" x2="480" y2="60" stroke="rgba(235, 225, 208, 0.08)" strokeWidth="1" />
              <line x1="80" y1="330" x2="480" y2="130" stroke="rgba(235, 225, 208, 0.07)" strokeWidth="1" />
              <line x1="210" y1="330" x2="480" y2="195" stroke="rgba(235, 225, 208, 0.05)" strokeWidth="1" />

              {/* 3D Isometric Cube */}
              {/* Front Left Face */}
              <polygon
                points="100,120 230,185 230,290 100,225"
                fill="#12110F"
                stroke="rgba(235, 225, 208, 0.22)"
                strokeWidth="1.2"
              />

              {/* Front Right Face */}
              <polygon
                points="230,185 360,120 360,225 230,290"
                fill="#0E0D0B"
                stroke="rgba(235, 225, 208, 0.22)"
                strokeWidth="1.2"
              />

              {/* Top Rhombus Face (Glowing Champagne Stroke) */}
              <polygon
                points="230,55 360,120 230,185 100,120"
                fill="#171613"
                stroke="#EFE1C6"
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 0 8px rgba(239, 225, 198, 0.6))' }}
              />

              {/* Top Face Isometric Internal Cross Lines (connecting midpoints) */}
              <line x1="165" y1="87.5" x2="295" y2="152.5" stroke="rgba(239, 225, 198, 0.28)" strokeWidth="1.2" />
              <line x1="295" y1="87.5" x2="165" y2="152.5" stroke="rgba(239, 225, 198, 0.28)" strokeWidth="1.2" />

              {/* Ambient Isometric Radial Glow on Top Surface */}
              <ellipse cx="230" cy="120" rx="80" ry="40" fill="url(#rfCubeGlow)" />

              {/* Floating Glowing Lightning Symbol (Tilted in 3D Perspective matching Reference) */}
              <g style={{ filter: 'drop-shadow(0 0 12px rgba(239, 225, 198, 0.95)) drop-shadow(0 0 24px rgba(233, 216, 185, 0.5))' }}>
                <polygon
                  points="248,88 225,119 237,119 225,150 250,114 238,114"
                  fill="#F6EEDF"
                />
              </g>
            </svg>
          </div>
        </div>

        {/* Full-width Horizontal Divider Line above Footer matching Reference */}
        <div className="rf-footer-divider rf-scroll-reveal" style={{
          width: '100%',
          height: '1px',
          backgroundColor: 'rgba(235, 225, 208, 0.12)',
          margin: '56px auto 40px',
        }} />

        {/* Minimal Compact Footer */}
        <footer className="rf-footer rf-scroll-reveal rf-stagger-1" style={{
          width: '100%',
          margin: '0 auto',
          padding: '0 4px 28px',
          boxSizing: 'border-box',
        }}>
          <div className="rf-footer-grid" style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            gap: 'clamp(28px, 3.5vw, 56px)',
            textAlign: 'left',
            marginBottom: '44px',
          }}>
            {/* Brand Column */}
            <div className="rf-footer-brand-col">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: '#F5F0E7',
                  color: '#0D0C0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.02em', color: '#F5F0E7' }}>
                  RELAYFORGE
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: '#858078', lineHeight: 1.55, marginTop: '14px', maxWidth: '300px' }}>
                A durable event processing platform for reliable, scalable systems.
              </p>
            </div>

            {/* Product Column */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F5F0E7', marginBottom: '14px' }}>
                Product
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <a href="#rf-metrics-section" style={{ color: '#858078', textDecoration: 'none', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Features</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Integrations</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Changelog</a>
              </div>
            </div>

            {/* Solutions Column */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F5F0E7', marginBottom: '14px' }}>
                Solutions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Order Processing</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Notifications</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Data Sync</a>
              </div>
            </div>

            {/* Resources Column */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F5F0E7', marginBottom: '14px' }}>
                Resources
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: '#858078', textDecoration: 'none', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Docs</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Guides</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>API Reference</a>
              </div>
            </div>

            {/* Company Column */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F5F0E7', marginBottom: '14px' }}>
                Company
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>About</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Pricing</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>Contact</a>
              </div>
            </div>
          </div>

          {/* Divider & Copyright */}
          <div className="rf-footer-bottom-bar" style={{
            borderTop: '1px solid rgba(235, 225, 208, 0.08)',
            paddingTop: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '12px',
            color: '#666159',
          }}>
            <div>
              &copy; {new Date().getFullYear()} RelayForge. All rights reserved.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => setModalOpen(true)}>Privacy Policy</span>
              <span>•</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setModalOpen(true)}>Terms of Service</span>
              <span>•</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setModalOpen(true)}>System Status</span>
            </div>
          </div>
        </footer>
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

      {/* 6. 90s ARCHITECTURE OVERVIEW MODAL */}
      {overviewModalOpen && (
        <div
          onClick={() => setOverviewModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(13, 12, 11, 0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#151412',
              border: '1px solid rgba(235, 225, 208, 0.16)',
              borderRadius: '20px',
              maxWidth: '660px',
              width: '100%',
              padding: '36px 32px',
              boxShadow: '0 28px 72px rgba(0, 0, 0, 0.85)',
              position: 'relative',
              textAlign: 'left',
            }}
          >
            <button
              onClick={() => setOverviewModalOpen(false)}
              aria-label="Close overview"
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
                fontSize: '18px',
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

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#E9D8B9',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#E9D8B9' }}></span>
              SYSTEM ARCHITECTURE WALKTHROUGH
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#F5F0E7', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              RelayForge in 90 Seconds
            </h3>

            <p style={{ fontSize: '13.5px', color: '#B5AEA3', lineHeight: 1.6, margin: '0 0 24px' }}>
              How RelayForge eliminates event loss, prevents cascading outages, and delivers deterministic event-driven workflows.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#100F0D', border: '1px solid rgba(235, 225, 208, 0.08)', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ backgroundColor: 'rgba(233, 216, 185, 0.12)', color: '#E9D8B9', borderRadius: '8px', padding: '4px 8px', fontSize: '11.5px', fontWeight: 700, flexShrink: 0 }}>01</div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#F5F0E7' }}>Sub-millisecond Ingestion Persistence</div>
                  <div style={{ fontSize: '12.5px', color: '#858078', marginTop: '2px', lineHeight: 1.45 }}>Payloads land in transactional PostgreSQL outboxes before network ACK, preventing data loss under burst spikes.</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#100F0D', border: '1px solid rgba(235, 225, 208, 0.08)', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ backgroundColor: 'rgba(233, 216, 185, 0.12)', color: '#E9D8B9', borderRadius: '8px', padding: '4px 8px', fontSize: '11.5px', fontWeight: 700, flexShrink: 0 }}>02</div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#F5F0E7' }}>Isolated Multi-Step Orchestration</div>
                  <div style={{ fontSize: '12.5px', color: '#858078', marginTop: '2px', lineHeight: 1.45 }}>Sequential pipeline steps execute with tenant sandboxing, token leasing, and zero cross-tenant contamination.</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#100F0D', border: '1px solid rgba(235, 225, 208, 0.08)', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ backgroundColor: 'rgba(233, 216, 185, 0.12)', color: '#E9D8B9', borderRadius: '8px', padding: '4px 8px', fontSize: '11.5px', fontWeight: 700, flexShrink: 0 }}>03</div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#F5F0E7' }}>Jittered Retries &amp; DLQ Circuit Breakers</div>
                  <div style={{ fontSize: '12.5px', color: '#858078', marginTop: '2px', lineHeight: 1.45 }}>Exhausted deliveries divert safely into Dead Letter Queues with manual replay inspection, zero message drops.</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOverviewModalOpen(false)}
                style={{ backgroundColor: 'transparent', border: '1px solid rgba(235, 225, 208, 0.16)', color: '#B5AEA3', borderRadius: '999px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => { setOverviewModalOpen(false); setModalOpen(true); }}
                style={{ backgroundColor: '#F5F0E7', color: '#0D0C0B', border: 'none', borderRadius: '999px', padding: '10px 22px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Open Developer Console
              </button>
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
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Scroll Reveal & Coming-Up Entrance Animations */
        .rf-scroll-reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.72s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.72s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }

        .rf-scroll-reveal.rf-in-view {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }

        .rf-scroll-card {
          opacity: 0;
          transform: translateY(38px) scale(0.985);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.28s ease,
                      border-color 0.28s ease;
          will-change: opacity, transform;
        }

        .rf-scroll-card.rf-in-view {
          opacity: 1 !important;
          transform: translateY(0) scale(1) !important;
        }

        /* Elevated Card Hover Responses Once Revealed */
        .rf-comparison-card.rf-in-view {
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.25s ease,
                      border-color 0.25s ease !important;
        }
        .rf-comparison-card.rf-in-view:hover {
          transform: translateY(-4px) scale(1) !important;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 24px rgba(235, 225, 208, 0.08) !important;
          border-color: rgba(233, 216, 185, 0.45) !important;
        }

        .rf-impact-card.rf-in-view {
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.25s ease,
                      border-color 0.25s ease !important;
        }
        .rf-impact-card.rf-in-view:hover {
          transform: translateY(-3px) scale(1) !important;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5) !important;
          border-color: rgba(235, 225, 208, 0.25) !important;
        }

        .rf-demo-panel.rf-in-view {
          transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.25s ease,
                      border-color 0.25s ease !important;
        }
        .rf-demo-panel.rf-in-view:hover {
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 32px rgba(235, 225, 208, 0.08) !important;
          border-color: rgba(235, 225, 208, 0.24) !important;
        }

        /* Stagger Delay Utility Classes */
        .rf-stagger-1 { transition-delay: 0.08s !important; }
        .rf-stagger-2 { transition-delay: 0.16s !important; }
        .rf-stagger-3 { transition-delay: 0.24s !important; }
        .rf-stagger-4 { transition-delay: 0.32s !important; }
        .rf-stagger-5 { transition-delay: 0.40s !important; }
        .rf-stagger-6 { transition-delay: 0.48s !important; }

        /* Flow nodes flourish when comparison card enters view */
        .rf-scroll-card.rf-in-view .rf-flow-container > div {
          animation: rfNodePop 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .rf-scroll-card.rf-in-view .rf-flow-container > div:nth-child(1) { animation-delay: 0.12s; }
        .rf-scroll-card.rf-in-view .rf-flow-container > div:nth-child(3) { animation-delay: 0.20s; }
        .rf-scroll-card.rf-in-view .rf-flow-container > div:nth-child(5) { animation-delay: 0.28s; }
        .rf-scroll-card.rf-in-view .rf-flow-container > div:nth-child(7) { animation-delay: 0.36s; }

        @keyframes rfNodePop {
          0% {
            opacity: 0.2;
            transform: scale(0.92);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Accessible reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .rf-scroll-reveal,
          .rf-scroll-card {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }

        /* 1. Global Viewport Safety */
        html, body {
          max-width: 100vw;
          overflow-x: hidden;
        }

        /* 2. Desktop Navigation & Interactions */
        .rf-mobile-menu-btn {
          display: none !important;
        }

        /* 3. Medium Screens / Laptops / Tablets Landscape (<= 1100px) */
        @media (max-width: 1100px) {
          .rf-hero-split-grid {
            grid-template-columns: 1fr !important;
            gap: 44px !important;
          }
          .rf-hero-dashboard-col {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
          }
          .rf-landing-nav-center {
            display: none !important;
          }
          .rf-mobile-menu-btn {
            display: inline-flex !important;
          }
          .rf-landing-logos {
            justify-content: center !important;
            gap: 32px !important;
          }
        }

        /* 4. Tablets Portrait (<= 900px) */
        @media (max-width: 900px) {
          .rf-comparison-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
          .rf-impact-metrics-row {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 14px !important;
          }
          .rf-demo-panel {
            grid-template-columns: 1fr !important;
            padding: 40px 24px !important;
            text-align: center !important;
            gap: 32px !important;
          }
          .rf-demo-content-col {
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          .rf-demo-content-col p {
            margin: 0 auto 28px !important;
          }
          .rf-demo-illustration-col {
            height: 240px !important;
            max-width: 360px !important;
            margin: 0 auto !important;
          }
          .rf-footer-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 32px !important;
          }
          .rf-footer-brand-col {
            grid-column: 1 / -1 !important;
          }
        }

        /* 5. Mobile Devices (<= 768px) */
        @media (max-width: 768px) {
          .rf-landing-header {
            height: 56px !important;
          }
          .rf-landing-container {
            padding: 0 12px !important;
            height: 56px !important;
          }
          .rf-header-brand {
            gap: 8px !important;
          }
          .rf-brand-icon {
            width: 30px !important;
            height: 30px !important;
            border-radius: 8px !important;
          }
          .rf-brand-icon svg {
            width: 16px !important;
            height: 16px !important;
          }
          .rf-brand-title {
            font-size: 14.5px !important;
            letter-spacing: 0.01em !important;
          }
          .rf-header-get-started-btn {
            display: none !important;
          }
          .rf-header-signin-btn {
            display: none !important;
          }
          .rf-landing-badge {
            display: none !important;
          }
          .rf-header-right-actions {
            gap: 0 !important;
          }
          .rf-mobile-menu-btn {
            display: inline-flex !important;
            width: 36px !important;
            height: 36px !important;
            border-radius: 8px !important;
            margin-right: 2px !important;
          }
          .rf-mobile-drawer {
            top: 56px !important;
          }
          .rf-hero-headline {
            font-size: clamp(28px, 7.5vw, 40px) !important;
            line-height: 1.15 !important;
            margin-bottom: 18px !important;
          }
          .rf-headline-line-1, .rf-headline-line-2 {
            display: inline !important;
            white-space: normal !important;
          }
          .rf-hero-desc {
            font-size: 15px !important;
            line-height: 1.55 !important;
            margin-bottom: 28px !important;
          }

          /* Technology logos in one single row */
          .rf-landing-logos {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            justify-content: flex-start !important;
            align-items: center !important;
            gap: 16px !important;
            padding: 6px 4px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .rf-landing-logos::-webkit-scrollbar {
            display: none !important;
          }
          .rf-landing-logos > div {
            flex-shrink: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            font-size: 12.5px !important;
            white-space: nowrap !important;
          }
          .rf-landing-logos > div svg {
            width: 16px !important;
            height: 16px !important;
          }

          /* Comparison Section: Go from text in two lines */
          .rf-comparison-heading {
            font-size: clamp(20px, 5.8vw, 28px) !important;
            line-height: 1.25 !important;
            margin-bottom: 12px !important;
          }
          .rf-go-from-line-1, .rf-go-from-line-2 {
            display: block !important;
            white-space: nowrap !important;
          }

          .rf-flow-container {
            padding: 0 10px !important;
            gap: 6px !important;
          }

          /* Reduced Spacing in Impact & Comparison */
          #rf-metrics-section {
            padding: 24px 14px 20px !important;
          }
          .rf-comparison-grid {
            margin-top: 24px !important;
            gap: 16px !important;
          }
          .rf-impact-container {
            margin: 32px auto 0 !important;
          }
          .rf-impact-container p {
            margin-bottom: 20px !important;
          }
          .rf-impact-metrics-row {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          .rf-impact-metrics-row > div {
            height: auto !important;
            min-height: 84px !important;
            padding: 14px 12px !important;
          }
          .rf-impact-metrics-row > div > div:first-child {
            font-size: 22px !important;
          }
          .rf-impact-metrics-row > div > div:last-child {
            font-size: 11.5px !important;
          }

          /* Mobile responsive See RelayForge in Action panel */
          .rf-demo-panel {
            grid-template-columns: 1fr !important;
            margin: 28px auto 0 !important;
            padding: 24px 16px 20px !important;
            border-radius: 18px !important;
            text-align: center !important;
            gap: 18px !important;
          }
          .rf-demo-content-col {
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          .rf-demo-content-col h3 {
            font-size: clamp(22px, 5.5vw, 26px) !important;
            line-height: 1.2 !important;
            margin-bottom: 10px !important;
          }
          .rf-demo-content-col p {
            font-size: 13.5px !important;
            line-height: 1.5 !important;
            margin: 0 auto 18px !important;
            max-width: 100% !important;
          }
          .rf-demo-illustration-col {
            height: 170px !important;
            max-width: 270px !important;
            margin: 6px auto 0 !important;
          }
          .rf-demo-illustration-col svg {
            width: 100% !important;
            height: auto !important;
            max-height: 170px !important;
          }

          /* Reduced Footer Spacing */
          .rf-footer-divider {
            margin: 24px auto 16px !important;
          }
          .rf-footer {
            padding: 0 4px 14px !important;
          }
          .rf-footer-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px 14px !important;
            margin-bottom: 20px !important;
          }
          .rf-footer-brand-col {
            grid-column: 1 / -1 !important;
            margin-bottom: 8px !important;
          }
          .rf-footer-bottom-bar {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            padding-top: 14px !important;
            gap: 10px !important;
          }
          #signin-modal-container {
            flex-direction: column !important;
            width: 94% !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
          }
          .rf-signin-modal-graphic {
            display: none !important;
          }
          .rf-signin-modal-content {
            padding: 32px 20px !important;
          }
        }

        /* 6. Narrow Mobile Devices (<= 480px) */
        @media (max-width: 480px) {
          .rf-hero-buttons {
            flex-direction: column !important;
            width: 100% !important;
            gap: 12px !important;
          }
          .rf-hero-buttons button {
            width: 100% !important;
            justify-content: center !important;
          }
          .rf-demo-panel {
            padding: 20px 14px 18px !important;
            border-radius: 16px !important;
          }
          .rf-demo-illustration-col {
            height: 150px !important;
            max-width: 240px !important;
          }
          .rf-impact-metrics-row > div > div:first-child {
            font-size: 20px !important;
          }
          .rf-impact-metrics-row > div > div:last-child {
            font-size: 11px !important;
          }
        }
      `}</style>
    </div>
  );
};
