# Identity, sessions, and tenant isolation

This describes the authentication review branch. Release acceptance is separate:
see the [release checklist](auth-release-checklist.txt) and [security review](auth-security-review.txt).

## Google and GitHub sign-in

Both providers use authorization-code OAuth with PKCE S256. State and the verifier
are stored in PostgreSQL `oauth_states` for ten minutes, not Redis or signed session tokens.

1. `GET /auth/{google|github}/start` stores state/verifier and the resolved frontend
   destination. `redirect_uri` must match the exact `FRONTEND_URL` origin, including
   scheme and port, without userinfo. An invalid destination falls back to
   `FRONTEND_URL`; it is not an HTTP rejection.
2. The response sets a provider-specific, ten-minute HttpOnly cookie containing
   the state hash: `Path=/; SameSite=Lax`, plus `Secure` and a `__Host-` name in production.
3. The callback checks that browser cookie against query state before code exchange.
   Matching callbacks clear it; provider denial also deletes stored state. Missing,
   mismatched or wrong-provider state fails closed. A new attempt for the same
   provider replaces its binding cookie, so only the latest attempt can finish.
4. The service checks expiry and deletes state before exchanging the code with the
   stored verifier. Only successful deletion proceeds; replay/concurrent losing
   deletion fails. Saved frontend destinations are revalidated before returning.
5. External identities use Google `sub` or GitHub numeric ID. Google email matching
   requires `email_verified === true`. GitHub passes its public profile email or
   verified-email lookup result to matching. New-user provisioning sets transaction-
   local `app.current_user_id` before creating the workspace and OWNER membership.
6. A fresh opaque session goes only in the HttpOnly cookie. The redirect has no
   session token. Starts/callbacks disable caching and referrer transmission.

Source: [AuthController](../src/modules/auth/auth.controller.ts),
[cookie/state helpers](../src/modules/auth/auth-cookies.ts), and the two OAuth services.

## Sessions and request authorization

The token is 32 random bytes encoded as hex; PostgreSQL stores only its SHA-256 hash.
Expiry is fixed at seven days. Updating `lastActiveAt` does not extend it; there is
no rolling refresh endpoint. Session cookies are host-only, HttpOnly and Path=/.
Secure follows `NODE_ENV=production`. `SESSION_COOKIE_SAME_SITE=lax|none` selects
policy; omission preserves development/test Lax and production None. Explicit none
is rejected outside production. Prefer lax with same-site domains or a same-origin
proxy; None does not override third-party-cookie blocking.

The frontend uses credentials and validates `GET /v1/me` before authenticated rendering.
That endpoint returns identity/memberships with Cache-Control: no-store and no session
credentials. URLs/localStorage/messages are not authentication channels; legacy tokens
are discarded. The development manual-token UI retains tokens only in memory.

The server still accepts valid opaque sessions via `Authorization: Bearer ...` in
all environments; arbitrary JWTs are not supported. Cookies take precedence. Cookie
POST/PUT/PATCH/DELETE requests require the exact configured frontend Origin, or a
trusted Referer only when Origin is absent. Missing/untrusted sources fail closed.
Bearer-only clients need no CSRF origin; adding a bearer header cannot exempt cookie
authentication. Credentialed CORS trusts only the configured frontend origin.

Logout revokes the session and clears the cookie with matching options. Invalid,
expired or revoked cookie sessions receive 401 and a clearing cookie. The frontend
treats stale-session logout as signed out, but reports network/5xx logout failures
instead of pretending the server session was revoked.

## Organizations and PostgreSQL RLS

Roles are OWNER > DEVELOPER > VIEWER. Organization/member administration requires
OWNER. Resource configuration generally requires DEVELOPER or OWNER; VIEWER has read
access. Services reject demotion/removal of the final owner.

Tenant operations use transaction-local settings:

```sql
SELECT set_config('app.current_org_id', '<org_id>', true),
       set_config('app.current_user_id', '<user_id>', true);
```

User-scoped operations set the user and clear the organization. Settings reset at
transaction end. RLS applies to tenant tables, not every global identity/session table.
SECURITY DEFINER membership helpers avoid recursion; review their owner, search_path
and grants. Runtime roles must not own tenant tables or have superuser/BYPASSRLS.
Startup currently warns about unsafe roles rather than refusing them, so deployed
credentials require independent verification.

Both organization SSE aliases check authentication and membership before opening,
including VIEWER access. Connections end within 30 seconds or earlier captured session
expiry. Native EventSource reconnect repeats the checks; revocation/removal is bounded
by the remaining connection lifetime, not instantaneous. No transaction stays open for SSE.

## Local provider setup

Use one hostname consistently. New defaults are frontend `http://localhost:5173`,
Google callback `http://localhost:3100/auth/google/callback` and GitHub callback
`http://localhost:3100/auth/github/callback`. Register the exact URLs with provider
apps and set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, both `*_CALLBACK_URL` variables and `FRONTEND_URL` locally.
Existing .env files are not automatically changed. For a proxy, use its public callback
URLs. See the [release configuration](auth-release-checklist.txt) for exact production names.
