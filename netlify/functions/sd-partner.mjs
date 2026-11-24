// SwanDesk AI partner portal API: the licensee's own staff manage only THEIR customers' workspaces and THEIR provider connections.
// They never see WebSwan's prices, costs, other partners or WebSwan's own clients.
import { whoIs, isAdmin, sameSite, json, clean, isEmail, AGENTS, tenant, saveTenant, newTenant, audit, emailOwner,
  partnerForAdmin, partnerClients, partners, EDITION_AGENTS, CONNECTIONS, vault, vaultView, saveVault } from "../lib/core.mjs";

const clientView = (t) => ({ id: t.id, business: t.business, ownerName: t.ownerName, industry: t.industry, phone: t.phone, emails: t.emails, status: t.status, createdAt: t.createdAt,
  agents: Object.fromEntries(Object.keys(AGENTS).map((a) => [a, t.agents[a].state])) });

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!sameSite(req)) return json(403, { error: "Not allowed from this page." });
  let who; try { who = await whoIs(req); } catch { return json(401, { error: "Please sign in." }); }
  let b = {}; try { b = await req.json(); } catch { b = {}; }
  // Tania can open any partner's portal to see exactly what they see (?as=<partner id>).
  const p = isAdmin(who) && b.as ? (await partners()).find((x) => x.id === b.as) : await partnerForAdmin(who);
  if (!p) return json(403, { error: "This account isn't a SwanDesk partner account. Please contact The WebSwan." });
  const allowed = EDITION_AGENTS[p.edition] || EDITION_AGENTS.voice;
  const mine = await partnerClients(p.id);
  const limit = Number(p.maxClients) || 0;

  if (b.action === "me") {
    return json(200, { partner: { name: p.name, edition: p.edition, status: p.status, maxClients: limit, used: mine.length },
      agents: Object.fromEntries(Object.entries(AGENTS).map(([k, a]) => [k, { name: a.name, role: a.role, included: allowed.includes(k) }])),
      clients: mine.map(clientView), connections: CONNECTIONS, vault: vaultView(await vault(p.id)), admin: isAdmin(who) });
  }
  if (b.action === "create") {
    if (limit && mine.length >= limit) return json(403, { error: `Your license includes ${limit} customer workspaces. Contact The WebSwan to add more.` });
    const t = newTenant(b);
    if (!t.business) return json(400, { error: "Add the business name." });
    t.emails = String(b.emails || "").split(/[,\s]+/).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 10);
    if (!t.emails.length) return json(400, { error: "Add at least one email the customer will sign in with." });
    for (const e of t.emails) if (await emailOwner(e)) return json(400, { error: e + " is already used by another SwanDesk workspace." });
    t.billing.partnerId = p.id; t.billing.setupPaid = false;
    for (const a of allowed) if ((b.agents || []).includes(a)) t.agents[a] = { state: "active", since: new Date().toISOString() };
    await saveTenant(t); await audit(t.id, who, "created by partner", `${p.name}: ${t.business}`);
    return json(200, { client: clientView(t) });
  }
  if (b.action === "vault_save") {
    const v = await saveVault(p.id, b.vault).catch((e) => null);
    if (!v) return json(500, { error: "Could not save the connections." });
    await audit("", who, "partner connections (partner)", `${p.name}: ${Object.keys(b.vault || {}).join(", ")}`);
    return json(200, { vault: v });
  }
  // Everything below acts on one of THIS partner's customers only.
  const t = await tenant(clean(b.id, 32));
  if (!t || !t.billing || t.billing.partnerId !== p.id) return json(404, { error: "Customer not found." });
  if (b.action === "agent") {
    // Partners switch on/off only the agents their edition includes; upgrades (e.g. Eva on Voice Edition) are turned on by WebSwan.
    if (!allowed.includes(b.agent) || !["active", "paused", "locked"].includes(b.state)) return json(403, { error: "That agent isn't included in your license. Contact The WebSwan to add it." });
    t.agents[b.agent] = { state: b.state, since: new Date().toISOString() };
    await saveTenant(t); await audit(t.id, who, "partner: agent", `${AGENTS[b.agent].name} → ${b.state}`);
    return json(200, { client: clientView(t) });
  }
  if (b.action === "account") {
    t.status = b.on === true ? "active" : "suspended"; t.statusNote = b.on === true ? "" : "Paused by " + p.name;
    await saveTenant(t); await audit(t.id, who, "partner: account " + (b.on === true ? "on" : "off"), p.name);
    return json(200, { client: clientView(t) });
  }
  if (b.action === "update") {
    for (const k of ["business", "industry", "ownerName", "phone"]) if (typeof b[k] === "string" && b[k].trim()) t[k] = clean(b[k], 120);
    let old;
    if (b.emails != null) {
      const em = String(b.emails).split(/[,\s]+/).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 10);
      for (const e of em) { const id = await emailOwner(e); if (id && id !== t.id) return json(400, { error: e + " is already used by another SwanDesk workspace." }); }
      if (em.length) { old = t.emails; t.emails = em; }
    }
    await saveTenant(t, old); await audit(t.id, who, "partner: updated", p.name);
    return json(200, { client: clientView(t) });
  }
  return json(400, { error: "Unknown action." });
};
