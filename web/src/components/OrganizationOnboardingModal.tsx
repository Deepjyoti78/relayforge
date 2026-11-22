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

const WORKLOAD_TYPES = [
  {
    id: 'fintech',
    title: 'Fintech & Transactional Banking',
    badge: 'PCI-DSS',
    desc: 'Strict idempotency guarantees, zero data loss, sub-second ledger and payout webhooks.',
  },
  {
    id: 'saas',
    title: 'SaaS & Cloud Microservices',
    badge: 'EVENT-DRIVEN',
    desc: 'High-throughput fanout, multi-tenant workspace separation, automated retry escalation.',
  },
  {
    id: 'ecommerce',
    title: 'E-Commerce & High-Volume Retail',
    badge: 'SURGE-PROOF',
    desc: 'Buffered ingest during flash sales, automated order sync, Shopify & Stripe pipelines.',
  },
  {
    id: 'ai-agents',
    title: 'AI Agents & Bounded Workflows',
    badge: 'STEP DURABILITY',
    desc: 'Multi-step stateful LLM tool execution, webhook callbacks, long-running agentic tasks.',
  },
  {
    id: 'healthcare',
    title: 'Healthcare & Telehealth Data Relays',
    badge: 'HIPAA-READY',
    desc: 'Encrypted payload transit, strict audit logging, automated failover into dead-letter queues.',
  },
];

const ARCHITECTURE_TIERS = [
  {
    id: 'zero-drop',
    name: 'High-Assurance Transactional Outbox (Recommended)',
    desc: 'ACID-guaranteed delivery via PostgreSQL SKIP LOCKED leases with Dead-Letter recovery.',
  },
  {
    id: 'low-latency',
    name: 'Ultra-Low Latency Direct Relay',
    desc: 'Optimized for sub-50ms dispatch to private VPC endpoints and edge webhooks.',
  },
  {
    id: 'fifo-workflows',
    name: 'Strict FIFO Sequential Bounded Workflows',
    desc: 'Enforces strict step execution order with idempotency keys and step-level timeouts.',
  },
];

const VOLUME_TIERS = [
  { id: 'starter', label: '< 100k events / mo', sub: 'Standard SLA' },
  { id: 'scale', label: '100k – 2.5M events / mo', sub: 'High Concurrency' },
  { id: 'enterprise', label: '2.5M+ events / mo', sub: 'Dedicated Isolation' },
];

export const OrganizationOnboardingModal: React.FC<OrganizationOnboardingModalProps> = ({
  isOpen,
  userDisplayName,
  onComplete,
  onSkip,
}) => {
  const [orgName, setOrgName] = useState(userDisplayName ? `${userDisplayName}'s Org` : '');
  const [customSlug, setCustomSlug] = useState('');
  const [selectedWorkload, setSelectedWorkload] = useState('fintech');
  const [selectedTier, setSelectedTier] = useState('zero-drop');
  const [selectedVolume, setSelectedVolume] = useState('scale');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: '#0A0A0A',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '16px',
          padding: '36px',
          color: '#FFFFFF',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.04)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                letterSpacing: '0.12em',
                color: '#A1A1AA',
                textTransform: 'uppercase',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              Workspace Setup
            </span>
            <span style={{ fontSize: '12px', color: '#71717A' }}>•</span>
            <span style={{ fontSize: '12px', color: '#71717A' }}>Multi-Tenant Architecture</span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
            Create Your Production Organization
          </h2>
          <p style={{ fontSize: '13.5px', color: '#A1A1AA', marginTop: '6px', lineHeight: 1.5 }}>
            Configure your tenant namespace, industry workload parameters, and delivery resilience settings before entering the RelayForge developer console.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#F87171',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Question 1: Organization Name */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#E4E4E7', marginBottom: '8px' }}>
              1. Organization or Company Name <span style={{ color: '#F87171' }}>*</span>
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Acme Financial, Stripe Relays, CloudHealth"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                backgroundColor: '#121214',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#FFFFFF')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
            />
          </div>

          {/* Question 2: Workspace Identifier / Slug */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#E4E4E7', marginBottom: '6px' }}>
              2. Workspace Slug / URL Namespace
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#121214',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <span style={{ padding: '0 12px', fontSize: '13px', color: '#71717A', fontFamily: 'monospace' }}>
                relayforge.dev/org/
              </span>
              <input
                type="text"
                value={customSlug || generatedSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="acme-corp"
                style={{
                  flex: 1,
                  padding: '12px 14px 12px 0',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>
            <p style={{ fontSize: '11.5px', color: '#71717A', marginTop: '5px', marginBottom: 0 }}>
              Unique tenant isolation key used in webhook ingestion endpoints and API key scopes.
            </p>
          </div>

          {/* Question 3: Workload & Industry Domain */}
          <div style={{ marginBottom: '26px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#E4E4E7', marginBottom: '10px' }}>
              3. Select Primary Workload & Industry Domain <span style={{ color: '#F87171' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {WORKLOAD_TYPES.map((type) => {
                const isSelected = selectedWorkload === type.id;
                return (
                  <div
                    key={type.id}
                    onClick={() => setSelectedWorkload(type.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.1)'}`,
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.05)' : '#121214',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 500, color: isSelected ? '#FFFFFF' : '#E4E4E7' }}>
                          {type.title}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
                            color: isSelected ? '#000000' : '#A1A1AA',
                            fontWeight: 600,
                          }}
                        >
                          {type.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#71717A', lineHeight: 1.4 }}>{type.desc}</div>
                    </div>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)'}`,
                        backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                        marginLeft: '12px',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question 4: Architecture Tier */}
          <div style={{ marginBottom: '26px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#E4E4E7', marginBottom: '8px' }}>
              4. Delivery Engine Resilience Architecture
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ARCHITECTURE_TIERS.map((tier) => {
                const isSelected = selectedTier === tier.id;
                return (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.08)'}`,
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.04)' : '#121214',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500, color: isSelected ? '#FFFFFF' : '#D4D4D8' }}>
                      {tier.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#71717A', marginTop: '2px' }}>{tier.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question 5: Estimated Volume */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#E4E4E7', marginBottom: '8px' }}>
              5. Projected Monthly Webhook Scale
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {VOLUME_TIERS.map((v) => {
                const isSelected = selectedVolume === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVolume(v.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.1)'}`,
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.06)' : '#121214',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: isSelected ? '#FFFFFF' : '#D4D4D8' }}>
                      {v.label}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#71717A', marginTop: '2px', fontFamily: 'monospace' }}>
                      {v.sub}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#71717A',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '8px 12px',
                }}
              >
                Skip to Default Console →
              </button>
            ) : <div />}

            <button
              type="submit"
              disabled={isSubmitting || !orgName.trim()}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#000000',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '13.5px',
                fontWeight: 600,
                letterSpacing: '0.02em',
                cursor: isSubmitting || !orgName.trim() ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || !orgName.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'opacity 0.15s ease',
              }}
            >
              {isSubmitting ? 'PROVISIONING WORKSPACE...' : 'LAUNCH WORKSPACE & OPEN CONSOLE →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
