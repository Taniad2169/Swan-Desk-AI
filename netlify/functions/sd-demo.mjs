// SwanDesk AI demo links (Tania, Nov 27): a one-time link she can send to a prospect so they can click around a
// real (but sample) SwanDesk dashboard for themselves -- no Google account needed, since the recipient usually
// isn't a client yet. The link works for exactly 2 hours from the moment it is FIRST opened, never resets, and
// never works again once that window closes or Tania revokes it. It never shows a real client's data: everyone
// who opens a demo link sees the same fixed sample workspace (Jennifer answering calls, Eva paused, Rosie and
// Jonathan available to add), matching the same picture already shown on the public demo page's mock preview.
// Pause/Resume on the demo page itself is purely cosmetic (handled client-side, nothing saved here) -- there is
// nothing real to protect in a sample workspace, so there's no server round-trip needed for it.
import crypto from "node:crypto";
import { whoIs, isAdmin, sameSite, json, clean, AGENTS } from "../lib/core.mjs";
import { getStore } from "@netlify/blobs";

const demos = () => getStore({ name: "swandesk-demos", consistency: "strong" });
const DEMO_MS = 2 * 60 * 60 * 1000; // exactly 2 hours, clock starts at first open
const key = (t) => "demo-" + t;

// The fixed sample workspace every demo link shows -- same picture as the public demo page's own mock preview
// (Jennifer active, Eva paused, Rosie and Jonathan locked/available), so nothing here depends on or exposes a
// real client's business.
function demoWorkspace() {
  const state = { jennifer: "active", eva: "paused", stan: "locked", jonathan: "locked", aleksander: "locked" };
  return {
    id: "demo", business: "Sample Business (demo)", ownerName: "", status: "active", statusNote: "",
    agents: Object.fromEntries(Object.keys(AGENTS).map((k) => [k, { ...AGENTS[k], state: state[k] || "locked", since: new Date().toISOString() }]))
  };
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!sameSite(req)) return json(403, { error: "Not allowed from this page." });
  let b = {}; try { b = await req.json(); } catch { b = {}; }

  // "start" is the only action a demo VIEWER ever calls -- no sign-in, since they may not have a Google account yet.
  if (b.action === "start") {
    const token = clean(b.token, 64);
    if (!token) return json(400, { error: "This demo link is missing its code." });
    const got = await demos().getWithMetadata(key(token), { type: "json" });
    if (!got || !got.data) return json(404, { error: "This demo link isn't valid. Please ask WebSwan for a new one." });
    let d = got.data;
    const now = Date.now();
    if (d.status === "expired") return json(410, { error: "This demo has ended. Please ask WebSwan for a new link." });
    if (d.status === "pending") {
      d = { ...d, startedAt: now, expiresAt: now + DEMO_MS, status: "active" };
      const w = await demos().setJSON(key(token), d, { onlyIfMatch: got.etag });
      if (w && w.modified === false) return json(409, { error: "Please try that link again." });
    } else if (now >= d.expiresAt) {
      d = { ...d, status: "expired" };
      await demos().setJSON(key(token), d).catch(() => {});
      return json(410, { error: "This demo has ended. Please ask WebSwan for a new link." });
    }
    return json(200, { ok: true, expiresAt: d.expiresAt, workspace: demoWorkspace() });
  }

  // Everything else is Tania's own admin tool for creating and managing these links.
  let who; try { who = await whoIs(req); } catch { return json(401, { error: "Please sign in." }); }
  if (!isAdmin(who)) return json(403, { error: "Admins only." });

  if (b.action === "create") {
    const token = crypto.randomBytes(18).toString("base64url");
    const record = { token, label: clean(b.label, 120), createdAt: new Date().toISOString(), createdBy: who, startedAt: null, expiresAt: null, status: "pending" };
    await demos().setJSON(key(token), record, { onlyIfNew: true });
    const origin = req.headers.get("origin") || new URL(req.url).origin;
    return json(200, { ok: true, token, url: origin + "/demo/live/?t=" + token });
  }

  if (b.action === "list") {
    const out = [];
    for await (const page of demos().list({ prefix: "demo-", paginate: true })) {
      for (const item of page.blobs) { const d = await demos().get(item.key, { type: "json" }).catch(() => null); if (d) out.push(d); }
    }
    out.sort((a, c) => String(c.createdAt).localeCompare(String(a.createdAt)));
    return json(200, { demos: out.map((d) => ({ ...d, token: undefined, link: d.token })) });
  }

  if (b.action === "revoke") {
    const token = clean(b.link || b.token, 64);
    const got = await demos().getWithMetadata(key(token), { type: "json" });
    if (!got || !got.data) return json(404, { error: "Not found." });
    await demos().setJSON(key(token), { ...got.data, status: "expired" }, { onlyIfMatch: got.etag }).catch(() => {});
    return json(200, { ok: true });
  }

  return json(400, { error: "Unknown action." });
};
