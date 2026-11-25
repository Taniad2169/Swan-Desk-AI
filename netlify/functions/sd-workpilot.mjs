// SwanDesk AI's own "WorkPilot" board (Tania, Nov 24): a second static page (WS-Work-Pilot, on GitHub Pages,
// taniad2169.github.io) that shows SwanDesk's real clients -- the same live records sd-admin.mjs already manages --
// plus its own general to-do board and per-client notes/color tags, exactly the "visible mirror, writable back"
// pattern already used for The WebSwan's own WorkPilot <-> Voice Studio link and Rachel's-Calls mirror.
// sd-admin.mjs enforces sameSite (same host as this Netlify site) because its own page is served from this same
// origin. WS-Work-Pilot is a DIFFERENT origin (GitHub Pages), so it needs its own origin check instead of sameSite --
// an explicit allowlist, not a blanket removal of the check, so this stays exactly as owner-gated as sd-admin.mjs.
import crypto from "node:crypto";
import { whoIs, isAdmin, clean, AGENTS, AGENT_STATES, tenant, tenants, updateTenant, audit, sd } from "../lib/core.mjs";

const ALLOWED_ORIGINS = ["https://taniad2169.github.io"];
function corsHeaders(req) {
  const o = req.headers.get("origin") || "";
  const h = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
  if (ALLOWED_ORIGINS.includes(o)) { h["Access-Control-Allow-Origin"] = o; h["Access-Control-Allow-Headers"] = "Authorization, Content-Type"; h["Access-Control-Allow-Methods"] = "POST, OPTIONS"; }
  return h;
}
const jsonCors = (status, body, req) => new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });

// A light board row -- identity, agent states and account status only (no computed pricing totals; the admin
// page is still the place for billing math). WorkPilot's own note/color live separately (wp-note-<id>), never
// written into the tenant record itself, so a WorkPilot tag can never corrupt the real client record.
function boardRow(t, note) {
  const on = Object.keys(AGENTS).filter((a) => t.agents[a] && t.agents[a].state !== "locked");
  return { id: t.id, business: t.business, industry: t.industry, ownerName: t.ownerName, phone: t.phone, emails: t.emails, status: t.status, statusNote: t.statusNote,
    agents: t.agents, licensed: on, billing: t.billing, createdAt: t.createdAt, note: (note && note.note) || "", color: (note && note.color) || "" };
}

export default async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonCors(405, { error: "POST only" }, req);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return jsonCors(403, { error: "Not allowed from this page." }, req);
  let who; try { who = await whoIs(req); } catch { return jsonCors(401, { error: "Please sign in." }, req); }
  if (!isAdmin(who)) return jsonCors(403, { error: "This board is for WebSwan administrators." }, req);
  let b = {}; try { b = await req.json(); } catch { return jsonCors(400, { error: "Bad request." }, req); }

  if (b.action === "list") {
    const notes = (await sd().get("wp-notes", { type: "json" })) || {};
    const all = []; for (const t of await tenants()) all.push(boardRow(t, notes[t.id]));
    const tasks = (await sd().get("wp-tasks", { type: "json" })) || [];
    return jsonCors(200, { clients: all, agents: AGENTS, states: AGENT_STATES, tasks }, req);
  }

  // Per-client WorkPilot tag: a color (for the board) and a free-text note. Never touches the real tenant record.
  if (b.action === "note_save") {
    const id = clean(b.id, 20); if (!id || !(await tenant(id))) return jsonCors(404, { error: "Client not found." }, req);
    const notes = (await sd().get("wp-notes", { type: "json" })) || {};
    notes[id] = { note: clean(b.note, 600), color: /^[a-z]{0,16}$/.test(b.color || "") ? b.color : "", at: new Date().toISOString() };
    await sd().setJSON("wp-notes", notes);
    return jsonCors(200, { ok: true }, req);
  }

  // Same two mutations sd-admin.mjs offers, so Tania can act straight from the WorkPilot board without switching
  // pages -- the real tenant record changes, exactly like flipping it in /admin/, with its own audit line.
  if (b.action === "agent" || b.action === "account") {
    const t = await tenant(clean(b.id, 20)); if (!t) return jsonCors(404, { error: "Client not found." }, req);
    const save = async (label, detail, change) => {
      try { const r = await updateTenant(t.id, change); if (r && r.error) return jsonCors(400, { error: r.error }, req); await audit(t.id, who, label, detail); return jsonCors(200, { client: boardRow(r, ((await sd().get("wp-notes", { type: "json" })) || {})[r.id]) }, req); }
      catch { return jsonCors(503, { error: "SwanDesk is busy, please try again." }, req); }
    };
    if (b.action === "agent") {
      if (!AGENTS[b.agent] || !AGENT_STATES.includes(b.state)) return jsonCors(400, { error: "Bad agent or state." }, req);
      let before; return save("agent", () => `${AGENTS[b.agent].name}: ${before} -> ${b.state}`, (x) => { before = x.agents[b.agent].state; x.agents[b.agent] = { state: b.state, since: new Date().toISOString() }; });
    }
    const on = b.on === true;
    return save(on ? "account on" : "account off", on ? "Back on (from WorkPilot)" : clean(b.note, 200) || "Paused for non-payment (from WorkPilot)", (x) => { x.status = on ? "active" : "suspended"; x.statusNote = on ? "" : clean(b.note, 200) || "Paused for non-payment"; });
  }

  // A general to-do board for Tania's own SwanDesk-side work -- not tied to any one client.
  if (b.action === "task_save") {
    const tasks = (await sd().get("wp-tasks", { type: "json" })) || [];
    const text = clean(b.text, 300); if (!text) return jsonCors(400, { error: "Add a task." }, req);
    tasks.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2, 8), text, done: false, at: new Date().toISOString() });
    await sd().setJSON("wp-tasks", tasks.slice(0, 300));
    return jsonCors(200, { tasks }, req);
  }
  if (b.action === "task_done" || b.action === "task_delete") {
    let tasks = (await sd().get("wp-tasks", { type: "json" })) || [];
    if (b.action === "task_done") { const x = tasks.find((y) => y.id === b.id); if (x) x.done = b.done !== false; }
    else tasks = tasks.filter((y) => y.id !== b.id);
    await sd().setJSON("wp-tasks", tasks);
    return jsonCors(200, { tasks }, req);
  }

  return jsonCors(400, { error: "Unknown action." }, req);
};
