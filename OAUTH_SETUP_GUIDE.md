# RelayForge — OAuth Provider Setup Guide (Google & GitHub)

> **Document Version:** 1.0.0  
> **Target Environments:** Local Development (`http://localhost:5173`, `http://127.0.0.1:3100`) & Render Staging (`https://relayforge-staging-web.onrender.com`, `https://relayforge-staging-api.onrender.com`)  

This guide provides the exact configuration parameters, authorized JavaScript origins, and authorized redirect URIs required to register RelayForge with Google Cloud Console and GitHub Developer Settings.

---

## 1. Google Cloud Console Configuration

### Step 1: Create or Select a Google Cloud Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select your existing project (e.g. `relayforge-staging`).

### Step 2: Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the required application information:
   * **App name:** `RelayForge Staging`
   * **User support email:** Your email address
   * **Developer contact information:** Your email address
4. Under **Scopes**, click **Add or Remove Scopes** and select:
   * `.../auth/userinfo.email` (`openid`, `email`)
   * `.../auth/userinfo.profile` (`profile`)
5. Save and continue. If the app is in "Testing" publishing status, add your test Google email addresses under **Test users**.

### Step 3: Create OAuth 2.0 Web Client Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Application type:** `Web application`.
4. **Name:** `RelayForge Web Client`.
5. Under **Authorized JavaScript origins**, add:
   * `http://localhost:5173` *(Local Vite frontend)*
   * `http://127.0.0.1:5173` *(Local IPv4 fallback)*
   * `https://relayforge-staging-web.onrender.com` *(Render Staging Web)*
6. Under **Authorized redirect URIs**, add the **exact** callback paths implemented in `AuthController`:
   * `http://127.0.0.1:3100/auth/google/callback` *(Local API callback)*
   * `https://relayforge-staging-api.onrender.com/auth/google/callback` *(Render Staging API callback)*
7. Click **Create**.
8. Copy the generated **Client ID** and **Client Secret**.

---

## 2. GitHub Developer Settings Configuration

### Step 1: Register an OAuth App
1. Navigate to [GitHub Developer Settings — OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**.
3. Configure the following fields:
   * **Application name:** `RelayForge Staging`
   * **Homepage URL:**
     * For Local: `http://localhost:5173`
     * For Staging: `https://relayforge-staging-web.onrender.com`
   * **Authorization callback URL:**
     * For Local: `http://127.0.0.1:3100/auth/github/callback`
     * For Staging: `https://relayforge-staging-api.onrender.com/auth/github/callback`
4. Click **Register application**.
5. Copy the **Client ID**.
6. Click **Generate a new client secret** and copy the resulting string immediately.

---

## 3. Environment Variable Mapping Matrix

The table below shows the exact variable names utilized in `src/modules/config/environment.ts` and where each must be configured:

| Variable Name | Description | Local `.env` | Render Staging API | Render Staging Worker | Render Staging Web |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` | `production` | `production` | N/A |
| `PORT` | HTTP server listening port | `3100` | `3100` | N/A | N/A |
| `DATABASE_URL` | PostgreSQL connection string | Local DB URL | Supabase URL | N/A | N/A |
| `WORKER_DATABASE_URL` | Worker PostgreSQL connection string | Local DB URL | N/A | Supabase URL | N/A |
| `REDIS_URL` | Redis connection string (TLS in staging) | Local Redis | Upstash Redis | Upstash Redis | N/A |
| `ENCRYPTION_KEY` | 32+ character hex key for AES-256 | 64-char hex | Auto-generated | From API service | N/A |
| `FRONTEND_URL` | Base URL of Web console | `http://localhost:5173` | `https://relayforge-staging-web.onrender.com` | N/A | N/A |
| `SESSION_COOKIE_NAME` | Cookie name for session tokens | `rf_session` | `rf_staging_session` | N/A | N/A |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | Your GitHub ID | Paste in Render Dashboard | **Not Needed** | N/A |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | Your GitHub Secret | Paste in Render Dashboard | **Not Needed** | N/A |
| `GITHUB_CALLBACK_URL` | Redirect target registered with GitHub | `http://127.0.0.1:3100/auth/github/callback` | `https://relayforge-staging-api.onrender.com/auth/github/callback` | **Not Needed** | N/A |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth 2.0 Client ID | Your Google ID | Paste in Render Dashboard | **Not Needed** | N/A |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth 2.0 Client Secret | Your Google Secret | Paste in Render Dashboard | **Not Needed** | N/A |
| `GOOGLE_CALLBACK_URL` | Redirect target registered with Google | `http://127.0.0.1:3100/auth/google/callback` | `https://relayforge-staging-api.onrender.com/auth/google/callback` | **Not Needed** | N/A |
| `VITE_API_URL` | Public API URL for frontend | N/A (Vite proxy) | N/A | N/A | `https://relayforge-staging-api.onrender.com` |

---

## 4. End-to-End Verification Checklist

1. [ ] **Google OAuth (Local):**
   * Run local backend (`npm run start:api`) and frontend (`npm run dev`).
   * Click **Continue with Google** on `http://localhost:5173`.
   * Verify centered popup opens `accounts.google.com`.
   * Complete login; verify popup automatically closes and dashboard displays your Google profile name and personal workspace.
2. [ ] **GitHub OAuth (Local):**
   * Click **Continue with GitHub** on `http://localhost:5173`.
   * Verify popup opens `github.com/login/oauth/authorize`.
   * Complete authorization; verify return to dashboard.
3. [ ] **Staging Verification (Render):**
   * Open `https://relayforge-staging-web.onrender.com`.
   * Click **Continue with Google** and **Continue with GitHub**.
   * Confirm successful OAuth token exchange against `https://relayforge-staging-api.onrender.com`.
