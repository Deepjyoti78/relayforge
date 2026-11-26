# Cloudflare preview build recovery

Confirmed from the supplied 25 November 2026 build log:

1. Cloudflare runs root `npm run build`, which compiles the backend and generates
   Prisma, rather than creating `web/dist`.
2. Its preview command `npx wrangler preview` (4.168.0) fails because the configs
   omit the required `previews` variables. Dependency-audit warnings did not cause
   this failure. Do not use `npm audit fix --force`.

Both Wrangler entry points now contain explicit UI-only preview settings. The
preview gateway never forwards cookies, OAuth callbacks or API requests to the
Render API: `/v1/me` returns an anonymous 401 and other API/auth routes return 503.
Reserved .invalid origins are deliberate unused safety values, not missing
credentials. The real relayforge Worker name, assets, routes and production
FRONTEND_URL/API_ORIGIN are unchanged. Preview sign-in is deliberately disabled;
test real OAuth only on the approved production/staging frontend.

`build:cloudflare` creates frontend assets with VITE_API_URL=/ and does not compile
the backend, initialize databases, migrate, or deploy. It works from either root.
The inherited UI includes the new two-line heading, typography, illustrative
ticker, removed Trusted-by section and immediate public landing render. Those
changes are absent from the older live screenshots because they have not been
successfully released there. A signed-out /v1/me 401 is expected; never weaken auth
or change it to authenticated 200 simply to hide a console message.

## Manual steps after review/publication approval

No live setting, branch publication or deployment was changed by this task.

1. Review this local branch, `codex/cloudflare-preview-build-fix`, based on the
   existing UI branch. Publish only after review-branch deployment triggers are
   independently confirmed safe. Do not publish the separate Phase 1/2 branches
   merely to repair this frontend build.
2. In Cloudflare select the existing **relayforge** Worker → Settings → Builds.
   Set Root directory to `web` to avoid automatically installing the backend's
   715 packages for a frontend build. Set:
   - Build: `npm ci --include=dev && npm run build:cloudflare`
   - Preview command: `npx --yes wrangler@4.168.0 preview --config wrangler.jsonc`
   - Production deploy command: `npx --yes wrangler@4.168.0 deploy --config wrangler.jsonc`
   These deploy commands are instructions for an approved release, not commands
   executed by this task. Node 22.23.5/npm 10.9.2 in the supplied log are compatible.
3. If deliberately keeping repository root `/`, instead use build
   `npm --prefix web ci --include=dev && npm run build:cloudflare`. Cloudflare may
   still automatically install backend dependencies in that root. The two deploy
   commands stay the same; the matching Wrangler entry point is selected explicitly.
4. Check production branch selection. Deploying a branch Preview does not update
   `https://relayforge.deepmuse.workers.dev`. To release the new UI there, the
   reviewed frontend changes must reach the configured production branch and
   receive a separately approved production deployment. Do not deploy or merge
   unreviewed backend migrations as part of this step.
5. Retry one preview build after the corrected commit/settings are available. If
   it passes, confirm the preview landing loads and API/auth remain disabled.
   Do not add real provider secrets or database credentials to Cloudflare Builds.
6. After an approved production release, hard-refresh and verify the two-line
   heading, ticker, no Trusted-by section and no blocking homepage spinner. Test
   Google/GitHub sign-in, dashboard reload and logout on the canonical origin.

The overview's “No Workers bound” refers to Worker service bindings; it does not
establish that the ASSETS binding or a database is missing. No binding-menu changes
are needed for the confirmed error. Do not change Render, OAuth credentials or
cookie/CORS settings to resolve this build failure.

Cloudflare behavior verified against its [Build configuration documentation](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

Local checks: frontend TypeScript/Vite build passed; all 13 proxy/preview tests
passed; built preview passed desktop/mobile Chromium checks with zero upstream API
calls; both Wrangler configs passed no-upload dry-run/effective-binding checks;
git diff --check passed. No backend/DB suite was rerun for these eight frontend
configuration/gateway/documentation files. No dependency versions or lockfiles changed.
