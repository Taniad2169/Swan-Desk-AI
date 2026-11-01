# SwanDesk AI

A WebSwan Digital Solutions platform: one smart desk with three AI agents for small businesses.

- **Jennifer**: receptionist and appointment setter (inbound calls, warm callbacks only).
- **Eva**: executive assistant (inbox briefing, drafts for approval, follow-ups).
- **Stan**: social media content (monthly plan, branded pictures, scheduling).

## Pages
- `/` client dashboard (Google sign-in; each client sees only their workspace).
- `/admin/` WebSwan admin (thewebswann@gmail.com): create clients, switch agents, account ON/OFF for non-payment, billing plan, prices, upgrade requests, history.

## Rules enforced on the server
- Only admins change agent licensing (locked, active, paused, suspended) or turn an account off.
- A client can only pause/resume an agent that is already active. Locked agents stay visible with their description and an "I'm interested" button.
- Account OFF (non-payment) stops every agent.
- Every change is written to the client's history.

## Setup (once)
1. Netlify: new site from this repo (name it `swandesk-ai`). No build command; publish directory `.`.
2. Firebase console (project webswan-gigoia-task) → Authentication → Settings → Authorized domains → add the Netlify domain (and any custom domain).
3. Later phases: CARTESIA_API_KEY (SwanDesk's own Cartesia account), DEEPSEEK_API_KEY, CONTENT360_API_KEY.

## Prices (editable in admin)
Jennifer $349 · Eva $199 · Stan $199 · any 2 $499 · all 3 $699 per month. Setup $299 (1-2 agents) / $499 (3). Every 3 months 5% off, every 6 months 10% off, yearly 15% off.
