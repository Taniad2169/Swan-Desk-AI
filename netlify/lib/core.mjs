// SwanDesk AI core: Google sign-in check (Firebase), client workspaces, agent licensing, billing terms and the audit log.
// Everything is enforced here on the server; the pages only show what the server allows.
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "webswan-gigoia-task";
// WebSwan administrators (Tania). Only these accounts can create clients, switch agents or suspend for non-payment.
export const ADMINS = ["thewebswann@gmail.com", "taniadomingue373@gmail.com"];
export const AGENTS = {
  jennifer: { name: "Jennifer", role: "Receptionist & Appointment Setter", desc: "Answers your calls 24/7, books appointments on your calendar, takes messages, and makes warm follow-up calls only to people who asked you to call them back (like the contact you met at an event, or the homeowner who said 'call me in 3 months')." },
  eva: { name: "Eva", role: "Executive Assistant", desc: "Reads your inbox every morning and tells you what matters, prepares personalized email drafts (with PDFs and photos attached) for you to approve, keeps your follow-ups and tasks on track, and sends friendly holiday and market-update emails to your future clients." },
  stan: { name: "Stan", role: "Social Media Content Creator", desc: "Plans a full month of posts for Facebook, Instagram, LinkedIn, TikTok and Google Business, with branded pictures and captions, and schedules them after you approve. Your videos go out on the dates you choose." }
};
export const AGENT_STATES = ["locked", "active", "paused", "suspended"];

// Prices (USD per month). Setup: 1-2 agents $299, all 3 $499. Prepaying reduces the price.
export const PRICING = {
  agent: { jennifer: 349, eva: 199, stan: 199 },
  bundle: { 2: 499, 3: 699 },
  setup: { 1: 299, 2: 299, 3: 499 },
  terms: { monthly: { months: 1, off: 0, label: "Monthly" }, quarterly: { months: 3, off: 0.05, label: "Every 3 months" }, semiannual: { months: 6, off: 0.10, label: "Every 6 months" }, annual: { months: 12, off: 0.15, label: "Once a year" } }
};
export async function getPricing() {
  const saved = (await sd().get("pricing", { type: "json" }).catch(() => null)) || {};
  return { agent: { ...PRICING.agent, ...(saved.agent || {}) }, bundle: { ...PRICING.bundle, ...(saved.bundle || {}) }, setup: { ...PRICING.setup, ...(saved.setup || {}) }, terms: Object.fromEntries(Object.entries(PRICING.terms).map(([k, v]) => [k, { ...v, ...((saved.terms || {})[k] || {}) }])) };
}
// Monthly price for a set of agents: the bundle price, but never more than buying them separately.
export function priceFor(agents, pricing) {
  const list = agents.filter((a) => pricing.agent[a] != null);
  if (!list.length) return { monthly: 0, setup: 0 };
  const sum = list.reduce((t, a) => t + pricing.agent[a], 0);
  const monthly = list.length === 1 ? sum : Math.min(sum, pricing.bundle[list.length] || sum);
  return { monthly, setup: pricing.setup[list.length] || 0, separately: sum };
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
export async function tenants() { return (await sd().get("tenants", { type: "json" })) || []; }
export async function tenant(id) { return id ? await sd().get("t-" + id, { type: "json" }) : null; }
export async function saveTenant(t) {
  t.updatedAt = new Date().toISOString();
  await sd().setJSON("t-" + t.id, t);
  const list = (await tenants()).filter((x) => x.id !== t.id);
  list.push({ id: t.id, business: t.business, status: t.status, emails: t.emails });
  await sd().setJSON("tenants", list.sort((a, b) => a.business.localeCompare(b.business)));
}
export async function tenantForEmail(email) {
  const hit = (await tenants()).find((t) => (t.emails || []).includes(email));
  return hit ? tenant(hit.id) : null;
}
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
    billing: { term: "monthly", setupPaid: false, paidThrough: "", notes: "" }
  };
}

// ---------- audit log (who changed what, when) ----------
export async function audit(tenantId, who, action, detail) {
  const key = "audit-" + (tenantId || "admin");
  const list = (await sd().get(key, { type: "json" })) || [];
  list.unshift({ at: new Date().toISOString(), who, action, detail: clean(detail, 400) });
  await sd().setJSON(key, list.slice(0, 1000));
}
