# SwanDesk-AI roadmap

## Step 1: Admin + client workspaces ✅
Client workspaces, agent licensing (locked / active / paused / suspended), account ON/OFF for non-payment, payment plans, prices, upgrade requests, history.

## Step 2: Jennifer (receptionist + warm callbacks)
- ONE Cartesia agent ("Jennifer Kennedy - SwanDesk Demo", account multimediasite23) serves every client.
- Each client gets their own Twilio number imported into Cartesia (~$1.15/month). Jennifer identifies the client by the number dialed and loads their greeting, hours, services and calendar.
- Clients may forward their existing line to the SwanDesk number; porting their own number is optional (1-4 weeks) and the Twilio number keeps working meanwhile.
- Warm callback calendar: who, phone, date, reason, HOW WE MET (consent record), reminder before the call. No cold calls.
- Booking on the client's Google Calendar (client-installed Apps Script bridge).

## Step 3: Eva (executive assistant)
Morning inbox briefing (sender, subject, short snippet only), drafts with PDF/photo attachments for approval, batch personalized emails (e.g. 12 leads), follow-ups, holiday and market-update emails to future clients. Drafts only; the client sends.

## Step 4: Stan (social content)
- Month plan of posts with BRANDED TEMPLATE PICTURES in the client's colors and logo (like Tatiana's cards and Marblism's Sonny templates), captions, hashtags, plus the client's own photos and videos.
- Client approves each post (Approve button), then Stan publishes on the scheduled date.
- Publishing for CLIENTS goes through a unified posting API (e.g. Zernio): each client connects their own Facebook, Instagram, LinkedIn, TikTok and Google Business through a secure link. Decision (Nov 1, 2026): Tania's Content360 is NOT used for clients; it stays for The WebSwan only.
- The publisher layer stays swappable, so SwanDesk's own platform apps can be added later after each platform's app review.
- Failed posts are reported to the client and to Tania immediately.

## Jennifer's final prompt: Tania's notes from testing the demo (Nov 1, 2026)
1. Repeat the email back in a normal voice; do NOT spell it letter by letter.
2. Never hang up before the caller says goodbye; wait for them to end, then close warmly.
3. Be personable: chat and answer general questions (a burrito recipe, places to visit in Boston), then gently return to helping. Don't keep rerouting to the appointment.
4. On inbound calls, introduce herself as the receptionist: she sets appointments, collects the caller's information and the reason for their call, and also makes warm outbound appointment-setting calls for people who met the business and asked for a call back. No cold calls.
Note: the demo test used 6 min 19 sec; no more test calls until Nov 5.
