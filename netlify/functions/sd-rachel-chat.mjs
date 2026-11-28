// "Practice call with Rachel" (Tania, Nov 27, her exact words: "they can have the practice call where they talk
// to rachel as if they call her and roleplay with her but free voice boo with intelligence of answering questions
// accurately i don't want to use my paid cartesia for demo"): a demo visitor types (or speaks, via the browser's
// own free mic) a question the way they would on a real call, and gets back a short, accurate answer in Rachel's
// voice -- "Rachel" being Jennifer's name on the phone (same as the real "(316) 248-6839" line already on these
// pages). This never touches Cartesia or any paid voice account: the reply here is text, and the browser's own
// free built-in speechSynthesis reads it aloud client-side (see demo/live/index.html) -- zero per-minute cost,
// nothing metered. A prospect who wants a real live call still has the real phone number for that.
// No Voice Studio anywhere in this: this function knows only SwanDesk AI's own four client-facing teammates and
// its own real pricing (from core.mjs), so it can never accidentally hand a prospect Voice Studio's agents,
// scripts or numbers.
import { sameSite, json, clean, AGENTS, getPricing } from "../lib/core.mjs";

const DEMO_AGENT_KEYS = ["jennifer", "eva", "stan", "jonathan"];

function systemPrompt(pricing) {
  const roster = DEMO_AGENT_KEYS.map((k) => `${AGENTS[k].name} (${AGENTS[k].role}): ${AGENTS[k].desc}`).join("\n");
  const p = pricing.agent;
  return `You are Rachel, the warm, upbeat phone voice of SwanDesk AI by The WebSwan. (Rachel is Jennifer's name on the phone -- same agent, same desk.) A website visitor is doing a practice call with you to see how SwanDesk AI's receptionist handles real questions, so answer exactly like a real call: short, friendly, one or two sentences, never a long lecture.
Open any first reply with something like "Hi, this is Rachel with SwanDesk AI!" and then answer what was actually asked.
SWANDESK AI'S REAL TEAM (the only agents that exist -- never mention any other name, and never say "Voice Studio," "Mariska," "Jenna," "Sebastien" or "Rachel Bennett" -- those are a different WebSwan product you know nothing about on this call):
${roster}
REAL MONTHLY PRICING (say these only if asked directly about price): Jennifer standalone $${p.jennifer}/mo (phone/minute plan varies), Eva $${p.eva}/mo, Rosie $${p.stan}/mo, Jonathan $${p.jonathan}/mo, all 4 bundled $${pricing.bundle[4]}/mo. Setup fee varies by how many agents. Tania may be running a special, so always add that she gives the final, current price on a short call -- never claim your number is guaranteed.
RULES: Only answer about SwanDesk AI and these four teammates. Never invent a feature, price, or policy not given above. If asked something you don't know (a specific integration, a contract detail, anything about another WebSwan product), say warmly that Tania can answer that on a quick call, and offer the booking email (designs@thewebswan.com) or the real phone number (316) 248-6839 for an actual live call. Never claim to be a human; if asked, say plainly you're SwanDesk AI's own AI receptionist, demonstrating exactly what you'd do for their business. Keep it natural and conversational, the way a real receptionist talks, not a bullet list.`;
}

async function askClaude(key, sys, question) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.SD_RACHEL_MODEL || "claude-haiku-4-5", max_tokens: 220, system: sys, messages: [{ role: "user", content: question }] })
  });
  if (!r.ok) throw new Error("claude " + r.status);
  const j = await r.json();
  return (j.content || []).map((c) => c.text || "").join("").trim();
}

async function askOpenAI(key, sys, question) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model: process.env.SD_RACHEL_MODEL || "gpt-4o-mini", max_tokens: 220, messages: [{ role: "system", content: sys }, { role: "user", content: question }] })
  });
  if (!r.ok) throw new Error("openai " + r.status);
  const j = await r.json();
  return (j.choices || [])[0]?.message?.content?.trim() || "";
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!sameSite(req)) return json(403, { error: "Not allowed from this page." });
  let b = {}; try { b = await req.json(); } catch { b = {}; }
  const question = clean(b.question, 400);
  if (!question) return json(400, { error: "Ask Rachel something first." });

  const anthropicKey = process.env.ANTHROPIC_API_KEY, openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openaiKey) {
    // No key set up yet -- degrade to one honest, on-brand line instead of erroring, so the demo still works
    // the moment Tania adds a key, and never breaks for a prospect in the meantime.
    return json(200, { answer: "Hi, this is Rachel with SwanDesk AI! I'm still warming up my voice for practice calls -- in the meantime, Tania can answer that for you directly. Want her email or a real call to (316) 248-6839?" });
  }
  const pricing = await getPricing();
  const sys = systemPrompt(pricing);
  try {
    const answer = anthropicKey ? await askClaude(anthropicKey, sys, question) : await askOpenAI(openaiKey, sys, question);
    return json(200, { answer: answer || "Sorry, could you say that one more time?" });
  } catch {
    return json(200, { answer: "Hi, this is Rachel! I didn't quite catch that -- mind asking again, or would you rather book a real call with Tania?" });
  }
};
