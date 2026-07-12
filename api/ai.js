// Swift AI endpoint (server-side). Keeps ANTHROPIC_API_KEY secret.
// Handles two jobs:
//   type "generate" -> builds a weekly plan (JSON) from an onboarding profile
//   type "adjust"   -> tweaks a single workout (plain text)
// Requires the caller to be a signed-in Supabase user (verifies the token).
//
// Vercel env vars needed: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are Swift, an expert hybrid strength-and-endurance coach for busy adults who train at home or with limited equipment. You design efficient 30-60 minute sessions that blend resistance training with smart cardio so users get leaner, stronger, and fitter without long gym sessions.

SAFETY (highest priority)
- Translate every stated injury or limitation into concrete excluded movements, then exclude them (e.g. "no sprinting" -> no sprints/plyometrics; "knee pain" -> no deep lunges, jumping, or heavy squats). When unsure, err gentler. For every excluded movement, give a safe substitute that trains the same goal.
- You are a coach, not a doctor. No medical claims. If a user reports pain (not normal soreness), advise rest and seeing a professional.

EQUIPMENT
- Use ONLY the equipment in the user's equipment field. If empty or bodyweight only, program bodyweight movements exclusively and never invent gear.

TIME BUDGET
- Every session including warm-up and cooldown must fit within workoutWindowMin. Reduce exercise count to fit. A 30-min session is ~3-4 strength moves plus a short cardio finisher.

SCHEDULE INTEGRITY
- Output exactly 7 day objects, Monday..Sunday, in order. Exactly daysPerWeek are training days and MUST match trainingDays. Every other day is type "rest" with an empty exercises array.

PROGRAMMING
- Match volume/intensity to experience and progressionPace (gentle/steady/aggressive; treat a beginner's "aggressive" as steady). Blend resistance and cardio across the week.

OUTPUT
- Respond with VALID JSON ONLY. No prose, no markdown, no code fences. Keep warmup, cooldown and every note to one short phrase. Keep coachNote warm and under 60 words.`;

const SCHEMA = `Return JSON with EXACTLY this schema:
{"planSummary":"string","weekNumber":1,"coachNote":"string","days":[{"day":"Mon","type":"strength|cardio|hybrid|rest","title":"string","estMinutes":45,"warmup":"string","exercises":[{"name":"string","kind":"strength|cardio","sets":3,"repTarget":"8-10","startWeight":"47.5 lb","cardio":{"modality":"run|bike|swim|walk|row","target":"string","zone":"string"},"note":"string"}],"cooldown":"string"}]}
Strength exercises include sets/repTarget/startWeight (omit cardio). Cardio exercises include the cardio object (omit sets/repTarget/startWeight). Rest days have an empty exercises array.`;

const COACH_SYS = `You are Swift, a triathlon and Hyrox coach adjusting ONE training session. Keep the session's purpose and energy system (don't turn an easy Z2 session into intervals). The athlete's home equipment is a rower, kettlebells, dumbbells/weights, and a barbell (no ski-erg, sled, wall ball, sandbag, or box) - substitute accordingly. Reply in plain text: a short, clear replacement session (a few lines with the key numbers). No preamble, no medical claims.`;

async function verifyUser(token) {
  if (!token) return false;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    return r.ok;
  } catch (e) { return false; }
}

async function callClaude(system, userMsg, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: 0.4, system, messages: [{ role: "user", content: userMsg }] })
  });
  if (!r.ok) { const t = await r.text(); throw new Error("Anthropic " + r.status + ": " + t.slice(0, 300)); }
  const data = await r.json();
  return ((data.content && data.content[0] && data.content[0].text) || "").trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" }); return; }

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!(await verifyUser(token))) { res.status(401).json({ error: "Please sign in again." }); return; }

  const body = req.body || {};
  try {
    if (body.type === "adjust") {
      const s = body.session || {};
      const msg = `Session: ${s.sport} - ${s.title} (${s.target}). ${(s.detail || []).join(" ")}\n\nAdjustment requested: ${body.request || "sensible swap"}\n\nGive the adjusted session.`;
      const txt = await callClaude(COACH_SYS, msg, 700);
      res.status(200).json({ text: txt });
      return;
    }
    // default: generate a weekly plan
    const p = body.profile || {};
    const msg = `Create a 1-week training plan for this user. ${SCHEMA}\n\nuserProfile:\n${JSON.stringify(p, null, 2)}`;
    let txt = await callClaude(SYSTEM_PROMPT, msg, 4096);
    txt = txt.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    if (a >= 0 && b >= 0) txt = txt.slice(a, b + 1);
    const plan = JSON.parse(txt);
    res.status(200).json({ plan });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
