# SwanDesk AI

A WebSwan Digital Solutions platform: one smart desk with four AI agents for small businesses.

- **Jennifer**: receptionist (inbound calls) and appointment setter (warm outbound calls only). Minute plans: Lite 600 min $249, Standard 1,500 min $349, Pro 3,000 min $649; inbound and outbound share the minutes; extra minutes $0.25.
- **Eva**: executive assistant and researcher (inbox briefing, drafts for approval, follow-ups, about 40 deep-research reports a month).
- **Rosie** (code key `stan`): social media, Google Business Profile and graphic designer; designs and publishes posts straight to the client's own accounts after approval (Zernio-style posting API, not Tania's Content360).
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
Jennifer $249 / $349 / $649 (Lite / Standard / Pro) · Eva $249 · Rosie $249 · Jonathan $299 · any 2 up to $549 · any 3 up to $799 · all 4 $949 per month (bundles include Jennifer Standard; Pro +$300). Approved by Tania with Clara's review, Nov 23, 2026. Setup $299 (1-2 agents) / $499 (3) / $599 (all 4). Every 3 months 5% off, every 6 months 10% off, yearly 15% off.
