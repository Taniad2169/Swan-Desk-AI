// SwanDesk AI partner portal API: the licensee's own staff manage only THEIR customers' workspaces and THEIR provider connections.
// They never see WebSwan's prices, costs, other partners or WebSwan's own clients.
import { whoIs, isAdmin, sameSite, json, clean, isEmail, AGENTS, tenant, newTenant, audit, updateTenant, createTenant, claimEmail, reserveSeat, releaseSeat,
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
    const t = newTenant(b);
    if (!t.business) return json(400, { error: "Add the business name." });
    t.emails = String(b.emails || "").split(/[,\s]+/).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 10);
    if (!t.emails.length) return json(400, { error: "Add at least one email the customer will sign in with." });
    t.billing.partnerId = p.id; t.billing.setupPaid = false;
    for (const a of allowed) if ((b.agents || []).includes(a)) t.agents[a] = { state: "active", since: new Date().toISOString() };
    // The seat is reserved atomically on the server, so the license limit holds even if many requests arrive at once.
    if (!(await reserveSeat(p.id, limit, t.id))) return json(403, { error: `Your license includes ${limit} customer workspaces. Contact The WebSwan to add more.` });
    const made = await createTenant(t); if (made.error) { await releaseSeat(p.id, t.id); return json(400, { error: made.error }); } await audit(t.id, who, "created by partner", `${p.name}: ${t.business}`);
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
  const save = async (label, detail, change) => {
    try {
      const r = await updateTenant(t.id, (x) => { if (!x.billing || x.billing.partnerId !== p.id) return { error: "Customer not found." }; return change(x); });
      if (!r || r.error) return json(404, { error: "Customer not found." });
      await audit(t.id, who, label, detail); return json(200, { client: clientView(r) });
    } catch { return json(503, { error: "SwanDesk is busy, please try again." }); }
  };
  if (b.action === "agent") {
    // Partners switch on/off only the agents their edition includes; upgrades (e.g. Eva on Voice Edition) are turned on by WebSwan.
    if (!allowed.includes(b.agent) || !["active", "paused", "locked"].includes(b.state)) return json(403, { error: "That agent isn't included in your license. Contact The WebSwan to add it." });
    return save("partner: agent", `${AGENTS[b.agent].name} → ${b.state}`, (x) => { x.agents[b.agent] = { state: b.state, since: new Date().toISOString() }; });
  }
  if (b.action === "account") {
    const on = b.on === true;
    return save("partner: account " + (on ? "on" : "off"), p.name, (x) => { x.status = on ? "active" : "suspended"; x.statusNote = on ? "" : "Paused by " + p.name; });
  }
  if (b.action === "update") {
    let em = null;
    if (b.emails != null) {
      em = String(b.emails).split(/[,\s]+/).map((e) => clean(e, 120).toLowerCase()).filter(isEmail).slice(0, 10);
      for (const e of em) if (!(t.emails || []).includes(e) && !(await claimEmail(e, t.id))) return json(400, { error: e + " is already used by another SwanDesk workspace." });
    }
    return save("partner: updated", p.name, (x) => {
      for (const k of ["business", "industry", "ownerName", "phone"]) if (typeof b[k] === "string" && b[k].trim()) x[k] = clean(b[k], 120);
      if (em && em.length) x.emails = em;
    });
  }
  return json(400, { error: "Unknown action." });
};
