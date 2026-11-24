// SwanDesk AI admin API (Tania only): clients, agent switches, non-payment switch, billing terms, prices, upgrade requests, audit log.
import { whoIs, isAdmin, sameSite, json, clean, isEmail, AGENTS, AGENT_STATES, getPricing, priceFor, termTotal, PRICING_VERSION,
  sd, tenants, tenant, saveTenant, emailOwner, updateTenant, createTenant, claimEmail, EDITION_AGENTS, newTenant, audit, partners, withPartnerDefaults, partnerInvoice, PARTNER_DEFAULTS, CONNECTIONS, vault, vaultView, saveVault, makeBackup, listBackups, restoreBackup, backups } from "../lib/core.mjs";
import crypto from "node:crypto";

function summary(t, pricing) {
  const on = Object.keys(AGENTS).filter((a) => t.agents[a] && t.agents[a].state !== "locked");
  const p = priceFor(on, pricing, t.billing.jplan);
  return { ...t, licensed: on, monthly: p.monthly, setupFee: p.setup, termTotal: termTotal(p.monthly, t.billing.term, pricing), partnerId: t.billing.partnerId || "" };
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
    for (const t of await tenants()) all.push(summary(t, pricing));
    const reqs = (await sd().get("upgrade-requests", { type: "json" })) || [];
    const parts = (await partners()).map((x) => { const pp = withPartnerDefaults(x); return { ...pp, invoice: partnerInvoice(pp, all.filter((c) => c.partnerId === pp.id)) }; });
    return json(200, { clients: all, agents: AGENTS, states: AGENT_STATES, pricing, requests: reqs.filter((r) => !r.done).slice(0, 100), partners: parts, partnerDefaults: PARTNER_DEFAULTS, connections: CONNECTIONS });
  }

  if (b.action === "create") {
    const t = newTenant(b);
    if (!t.business) return json(400, { error: "Add the business name." });
    t.emails = (Array.isArray(b.emails) ? b.emails : String(b.emails || "").split(/[,\s]+/)).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 10);
    if (!t.emails.length) return json(400, { error: "Add at least one Google email the client will sign in with." });

    for (const a of Object.keys(AGENTS)) if ((b.agents || []).includes(a)) t.agents[a] = { state: "active", since: new Date().toISOString() };
    if (PRICING_TERMS(pricing).includes(b.term)) t.billing.term = b.term;
    if (JPLANS.includes(b.jplan)) t.billing.jplan = b.jplan;
    if (b.partnerId && (await partners()).some((x) => x.id === b.partnerId)) t.billing.partnerId = b.partnerId;
    const made = await createTenant(t); if (made.error) return json(400, { error: made.error }); await audit(t.id, who, "created", `${t.business}; agents: ${(b.agents || []).join(", ") || "none"}`);
    return json(200, { client: summary(t, pricing) });
  }

  // B2B partners: create or update a partner deal (prices stay drafts until the CEO approves).
  if (b.action === "partner_save") {
    const list = await partners(), x = b.partner || {};
    let p = list.find((q) => q.id === x.id);
    if (!p) { p = { id: crypto.randomBytes(5).toString("hex"), createdAt: new Date().toISOString() }; list.push(p); }
    const name = clean(x.name, 80); if (!name) return json(400, { error: "Add the partner's company name." });
    const num = (v, d, max) => { const n = Number(v); return v !== "" && v != null && n >= 0 && n <= max ? Math.round(n * 10000) / 10000 : d; };
    const url = (v) => { const u = clean(v, 300); try { return u && new URL(u).protocol === "https:" ? u : ""; } catch { return ""; } };
    const d = withPartnerDefaults(p);
    Object.assign(p, {
      name, contact: clean(x.contact, 120), website: url(x.website), linkUrl: url(x.linkUrl), linkLabel: clean(x.linkLabel, 60), notes: clean(x.notes, 800),
      status: ["draft", "pilot", "active", "ended"].includes(x.status) ? x.status : d.status, plan: ["managed", "byo", "license"].includes(x.plan) ? x.plan : d.plan,
      agentsPaidBy: ["webswan", "partner"].includes(x.agentsPaidBy) ? x.agentsPaidBy : d.agentsPaidBy, licensePaid: x.licensePaid === true,
      licenseFee: num(x.licenseFee, d.licenseFee, 1000000), hostingFee: num(x.hostingFee, d.hostingFee, 100000),
      phonePaidBy: ["webswan", "partner"].includes(x.phonePaidBy) ? x.phonePaidBy : d.phonePaidBy, voicePaidBy: ["webswan", "partner"].includes(x.voicePaidBy) ? x.voicePaidBy : d.voicePaidBy,
      edition: ["voice", "enterprise"].includes(x.edition) ? x.edition : d.edition, maxClients: Math.round(num(x.maxClients, d.maxClients, 100000)),
      admins: (Array.isArray(x.admins) ? x.admins : String(x.admins || "").split(/[,\s]+/)).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 20),
      pilotEnds: /^\d{4}-\d{2}-\d{2}$/.test(x.pilotEnds || "") ? x.pilotEnds : "",
      monthlyFee: num(x.monthlyFee, d.monthlyFee, 100000), includedClients: Math.round(num(x.includedClients, d.includedClients, 1000)), perClientAfter: num(x.perClientAfter, d.perClientAfter, 10000),
      minutes: Math.round(num(x.minutes, d.minutes, 100000)), overage: num(x.overage, d.overage, 5), setup: num(x.setup, d.setup, 10000),
      addons: Object.fromEntries(Object.keys(d.addons).map((a) => [a, num((x.addons || {})[a], d.addons[a], 10000)])),
      cost: Object.fromEntries(Object.keys(d.cost).map((k) => [k, num((x.cost || {})[k], d.cost[k], 100000)])),
      updatedAt: new Date().toISOString()
    });
    await sd().setJSON("partners", list); await audit("", who, "partner", `${p.name}: ${p.status}, ${p.plan}, $${p.monthlyFee}/mo for ${p.includedClients} clients`);
    return json(200, { ok: true, id: p.id });
  }

  // Backups: make one now, list them, download one, restore one (restore first takes a safety backup).
  if (b.action === "backup_now") { const r = await makeBackup(clean(b.reason, 80) || "manual"); await audit("", who, "backup", `${r.key} · ${r.count} records · verified ${r.verified}`); return json(200, r); }
  if (b.action === "backup_list") return json(200, { backups: (await listBackups()).slice(0, 60) });
  if (b.action === "backup_get") { const raw = await backups().get(clean(b.key, 80), { type: "text" }); return raw ? new Response(raw, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }) : json(404, { error: "Backup not found." }); }
  if (b.action === "backup_restore") {
    if (b.confirm !== "RESTORE") return json(400, { error: "Type RESTORE to confirm." });
    try { const r = await restoreBackup(clean(b.key, 80)); await audit("", who, "restore", `${b.key} · ${r.restored} records · safety ${r.safety}`); return json(200, r); } catch (e) { return json(400, { error: e.message }); }
  }

  // Partner connections: their own phone, voice AI and AI keys. Saved encrypted; pages only ever see the last 4 characters.
  if (b.action === "vault_get" || b.action === "vault_save") {
    const p = (await partners()).find((q) => q.id === b.partnerId); if (!p) return json(404, { error: "Partner not found." });
    try {
      if (b.action === "vault_get") return json(200, { vault: vaultView(await vault(p.id)) });
      const view = await saveVault(p.id, b.vault); await audit("", who, "partner connections", `${p.name}: ${Object.keys(b.vault || {}).join(", ")}`);
      return json(200, { vault: view });
    } catch (e) { return json(500, { error: e.message === "vault key missing" ? "The vault key isn't set on Netlify yet." : "Could not save the connections." }); }
  }

  const t = await tenant(clean(b.id, 20));
  if (!t && b.action !== "pricing" && b.action !== "request_done") return json(404, { error: "Client not found." });

  // Every change below is applied with safe saving (updateTenant), so two changes at the same moment are both kept.
  const save = async (label, detail, change) => {
    try { const r = await updateTenant(t.id, change); if (r && r.error) return json(400, { error: r.error }); await audit(t.id, who, label, typeof detail === "function" ? detail(r) : detail); return json(200, { client: summary(r, pricing) }); }
    catch { return json(503, { error: "SwanDesk is busy, please try again." }); }
  };
  // Agent licensing: locked (not purchased), active, paused, suspended. Only admins reach this code.
  if (b.action === "agent") {
    if (!AGENTS[b.agent] || !AGENT_STATES.includes(b.state)) return json(400, { error: "Bad agent or state." });
    let before; return save("agent", () => `${AGENTS[b.agent].name}: ${before} → ${b.state}`, (x) => { before = x.agents[b.agent].state; x.agents[b.agent] = { state: b.state, since: new Date().toISOString() }; });
  }
  // Non-payment switch: suspends the whole account (every agent stops) until switched back on.
  if (b.action === "account") {
    const on = b.on === true;
    return save(on ? "account on" : "account off", on ? "Back on" : clean(b.note, 200) || "Paused for non-payment", (x) => { x.status = on ? "active" : "suspended"; x.statusNote = on ? "" : clean(b.note, 200) || "Paused for non-payment"; });
  }
  if (b.action === "update") {
    let em = null;
    if (b.emails != null) {
      em = (Array.isArray(b.emails) ? b.emails : String(b.emails).split(/[,\s]+/)).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 10);
      for (const e of em) if (!(t.emails || []).includes(e) && !(await claimEmail(e, t.id))) return json(400, { error: e + " already belongs to another client." });
    }
    const valid = async () => (await partners()).some((x) => x.id === b.billing.partnerId);
    const partnerOk = b.billing && b.billing.partnerId ? await valid() : false;
    return save("updated", "details / billing", (x) => {
      for (const k of ["business", "industry", "ownerName", "phone", "timezone"]) if (typeof b[k] === "string") x[k] = clean(b[k], 120);
      if (em && em.length) x.emails = em;
      if (b.billing) {
        if (PRICING_TERMS(pricing).includes(b.billing.term)) x.billing.term = b.billing.term;
        if (JPLANS.includes(b.billing.jplan)) x.billing.jplan = b.billing.jplan;
        if (typeof b.billing.setupPaid === "boolean") x.billing.setupPaid = b.billing.setupPaid;
        if (/^\d{4}-\d{2}-\d{2}$/.test(b.billing.paidThrough || "")) x.billing.paidThrough = b.billing.paidThrough;
        if (typeof b.billing.notes === "string") x.billing.notes = clean(b.billing.notes, 500);
        if (b.billing.partnerId === "") x.billing.partnerId = "";
        else if (partnerOk) x.billing.partnerId = b.billing.partnerId;
      }
    });
  }
  if (b.action === "audit") return json(200, { log: ((await sd().get("audit-" + t.id, { type: "json" })) || []).slice(0, 200) });
  if (b.action === "request_done") {
    const reqs = (await sd().get("upgrade-requests", { type: "json" })) || [];
    const r = reqs.find((x) => x.id === b.requestId); if (r) { r.done = true; r.doneAt = new Date().toISOString(); }
    await sd().setJSON("upgrade-requests", reqs);
    return json(200, { ok: true });
  }
  if (b.action === "pricing") {
    const p = b.pricing || {}, out = { version: PRICING_VERSION, agent: {}, bundle: {}, setup: {}, terms: {} };
    for (const a of Object.keys(AGENTS)) if (Number(p.agent && p.agent[a]) > 0) out.agent[a] = Math.round(Number(p.agent[a]));
    for (const n of [2, 3, 4]) if (Number(p.bundle && p.bundle[n]) > 0) out.bundle[n] = Math.round(Number(p.bundle[n]));
    for (const n of [1, 2, 3, 4]) if (Number(p.setup && p.setup[n]) >= 0 && p.setup && p.setup[n] !== "") out.setup[n] = Math.round(Number(p.setup[n]));
    out.jplans = {}; for (const k of JPLANS) if (Number(p.jplans && p.jplans[k] && p.jplans[k].price) > 0) out.jplans[k] = { price: Math.round(Number(p.jplans[k].price)), minutes: Math.max(0, Math.round(Number(p.jplans[k].minutes) || pricing.jplans[k].minutes)) };
    if (Number(p.overage) > 0 && Number(p.overage) < 5) out.overage = Math.round(Number(p.overage) * 100) / 100;
    if (Number(p.proUpgrade) >= 0 && p.proUpgrade !== "" && p.proUpgrade != null) out.proUpgrade = Math.round(Number(p.proUpgrade));
    for (const k of Object.keys(pricing.terms)) { const v = Number(p.terms && p.terms[k]); if (v >= 0 && v < 0.5) out.terms[k] = { off: v }; }
    await sd().setJSON("pricing", out); await audit("", who, "pricing", JSON.stringify(out).slice(0, 380));
    return json(200, { pricing: await getPricing() });
  }
  return json(400, { error: "Unknown action." });
};
const PRICING_TERMS = (p) => Object.keys(p.terms);
const JPLANS = ["lite", "standard", "pro"];
