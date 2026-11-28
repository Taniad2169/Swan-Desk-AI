// Demo "talk with the agent" chat (Tania, Nov 27 -- practice calls first, then expanded into "mic to voice talk
// that will open the agent just like it does for studio"): a demo visitor picks one of SwanDesk AI's own four
// client-facing teammates (Jennifer "Rachel" on the phone, Eva, Rosie, Jonathan) and can type or speak to them.
// The browser's own free built-in speechSynthesis/SpeechRecognition do all the voice work client-side (see
// demo/live/index.html) -- this function only ever returns text, and never touches Cartesia or any paid voice
// account. Grounded in SwanDesk's own real agent descriptions and pricing (core.mjs) so nothing is invented, and
// scoped to SwanDesk AI only -- it has no knowledge of Voice Studio, Mariska, Jenna, Sebastien or any other
// WebSwan product, so it can never hand a prospect the wrong name or number.
import { sameSite, json, clean, AGENTS, getPricing } from "../lib/core.mjs";

const DEMO_AGENT_KEYS = ["jennifer", "eva", "stan", "jonathan"];
// How each agent opens and refers to themselves -- Jennifer alone answers to a phone name too.
const PHONE_NAME = { jennifer: "Rachel" };

function systemPrompt(agentKey, pricing) {
  const self = AGENTS[agentKey];
  const roster = DEMO_AGENT_KEYS.map((k) => `${AGENTS[k].name} (${AGENTS[k].role}): ${AGENTS[k].desc}`).join("\n");
  const p = pricing.agent;
  const phoneNote = PHONE_NAME[agentKey] ? ` On the phone, you also go by "${PHONE_NAME[agentKey]}" -- same you, just your calling name.` : "";
  return `You are ${self.name}, ${self.role} for SwanDesk AI by The WebSwan.${phoneNote} A website visitor is trying you out in a demo to see how you'd actually help their business, so answer like a real, warm conversation: short, one or two sentences, never a long lecture or a bullet list.
Open your very first reply with a quick "Hi, I'm ${self.name}${PHONE_NAME[agentKey] ? " (or Rachel, on the phone)" : ""}!" and then answer what was actually asked.
YOUR OWN JOB: ${self.desc}
SWANDESK AI'S FULL TEAM (the only agents that exist -- never mention any other name, and never say "Voice Studio," "Mariska," "Jenna," "Sebastien" or "Rachel Bennett" -- those belong to a different WebSwan product you know nothing about on this call):
${roster}
REAL MONTHLY PRICING (say these only if asked directly about price): Jennifer standalone $${p.jennifer}/mo (phone/minute plan varies), Eva $${p.eva}/mo, Rosie $${p.stan}/mo, Jonathan $${p.jonathan}/mo, all 4 bundled $${pricing.bundle[4]}/mo. Setup fee varies by how many agents. Tania may be running a special, so always add that she gives the final, current price on a short call -- never claim your number is guaranteed.
RULES: Only answer about SwanDesk AI and this team. Never invent a feature, price, policy, or anything about a real client (there are no real clients yet -- this is always a demo). If asked something outside what's given here, say warmly that Tania can answer that on a quick call, and offer the booking email (designs@thewebswan.com) or the real phone number (316) 248-6839 for an actual live call. Never claim to be human; if asked, say plainly you're SwanDesk AI's own AI, demonstrating exactly what you'd do for their business. If asked to loop in a teammate (Jennifer, Eva, Rosie or Jonathan), say you're flagging it to them and that they'll pick it up -- don't pretend to BE that other teammate.`;
}

async function askClaude(key, sys, question) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.SD_AGENT_MODEL || "claude-haiku-4-5", max_tokens: 220, system: sys, messages: [{ role: "user", content: question }] })
  });
  if (!r.ok) throw new Error("claude " + r.status);
  const j = await r.json();
  return (j.content || []).map((c) => c.text || "").join("").trim();
}

async function askOpenAI(key, sys, question) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model: process.env.SD_AGENT_MODEL || "gpt-4o-mini", max_tokens: 220, messages: [{ role: "system", content: sys }, { role: "user", content: question }] })
  });
  if (!r.ok) throw new Error("openai " + r.status);
  const j = await r.json();
  return (j.choices || [])[0]?.message?.content?.trim() || "";
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!sameSite(req)) return json(403, { error: "Not allowed from this page." });
  let b = {}; try { b = await req.json(); } catch { b = {}; }
  const agentKey = DEMO_AGENT_KEYS.includes(b.agent) ? b.agent : "jennifer";
  const question = clean(b.question, 400);
  const name = AGENTS[agentKey].name;
  if (!question) return json(400, { error: "Ask " + name + " something first." });

  const anthropicKey = process.env.ANTHROPIC_API_KEY, openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openaiKey) {
    // No key set up yet -- degrade to one honest, on-brand line instead of erroring, so the demo still works
    // the moment Tania adds a key, and never breaks for a prospect in the meantime.
    return json(200, { answer: "Hi, I'm " + name + "! I'm still warming up for demo conversations -- in the meantime, Tania can answer that for you directly. Want her email, or a real call to (316) 248-6839?" });
  }
  const pricing = await getPricing();
  const sys = systemPrompt(agentKey, pricing);
  try {
    const answer = anthropicKey ? await askClaude(anthropicKey, sys, question) : await askOpenAI(openaiKey, sys, question);
    return json(200, { answer: answer || "Sorry, could you say that one more time?" });
  } catch {
    return json(200, { answer: "Hi, I'm " + name + "! I didn't quite catch that -- mind asking again, or would you rather book a real call with Tania?" });
  }
};
