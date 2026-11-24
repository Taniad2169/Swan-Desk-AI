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

## Step 5: Jonathan, the Legal Eagle (legal & compliance assistant), $299/month (Tania, Nov 23, 2026)
**For doctors (and other practices):**
- Reviews their legal documents and legal letters and explains them in plain language.
- Website review: ADA/accessibility, cookie banner, privacy policy, HIPAA-safe forms; flags what is out of compliance and what to fix.
- Monthly law & rule updates for their industry and state (privacy, ADA, advertising rules).
- Drafts a privacy policy, cookie policy and accessibility statement for the client to review.
- When something needs a lawyer, Jonathan says so plainly and advises them to consult an attorney.

**For attorneys:** works as their legal assistant.
- Document review, preparing for court, case presentations, drafting legal letters, and deep legal research.
- Everything is a draft for the attorney's review; the attorney signs off.

**Rules for Jonathan's prompt:**
- Always says he is an AI assistant, not a lawyer, and does not give legal advice or create an attorney-client relationship.
- Cites his sources on research and marks anything he is unsure of; never invents case law or citations.
- Keeps clients' documents private to their own SwanDesk.
- Uses Jonathan's voice (same voice as in the WebSwan AI Office).

## Pricing approved Nov 23, 2026 (Tania, reviewed by Clara and Gips)
- Jennifer (inbound receptionist + warm outbound appointment setter; inbound and outbound share the minutes): Lite 600 min $249, Standard 1,500 min $349, Pro 4,000 min $649. Extra minutes $0.20 (must be enforced: it protects Pro's margin).
- Eva $249 (with deep research, about 40 reports/month), Jonathan $299, Rosie $249 (social media, Google Business, graphics; posts directly to client accounts like Sonny at Marblism; Content360 is never used for clients).
- Bundles: any 2 up to $549, any 3 up to $799, all 4 $949; bundles include Jennifer Standard; Jennifer Pro inside a bundle +$300.
- Setup: $299 (1-2 agents), $499 (3), $599 (all 4).
- Clara: lowest safe prices Jennifer Lite $89 / Standard $189 / Pro $429, Eva $119, Jonathan $159, Rosie $99; fixed costs about $134/month; one Full Desk client covers them.
- Before launch (Gips): usage metering, automatic billing, alerts at 75/90/100%, client allowance dashboard, HIPAA BAAs with every vendor used for doctor clients.
- UPDATE Nov 23, 11:25 PM: Tania's rule is a 50% minimum margin even at worst-case cost (outbound calling about $0.10/min + 10% AI reserve + fixed share + 3% card fees). Jennifer Pro changed to 3,000 minutes at $649 (51%; 4,000 minutes would need $849) and extra minutes to $0.25 (59%). Every other price already clears 50%.
