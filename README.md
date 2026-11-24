# SwanDesk AI

A WebSwan Digital Solutions platform: one smart desk with four AI agents for small businesses.

- **Jennifer**: receptionist and appointment setter (inbound calls, warm callbacks only).
- **Eva**: executive assistant (inbox briefing, drafts for approval, follow-ups).
- **Stan**: social media content (monthly plan, branded pictures, scheduling).
- **Jonathan** ("Legal Eagle"): legal and compliance assistant. Doctors: document, legal-letter and website review for compliance, rule updates, policy drafts, and a referral to consult an attorney when needed. Attorneys: legal assistant for document review, court prep, case presentations, legal letters and deep research. AI assistant, not a lawyer; no legal advice.

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
3. Later phases (Netlify environment variables): CARTESIA_API_KEY (SwanDesk's own Cartesia account, multimediasite23), TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN, DEEPSEEK_API_KEY, ZERNIO_API_KEY (Stan's posting for clients).

## Prices (editable in admin)
Jennifer $349 · Eva $199 · Stan $199 · Jonathan $299 · any 2 $499 · any 3 $699 · all 4 $949 per month. Setup $299 (1-2 agents) / $499 (3) / $599 (all 4). Every 3 months 5% off, every 6 months 10% off, yearly 15% off.
