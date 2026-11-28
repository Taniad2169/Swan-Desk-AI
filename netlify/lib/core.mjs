// SwanDesk AI core: Google sign-in check (Firebase), client workspaces, agent licensing, billing terms and the audit log.
// Everything is enforced here on the server; the pages only show what the server allows.
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "webswan-gigoia-task";
// WebSwan administrators (Tania). Only these accounts can create clients, switch agents or suspend for non-payment.
export const ADMINS = ["thewebswann@gmail.com", "taniadomingue373@gmail.com"];
export const AGENTS = {
  jennifer: { name: "Jennifer", role: "Receptionist & Appointment Setter", desc: "Answers your calls 24/7, books appointments on your calendar, takes messages, and makes warm follow-up calls only to people who asked you to call them back (like the contact you met at an event, or the homeowner who said 'call me in 3 months')." },
  eva: { name: "Eva", role: "Executive Assistant & Researcher", desc: "Reads your inbox every morning and tells you what matters, prepares personalized email drafts (with PDFs and photos attached) for you to approve, keeps your follow-ups and tasks on track, sends friendly holiday and market-update emails to your future clients, and does deep research for you (about 40 research reports a month)." },
  stan: { name: "Tatiana", role: "Social Media, Google Business & Graphic Designer", desc: "Plans a full month of posts for Facebook, Instagram, LinkedIn, TikTok and your Google Business Profile, designs the branded pictures in your colors, writes the captions, and publishes them straight to your accounts after you approve (about 30 posts a month, up to 5 accounts plus Google Business)." },
  jonathan: { name: "Jonathan", role: "Legal Eagle · Legal & Compliance Assistant", desc: "For doctors: reviews your documents, legal letters and website so your practice stays in compliance (ADA, privacy, cookie and HIPAA forms), keeps you updated on new rules in your state, drafts your privacy policy, cookie policy and accessibility statement, and tells you when it's time to consult an attorney. For attorneys: your legal assistant who reviews documents, helps you prepare for court, builds case presentations, drafts legal letters and does deep research for your review. Jonathan is an AI assistant, not a lawyer, and does not give legal advice." },
  aleksander: { name: "Aleksander Reid", role: "SDR & Sales Coach · Researcher", desc: "Listens to Jennifer's calls -- both the ones she answers and the warm outbound calls she makes -- and coaches her: what landed, what to say differently, patterns across calls, so she keeps getting sharper. Digs up real research on prospects and their market before any outreach goes out, the way a seasoned SDR would, and hands Eva punchy, researched email copy to send instead of generic templates. Aleksander doesn't take calls himself -- he's the coach and researcher behind the scenes." }
};
export const AGENT_STATES = ["locked", "active", "paused", "suspended"];

// Prices (USD per month), approved by Tania with Clara's review (Nov 23, 2026). Setup: 1-2 agents $299, 3 agents $499, all 4 $599.
// Jennifer has 3 minute plans; bundles include Jennifer Standard, and Jennifer Pro adds proUpgrade inside a bundle. Extra minutes: overage per minute.
// Aleksander (Nov 24) is new and his $279 price (and the setup/bundle tiers, still only sized for up to 4 agents) is a DRAFT -- not yet reviewed the way the other four were.
export const PRICING_VERSION = 2;
export const PRICING = {
  agent: { jennifer: 349, eva: 249, stan: 249, jonathan: 299, aleksander: 279 },
  jplans: { lite: { label: "Lite", minutes: 600, price: 299 }, standard: { label: "Standard", minutes: 1500, price: 349 }, pro: { label: "Pro", minutes: 3000, price: 649 } },
  overage: 0.25, proUpgrade: 300,
  bundle: { 2: 549, 3: 799, 4: 949 },
  setup: { 1: 299, 2: 299, 3: 499, 4: 599 },
  terms: { monthly: { months: 1, off: 0, label: "Monthly" }, quarterly: { months: 3, off: 0.05, label: "Every 3 months" }, semiannual: { months: 6, off: 0.10, label: "Every 6 months" }, annual: { months: 12, off: 0.15, label: "Once a year" } }
};
export async function getPricing() {
  // Prices saved before the Nov 23, 2026 approval (no version 2) are ignored, so old numbers can't override the approved prices.
  let saved = (await sd().get("pricing", { type: "json" }).catch(() => null)) || {};
  if (saved.version !== PRICING_VERSION) saved = {};
  const jplans = Object.fromEntries(Object.entries(PRICING.jplans).map(([k, v]) => [k, { ...v, ...((saved.jplans || {})[k] || {}) }]));
  return { jplans, overage: saved.overage ?? PRICING.overage, proUpgrade: saved.proUpgrade ?? PRICING.proUpgrade, agent: { ...PRICING.agent, ...(saved.agent || {}), jennifer: jplans.standard.price }, bundle: { ...PRICING.bundle, ...(saved.bundle || {}) }, setup: { ...PRICING.setup, ...(saved.setup || {}) }, terms: Object.fromEntries(Object.entries(PRICING.terms).map(([k, v]) => [k, { ...v, ...((saved.terms || {})[k] || {}) }])) };
}
// Monthly price for a set of agents: the bundle price, but never more than buying them separately.
// jplan = Jennifer's minute plan (lite | standard | pro). Bundles include Jennifer Standard (Lite if chosen); Pro adds proUpgrade on top.
export function priceFor(agents, pricing, jplan) {
  const list = agents.filter((a) => pricing.agent[a] != null);
  if (!list.length) return { monthly: 0, setup: 0 };
  const plans = pricing.jplans || PRICING.jplans, plan = plans[jplan] ? jplan : "standard";
  const jPrice = (a) => a === "jennifer" ? plans[plan].price : pricing.agent[a];
  const separately = list.reduce((t, a) => t + jPrice(a), 0);
  let monthly = separately;
  if (list.length > 1) {
    const base = list.reduce((t, a) => t + (a === "jennifer" ? (plan === "lite" ? plans.lite.price : plans.standard.price) : pricing.agent[a]), 0);
    monthly = Math.min(base, pricing.bundle[list.length] || base) + (list.includes("jennifer") && plan === "pro" ? (pricing.proUpgrade ?? PRICING.proUpgrade) : 0);
  }
  return { monthly, setup: pricing.setup[list.length] || 0, separately };
}
export function termTotal(monthly, term, pricing) {
  const t = pricing.terms[term] || pricing.terms.monthly;
  return Math.round(monthly * t.months * (1 - t.off));
}

export const sd = () => getStore({ name: "swandesk", consistency: "strong" });
export const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, "").trim().slice(0, n);
export const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || ""));

// ---------- sign-in ----------
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwks = { keys: null, at: 0 };
const b64json = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
export async function whoIs(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const p = token.split(".");
  if (p.length !== 3) throw new Error("not signed in");
  const head = b64json(p[0]), body = b64json(p[1]);
  if (head.alg !== "RS256" || !head.kid) throw new Error("bad token");
  if (!jwks.keys || Date.now() - jwks.at > 3600e3) { const r = await fetch(JWKS_URL); if (!r.ok) throw new Error("keys"); jwks = { keys: (await r.json()).keys, at: Date.now() }; }
  const jwk = jwks.keys.find((k) => k.kid === head.kid); if (!jwk) throw new Error("unknown key");
  const ok = crypto.verify("RSA-SHA256", Buffer.from(p[0] + "." + p[1]), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(p[2], "base64url"));
  if (!ok) throw new Error("bad signature");
  if (body.aud !== PROJECT_ID || body.iss !== "https://securetoken.google.com/" + PROJECT_ID) throw new Error("wrong project");
  if (!(body.exp > Date.now() / 1000) || !body.email_verified) throw new Error("expired");
  return String(body.email || "").toLowerCase();
}
export const isAdmin = (email) => ADMINS.includes(email);

// ---------- responses (same-site pages only) ----------
export function sameSite(req) {
  const o = req.headers.get("origin") || "";
  const host = new URL(req.url).host;
  try { return !o || new URL(o).host === host; } catch { return false; }
}
export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// ---------- clients (tenants) ----------
// Capacity: every client is its own record ("t-<id>") plus one small key per sign-in email ("email-<...>" -> client id).
// There is no shared list file, so many clients saving at the same moment can't overwrite each other.
const emailKey = (e) => "email-" + Buffer.from(String(e).toLowerCase()).toString("base64url");
export async function tenantIds() {
  const ids = []; for await (const page of sd().list({ prefix: "t-", paginate: true })) for (const b of page.blobs) ids.push(b.key.slice(2));
  return ids;
}
export async function tenants() {
  const out = [];
  for (const id of await tenantIds()) { const t = await tenant(id); if (t) out.push(t); }
  return out.sort((a, b) => String(a.business).localeCompare(String(b.business)));
}
// Agents added after a client was created (e.g. Jonathan) show up as "locked" (not on their plan) instead of missing.
export async function tenant(id) {
  const t = id && /^[a-f0-9]{6,32}$/.test(id) ? await sd().get("t-" + id, { type: "json" }) : null;
  if (t) { t.agents = t.agents || {}; t.billing = t.billing || {}; for (const a of Object.keys(AGENTS)) if (!t.agents[a]) t.agents[a] = { state: "locked", since: new Date().toISOString() }; }
  return t;
}
// Which client an email belongs to (fast path), falling back to the older shared list for clients created before Nov 24, 2026.
export async function emailOwner(email) {
  const id = await sd().get(emailKey(email), { type: "text" }).catch(() => null);
  if (id) return id;
  const legacy = (await sd().get("tenants", { type: "json" }).catch(() => null)) || [];
  const hit = legacy.find((x) => (x.emails || []).includes(String(email).toLowerCase()));
  return hit ? hit.id : null;
}
// Safe saving: a client record is only written if nobody else changed it since it was read (Netlify Blobs "onlyIfMatch").
// If someone did, we read the fresh copy and apply the change again, so two changes at the same moment are both kept.
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export async function updateTenant(id, change) {
  for (let i = 0; i < 12; i++) {
    const got = await sd().getWithMetadata("t-" + id, { type: "json" });
    if (!got || !got.data) return null;
    const t = got.data; t.agents = t.agents || {}; t.billing = t.billing || {};
    for (const a of Object.keys(AGENTS)) if (!t.agents[a]) t.agents[a] = { state: "locked", since: new Date().toISOString() };
    const oldEmails = [...(t.emails || [])];
    const res = await change(t);
    if (res && res.error) return res;
    t.updatedAt = new Date().toISOString();
    const w = await sd().setJSON("t-" + id, t, { onlyIfMatch: got.etag });
    if (w && w.modified === false) { await pause(20 + Math.random() * 80 * (i + 1)); continue; }
    await syncEmails(t, oldEmails);
    return t;
  }
  throw new Error("busy");
}
// Claims a sign-in email for a client. "onlyIfNew" makes the claim atomic: two clients can never get the same email.
export async function claimEmail(email, id) {
  const k = emailKey(email);
  const w = await sd().set(k, id, { onlyIfNew: true });
  if (w && w.modified === false) return (await sd().get(k, { type: "text" })) === id;
  return !(await legacyOwner(email, id));
}
async function legacyOwner(email, id) {
  const legacy = (await sd().get("tenants", { type: "json" }).catch(() => null)) || [];
  const hit = legacy.find((x) => x.id !== id && (x.emails || []).includes(String(email).toLowerCase()));
  return hit ? hit.id : null;
}
async function syncEmails(t, oldEmails) {
  for (const e of t.emails || []) await sd().set(emailKey(e), t.id);
  for (const e of oldEmails || []) if (!(t.emails || []).includes(e) && (await sd().get(emailKey(e), { type: "text" })) === t.id) await sd().delete(emailKey(e));
}
// Brand-new client: claim every email first (atomic), then write the record only if it doesn't exist yet.
export async function createTenant(t) {
  const claimed = [];
  for (const e of t.emails) { if (!(await claimEmail(e, t.id))) { for (const c of claimed) await sd().delete(emailKey(c)); return { error: e + " is already used by another SwanDesk workspace." }; } claimed.push(e); }
  t.updatedAt = new Date().toISOString();
  await sd().setJSON("t-" + t.id, t, { onlyIfNew: true });
  return { ok: true };
}
export async function saveTenant(t, oldEmails) { // kept for older code paths; prefer updateTenant
  t.updatedAt = new Date().toISOString();
  await sd().setJSON("t-" + t.id, t);
  await syncEmails(t, oldEmails);
}
// License seats: a partner's workspace count is reserved atomically, so 20 requests at once can't go past the limit.
export async function reserveSeat(pid, limit, id) {
  const key = "seats-" + pid;
  for (let i = 0; i < 12; i++) {
    let got = await sd().getWithMetadata(key, { type: "json" });
    if (!got || !got.data) {
      const ids = (await tenants()).filter((x) => x.billing && x.billing.partnerId === pid).map((x) => x.id);
      const w = await sd().setJSON(key, { ids }, { onlyIfNew: true });
      continue;
    }
    const ids = got.data.ids || [];
    if (limit && ids.length >= limit) return false;
    const w = await sd().setJSON(key, { ids: [...ids, id] }, { onlyIfMatch: got.etag });
    if (w && w.modified === false) { await pause(20 + Math.random() * 80 * (i + 1)); continue; }
    return true;
  }
  throw new Error("busy");
}
export async function releaseSeat(pid, id) {
  for (let i = 0; i < 12; i++) {
    const got = await sd().getWithMetadata("seats-" + pid, { type: "json" }); if (!got || !got.data) return;
    const w = await sd().setJSON("seats-" + pid, { ids: (got.data.ids || []).filter((x) => x !== id) }, { onlyIfMatch: got.etag });
    if (!(w && w.modified === false)) return; await pause(30);
  }
}
export async function tenantForEmail(email) { const id = await emailOwner(email); return id ? tenant(id) : null; }
// What an agent may do right now: only if the account is in good standing AND the agent is active.
export function agentAllowed(t, agent) {
  return !!t && t.status === "active" && t.agents && t.agents[agent] && t.agents[agent].state === "active";
}
export function newTenant(b) {
  return {
    id: crypto.randomBytes(6).toString("hex"), createdAt: new Date().toISOString(),
    business: clean(b.business, 120), industry: clean(b.industry, 60), ownerName: clean(b.ownerName, 80), phone: clean(b.phone, 30), timezone: clean(b.timezone, 40) || "America/Los_Angeles",
    emails: [], status: "active", statusNote: "",
    agents: Object.fromEntries(Object.keys(AGENTS).map((a) => [a, { state: "locked", since: new Date().toISOString() }])),
    billing: { term: "monthly", jplan: "standard", setupPaid: false, paidThrough: "", notes: "" }
  };
}

// ---------- audit log (who changed what, when) ----------
export async function audit(tenantId, who, action, detail) {
  // Safe saving here too, so no history line is lost when several changes happen at once.
  const key = "audit-" + (tenantId || "admin"), line = { at: new Date().toISOString(), who, action, detail: clean(detail, 400) };
  for (let i = 0; i < 12; i++) {
    const got = await sd().getWithMetadata(key, { type: "json" });
    const list = [line, ...((got && got.data) || [])].slice(0, 1000);
    const w = got ? await sd().setJSON(key, list, { onlyIfMatch: got.etag }) : await sd().setJSON(key, list, { onlyIfNew: true });
    if (!(w && w.modified === false)) return;
    await pause(10 + Math.random() * 40 * (i + 1));
  }
}

// ---------- B2B partners (PRIVATE: admin only) ----------
// One SwanDesk code base. A partner (e.g. an outbound-only AI sales company) pays WebSwan one monthly fee for its customers' workspaces.
// "managed": WebSwan pays the voice AI and phone minutes (minute cap per client). "byo": the partner connects its own phone provider
// (Twilio etc.) and pays its own minutes; WebSwan charges a platform fee. "license": one-time license fee + monthly hosting & maintenance;
// the partner connects its own phone, voice AI and AI brain accounts (Eva, Jonathan, Tatiana) and sells to its own customers. All numbers are DRAFTS until the CEO approves Clara's numbers.
export const PARTNER_DEFAULTS = {
  edition: "voice", maxClients: 25, admins: [],
  status: "draft", plan: "license", monthlyFee: 499, licenseFee: 15000, licensePaid: false, hostingFee: 499, agentsPaidBy: "partner", includedClients: 25, perClientAfter: 15, minutes: 600, overage: 0.2, setup: 299,
  addons: { eva: 149, stan: 129, jonathan: 189, aleksander: 169 }, phonePaidBy: "partner", voicePaidBy: "partner", linkUrl: "", linkLabel: "", website: "", contact: "", notes: "", pilotEnds: "",
  // Cost assumptions are private: they live in the SD_PARTNER_COSTS environment variable on Netlify, not in this (public) code.
  cost: { phonePerMin: 0, voicePerMin: 0, number: 0, eva: 0, stan: 0, jonathan: 0, aleksander: 0, fixed: 0, hosting: 0, card: 0, ...(() => { try { return JSON.parse(process.env.SD_PARTNER_COSTS || "{}"); } catch { return {}; } })() }
};
export async function partners() { return (await sd().get("partners", { type: "json" })) || []; }
export async function partner(id) { return id ? (await partners()).find((p) => p.id === id) || null : null; }
export function withPartnerDefaults(p) {
  const d = PARTNER_DEFAULTS;
  return { ...d, ...p, addons: { ...d.addons, ...(p.addons || {}) }, cost: { ...d.cost, ...(p.cost || {}) } };
}
// The partner's monthly bill and a private profit check (cost assumptions come from a Netlify secret).
export function partnerInvoice(p, clients) {
  p = withPartnerDefaults(p);
  const n = clients.length, extra = Math.max(0, n - p.includedClients);
  const addon = { eva: 0, stan: 0, jonathan: 0 };
  for (const c of clients) for (const a of Object.keys(addon)) if (c.agents && c.agents[a] && c.agents[a].state !== "locked") addon[a]++;
  const ownAgents = p.agentsPaidBy === "partner";
  const addonTotal = ownAgents ? 0 : Object.keys(addon).reduce((t, a) => t + addon[a] * p.addons[a], 0);
  if (ownAgents) for (const a of Object.keys(addon)) addon[a] = 0;
  const base = p.plan === "license" ? p.hostingFee : p.monthlyFee;
  const monthly = (n || p.status !== "ended" ? base : 0) + extra * p.perClientAfter + addonTotal;
  const licenseDue = p.plan === "license" && !p.licensePaid ? p.licenseFee : 0;
  const setupDue = clients.filter((c) => !(c.billing && c.billing.setupPaid)).length * p.setup;
  const k = p.cost, fixedCost = p.voicePaidBy === "webswan" ? k.fixed : k.hosting, perMin = (p.phonePaidBy === "webswan" ? k.phonePerMin : 0) + (p.voicePaidBy === "webswan" ? k.voicePerMin : 0);
  const billed = Math.max(n, p.includedClients); // the flat fee is paid for the included clients even before they are all signed up
  const cost = n * (p.minutes * perMin + (p.phonePaidBy === "webswan" ? k.number : 0)) + addon.eva * k.eva + addon.stan * k.stan + addon.jonathan * k.jonathan + fixedCost + monthly * k.card;
  const fullCost = billed * (p.minutes * perMin + (p.phonePaidBy === "webswan" ? k.number : 0)) + addon.eva * k.eva + addon.stan * k.stan + addon.jonathan * k.jonathan + fixedCost + monthly * k.card;
  const margin = (c) => monthly > 0 ? Math.round((1 - c / monthly) * 100) : 0;
  return { clients: n, extraClients: extra, addons: addon, monthly, setupDue, licenseDue, costNow: Math.round(cost), costFull: Math.round(fullCost), marginNow: margin(cost), marginFull: margin(fullCost) };
}

// ---------- partner connections vault (their phone, voice AI and AI brain keys) ----------
// Keys are encrypted (AES-256-GCM) with SD_VAULT_KEY before they are stored, and are never sent back to any page (only the last 4 characters).
export const CONNECTIONS = {
  phone: { label: "Phone provider", providers: ["Twilio", "RingCentral", "Telnyx", "Plivo", "Vonage", "SignalWire", "Other"], fields: { account: "Account SID / ID", secret: "Auth token / API key", numbers: "Phone numbers (comma separated)" } },
  voice: { label: "Voice AI (Jennifer's voice)", providers: ["Cartesia", "Retell AI", "Vapi", "ElevenLabs", "Other"], fields: { secret: "API key", agent: "Agent / assistant ID" } },
  brain: { label: "AI brain for Eva, Jonathan, Tatiana & Aleksander", providers: ["OpenAI", "Anthropic (Claude)", "Google Gemini", "DeepSeek", "Other"], fields: { secret: "API key", model: "Model name (optional)" } },
  research: { label: "Research search (Eva & Jonathan)", providers: ["Perplexity", "Brave Search", "Other"], fields: { secret: "API key" } },
  design: { label: "Graphics & posting (Tatiana)", providers: ["Canva", "Content scheduler", "Other"], fields: { secret: "API key / token" } }
};
const SECRET = new Set(["secret"]);
function vaultKey() { const k = process.env.SD_VAULT_KEY; if (!k || k.length < 24) throw new Error("vault key missing"); return crypto.createHash("sha256").update(k).digest(); }
export function seal(text) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv); const enc = Buffer.concat([c.update(String(text), "utf8"), c.final()]); return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join("."); }
export function unseal(box) { const [iv, tag, enc] = String(box).split(".").map((x) => Buffer.from(x, "base64")); const d = crypto.createDecipheriv("aes-256-gcm", vaultKey(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(enc), d.final()]).toString("utf8"); }
export async function vault(pid) { return (await sd().get("vault-" + pid, { type: "json" })) || {}; }
// What pages may see: provider, non-secret fields, and only the last 4 characters of each secret.
export function vaultView(v) {
  return Object.fromEntries(Object.keys(CONNECTIONS).map((k) => { const c = v[k] || {}; const out = { provider: c.provider || "", updatedAt: c.updatedAt || "" };
    for (const f of Object.keys(CONNECTIONS[k].fields)) out[f] = SECRET.has(f) ? (c[f] ? "••••" + (c[f + "4"] || "") : "") : (c[f] || ""); return [k, out]; }));
}
export async function saveVault(pid, input) {
  const v = await vault(pid);
  for (const k of Object.keys(CONNECTIONS)) {
    const x = (input || {})[k]; if (!x) continue;
    const c = v[k] || {};
    if (x.clear) { delete v[k]; continue; }
    if (CONNECTIONS[k].providers.includes(x.provider)) c.provider = x.provider;
    for (const f of Object.keys(CONNECTIONS[k].fields)) {
      const val = clean(x[f], 600); if (!val) continue;
      if (SECRET.has(f)) { c[f] = seal(val); c[f + "4"] = val.slice(-4); } else c[f] = val;
    }
    c.updatedAt = new Date().toISOString(); v[k] = c;
  }
  await sd().setJSON("vault-" + pid, v);
  return vaultView(v);
}

// ---------- partner admins (the licensee's own staff) ----------
// Editions: "voice" = Partner Voice Edition (Jennifer only; Eva, Jonathan and Tatiana are upgrades WebSwan turns on),
// "enterprise" = SwanDesk AI Enterprise (all 4 agents + WorkPilot Business Edition).
export const EDITION_AGENTS = { voice: ["jennifer"], enterprise: Object.keys(AGENTS) };
export async function partnerForAdmin(email) {
  const e = String(email).toLowerCase();
  return (await partners()).find((p) => (p.admins || []).includes(e) && p.status !== "ended") || null;
}
export async function partnerClients(pid) { return (await tenants()).filter((t) => t.billing && t.billing.partnerId === pid); }

// ---------- backups (daily + on demand) ----------
// A backup copies EVERY SwanDesk record (clients, partners, prices, audit logs, encrypted partner keys stay encrypted) into a separate store.
export const backups = () => getStore({ name: "swandesk-backups", consistency: "strong" });
export async function makeBackup(reason) {
  const data = {};
  for await (const page of sd().list({ paginate: true })) for (const b of page.blobs) data[b.key] = await sd().get(b.key, { type: "text" });
  const key = "backup-" + new Date().toISOString().replace(/[:.]/g, "-");
  const body = JSON.stringify({ at: new Date().toISOString(), reason: clean(reason, 80), count: Object.keys(data).length, data });
  await backups().set(key, body);
  // Verify: read it back and compare every record before calling it a good backup.
  const check = JSON.parse(await backups().get(key, { type: "text" }));
  const ok = Object.keys(data).every((k) => check.data[k] === data[k]);
  return { key, count: Object.keys(data).length, bytes: body.length, verified: ok };
}
export async function listBackups() {
  const out = []; for await (const page of backups().list({ paginate: true })) for (const b of page.blobs) out.push(b.key);
  return out.sort().reverse();
}
// Restore puts every record from the backup back. Records created after the backup are left alone (nothing is deleted).
// A safety backup of the current state is taken first, so a restore can itself be undone.
export async function restoreBackup(key) {
  const raw = await backups().get(key, { type: "text" }); if (!raw) throw new Error("Backup not found.");
  const safety = await makeBackup("before restoring " + key);
  const { data } = JSON.parse(raw);
  for (const [k, v] of Object.entries(data)) await sd().set(k, v);
  return { restored: Object.keys(data).length, safety: safety.key };
}
