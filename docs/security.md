# RelayForge Security Architecture & SSRF Hardening

## 1. SSRF Egress Defense-in-Depth

RelayForge contacts arbitrary user-configured webhook target destinations over HTTP/HTTPS. To protect cloud infrastructure, internal service meshes, and link-local services against Server-Side Request Forgery (SSRF), multiple defense layers are strictly enforced.

### Protocol Enforcement
Only `http:` and `https:` schemes are permitted. File schemes (`file:`), raw sockets, internal pipes, and gopher schemes are rejected at registration and dispatch time.

### IP Range & Cloud Metadata Blocking
Destination hostnames and raw IP addresses are resolved and checked against comprehensive denylists:
- **Loopback:** `127.0.0.0/8`, `::1`
- **RFC 1918 Private IPv4:** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- **Link-Local & Cloud Metadata:** `169.254.0.0/16` (including `169.254.169.254` AWS/GCP/Azure instance metadata), `fe80::/10`
- **CGNAT:** `100.64.0.0/10`
- **Reserved & Future:** `0.0.0.0/8`, `240.0.0.0/4`, `255.255.255.255`
- **IPv6 Unique Local & Special:** `fc00::/7`, `ff00::/8`, `::ffff:0:0/96` (IPv4-mapped IPv6)
- **Forbidden Hostnames:** `localhost`, `metadata.google.internal`, `instance-data`

### Multi-IP Resolution (Dual-Homed Hosts)
If a hostname resolves to multiple DNS A/AAAA records and **any** single address falls into a prohibited range, the entire destination is rejected immediately.

---

## 2. DNS Rebinding (TOCTOU) Elimination

### The Problem
Traditional SSRF validators resolve DNS, check that the IP address is public, and then invoke `fetch(url)`. An attacker can configure a malicious authoritative DNS server that returns a public IP on the first resolution (TTL 0) and loopback (`127.0.0.1`) on the second resolution made by `fetch()`. This Time-of-Check to Time-of-Use window permits full SSRF bypass.

### The Solution: Pinned Socket Connector
RelayForge decouples hostname validation from DNS resolution by pinning the actual outbound TCP socket connection:
1. `validateDestinationUrl()` resolves DNS and validates all addresses.
2. The validated IP address is passed to `createPinnedDispatcher(pinnedIp)`.
3. A custom `undici.Agent` connector forces socket creation directly to `pinnedIp`.
4. The original target hostname is preserved in the TLS Server Name Indication (SNI) and the HTTP `Host` header, preserving full TLS certificate verification without triggering secondary DNS resolutions.
5. Connection pooling pipelining is disabled (`pipelining: 0`) and agents are cleanly destroyed after request lifecycle completion.

---

## 3. Prohibition of Automatic HTTP Redirects

### The Vulnerability
If an outbound webhook request automatically follows HTTP redirects (301, 302, 303, 307, 308), a public destination could return a redirect to `http://169.254.169.254/latest/meta-data` or `http://127.0.0.1:5432`. Furthermore, user authentication headers and HMAC signing headers could be leaked to the redirected third party.

### The Enforcement
- All delivery requests specify `redirect: 'manual'`.
- Status codes in the 3xx range are treated as **delivery failures**.
- The `Location` header is recorded for telemetry, but the redirected URL is **never** automatically contacted.
- No HMAC signatures, payloads, or authentication headers are ever sent to an unvalidated redirected location.

---

## 4. Multi-Tenant Row-Level Security (RLS)

- PostgreSQL 17 Row-Level Security is active on all tenant-facing tables (`organizations`, `memberships`, `api_keys`, `endpoints`, `events`, `destinations`, `outbox_messages`, `delivery_attempts`).
- Isolation is enforced inside PostgreSQL via `app.current_organization_id` session settings.
- Bypassing application code cannot leak records across tenant boundaries because the PostgreSQL engine itself discards unauthorized rows at the storage layer.
