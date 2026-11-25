# Landing and session loading refinement

Local review branch: `codex/landing-loading-polish`, based on staging `d5552a7`.
The initial UI commit `5c2e8e3` was subsequently pushed at the user's request;
its hosted CI passed. Follow-up UI work remains local only. No deployment was
performed. Redis/infrastructure work is separate.

## Behavior

Previously the public homepage waited for `/v1/me`, whose existing request
deadline is 20 seconds. It now renders immediately while session verification
runs in the background. Verified returning users still enter the dashboard.
Protected routes never render account data before verification, and a service
failure remains an unknown session rather than a logout. Retry retains the route.

The protected-route loading view uses a small relay animation, an accessible
status, a slow-response message after four seconds, reduced-motion support and
an error recovery view. The initial HTML fallback now matches the dark surface.
No artificial minimum loading duration was added.

The latest reference supersedes the original serif pairing: the landing page
uses Helvetica Neue/Helvetica/Arial, regular-weight headings and a muted second
hero line. Helvetica Neue is used where installed; no proprietary font is
downloaded. The hero reads “Every event.” / “Delivered reliably.” and remains
two lines at the five tested viewport widths. Hero text/actions no longer wait
for reveal animations. Existing dashboard fonts load asynchronously, while its
theme remains intact. Dashboard management code loads only when needed.

A native React/CSS delivery ticker sits below the hero. It shows six explicit
sample states, a duplicated aria-hidden track, pause/resume and hover/focus pause.
Reduced-motion users receive a static wrapped list. It imports no third-party
ticker script and claims no live customer metrics. The trust/technology-logo
section has been removed in full at the user's request.

## Local verification — 26 November 2026

- `npm run db:generate`: passed; generated client only, no database connection.
- `npm run lint`: passed after generating the worktree's Prisma client.
- `npm run typecheck`: passed.
- `npm --prefix web run build`: passed, including frontend TypeScript.
- `npm run test:proxy`: 9 passed.
- `npx playwright test --config playwright.loading.config.cjs`: 6 passed,
  25.6 seconds, Chromium with synthetic session responses. Covers pending
  homepage/login, validated dashboard reload, slow protected lookup, service
  error/retry, actual computed fonts, mobile overflow and reduced motion.
- `git diff --check`: passed.
- Mechanical UI scan: two warnings. The width transition belongs to the existing
  sidebar; the font warning matches the explicitly requested Helvetica pairing.
  Neither requires a broader UI change.

Initial entry JavaScript decreased from 578.74 kB / 131.63 kB gzip before
dashboard splitting to 411.26 kB / 104.95 kB gzip after it (about 29% / 20%).
The dashboard chunk is 168.78 kB / 28.24 kB gzip. These are local build sizes,
not hosted load-time measurements. The pending-request browser test proves
the headline and sign-in modal work before the session response finishes.

The first browser attempt found the default browser cache absent; tests passed
using the already installed Chromium cache. A subsequent typography assertion
caught the global font rule overriding Georgia; scoped overrides corrected it.

The PostgreSQL-backed OAuth browser suite and database integration tests were
not rerun: Docker's Linux engine was stopped. Existing provider/session tests
remain unchanged. No live OAuth, hosting or cold-start performance test was run.
The backend's 20-second deadline and infrastructure behavior are unchanged.

Local visual evidence is under `.cache/landing-desktop.png`,
`.cache/landing-mobile.png`, `.cache/session-loading-desktop.png`,
`.cache/session-error-mobile.png` and `.cache/landing-login.png`.

Follow-up final checks: 9 Chromium tests passed in 32.7 seconds, including ticker
pause/resume, static reduced-motion mobile layout, two complete heading lines at
five viewport widths and absence of the removed trust section. Frontend build
passed (entry 408.44 kB / 104.98 kB gzip). Scoped UI detector returned no findings.
These local follow-ups have not been pushed or covered by fresh hosted CI.
