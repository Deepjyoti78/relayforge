# RelayForge Production Security Review & Hardening Guide

## Executive Summary

RelayForge is an enterprise-grade webhook delivery gateway and sequential workflow orchestration platform. Because RelayForge is positioned as an intermediary between untrusted inbound webhook traffic and arbitrary third-party outbound HTTP endpoints, security is designed from a zero-trust model across all layers.

This document records the independent security architecture verification across:
1. Authentication & Session Management
2. Multi-Tenant Isolation & Row-Level Security (RLS)
3. Outbound SSRF & DNS Rebinding Elimination
4. Cryptographic Storage & Ingestion Verification
5. Delivery Correctness & Concurrency Fencing

---

## 1. Authentication & Session Management

### 1.1 GitHub OAuth 2.0 with PKCE
- **PKCE Verification:** Inbound OAuth state uses cryptographically generated random nonces and PKCE code verifiers stored in transient Redis or cryptographically signed session tokens.
- **Callback URL Strict Validation:** The OAuth callback handler strictly rejects unapproved `redirect_uri` parameters, enforcing protocol matching and origin validation to eliminate open redirect vectors.
- **Account Linking & Provisioning:** User accounts linked via GitHub identities are tied to immutable GitHub IDs. Email addresses are treated as secondary verified identifiers.

### 1.2 Session Token Security
- **Disabled Direct Token Injection:** Direct session token entry / Bearer token authentication is strictly disabled server-side in production and staging environments (`NODE_ENV === 'production'`). Browser sessions must be established exclusively via the secure HttpOnly cookie from verified OAuth callbacks.
- **OAuth Open Redirect Defense:** `createAuthorizationUrl` cryptographically validates all `redirect_uri` parameters against the configured frontend origin, strictly rejecting untrusted external domains.
- **Cookie Flags:**
  - `HttpOnly`: Always enforced; JavaScript running in the browser cannot read session cookies.
  - `SameSite=Lax`: Prevents Cross-Site Request Forgery (CSRF) on mutating requests while permitting top-level navigation.
  - `Secure`: Conditionally enforced based on HTTPS protocol, mandatory in `NODE_ENV=production`.
- **Database Hashing:** Session tokens are hashed via SHA-256 before storage and lookup, preventing database leakage from exposing active session tokens.

### 1.3 API Key Architecture
- **Prefix + High Entropy Token:** API keys are generated as `rf_live_<random_bytes>`.
- **One-Way SHA-256 Hashing:** The database only stores the SHA-256 digest of the key and the display prefix (`rf_live_...`). Plaintext keys are presented exactly once upon generation.
- **Instant Revocation:** Revoking an API key instantly invalidates the database row within the tenant's transaction boundary, rejecting subsequent ingestion immediately.

---

## 2. Multi-Tenant Isolation & Row-Level Security (RLS)

### 2.1 PostgreSQL RLS Enforcement
- **Session Variable `app.current_org_id`:** Every database transaction initiated by the API sets `SET LOCAL app.current_org_id = :orgId`.
- **Least-Privilege Roles:**
  - `relayforge_api`: Operates with standard role permissions subject to strict RLS policies on all tenant tables (`organizations`, `organization_members`, `endpoints`, `destinations`, `events`, `outbox_messages`, `delivery_attempts`, `workflows`, `workflow_executions`).
  - `relayforge_worker`: Runs background delivery, leased state updates, and rate limiting with specific leased outbox permissions.
  - `relayforge_admin`: Superuser used exclusively for migrations and schema provisioning.
- **Query Safeguards:** Application queries explicitly include `WHERE org_id = :orgId` as defense-in-depth, preventing cross-tenant data access even in the event of an RLS policy misconfiguration.

### 2.2 Role-Based Access Control (RBAC)
- Each organization member is assigned an explicit role (`OWNER`, `DEVELOPER`, `MEMBER`).
- Mutating actions (API key creation/revocation, destination registration, endpoint deletion, workflow publishing) require `OWNER` or `DEVELOPER` permissions.
- Ingestion endpoints accept webhook payloads authenticated via scoped API keys or HMAC signatures.

---

## 3. Outbound SSRF & DNS Rebinding Elimination

### 3.1 Socket-Level IP Pinning
Standard DNS resolution checks before `fetch()` suffer from Time-Of-Check to Time-Of-Use (TOCTOU) DNS rebinding, where a malicious DNS server returns a benign public IP on first lookup and `127.0.0.1` on the second lookup.

RelayForge resolves this via custom `undici` connector socket pinning:
1. Destination hostname is resolved using `dns.promises.lookup({ all: true })`.
2. Every returned IPv4 and IPv6 address is evaluated against strict prohibited ranges.
3. The HTTP connection is initiated directly to a validated IP address.
4. The original hostname is retained for HTTP `Host` header formatting and TLS Server Name Indication (SNI) validation.
5. If the destination domain alters its DNS resolution during flight, the pinned connection socket is strictly decoupled from untrusted resolutions.

### 3.2 Prohibited Address Ranges
The SSRF filter categorically forbids:
- IPv4 Loopback: `127.0.0.0/8`
- IPv4 RFC1918 Private: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- IPv4 Carrier-Grade NAT: `100.64.0.0/10`
- IPv4 Link-Local & Cloud Metadata: `169.254.0.0/16` (including AWS/GCP/Azure `169.254.169.254`)
- IPv4 Multicast & Broadcast: `224.0.0.0/4`, `255.255.255.255/32`
- IPv6 Loopback & Unspecified: `::1`, `::`
- IPv6 Unique Local: `fc00::/7`
- IPv6 Link-Local: `fe80::/10`
- IPv6 Cloud Metadata: `fd00:ec2::254`
- IPv4-Mapped IPv6: `::ffff:127.0.0.1`, `::ffff:169.254.169.254`, etc.

### 3.3 Manual HTTP Redirect Handling
Automatic HTTP redirects (`301`, `302`, `303`, `307`, `308`) are explicitly disabled via `redirect: 'manual'`.
- RelayForge never follows HTTP redirects automatically.
- Redirects are recorded as non-terminal or diagnostic outcomes.
- Prevents malicious destinations from redirecting an outbound request to internal intranet resources or cloud metadata services.

---

## 4. Cryptographic Storage & Ingestion Verification

### 4.1 Inbound HMAC-SHA256 Signature Verification
- Inbound webhooks signed with HMAC-SHA256 are verified using `crypto.timingSafeEqual` to avoid timing side-channel attacks.
- Signatures incorporate UNIX timestamps (`t=...`) with a configurable drift tolerance window (default 300 seconds) to prevent replay attacks.

### 4.2 AES-256-GCM Secret Encryption
- Destination signing secrets and endpoint credentials are encrypted using AES-256-GCM.
- Each encrypted secret includes:
  - 96-bit unique cryptographically secure initialization vector (IV).
  - 128-bit authentication tag ensuring ciphertext integrity.
- Encrypted blobs stored in PostgreSQL cannot be deciphered or tampered with without the master key.
- Key rotation is supported through versioned envelope encryption headers.

---

## 5. Delivery Correctness & Concurrency Fencing

### 5.1 Fenced Worker Leases
- Outbox messages are claimed using pessimistic row-level locking: `SELECT ... FOR UPDATE SKIP LOCKED`.
- Workers claim batches with a monotonic lease expiration timestamp and unique worker lease token.
- Mutating worker transactions verify that the lease token matches before committing delivery state or scheduling retries:
  ```sql
  UPDATE outbox_messages
  SET status = 'DELIVERED', completed_at = NOW()
  WHERE id = :id AND lease_token = :leaseToken;
  ```
- If a worker crashes or encounters an extended network partition, its lease safely expires. A healthy worker recovers the stale lease without race conditions.

### 5.2 Exponential Backoff with Bounded Jitter
- Retries use exponential backoff: `delay = min(max_delay, base_delay * 2^(attempt - 1)) + jitter`.
- Full jitter uniformly distributes retries across `[0, delay]` to eliminate thundering herd spikes against downstream destinations.
- Upstream `Retry-After` headers are parsed and respected when within safe bounds.
