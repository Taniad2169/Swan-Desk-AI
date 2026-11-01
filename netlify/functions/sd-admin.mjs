// SwanDesk AI admin API (Tania only): clients, agent switches, non-payment switch, billing terms, prices, upgrade requests, audit log.
import { whoIs, isAdmin, sameSite, json, clean, isEmail, AGENTS, AGENT_STATES, getPricing, priceFor, termTotal,
  sd, tenants, tenant, saveTenant, newTenant, audit } from "../lib/core.mjs";

function summary(t, pricing) {
  const on = Object.keys(AGENTS).filter((a) => t.agents[a] && t.agents[a].state !== "locked");
  const p = priceFor(on, pricing);
  return { ...t, licensed: on, monthly: p.monthly, setupFee: p.setup, termTotal: termTotal(p.monthly, t.billing.term, pricing) };
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!sameSite(req)) return json(403, { error: "Not allowed from this page." });
  let who; try { who = await whoIs(req); } catch { return json(401, { error: "Please sign in." }); }
  if (!isAdmin(who)) return json(403, { error: "This page is for WebSwan administrators." });
  let b = {}; try { b = await req.json(); } catch { return json(400, { error: "Bad request." }); }
  const pricing = await getPricing();

  if (b.action === "list") {
    const all = [];
    for (const x of await tenants()) { const t = await tenant(x.id); if (t) all.push(summary(t, pricing)); }
    const reqs = (await sd().get("upgrade-requests", { type: "json" })) || [];
    return json(200, { clients: all, agents: AGENTS, states: AGENT_STATES, pricing, requests: reqs.filter((r) => !r.done).slice(0, 100) });
  }

  if (b.action === "create") {
    const t = newTenant(b);
    if (!t.business) return json(400, { error: "Add the business name." });
    t.emails = (Array.isArray(b.emails) ? b.emails : String(b.emails || "").split(/[,\s]+/)).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 10);
    if (!t.emails.length) return json(400, { error: "Add at least one Google email the client will sign in with." });
    const taken = (await tenants()).find((x) => (x.emails || []).some((e) => t.emails.includes(e)));
    if (taken) return json(400, { error: "That email already belongs to " + taken.business + "." });
    for (const a of Object.keys(AGENTS)) if ((b.agents || []).includes(a)) t.agents[a] = { state: "active", since: new Date().toISOString() };
    if (PRICING_TERMS(pricing).includes(b.term)) t.billing.term = b.term;
    await saveTenant(t); await audit(t.id, who, "created", `${t.business}; agents: ${(b.agents || []).join(", ") || "none"}`);
    return json(200, { client: summary(t, pricing) });
  }

  const t = await tenant(clean(b.id, 20));
  if (!t && b.action !== "pricing" && b.action !== "request_done") return json(404, { error: "Client not found." });

  // Agent licensing: locked (not purchased), active, paused, suspended. Only admins reach this code.
  if (b.action === "agent") {
    if (!AGENTS[b.agent] || !AGENT_STATES.includes(b.state)) return json(400, { error: "Bad agent or state." });
    const before = t.agents[b.agent].state;
    t.agents[b.agent] = { state: b.state, since: new Date().toISOString() };
    await saveTenant(t); await audit(t.id, who, "agent", `${AGENTS[b.agent].name}: ${before} → ${b.state}`);
    return json(200, { client: summary(t, pricing) });
  }
  // Non-payment switch: suspends the whole account (every agent stops) until switched back on.
  if (b.action === "account") {
    const on = b.on === true;
    t.status = on ? "active" : "suspended"; t.statusNote = on ? "" : clean(b.note, 200) || "Paused for non-payment";
    await saveTenant(t); await audit(t.id, who, on ? "account on" : "account off", t.statusNote || "Back on");
    return json(200, { client: summary(t, pricing) });
  }
  if (b.action === "update") {
    for (const k of ["business", "industry", "ownerName", "phone", "timezone"]) if (typeof b[k] === "string") t[k] = clean(b[k], 120);
    if (b.emails != null) {
      const em = (Array.isArray(b.emails) ? b.emails : String(b.emails).split(/[,\s]+/)).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 10);
      const clash = (await tenants()).find((x) => x.id !== t.id && (x.emails || []).some((e) => em.includes(e)));
      if (clash) return json(400, { error: "An email already belongs to " + clash.business + "." });
      if (em.length) t.emails = em;
    }
    if (b.billing) {
      if (PRICING_TERMS(pricing).includes(b.billing.term)) t.billing.term = b.billing.term;
      if (typeof b.billing.setupPaid === "boolean") t.billing.setupPaid = b.billing.setupPaid;
      if (/^\d{4}-\d{2}-\d{2}$/.test(b.billing.paidThrough || "")) t.billing.paidThrough = b.billing.paidThrough;
      if (typeof b.billing.notes === "string") t.billing.notes = clean(b.billing.notes, 500);
    }
    await saveTenant(t); await audit(t.id, who, "updated", "details / billing");
    return json(200, { client: summary(t, pricing) });
  }
  if (b.action === "audit") return json(200, { log: ((await sd().get("audit-" + t.id, { type: "json" })) || []).slice(0, 200) });
  if (b.action === "request_done") {
    const reqs = (await sd().get("upgrade-requests", { type: "json" })) || [];
    const r = reqs.find((x) => x.id === b.requestId); if (r) { r.done = true; r.doneAt = new Date().toISOString(); }
    await sd().setJSON("upgrade-requests", reqs);
    return json(200, { ok: true });
  }
  if (b.action === "pricing") {
    const p = b.pricing || {}, out = { agent: {}, bundle: {}, setup: {}, terms: {} };
    for (const a of Object.keys(AGENTS)) if (Number(p.agent && p.agent[a]) > 0) out.agent[a] = Math.round(Number(p.agent[a]));
    for (const n of [2, 3]) if (Number(p.bundle && p.bundle[n]) > 0) out.bundle[n] = Math.round(Number(p.bundle[n]));
    for (const n of [1, 2, 3]) if (Number(p.setup && p.setup[n]) >= 0 && p.setup && p.setup[n] !== "") out.setup[n] = Math.round(Number(p.setup[n]));
    for (const k of Object.keys(pricing.terms)) { const v = Number(p.terms && p.terms[k]); if (v >= 0 && v < 0.5) out.terms[k] = { off: v }; }
    await sd().setJSON("pricing", out); await audit("", who, "pricing", JSON.stringify(out).slice(0, 380));
    return json(200, { pricing: await getPricing() });
  }
  return json(400, { error: "Unknown action." });
};
const PRICING_TERMS = (p) => Object.keys(p.terms);
