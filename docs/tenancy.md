# Identity, Organizations, and Multi-Tenant Isolation

Milestone 2 establishes developer authentication, organization memberships, role-based access control, and database-enforced multi-tenant isolation via PostgreSQL Row-Level Security (RLS).

---

## 1. Authentication Architecture

RelayForge uses GitHub OAuth 2.0 with PKCE and server-side sessions.

### The Authentication Lifecycle

```
Developer Browser                RelayForge API                GitHub OAuth API
       |                               |                              |
       |--- GET /auth/github/start --->|                              |
       |                               |-- Gen state & PKCE S256 ---->|
       |                               |-- Store in oauth_states ----->|
       |<-- 302 to GitHub Auth URL ----|                              |
       |                                                              |
       |------------------- User Authorizes on GitHub --------------->|
       |                                                              |
       |<-- 302 to /auth/github/callback?code=...&state=... ----------|
       |                                                              |
       |--- GET /auth/github/callback?code=...&state=... ------------>|
       |                               |-- Atomically consume state ->|
       |                               |-- Exchange code + verifier ->|
       |                               |<-- Return access token ------|
       |                               |-- Fetch user profile --------|
       |                               |<-- Return profile JSON ------|
       |                               |-- Resolve / create User ---->|
       |                               |-- Gen session token -------->|
       |                               |-- Store SHA-256 hash in DB ->|
       |<-- Set-Cookie: rf_session ----|                              |
       |<-- 302 to Frontend URL -------|                              |
```

### Security Details

1. **Stable Identity Anchor:**
   - Users are identified by their unique, immutable numeric GitHub ID (`profile.id.toString()`) stored in `external_identities`.
   - Email addresses are mutable and can be private; they are not used as the primary identity anchor.
2. **PKCE & Single-Use State:**
   - Every login generates a high-entropy state and PKCE S256 code challenge/verifier pair (`src/common/crypto.ts`).
   - The state is stored in `oauth_states` with a 10-minute expiry and deleted atomically upon callback. Replaying an authorization callback is rejected.
3. **Session Token Hashing:**
   - The client receives a 32-byte cryptographic token in an `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` (in production) cookie (`rf_session`).
   - The database only stores the SHA-256 hash (`token_hash`) of the token. A database compromise does not reveal raw session tokens.
4. **CSRF Mitigation:**
   - `SameSite=Lax` cookies prevent ambient cross-site inclusion on subrequests.
   - `AuthGuard` verifies the `Origin` / `Referer` headers on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`).

---

## 2. Organization and Membership Model

RelayForge supports multi-tenancy where users can belong to multiple organizations, and organizations can have multiple members.

### Role Hierarchy

- **`OWNER` (Rank 3):** Full organization administration, organization renaming/configuration, member invitations, role changes, and member removal.
- **`DEVELOPER` (Rank 2):** Development and operational resources: configuring destinations, workflows, and viewing execution logs (Milestones 3+).
- **`VIEWER` (Rank 1):** Read-only inspection of organization resources and member rosters.

### Final Owner Invariant

An organization must always have at least one active `OWNER`. Both role demotion and member removal evaluate the remaining owner count; any operation that would leave an organization without an owner is rejected (`Cannot demote/remove the final Owner`).

---

## 3. Database-Enforced Tenancy (PostgreSQL RLS)

RelayForge enforces multi-tenant isolation at the database engine level using PostgreSQL Row-Level Security rather than relying solely on application-level `WHERE org_id = ...` clauses.

### Transaction-Local Tenant Context

When executing tenant operations, `TenantContextService` wraps Prisma operations inside an interactive transaction:

```sql
SELECT set_config('app.current_org_id', '<org_id>', true),
       set_config('app.current_user_id', '<user_id>', true);
```

Passing `is_local = true` ensures these session settings exist **only for the duration of the transaction**. When the transaction commits or rolls back, PostgreSQL automatically clears them. Even when connection pooling reuses the physical connection, no tenant context leaks to subsequent queries.

### Elimination of RLS Recursion

Querying the `memberships` table within a membership RLS policy can cause infinite recursion in PostgreSQL (`ERROR: infinite recursion detected in policy for relation "memberships"`).

RelayForge eliminates recursion by using PostgreSQL `SECURITY DEFINER` functions:

```sql
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE org_id = p_org_id AND user_id = p_user_id
  );
$$;
```

Because `is_org_member` executes with the privileges of the schema owner (`relayforge_admin`), internal subqueries bypass RLS checks during the function call, completely avoiding policy recursion while enforcing airtight authorization for runtime accounts (`relayforge_api`).

---

## 4. Local GitHub OAuth Setup

To test GitHub OAuth with your own developer account:

1. Open [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**:
   - **Application name:** RelayForge Local
   - **Homepage URL:** `http://localhost:5173`
   - **Authorization callback URL:** `http://127.0.0.1:3100/auth/github/callback`
3. Generate a Client Secret.
4. Copy the credentials into your local `.env`:
   ```bash
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   GITHUB_CALLBACK_URL=http://127.0.0.1:3100/auth/github/callback
   FRONTEND_URL=http://localhost:5173
   ```
