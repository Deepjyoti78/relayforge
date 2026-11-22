# RelayForge Production Security Review & Hardening Guide

## Scope and evidence

This guide describes selected implementation controls, not a production security
certification. See the [current authentication review](auth-security-review.txt),
[tenancy model](tenancy.md) and [release checklist](auth-release-checklist.txt).
Local results do not certify live OAuth consent, hosting policy or deployed credentials.

## 1. Authentication and sessions

### 1.1 Google/GitHub OAuth with browser-bound state and PKCE

State and PKCE verifiers are stored in PostgreSQL `oauth_states`, with a ten-minute
expiry. A provider-specific HttpOnly Lax cookie contains the state hash; production
adds Secure and a __Host- name. The callback verifies browser binding before provider
exchange, clears matching cookies and consumes state before exchanging the code.
Provider denial removes matching state. Same-provider attempts replace the cookie;
only the latest can finish. External identities use Google sub or GitHub numeric ID.
New-user workspace creation sets the transaction-local user identity before RLS writes.

A supplied frontend `redirect_uri` must match the exact configured FRONTEND_URL
origin (scheme/host/port), without userinfo. Invalid values fall back to FRONTEND_URL;
saved destinations are revalidated during callback. This is URL comparison, not a
cryptographic redirect signature. Provider callback URLs are independently configured.

### 1.2 Session and browser policy

Session tokens are opaque random values; PostgreSQL stores their SHA-256 hashes.
Browser OAuth sends them only in host-only HttpOnly cookies, never URL parameters,
localStorage or cross-window messages. The server still accepts VALID opaque session
tokens in Authorization: Bearer in production/staging; invalid-token rejection does
not prove cookie-only authentication. The development manual-token UI is memory-only.

Cookie Secure follows NODE_ENV=production. SESSION_COOKIE_SAME_SITE=lax|none chooses
policy; omitted means Lax in development/test and None in production for compatibility.
Explicit none requires production Secure. Recommend lax with same-site custom domains
or a same-origin proxy. Cookie mutations additionally require the exact frontend
Origin, or trusted Referer only when Origin is absent. Missing/untrusted sources fail
closed. CORS permits only the configured frontend origin. None cannot override browser
third-party-cookie blocking on distinct default Render/Cloudflare hosts.

Sessions expire after a fixed seven days. Activity updates do not renew them, and no
refresh endpoint exists. /v1/me and logout disable caching. Invalid/revoked/expired
cookies receive 401 and are cleared; successful logout revokes and clears with the
same options. Network/5xx logout failures remain visible rather than simulating logout.
Both SSE aliases check membership and bound connections to 30 seconds or earlier
session expiry; automatic reconnect reauthorizes. Revocation is not instantaneous.

### 1.3 API Key Architecture
- **Prefix + High Entropy Token:** API keys are generated as `rf_live_<random_bytes>`.
- **One-Way SHA-256 Hashing:** The database only stores the SHA-256 digest of the key and the display prefix (`rf_live_...`). Plaintext keys are presented exactly once upon generation.
- **Instant Revocation:** Revoking an API key instantly invalidates the database row within the tenant's transaction boundary, rejecting subsequent ingestion immediately.

---

## 2. Multi-Tenant Isolation & Row-Level Security (RLS)

### 2.1 PostgreSQL RLS Enforcement
- **Transaction-local context:** Tenant operations set `app.current_org_id` and `app.current_user_id`; user-scoped operations clear the organization value. Global OAuth/session lookups do not use tenant context.
- **Least-Privilege Roles:**
  - `relayforge_api`: Operates with standard role permissions subject to strict RLS policies on all tenant tables (`organizations`, `memberships`, `endpoints`, `destinations`, `events`, `outbox_messages`, `delivery_attempts`, `workflows`, `workflow_executions`).
  - `relayforge_worker`: Runs background delivery, leased state updates, and rate limiting with specific leased outbox permissions.
  - Migration/schema-owner credentials belong only in an authorized provisioning/migration context, never API/worker runtime. Production migration roles need not be superusers; the local test bootstrap uses an administrator.
- **Deployment boundary:** RLS and service authorization depend on correct role grants. DatabaseService currently warns about administrative/BYPASSRLS roles rather than refusing startup; do not treat startup or a healthy response as evidence of least privilege.

### 2.2 Role-Based Access Control (RBAC)
- Each organization member is assigned an explicit role (`OWNER`, `DEVELOPER`, `VIEWER`).
- Mutating actions (API key creation/revocation, destination registration, endpoint deletion, workflow publishing) require `OWNER` or `DEVELOPER` permissions.
- Management uses user sessions and organization roles. API-key ingestion and webhook ingress are separate paths. IngestionService verifies a webhook signature when a signature header is supplied; this guide does not claim every ingress request requires HMAC.

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
- Current records contain ciphertext, IV and tag under one configured ENCRYPTION_KEY. No versioned key ring or automated re-encryption workflow is implemented; changing the key can make stored secrets unreadable. Operational rotation needs a separately reviewed migration plan.

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

## Release limitations that remain open

- The Prisma/Effect advisory still fails the vulnerability gate; this PR changes no existing dependency versions.
- Live provider consent, exact callback registrations, production TLS and hosting cookie behavior remain manual acceptance checks.
- DatabaseService disables certificate verification for detected cloud/pooler connections; RedisService disables it for rediss connections. Encryption alone is not certificate authentication. This existing behavior needs a separate transport-security fix and deployment verification.
- render.yaml copies the API DATABASE_URL into WORKER_DATABASE_URL. Separate restricted identities must be provisioned and verified; staging-db-init.cjs can swallow failures and is not proof that roles/grants or runtime URLs are correct.
- Previously exposed production sessions were not revoked. No live secrets, sessions or deployment settings were changed during this review.
