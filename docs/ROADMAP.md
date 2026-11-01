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

## Selling SwanDesk-AI (Tania's plan, Nov 1, 2026)
- Website: "Interested in the package? Call Jennifer for more insight." The demo Jennifer explains SwanDesk-AI, answers questions, and books a 10-minute appointment with Tania on Tania's Google Calendar.
- After each demo call, Tania gets an email AND a message in the SwanDesk admin chat (Rachel/Marblism style) with the summary, and can replay the call recording.
- The demo number is used only for demos. Client numbers come from Twilio and connect to a separate "Jennifer – Clients" agent.
- Voice Studio sells it: Alek (floater) collects emails and appointments for SwanDesk-AI and gives prospects Jennifer's demo number ("call her, try her, ask her anything; if interested, book 10 minutes with Tania"). Possibly a duplicate Rebecca for SwanDesk booking.
- Later: Rachel on ads.webswanmedianetwork.com talks about both Media Network advertising and SwanDesk-AI (SwanDesk is part of WebSwan Media Network). Not yet.

## Heavy-usage pricing
- $349 Jennifer plan includes about 1,950 minutes; overage $0.15/min. A 3,500-minute client = $349 + 1,550 x $0.15 = $581.50/month.
- Consider a "Jennifer Pro" tier (e.g. 4,000 minutes for about $549) for busy offices.

## Jennifer demo line: always capture the caller
Anyone who calls the demo number is interested, so Jennifer must get and save the caller's **name, company/practice and phone number** (caller ID plus confirmation) on every call, even if they only test her.
Tania gets an email + SwanDesk admin chat message with those details and the recording, so she can call them right back.
- Caller ID is saved on EVERY demo call automatically (with the recording), even if the caller gives no name or company.
- "Who called?" lookup: match that phone number against Voice Studio leads and campaigns (who Rebecca called and gave Jennifer's number to), so Tania knows the practice and calls them back.
