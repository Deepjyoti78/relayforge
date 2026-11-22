import React, { useState } from 'react';

interface OrganizationOnboardingModalProps {
  isOpen: boolean;
  userDisplayName?: string | null;
  userEmail?: string | null;
  onComplete: (orgData: {
    name: string;
    slug?: string;
    workloadType: string;
    architectureTier: string;
    estimatedVolume: string;
  }) => Promise<void>;
  onSkip?: () => void;
}

const WORKLOAD_OPTIONS = [
  { id: 'fintech', label: 'Fintech & Transactional Banking (PCI-DSS)' },
  { id: 'saas', label: 'SaaS & Cloud Microservices (Event-Driven)' },
  { id: 'ecommerce', label: 'E-Commerce & High-Volume Retail (Surge-Proof)' },
  { id: 'ai-agents', label: 'AI Agents & Durable Workflows' },
  { id: 'healthcare', label: 'Healthcare & Telehealth Relays (HIPAA-Ready)' },
];

const ARCHITECTURE_OPTIONS = [
  { id: 'zero-drop', label: 'Transactional Outbox (Recommended)' },
  { id: 'low-latency', label: 'Low-Latency Direct Relay' },
  { id: 'fifo-workflows', label: 'Strict FIFO Sequential Workflows' },
];

const VOLUME_OPTIONS = [
  { id: 'starter', label: '< 100k events/mo' },
  { id: 'scale', label: '100k – 2.5M events/mo' },
  { id: 'enterprise', label: '2.5M+ events/mo' },
];

export const OrganizationOnboardingModal: React.FC<OrganizationOnboardingModalProps> = ({
  isOpen,
  userDisplayName,
  onComplete,
  onSkip,
}) => {
  const [orgName, setOrgName] = useState(userDisplayName ? `${userDisplayName}'s Org` : '');
  const [customSlug, setCustomSlug] = useState('');
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [selectedWorkload, setSelectedWorkload] = useState('fintech');
  const [selectedTier, setSelectedTier] = useState('zero-drop');
  const [selectedVolume, setSelectedVolume] = useState('scale');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (userDisplayName && !orgName) {
      setOrgName(`${userDisplayName}'s Org`);
    }
  }, [userDisplayName]);

  if (!isOpen) return null;

  const generatedSlug = (customSlug || orgName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setErrorMessage('Please enter an organization name.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onComplete({
        name: orgName.trim(),
        slug: generatedSlug || undefined,
        workloadType: selectedWorkload,
        architectureTier: selectedTier,
        estimatedVolume: selectedVolume,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to provision organization.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#0A0A0A',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '14px',
          padding: '24px 26px',
          color: '#FFFFFF',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '10px',
                letterSpacing: '0.12em',
                color: '#A1A1AA',
                textTransform: 'uppercase',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '2px 6px',
                borderRadius: '3px',
              }}
            >
              WORKSPACE SETUP
            </span>
            <span style={{ fontSize: '11px', color: '#52525B' }}>• Multi-Tenant Namespace</span>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: '#FFFFFF' }}>
            Create Your Organization
          </h2>
          <p style={{ fontSize: '12.5px', color: '#71717A', marginTop: '4px', marginBottom: 0, lineHeight: 1.4 }}>
            Configure your workspace namespace and delivery engine profile.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#F87171',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Organization Name & Slug */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#D4D4D8', marginBottom: '6px' }}>
              Organization Name <span style={{ color: '#F87171' }}>*</span>
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Acme Relays"
              required
              autoFocus
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: '#121214',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#FFFFFF')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
            />

            {/* Inline Slug Preview & Edit */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '5px',
                fontSize: '11px',
                color: '#71717A',
                fontFamily: 'monospace',
              }}
            >
              <span>
                Namespace: <span style={{ color: '#A1A1AA' }}>relayforge.dev/org/{isEditingSlug ? '' : (generatedSlug || 'my-org')}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingSlug(!isEditingSlug)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#A1A1AA',
                  fontSize: '10px',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {isEditingSlug ? 'Done' : 'Customize'}
              </button>
            </div>

            {isEditingSlug && (
              <input
                type="text"
                value={customSlug || generatedSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="custom-slug"
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '6px 10px',
                  backgroundColor: '#161618',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: '#FFFFFF',
                  fontSize: '11.5px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* Industry Workload Dropdown */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#D4D4D8', marginBottom: '6px' }}>
              Workload Profile
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedWorkload}
                onChange={(e) => setSelectedWorkload(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: '#121214',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                }}
              >
                {WORKLOAD_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} style={{ backgroundColor: '#18181B', color: '#FFFFFF' }}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  fontSize: '10px',
                  color: '#71717A',
                }}
              >
                ▼
              </div>
            </div>
          </div>

          {/* 2-Column Compact Row: Architecture Tier & Scale */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '22px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#A1A1AA', marginBottom: '5px' }}>
                Engine Tier
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#121214',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '11.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                >
                  {ARCHITECTURE_OPTIONS.map((tier) => (
                    <option key={tier.id} value={tier.id} style={{ backgroundColor: '#18181B', color: '#FFFFFF' }}>
                      {tier.label}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    fontSize: '9px',
                    color: '#71717A',
                  }}
                >
                  ▼
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: '#A1A1AA', marginBottom: '5px' }}>
                Monthly Scale
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedVolume}
                  onChange={(e) => setSelectedVolume(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#121214',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '11.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                >
                  {VOLUME_OPTIONS.map((vol) => (
                    <option key={vol.id} value={vol.id} style={{ backgroundColor: '#18181B', color: '#FFFFFF' }}>
                      {vol.label}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    fontSize: '9px',
                    color: '#71717A',
                  }}
                >
                  ▼
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#71717A',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#71717A')}
              >
                Skip for now
              </button>
            ) : <div />}

            <button
              type="submit"
              disabled={isSubmitting || !orgName.trim()}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#000000',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontSize: '12.5px',
                fontWeight: 600,
                letterSpacing: '0.01em',
                cursor: isSubmitting || !orgName.trim() ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || !orgName.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'opacity 0.15s ease',
              }}
            >
              {isSubmitting ? 'Provisioning...' : 'Launch Workspace →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
