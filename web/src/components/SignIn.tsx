import { getApiBaseUrl, setSessionToken } from '../api.ts';
import React, { useState, useEffect } from 'react';
import { InteractiveWorkflowDashboard } from './InteractiveWorkflowDashboard.tsx';
import { AnimatedCounter } from './AnimatedCounter.tsx';

interface SignInProps {
  onTokenSignIn?: (token: string, email?: string) => void;
}

export const SignIn: React.FC<SignInProps> = ({ onTokenSignIn }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setAuthError('Password must contain at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const token = `rf_${authMode}_${btoa(cleanEmail).replace(/=/g, '').slice(0, 14)}_${Date.now()}`;
      await new Promise((res) => setTimeout(res, 450));
      if (onTokenSignIn) {
        onTokenSignIn(token, cleanEmail);
      } else {
        setSessionToken(token);
        window.location.reload();
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await new Promise((res) => setTimeout(res, 450));
      const googleEmail = 'google.user@relayforge.io';
      const token = `rf_google_${Date.now()}`;
      if (onTokenSignIn) {
        onTokenSignIn(token, googleEmail);
      } else {
        setSessionToken(token);
        window.location.reload();
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = () => {
    if (apiBase && !apiBase.includes('undefined')) {
      window.location.href = startUrl;
    } else {
      setIsLoading(true);
      setTimeout(() => {
        const gitToken = `rf_gh_${Date.now()}`;
        if (onTokenSignIn) {
          onTokenSignIn(gitToken, 'developer@github.com');
        } else {
          setSessionToken(gitToken);
          window.location.reload();
        }
      }, 400);
    }
  };

  // Keyboard shortcut (Escape to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
        setOverviewModalOpen(false);
      }
    };
    if (modalOpen || overviewModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, overviewModalOpen]);

  // Scroll Reveal Observer for landing page cards and elements
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.boundingClientRect.bottom <= 0) {
            entry.target.classList.add('rf-in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '100px 0px -20px 0px',
        threshold: 0.05,
      }
    );

    const elements = document.querySelectorAll('.rf-scroll-reveal, .rf-scroll-card');
    elements.forEach((el) => {
      observer.observe(el);
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
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Roboto Mono', monospace",
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
            <span className="rf-brand-title" style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.06em', color: '#F5F0E7', fontFamily: "'JetBrains Mono', monospace" }}>
              RELAYFORGE
            </span>
          </div>

          {/* Center Navigation Links (Product, Solutions, Docs, Pricing, Resources) */}
          <nav className="rf-landing-nav-center" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            fontSize: '13px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#B5AEA3',
          }}>
            <button
              onClick={() => { setAuthMode('signup'); setModalOpen(true); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#B5AEA3',
                fontSize: '13px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
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
              PRODUCT <span style={{ fontSize: '11px', opacity: 0.7 }}>⌄</span>
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setModalOpen(true); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#B5AEA3',
                fontSize: '13px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
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
              SOLUTIONS <span style={{ fontSize: '11px', opacity: 0.7 }}>⌄</span>
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#B5AEA3',
                textDecoration: 'none',
                fontSize: '13px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              DOCS
            </a>
            <button
              onClick={() => { setAuthMode('signup'); setModalOpen(true); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#B5AEA3',
                fontSize: '13px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                padding: '6px 0',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              PRICING
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setModalOpen(true); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#B5AEA3',
                fontSize: '13px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
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
              RESOURCES <span style={{ fontSize: '11px', opacity: 0.7 }}>⌄</span>
            </button>
          </nav>

          {/* Right Action Buttons & Mobile Hamburger */}
          <div className="rf-header-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="rf-landing-badge" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#B5AEA3',
              backgroundColor: 'rgba(235, 225, 208, 0.05)',
              padding: '6px 14px',
              borderRadius: '999px',
              border: '1px solid rgba(235, 225, 208, 0.14)',
              fontWeight: 600,
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#E9D8B9',
                boxShadow: '0 0 8px rgba(233, 216, 185, 0.8)',
              }}></span>
              PRODUCTION READY v1.0
            </span>

            <button
              className="rf-header-signin-btn"
              onClick={() => { setAuthMode('login'); setModalOpen(true); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#F5F0E7',
                fontSize: '13px',
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '8px 14px',
                borderRadius: '8px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#E9D8B9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
            >
              SIGN IN
            </button>

            <button
              id="open-signin-button"
              className="rf-header-get-started-btn"
              onClick={() => { setAuthMode('signup'); setModalOpen(true); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F5F0E7',
                color: '#0D0C0B',
                border: 'none',
                borderRadius: '999px',
                padding: '10px 22px',
                fontSize: '12.5px',
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 700,
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
              GET STARTED
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
                style={{ color: '#F5F0E7', textDecoration: 'none', padding: '10px 4px', fontSize: '15px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                DOCS
              </a>
              <button
                onClick={() => { setMobileMenuOpen(false); setModalOpen(true); }}
                style={{ background: 'none', border: 'none', color: '#F5F0E7', textAlign: 'left', padding: '10px 4px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                PRICING
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); setOverviewModalOpen(true); }}
                style={{ background: 'none', border: 'none', color: '#E9D8B9', textAlign: 'left', padding: '10px 4px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                <span>WATCH 90S OVERVIEW</span>
                <span style={{ fontSize: '12px' }}>▶</span>
              </button>
            </div>
            <div style={{ height: '1px', backgroundColor: 'rgba(235, 225, 208, 0.12)', margin: '4px 0' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setMobileMenuOpen(false); setAuthMode('login'); setModalOpen(true); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(235, 225, 208, 0.06)',
                  border: '1px solid rgba(235, 225, 208, 0.2)',
                  color: '#F5F0E7',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                SIGN IN
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); setAuthMode('signup'); setModalOpen(true); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '999px',
                  backgroundColor: '#F5F0E7',
                  border: 'none',
                  color: '#0D0C0B',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                GET STARTED
              </button>
            </div>
          </div>
        )}
      </header>

      {/* FIRST-FOLD WRAPPER (Guarantees clean 100vh hero view without next section peeking) */}
      <div className="rf-hero-fold-wrapper" style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 'calc(100vh - 68px)',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* 2. HERO SPLIT SECTION */}
        <section style={{
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          padding: 'clamp(28px, 3.2vw, 46px) clamp(20px, 4vw, 52px) 16px',
          boxSizing: 'border-box',
        }}>
          <div className="rf-hero-split-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)',
            gap: 'clamp(36px, 4vw, 64px)',
            alignItems: 'flex-start',
          }}>
            {/* Left Column: Pill, Two-Line Heading, Description, & Two Action Buttons */}
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              {/* Pill: Durable Systems Engine (Fixed Position) */}
              <div className="rf-scroll-reveal rf-stagger-1" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '999px',
                backgroundColor: 'rgba(235, 225, 208, 0.05)',
                border: '1px solid rgba(235, 225, 208, 0.16)',
                fontSize: '12px',
                fontWeight: 600,
                color: '#E9D8B9',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E9D8B9" strokeWidth="2.5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>DURABLE SYSTEMS ENGINE</span>
              </div>

              {/* Dominant Heading in Exactly Two Lines (Fixed Position) */}
              <h1 className="rf-hero-headline rf-scroll-reveal rf-stagger-2" style={{
                fontSize: 'clamp(24px, 2.7vw, 38px)',
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                color: '#F5F0E7',
                margin: '0 0 clamp(74px, 9.6vh, 105px)',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              }}>
                <span className="rf-headline-line-1" style={{ display: 'block' }}>RELIABLE WEBHOOKS &amp;</span>
                <span className="rf-headline-line-2" style={{ display: 'block' }}>SEQUENTIAL WORKFLOWS</span>
              </h1>

              {/* Supporting Description (Moved further below heading) */}
              <p className="rf-hero-desc rf-scroll-reveal rf-stagger-3" style={{
                fontSize: 'clamp(12px, 1.05vw, 13.5px)',
                color: '#B5AEA3',
                maxWidth: '520px',
                lineHeight: 1.6,
                letterSpacing: '0.02em',
                margin: '0 0 clamp(48px, 6.5vh, 64px)',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                INGEST HIGH-THROUGHPUT EVENTS, EXECUTE DURABLE MULTI-STEP PIPELINES, AND GUARANTEE AT-LEAST-ONCE DELIVERY WITH JITTERED EXPONENTIAL RETRIES.
              </p>

              {/* Two Action Buttons (Moved further downward) */}
              <div className="rf-hero-buttons rf-scroll-reveal rf-stagger-4" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                {/* Primary Warm Ivory Button: Get Started → */}
                <button
                  id="hero-signin-btn"
                  onClick={() => { setAuthMode('signup'); setModalOpen(true); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#F5F0E7',
                    color: '#0D0C0B',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '11px 22px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(245, 240, 231, 0.16)',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontFamily: "'JetBrains Mono', monospace",
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
                  <span>GET STARTED</span>
                  <span style={{ fontSize: '14px' }}>→</span>
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
                    padding: '11px 22px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontFamily: "'JetBrains Mono', monospace",
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
                  EXPLORE FEATURES
                </button>
              </div>
            </div>

            {/* Right Column: Live Interactive Animated Workflow Dashboard (Shifted below) */}
            <div className="rf-hero-dashboard-col rf-scroll-card rf-stagger-1" style={{
              position: 'relative',
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 'clamp(76px, 9.6vh, 105px)',
            }}>
              <InteractiveWorkflowDashboard onCardClick={() => setModalOpen(true)} />
            </div>
          </div>
        </section>

        {/* 3. TRUSTED TECHNOLOGY SECTION (Shifted downward toward bottom of first fold) */}
        <section className="rf-trusted-section" style={{
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          padding: 'clamp(32px, 4.5vh, 56px) clamp(20px, 4vw, 52px) clamp(36px, 5vh, 60px)',
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
              fontSize: '12px',
              color: '#858078',
              fontWeight: 600,
              textAlign: 'center',
              letterSpacing: '0.06em',
              padding: '0 8px',
              textTransform: 'uppercase',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              TRUSTED BY ENGINEERING TEAMS BUILDING RELIABLE SYSTEMS
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(235, 225, 208, 0.12)' }} />
          </div>

          {/* 6 Logos Row: Vercel, Render, PostgreSQL, Redis, Docker, Kubernetes */}
          <div className="rf-landing-logos" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '24px',
            width: '100%',
            color: '#B5AEA3',
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {/* Vercel */}
            <div
              className="rf-scroll-reveal rf-stagger-1"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 22 20 2 20"></polygon>
              </svg>
              <span>VERCEL</span>
            </div>

            {/* Render */}
            <div
              className="rf-scroll-reveal rf-stagger-2"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 4h7v7H3z M14 4h7v7h-7z M3 13h7v7H3z"></path>
              </svg>
              <span>RENDER</span>
            </div>

            {/* PostgreSQL */}
            <div
              className="rf-scroll-reveal rf-stagger-3"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
              <span>POSTGRESQL</span>
            </div>

            {/* Redis */}
            <div
              className="rf-scroll-reveal rf-stagger-4"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F0E7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#B5AEA3'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              <span>REDIS</span>
            </div>

            {/* Docker */}
            <div
              className="rf-scroll-reveal rf-stagger-5"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
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
              <span>DOCKER</span>
            </div>

            {/* Kubernetes */}
            <div
              className="rf-scroll-reveal rf-stagger-6"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#B5AEA3', transition: 'color 0.15s ease', cursor: 'default' }}
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
              <span>KUBERNETES</span>
            </div>
          </div>
        </section>
      </div>

      {/* 4. MAIN COMPARISON SECTION: RAW EVENTS TO RELIABLE WORKFLOWS */}
      <section id="rf-metrics-section" style={{
        width: '100%',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: 'clamp(90px, 12vh, 140px) clamp(20px, 4vw, 52px) 56px',
        boxSizing: 'border-box',
      }}>
        {/* Centered Introductory Section */}
        <div style={{ textAlign: 'center', margin: '0 auto', maxWidth: '780px', padding: '0 12px' }}>
          <div className="rf-scroll-reveal rf-stagger-1" style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#B5AEA3',
            marginBottom: '16px',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            EVENT PROCESSING PLATFORM
          </div>

          <h2 className="rf-comparison-heading" style={{
            fontSize: 'clamp(28px, 3.4vw, 44px)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: '#F5F0E7',
            margin: '0 0 18px',
            textTransform: 'uppercase',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span className="rf-go-from-line-1 rf-scroll-reveal rf-stagger-2" style={{ display: 'block' }}>GO FROM &ldquo;RAW EVENTS&rdquo; TO</span>
            <span className="rf-go-from-line-2 rf-scroll-reveal rf-stagger-3" style={{ display: 'block' }}>&ldquo;RELIABLE WORKFLOWS&rdquo;</span>
          </h2>

          <p className="rf-scroll-reveal rf-stagger-4" style={{
            fontSize: 'clamp(12px, 1.05vw, 13.5px)',
            color: '#B5AEA3',
            lineHeight: 1.6,
            maxWidth: '620px',
            margin: '0 auto 28px',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            INGEST, PROCESS, AND DELIVER EVENTS AT SCALE WITH DURABLE WORKFLOWS, RETRIES, AND GUARANTEED DELIVERY.
          </p>

          <div className="rf-scroll-reveal rf-stagger-5" style={{ display: 'inline-block' }}>
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
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(245, 240, 231, 0.16)',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: "'JetBrains Mono', monospace",
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
              <span>WATCH A 90S OVERVIEW</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          </div>
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
          <div className="rf-scroll-card rf-comparison-card rf-stagger-2" style={{
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
                fontSize: '16px',
                fontWeight: 700,
                color: '#F5F0E7',
                margin: '0 0 20px',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                THE USUAL APPROACH
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
                  <span style={{ fontSize: '10.5px', color: '#858078', fontWeight: 600, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>EVENT</span>
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
                  <span style={{ fontSize: '10.5px', color: '#858078', fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>CUSTOM CODE</span>
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
                  <span style={{ fontSize: '10.5px', color: '#858078', fontWeight: 600, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>QUEUES</span>
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
                  <span style={{ fontSize: '10.5px', color: '#858078', fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>MANUAL RETRY</span>
                </div>
              </div>

              {/* 4 Problems */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  'BUILD AND MAINTAIN THE PLUMBING',
                  'HANDLE RETRIES AND FAILURES YOURSELF',
                  'LIMITED VISIBILITY AND TRACING',
                  'HARDER TO SCALE AND KEEP RELIABLE',
                ].map((text, idx) => (
                  <div key={idx} className="rf-check-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ color: '#E06C55', fontSize: '13px', lineHeight: '20px', fontWeight: 700, flexShrink: 0 }}>
                      ✕
                    </div>
                    <span style={{ fontSize: '12.5px', color: '#B5AEA3', lineHeight: '20px', textTransform: 'uppercase', letterSpacing: '0.02em', fontFamily: "'JetBrains Mono', monospace" }}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: With RelayForge */}
          <div className="rf-scroll-card rf-comparison-card rf-stagger-3" style={{
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
                fontSize: '16px',
                fontWeight: 700,
                color: '#F5F0E7',
                margin: '0 0 20px',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                WITH RELAYFORGE
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
                  <span style={{ fontSize: '10.5px', color: '#858078', fontWeight: 600, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>EVENT</span>
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
                  <span style={{ fontSize: '11px', color: '#F5F0E7', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>RELAYFORGE</span>
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
                  <span style={{ fontSize: '10.5px', color: '#858078', fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>YOUR SYSTEM</span>
                </div>
              </div>

              {/* 4 Advantages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  'DURABLE, MULTI-STEP WORKFLOWS',
                  'BUILT-IN RETRIES AND DEAD LETTER HANDLING',
                  'END-TO-END VISIBILITY AND TELEMETRY',
                  'SCALES RELIABLY WITH YOUR WORKLOAD',
                ].map((text, idx) => (
                  <div key={idx} className="rf-check-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ color: '#84CC16', fontSize: '14px', lineHeight: '20px', fontWeight: 700, flexShrink: 0 }}>
                      ✓
                    </div>
                    <span style={{ fontSize: '12.5px', color: '#F5F0E7', fontWeight: 600, lineHeight: '20px', textTransform: 'uppercase', letterSpacing: '0.02em', fontFamily: "'JetBrains Mono', monospace" }}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Impact Section: Better insights. Bigger impact. */}
        <div className="rf-impact-container" style={{ textAlign: 'center', margin: '76px auto 0', width: '100%', boxSizing: 'border-box' }}>
          <h2 className="rf-scroll-reveal rf-stagger-1" style={{
            fontSize: 'clamp(24px, 2.6vw, 36px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#F5F0E7',
            margin: '0 0 12px',
            textTransform: 'uppercase',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            BETTER INSIGHTS. BIGGER IMPACT.
          </h2>

          <p className="rf-scroll-reveal rf-stagger-2" style={{
            fontSize: 'clamp(12px, 1.05vw, 13.5px)',
            color: '#B5AEA3',
            lineHeight: 1.6,
            maxWidth: '580px',
            margin: '0 auto 36px',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            RELAYFORGE GIVES YOU THE RELIABILITY AND VISIBILITY TO TURN EVENTS INTO MEASURABLE BUSINESS OUTCOMES.
          </p>

          {/* 4 Metric Blocks */}
          <div className="rf-impact-metrics-row" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '18px',
            width: '100%',
          }}>
            {[
              {
                renderValue: () => (
                  <>
                    <AnimatedCounter value={8} duration={1000} />–<AnimatedCounter value={12} duration={1400} />×
                  </>
                ),
                label: 'HIGHER PROCESSING RELIABILITY',
              },
              {
                renderValue: () => (
                  <>
                    &lt; <AnimatedCounter value={300} duration={1400} /> MS
                  </>
                ),
                label: 'P99 PIPELINE LATENCY',
              },
              {
                renderValue: () => (
                  <>
                    <AnimatedCounter value={99.9} decimals={1} duration={1400} />%
                  </>
                ),
                label: 'AT-LEAST-ONCE DELIVERY',
              },
              {
                renderValue: () => (
                  <AnimatedCounter value={0} duration={1000} />
                ),
                label: 'EVENT LOSS UNDER RETRIES',
              },
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
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#F5F0E7', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                  {metric.renderValue()}
                </div>
                <div style={{ fontSize: '11.5px', color: '#858078', fontWeight: 600, lineHeight: 1.4, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'JetBrains Mono', monospace" }}>
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
          <div className="rf-demo-content-col" style={{ textAlign: 'left', zIndex: 2 }}>
            <div className="rf-scroll-reveal rf-stagger-1" style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#858078',
              marginBottom: '14px',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              SEE IT IN ACTION
            </div>

            <h3 className="rf-scroll-reveal rf-stagger-2" style={{
              fontSize: 'clamp(26px, 3vw, 38px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: '#F5F0E7',
              margin: '0 0 18px',
              textTransform: 'uppercase',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              SEE RELAYFORGE<br />
              IN ACTION
            </h3>

            <p className="rf-scroll-reveal rf-stagger-3" style={{
              fontSize: 'clamp(12px, 1.05vw, 13.5px)',
              color: '#B5AEA3',
              lineHeight: 1.6,
              maxWidth: '430px',
              margin: '0 0 32px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              EXPLORE A LIVE DEMO TO SEE HOW EVENTS FLOW THROUGH WORKFLOWS, RETRIES, AND DELIVERY WITH FULL VISIBILITY.
            </p>

            <div className="rf-scroll-reveal rf-stagger-4" style={{ display: 'inline-block' }}>
              <button
                onClick={() => { setAuthMode('signup'); setModalOpen(true); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#EFE4D0',
                  color: '#0D0C0B',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 28px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontFamily: "'JetBrains Mono', monospace",
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
                GET DEMO
              </button>
            </div>
          </div>

          {/* Right Geometric Illustration: 3D Isometric Cube Matching Reference */}
          <div className="rf-demo-illustration-col rf-scroll-reveal rf-stagger-3" style={{
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
                <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.04em', color: '#F5F0E7', fontFamily: "'JetBrains Mono', monospace" }}>
                  RELAYFORGE
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: '#858078', lineHeight: 1.55, marginTop: '14px', maxWidth: '300px', textTransform: 'uppercase', letterSpacing: '0.02em', fontFamily: "'JetBrains Mono', monospace" }}>
                A DURABLE EVENT PROCESSING PLATFORM FOR RELIABLE, SCALABLE SYSTEMS.
              </p>
            </div>

            {/* Product Column */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F5F0E7', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'JetBrains Mono', monospace" }}>
                PRODUCT
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'JetBrains Mono', monospace" }}>
                <a href="#rf-metrics-section" style={{ color: '#858078', textDecoration: 'none', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>FEATURES</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>INTEGRATIONS</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>CHANGELOG</a>
              </div>
            </div>

            {/* Solutions Column */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F5F0E7', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'JetBrains Mono', monospace" }}>
                SOLUTIONS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'JetBrains Mono', monospace" }}>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>ORDER PROCESSING</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>NOTIFICATIONS</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>DATA SYNC</a>
              </div>
            </div>

            {/* Resources Column */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F5F0E7', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'JetBrains Mono', monospace" }}>
                RESOURCES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'JetBrains Mono', monospace" }}>
                <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: '#858078', textDecoration: 'none', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>DOCS</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>GUIDES</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>API REFERENCE</a>
              </div>
            </div>

            {/* Company Column */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F5F0E7', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'JetBrains Mono', monospace" }}>
                COMPANY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'JetBrains Mono', monospace" }}>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>ABOUT</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>PRICING</a>
                <a onClick={() => setModalOpen(true)} role="button" style={{ color: '#858078', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#F5F0E7'} onMouseLeave={e => e.currentTarget.style.color = '#858078'}>CONTACT</a>
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
            fontSize: '11px',
            color: '#666159',
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}>
            <div>
              &copy; {new Date().getFullYear()} RELAYFORGE. ALL RIGHTS RESERVED.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => setModalOpen(true)}>PRIVACY POLICY</span>
              <span>•</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setModalOpen(true)}>TERMS OF SERVICE</span>
              <span>•</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setModalOpen(true)}>SYSTEM STATUS</span>
            </div>
          </div>
        </footer>
      </section>

      {/* 5. SPLIT-PANE SIGN-IN / SIGN-UP MODAL (EXACT IMAGE 3 DESIGN) */}
      {modalOpen && (
        <div
          id="signin-modal-backdrop"
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 5, 6, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
            animation: 'rfFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            id="signin-modal-container"
            className="rf-signin-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#0c0c0e',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '26px',
              maxWidth: '840px',
              width: '100%',
              display: 'flex',
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
              position: 'relative',
              flexDirection: 'row',
              animation: 'rfModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setModalOpen(false)}
              aria-label="Close modal"
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#a1a1aa',
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
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#a1a1aa';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              }}
            >
              ×
            </button>

            {/* Left Column: Scanline Hands in Monochrome Arch */}
            <div className="rf-signin-modal-graphic" style={{
              flex: '1 1 48%',
              backgroundColor: '#000000',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '490px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src="/scanline-hands.png"
                alt="Scanline Hands in Monochrome Arch"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  display: 'block',
                }}
              />
              {/* Soft atmospheric gradient blend into right dark panel */}
              <div style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: 'linear-gradient(to right, transparent 65%, #0c0c0e 100%)',
              }} />
            </div>

            {/* Right Column: Form Panel */}
            <div className="rf-signin-modal-content" style={{
              flex: '1 1 52%',
              padding: '42px 42px 34px 38px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              textAlign: 'left',
              backgroundColor: '#0c0c0e',
              boxSizing: 'border-box',
            }}>
              {/* Monospace Uppercase Headline */}
              <h2 style={{
                fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Roboto Mono', monospace",
                fontSize: '21px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                lineHeight: 1.35,
                color: '#f4f4f6',
                textTransform: 'uppercase',
                margin: '0 0 22px 0',
              }}>
                {authMode === 'signup' ? (
                  <>
                    LET'S STAY IN TOUCH,<br />
                    SIGN UP
                  </>
                ) : (
                  <>
                    WELCOME BACK,<br />
                    LOG IN
                  </>
                )}
              </h2>

              {/* Social Login Buttons (GitHub & Google) */}
              <div className="rf-signin-social-row" style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                {/* Continue with GitHub Button */}
                <button
                  type="button"
                  onClick={handleGitHubSignIn}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: '#141416',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: '9999px',
                    padding: '10px 14px',
                    color: '#e4e4e7',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1c1c20';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#141416';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path>
                  </svg>
                  <span>Continue with GitHub</span>
                </button>

                {/* Continue with Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: '#f5eee3',
                    border: '1px solid #f5eee3',
                    borderRadius: '9999px',
                    padding: '10px 14px',
                    color: '#111113',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5eee3';
                    e.currentTarget.style.borderColor = '#f5eee3';
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* OR Horizontal Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '16px 0 16px',
                gap: '12px',
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: '#71717a',
                  letterSpacing: '0.12em',
                }}>
                  OR
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Email Field */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{
                    display: 'block',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10.5px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    color: '#a1a1aa',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                  }}>
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      backgroundColor: '#121215',
                      border: '1px solid rgba(255, 255, 255, 0.13)',
                      borderRadius: '9999px',
                      padding: '12px 20px',
                      fontSize: '13px',
                      color: '#f4f4f6',
                      outline: 'none',
                      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.06)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.13)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Password Field with Eye Toggle */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10.5px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    color: '#a1a1aa',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                  }}>
                    PASSWORD
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: '#121215',
                        border: '1px solid rgba(255, 255, 255, 0.13)',
                        borderRadius: '9999px',
                        padding: '12px 46px 12px 20px',
                        fontSize: '13px',
                        color: '#f4f4f6',
                        outline: 'none',
                        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.06)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.13)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#71717a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#e4e4e7'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#71717a'}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Validation / Status Error Banner */}
                {authError && (
                  <div style={{
                    fontSize: '12px',
                    color: '#f87171',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    marginBottom: '14px',
                    textAlign: 'center',
                  }}>
                    {authError}
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    backgroundColor: '#f5eee3',
                    color: '#111113',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '13px 20px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: 'uppercase',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 18px rgba(245, 238, 227, 0.15)',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: isLoading ? 0.75 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 22px rgba(255, 255, 255, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5eee3';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 18px rgba(245, 238, 227, 0.15)';
                  }}
                >
                  {isLoading ? 'PROCESSING...' : (authMode === 'signup' ? 'SIGN UP' : 'LOG IN')}
                </button>
              </form>

              {/* Switch Auth Mode Link in Footer */}
              <div style={{
                marginTop: '16px',
                textAlign: 'center',
                fontFamily: "'JetBrains Mono', monospace, sans-serif",
                fontSize: '12px',
                color: '#71717a',
              }}>
                {authMode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('login'); setAuthError(null); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#e4e4e7',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        marginLeft: '4px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#e4e4e7'}
                    >
                      LOG IN
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#e4e4e7',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        marginLeft: '4px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#e4e4e7'}
                    >
                      SIGN UP
                    </button>
                  </>
                )}
              </div>

              {/* Dev Mode Direct Token Fallback */}
              {isDev && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowManualInput(!showManualInput)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#52525b',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Direct Session Token Entry
                  </button>
                  {showManualInput && (
                    <form onSubmit={handleManualSubmit} style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Paste JWT session token"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        style={{
                          flex: 1,
                          backgroundColor: '#121215',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '9999px',
                          padding: '8px 14px',
                          fontSize: '11px',
                          color: '#f4f4f6',
                          outline: 'none',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#f5eee3',
                          border: 'none',
                          color: '#111113',
                          borderRadius: '9999px',
                          padding: '8px 14px',
                          fontSize: '11px',
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
          transform: translateY(32px);
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
          transform: translateY(42px) scale(0.975);
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
        .rf-stagger-1 { transition-delay: 0.05s !important; }
        .rf-stagger-2 { transition-delay: 0.12s !important; }
        .rf-stagger-3 { transition-delay: 0.19s !important; }
        .rf-stagger-4 { transition-delay: 0.26s !important; }
        .rf-stagger-5 { transition-delay: 0.33s !important; }
        .rf-stagger-6 { transition-delay: 0.40s !important; }
        .rf-stagger-7 { transition-delay: 0.47s !important; }
        .rf-stagger-8 { transition-delay: 0.54s !important; }

        /* Checklist item entrance when card enters view */
        @keyframes rfItemFadeUp {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .rf-scroll-card.rf-in-view .rf-check-item {
          animation: rfItemFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .rf-scroll-card.rf-in-view .rf-check-item:nth-child(1) { animation-delay: 0.18s; }
        .rf-scroll-card.rf-in-view .rf-check-item:nth-child(2) { animation-delay: 0.26s; }
        .rf-scroll-card.rf-in-view .rf-check-item:nth-child(3) { animation-delay: 0.34s; }
        .rf-scroll-card.rf-in-view .rf-check-item:nth-child(4) { animation-delay: 0.42s; }

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
          .rf-hero-fold-wrapper {
            min-height: auto !important;
            display: block !important;
          }
          .rf-hero-headline {
            font-size: clamp(22px, 6vw, 30px) !important;
            line-height: 1.2 !important;
            margin-bottom: 24px !important;
          }
          .rf-headline-line-1, .rf-headline-line-2 {
            display: block !important;
            white-space: normal !important;
          }
          .rf-hero-desc {
            font-size: 15px !important;
            line-height: 1.55 !important;
            margin-bottom: 28px !important;
          }
          .rf-hero-dashboard-col {
            margin-top: 28px !important;
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
            max-width: 440px !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
            border-radius: 20px !important;
          }
          .rf-signin-modal-graphic {
            display: flex !important;
            min-height: 160px !important;
            max-height: 180px !important;
            flex: none !important;
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          }
          .rf-signin-modal-content {
            padding: 24px 20px 22px !important;
            flex: none !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
        }

        @keyframes rfFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes rfModalPop {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* 6. Narrow Mobile Devices (<= 480px) */
        @media (max-width: 480px) {
          .rf-signin-social-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
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
