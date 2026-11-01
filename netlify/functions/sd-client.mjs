// SwanDesk AI client API: what the signed-in client sees (their workspace, which agents are on) and upgrade requests.
// A client can pause/resume an ACTIVE agent they own; they can never unlock a locked or suspended one.
import { whoIs, isAdmin, sameSite, json, clean, AGENTS, sd, tenant, tenantForEmail, saveTenant, audit } from "../lib/core.mjs";

const view = (t) => ({
  id: t.id, business: t.business, ownerName: t.ownerName, status: t.status, statusNote: t.status === "active" ? "" : "Your account is paused. Please contact WebSwan Digital Solutions.",
  agents: Object.fromEntries(Object.entries(AGENTS).map(([k, a]) => [k, { ...a, state: t.status === "active" ? t.agents[k].state : (t.agents[k].state === "locked" ? "locked" : "suspended") }]))
});

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!sameSite(req)) return json(403, { error: "Not allowed from this page." });
  let who; try { who = await whoIs(req); } catch { return json(401, { error: "Please sign in." }); }
  let b = {}; try { b = await req.json(); } catch { b = {}; }
  // Tania can open any client's dashboard to see exactly what they see.
  const t = isAdmin(who) && b.as ? await tenant(clean(b.as, 20)) : await tenantForEmail(who);
  if (!t) return json(403, { error: isAdmin(who) ? "Pick a client in the admin page, then use 'View as client'." : "This Google account isn't connected to a SwanDesk workspace yet. Please contact WebSwan Digital Solutions." });

  if (b.action === "me") return json(200, { workspace: view(t), admin: isAdmin(who) });

  if (b.action === "request") {
    if (!AGENTS[b.agent]) return json(400, { error: "Unknown agent." });
    const reqs = (await sd().get("upgrade-requests", { type: "json" })) || [];
    if (reqs.some((r) => !r.done && r.tenantId === t.id && r.agent === b.agent)) return json(200, { ok: true, message: "We already have your request. WebSwan will contact you soon." });
    reqs.unshift({ id: Date.now().toString(36), at: new Date().toISOString(), tenantId: t.id, business: t.business, agent: b.agent, by: who, note: clean(b.note, 300), done: false });
    await sd().setJSON("upgrade-requests", reqs.slice(0, 500));
    await audit(t.id, who, "upgrade request", AGENTS[b.agent].name);
    return json(200, { ok: true, message: `Thank you! WebSwan will contact you about adding ${AGENTS[b.agent].name}.` });
  }

  if (b.action === "pause" || b.action === "resume") {
    const a = t.agents[b.agent];
    if (!a || t.status !== "active") return json(403, { error: "Not available." });
    if (b.action === "pause" && a.state !== "active") return json(403, { error: "Only an active agent can be paused." });
    if (b.action === "resume" && a.state !== "paused") return json(403, { error: "Only a paused agent can be resumed." });
    t.agents[b.agent] = { state: b.action === "pause" ? "paused" : "active", since: new Date().toISOString() };
    await saveTenant(t); await audit(t.id, who, b.action, AGENTS[b.agent].name);
    return json(200, { workspace: view(t) });
  }
  return json(400, { error: "Unknown action." });
};
