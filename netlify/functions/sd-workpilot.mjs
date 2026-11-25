// SwanDesk WorkPilot (Tania, Nov 24): the partner-edition board -- a second static page (repo WS-Work-Pilot, on
// GitHub Pages, taniad2169.github.io) for the companies that PURCHASE and RESELL SwanDesk AI to their own
// business customers. It is NOT for those end businesses (they get their own client dashboard at `/`), and it is
// NOT a WebSwan-internal tool (no Voice Studio, no WebSwan branding) -- a partner signs in with their own email
// and sees only their own resold customers, the same scoping sd-partner.mjs already enforces for the partner
// portal. Tania herself can open any partner's board the same way she can open their portal (b.as).
// sd-admin.mjs/sd-partner.mjs enforce sameSite (same host as this Netlify site) because their own pages are
// served from this same origin. WS-Work-Pilot is a DIFFERENT origin (GitHub Pages), so it needs its own origin
// check instead of sameSite -- an explicit allowlist, not a blanket removal of the check, so this stays exactly
// as gated as the originals.
import crypto from "node:crypto";
import { whoIs, isAdmin, clean, AGENTS, partners, partnerForAdmin, partnerClients, tenant, updateTenant, audit, sd, EDITION_AGENTS } from "../lib/core.mjs";

const ALLOWED_ORIGINS = ["https://taniad2169.github.io"];
function corsHeaders(req) {
  const o = req.headers.get("origin") || "";
  const h = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
  if (ALLOWED_ORIGINS.includes(o)) { h["Access-Control-Allow-Origin"] = o; h["Access-Control-Allow-Headers"] = "Authorization, Content-Type"; h["Access-Control-Allow-Methods"] = "POST, OPTIONS"; }
  return h;
}
const jsonCors = (status, body, req) => new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2, 8));
const COLORS = ["", "yellow", "blue", "green", "orange", "red"];

// Everything below is scoped to one partner's own key prefix ("wp-<partnerId>-..."), so one partner's board can
// never see or touch another's data -- separate both from each other and from the tenant record itself (a
// WorkPilot note/call/appointment/assignment/follow-up never writes into the client's own real record; only the
// "agent" and "account" actions below do that, same as the partner portal already allows).
const kClients = (p) => `wp-${p}-note`, kCalls = (p) => `wp-${p}-calls`, kAppts = (p) => `wp-${p}-appts`, kAssigns = (p) => `wp-${p}-assigns`, kFollow = (p) => `wp-${p}-followups`;

function boardRow(t, note) {
  return { id: t.id, business: t.business, industry: t.industry, ownerName: t.ownerName, phone: t.phone, emails: t.emails, status: t.status, statusNote: t.statusNote,
    agents: t.agents, billing: { term: t.billing.term }, createdAt: t.createdAt, note: (note && note.note) || "", color: (note && note.color) || "" };
}

export default async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonCors(405, { error: "POST only" }, req);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return jsonCors(403, { error: "Not allowed from this page." }, req);
  let who; try { who = await whoIs(req); } catch { return jsonCors(401, { error: "Please sign in." }, req); }
  let b = {}; try { b = await req.json(); } catch { return jsonCors(400, { error: "Bad request." }, req); }

  // Tania can open any partner's WorkPilot the same way she can open their portal (?as=<partner id>). Anyone else
  // must be a registered admin email on an active partner record (core.mjs's partnerForAdmin).
  const p = isAdmin(who) && b.as ? (await partners()).find((x) => x.id === b.as) : await partnerForAdmin(who);
  if (!p) return jsonCors(403, { error: "This account isn't a SwanDesk partner account. Please contact The WebSwan." }, req);
  const allowedAgents = EDITION_AGENTS[p.edition] || EDITION_AGENTS.voice;

  // Only this partner's own customers, ever -- same list sd-partner.mjs's own portal uses.
  const myClients = async () => await partnerClients(p.id);
  const myClientIds = async () => new Set((await myClients()).map((t) => t.id));
  const ownsClient = async (id) => (await myClientIds()).has(id);

  if (b.action === "me") {
    const notes = (await sd().get(kClients(p.id), { type: "json" })) || {};
    const clients = (await myClients()).map((t) => boardRow(t, notes[t.id]));
    return jsonCors(200, { partner: { id: p.id, name: p.name, edition: p.edition }, agents: Object.fromEntries(Object.entries(AGENTS).map(([k, a]) => [k, { name: a.name, role: a.role, included: allowedAgents.includes(k) }])), clients, admin: isAdmin(who) && !b.as }, req);
  }

  // ---------- Customer Management: profile note (up to 5,000 characters) + color tag. Never touches the real record. ----------
  if (b.action === "note_save") {
    const id = clean(b.id, 32); if (!id || !(await ownsClient(id))) return jsonCors(404, { error: "Customer not found." }, req);
    const notes = (await sd().get(kClients(p.id), { type: "json" })) || {};
    notes[id] = { note: clean(b.note, 5000), color: COLORS.includes(b.color) ? b.color : "", at: new Date().toISOString() };
    await sd().setJSON(kClients(p.id), notes);
    return jsonCors(200, { ok: true }, req);
  }

  // Agent licensing on/off and the non-payment switch -- same two mutations the partner portal already offers,
  // so a partner can act straight from WorkPilot without switching pages. Scoped to this partner's own customers.
  if (b.action === "agent" || b.action === "account") {
    const id = clean(b.id, 32); if (!id || !(await ownsClient(id))) return jsonCors(404, { error: "Customer not found." }, req);
    const t = await tenant(id);
    const save = async (label, detail, change) => {
      try { const r = await updateTenant(t.id, (x) => { if (!x.billing || x.billing.partnerId !== p.id) return { error: "Customer not found." }; return change(x); }); if (!r || r.error) return jsonCors(404, { error: "Customer not found." }, req); await audit(t.id, who, label, detail); const notes = (await sd().get(kClients(p.id), { type: "json" })) || {}; return jsonCors(200, { client: boardRow(r, notes[r.id]) }, req); }
      catch { return jsonCors(503, { error: "SwanDesk is busy, please try again." }, req); }
    };
    if (b.action === "agent") {
      if (!allowedAgents.includes(b.agent) || !["active", "paused", "locked"].includes(b.state)) return jsonCors(403, { error: "That agent isn't included in your license." }, req);
      return save("partner: agent (WorkPilot)", `${AGENTS[b.agent].name} -> ${b.state}`, (x) => { x.agents[b.agent] = { state: b.state, since: new Date().toISOString() }; });
    }
    const on = b.on === true;
    return save(on ? "account on (WorkPilot)" : "account off (WorkPilot)", on ? "Back on" : clean(b.note, 200) || "Paused for non-payment", (x) => { x.status = on ? "active" : "suspended"; x.statusNote = on ? "" : clean(b.note, 200) || "Paused for non-payment"; });
  }

  // ---------- 1. Call Tracking: calls to/from a customer -- outcome color, summary, optional recording link. ----------
  // Logged by hand today; once Jennifer's own live calling is wired up for SwanDesk (Cartesia not yet connected,
  // per the project's own README), the same shape can be filled in automatically instead.
  if (b.action === "call_list") { const all = (await sd().get(kCalls(p.id), { type: "json" })) || []; return jsonCors(200, { calls: all }, req); }
  if (b.action === "call_save") {
    const id = clean(b.id, 32); if (!id || !(await ownsClient(id))) return jsonCors(404, { error: "Customer not found." }, req);
    const all = (await sd().get(kCalls(p.id), { type: "json" })) || [];
    all.unshift({ id: uid(), clientId: id, agent: allowedAgents.includes(b.agent) ? b.agent : "jennifer", color: COLORS.includes(b.color) ? b.color : "yellow", summary: clean(b.summary, 1000), recordingUrl: /^https:\/\//.test(b.recordingUrl || "") ? clean(b.recordingUrl, 500) : "", at: new Date().toISOString() });
    await sd().setJSON(kCalls(p.id), all.slice(0, 2000));
    return jsonCors(200, { calls: all }, req);
  }
  if (b.action === "call_delete") { const all = ((await sd().get(kCalls(p.id), { type: "json" })) || []).filter((x) => x.id !== b.id); await sd().setJSON(kCalls(p.id), all); return jsonCors(200, { calls: all }, req); }

  // ---------- 2. Appointments: bookings and scheduling. ----------
  if (b.action === "appt_list") { const all = (await sd().get(kAppts(p.id), { type: "json" })) || []; return jsonCors(200, { appts: all }, req); }
  if (b.action === "appt_save") {
    const id = clean(b.id, 32); if (!id || !(await ownsClient(id))) return jsonCors(404, { error: "Customer not found." }, req);
    const title = clean(b.title, 200); if (!title) return jsonCors(400, { error: "Add what the appointment is for." }, req);
    const all = (await sd().get(kAppts(p.id), { type: "json" })) || [];
    all.unshift({ id: uid(), clientId: id, title, at: clean(b.at, 40), status: ["scheduled", "completed", "canceled", "rescheduled"].includes(b.status) ? b.status : "scheduled", notes: clean(b.notes, 500), createdAt: new Date().toISOString() });
    await sd().setJSON(kAppts(p.id), all.slice(0, 2000));
    return jsonCors(200, { appts: all }, req);
  }
  if (b.action === "appt_status") { const all = (await sd().get(kAppts(p.id), { type: "json" })) || []; const x = all.find((y) => y.id === b.id); if (x && ["scheduled", "completed", "canceled", "rescheduled"].includes(b.status)) x.status = b.status; await sd().setJSON(kAppts(p.id), all); return jsonCors(200, { appts: all }, req); }
  if (b.action === "appt_delete") { const all = ((await sd().get(kAppts(p.id), { type: "json" })) || []).filter((x) => x.id !== b.id); await sd().setJSON(kAppts(p.id), all); return jsonCors(200, { appts: all }, req); }

  // ---------- 3. Agent Assignments: a task for one of this partner's SwanDesk agents, with instructions. ----------
  if (b.action === "assign_list") { const all = (await sd().get(kAssigns(p.id), { type: "json" })) || []; return jsonCors(200, { assigns: all }, req); }
  if (b.action === "assign_save") {
    const id = clean(b.id, 32); if (!id || !(await ownsClient(id))) return jsonCors(404, { error: "Customer not found." }, req);
    if (!allowedAgents.includes(b.agent)) return jsonCors(400, { error: "That agent isn't included in your license." }, req);
    const instructions = clean(b.instructions, 1000); if (!instructions) return jsonCors(400, { error: "Add what the agent should do." }, req);
    const all = (await sd().get(kAssigns(p.id), { type: "json" })) || [];
    all.unshift({ id: uid(), clientId: id, agent: b.agent, instructions, status: "pending", at: new Date().toISOString() });
    await sd().setJSON(kAssigns(p.id), all.slice(0, 2000));
    return jsonCors(200, { assigns: all }, req);
  }
  if (b.action === "assign_status") { const all = (await sd().get(kAssigns(p.id), { type: "json" })) || []; const x = all.find((y) => y.id === b.id); if (x && ["pending", "in_progress", "done"].includes(b.status)) x.status = b.status; await sd().setJSON(kAssigns(p.id), all); return jsonCors(200, { assigns: all }, req); }
  if (b.action === "assign_delete") { const all = ((await sd().get(kAssigns(p.id), { type: "json" })) || []).filter((x) => x.id !== b.id); await sd().setJSON(kAssigns(p.id), all); return jsonCors(200, { assigns: all }, req); }

  // ---------- 4. Follow-ups: pending callbacks, emails, reminders. ----------
  if (b.action === "followup_list") { const all = (await sd().get(kFollow(p.id), { type: "json" })) || []; return jsonCors(200, { followups: all }, req); }
  if (b.action === "followup_save") {
    const id = clean(b.id, 32); if (!id || !(await ownsClient(id))) return jsonCors(404, { error: "Customer not found." }, req);
    const text = clean(b.text, 500); if (!text) return jsonCors(400, { error: "Add what's pending." }, req);
    const all = (await sd().get(kFollow(p.id), { type: "json" })) || [];
    all.unshift({ id: uid(), clientId: id, text, dueAt: clean(b.dueAt, 40), done: false, at: new Date().toISOString() });
    await sd().setJSON(kFollow(p.id), all.slice(0, 2000));
    return jsonCors(200, { followups: all }, req);
  }
  if (b.action === "followup_done") { const all = (await sd().get(kFollow(p.id), { type: "json" })) || []; const x = all.find((y) => y.id === b.id); if (x) x.done = b.done !== false; await sd().setJSON(kFollow(p.id), all); return jsonCors(200, { followups: all }, req); }
  if (b.action === "followup_delete") { const all = ((await sd().get(kFollow(p.id), { type: "json" })) || []).filter((x) => x.id !== b.id); await sd().setJSON(kFollow(p.id), all); return jsonCors(200, { followups: all }, req); }

  return jsonCors(400, { error: "Unknown action." }, req);
};
