import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TRI_WEEKS, TRI_START } from "./plan-data.js";

// ---------- globals ----------
let sb = null, session = null, profile = null;
let aiPlan = null, aiPlanId = null;        // friend AI plan (raw json)
let doneSet = new Set();                    // completed session refs
let weights = [];                           // bodyweight logs
let curWk = 1, curDi = 0;                   // loaded-plan navigation
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SPORT_COLOR = { Swim: "var(--swim)", Bike: "var(--bike)", Run: "var(--run)", Hyrox: "var(--hyrox)", Strength: "var(--str)", Brick: "var(--brick)", Event: "var(--event)", Rest: "#B5B9C1" };

const $ = (id) => document.getElementById(id);
const root = () => $("root");
const esc = (s) => (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(window._t); window._t = setTimeout(() => t.classList.remove("show"), 1900); }
function closeModal() { $("modal").classList.remove("show"); }
function openSheet(html) { $("sheet").innerHTML = html; $("modal").classList.add("show"); }

// ---------- date helpers (loaded plan) ----------
function dDate(wk, di) { const d = new Date(TRI_START); d.setDate(d.getDate() + (wk - 1) * 7 + di); return d; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function fmtD(d) { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function fmtShort(d) { return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function locateToday() { const now = new Date(); for (let w = 1; w <= 16; w++) for (let i = 0; i < 7; i++) if (sameDay(dDate(w, i), now)) return { wk: w, di: i }; if (now < dDate(1, 0)) return { wk: 1, di: 0 }; return { wk: 16, di: 6 }; }
function daysToRace() { return Math.max(0, Math.round((dDate(16, 5) - new Date()) / 864e5)); }

// ---------- boot ----------
async function boot() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    if (!cfg.supabaseUrl) { root().innerHTML = errScreen("Server isn't configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel, then redeploy."); return; }
    sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const { data } = await sb.auth.getSession();
    session = data.session;
    sb.auth.onAuthStateChange((_e, s) => { session = s; route(); });
    $("fbtn").onclick = openFeedback;
    document.querySelectorAll(".tab").forEach(t => t.onclick = () => openTab(t.dataset.tab));
    await route();
  } catch (e) {
    root().innerHTML = errScreen("Couldn't start: " + esc(e.message));
  }
}
function errScreen(msg) { return `<div class="center"><div class="logo" style="font-size:34px;text-align:center;margin-bottom:10px">SWIFT<span class="dot">.</span></div><div class="card"><p class="sub" style="margin:0">${msg}</p></div></div>`; }

async function route() {
  const loc = locateToday(); curWk = loc.wk; curDi = loc.di;
  if (!session) { $("tabbar").style.display = "none"; $("fbtn").style.display = "none"; renderLogin(); return; }
  await loadProfile();
  await loadCompletions();
  await loadWeights();
  if (profile.plan_type === "loaded") { openTab("today"); return; }
  await loadAiPlan();
  if (!aiPlan) { $("tabbar").style.display = "none"; $("fbtn").style.display = "none"; renderOnboarding(); return; }
  openTab("today");
}

// ---------- data loads ----------
async function loadProfile() {
  const uid = session.user.id;
  let { data } = await sb.from("profiles").select("*").eq("user_id", uid).maybeSingle();
  if (!data) {
    const ins = await sb.from("profiles").insert({ user_id: uid, email: session.user.email }).select().maybeSingle();
    data = ins.data || { user_id: uid, email: session.user.email, plan_type: "ai" };
  }
  profile = data;
}
async function loadAiPlan() {
  const { data } = await sb.from("plans").select("*").eq("user_id", session.user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  aiPlan = data ? data.raw_json : null; aiPlanId = data ? data.id : null;
}
async function loadCompletions() {
  const { data } = await sb.from("session_completions").select("ref,done").eq("user_id", session.user.id);
  doneSet = new Set((data || []).filter(r => r.done).map(r => r.ref));
}
async function toggleCompletion(ref) {
  const now = !doneSet.has(ref);
  if (now) doneSet.add(ref); else doneSet.delete(ref);
  await sb.from("session_completions").upsert({ user_id: session.user.id, ref, done: now }, { onConflict: "user_id,ref" });
}
async function loadWeights() {
  const { data } = await sb.from("bodyweight_logs").select("weight_lb,log_date").eq("user_id", session.user.id).order("log_date", { ascending: true });
  weights = data || [];
}

// ---------- LOGIN ----------
function renderLogin() {
  root().innerHTML = `<div class="scroll"><div class="center">
    <div class="logo" style="font-size:40px;text-align:center;margin-bottom:6px">SWIFT<span class="dot">.</span></div>
    <p class="sub" style="text-align:center">Leaner, stronger, fitter — your AI hybrid coach.</p>
    <div class="card">
      <button class="btn btn-dark" id="gBtn">Continue with Google</button>
      <div style="text-align:center;color:#B5B9C1;font-size:12px;margin:14px 0;font-weight:600">— or —</div>
      <div class="label" style="margin-top:0">Email</div>
      <input class="field" id="emailIn" type="email" placeholder="you@email.com" autocomplete="email">
      <button class="btn btn-gold" style="margin-top:12px" id="mBtn">Email me a login link</button>
      <div class="errbox" id="logErr"></div>
      <p id="logMsg" class="muted" style="margin-top:12px;text-align:center;display:none"></p>
    </div>
    <p class="muted" style="text-align:center;margin-top:14px">New here? Just sign in — your account is created automatically.</p>
  </div></div>`;
  $("gBtn").onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) showLogErr(error.message);
  };
  $("mBtn").onclick = async () => {
    const email = $("emailIn").value.trim();
    if (!email) { showLogErr("Enter your email first."); return; }
    $("mBtn").disabled = true; $("mBtn").textContent = "Sending…";
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    $("mBtn").disabled = false; $("mBtn").textContent = "Email me a login link";
    if (error) { showLogErr(error.message); return; }
    const m = $("logMsg"); m.style.display = "block"; m.textContent = "Check your email for a login link, then come back here.";
  };
}
function showLogErr(m) { const e = $("logErr"); e.style.display = "block"; e.textContent = m; }

// ---------- ONBOARDING (friends / AI) ----------
const sel = { goals: new Set(["Lose fat", "Build strength"]), window: 45, dpw: 4, days: new Set(["Mon", "Tue", "Thu", "Sat"]), exp: "Intermediate", pace: "Steady" };
function renderOnboarding() {
  root().innerHTML = `<div class="scroll">
    <div class="logo" style="font-size:22px;margin:6px 0 8px">SWIFT<span class="dot">.</span></div>
    <h2 class="title">What do you want to achieve?</h2>
    <p class="sub">Tell Swift in your own words — the more detail, the smarter your plan.</p>
    <textarea class="field" id="goalText" rows="4" placeholder="e.g. Lose 15 lbs and get stronger, ~45 min a day, dumbbells at home, dodgy left knee."></textarea>
    <div class="label">Quick picks</div><div class="wrapchips" id="goalChips"></div>
    <div class="row" style="margin-top:14px">
      <div><div class="label" style="margin-top:0">Age</div><input class="field" id="f_age" inputmode="numeric"></div>
      <div><div class="label" style="margin-top:0">Weight (lb)</div><input class="field" id="f_weight" inputmode="numeric"></div>
    </div>
    <div class="label">Injuries / limitations</div><input class="field" id="f_injury" placeholder="none, or e.g. bad knee">
    <div class="label">Equipment</div><input class="field" id="f_equip" placeholder="e.g. dumbbells, bench — or 'bodyweight only'">
    <div class="label">Daily workout window</div><div class="grid4" id="winChips"></div>
    <div class="label">Days per week</div><div class="grid4" id="dpwChips"></div>
    <div class="label">Which days</div><div class="grid7" id="dayPick"></div>
    <div class="label">Experience</div><div class="wrapchips" id="expChips"></div>
    <div class="label">Progression pace</div><div class="wrapchips" id="paceChips"></div>
    <button class="btn btn-gold" style="margin-top:20px" id="buildBtn">Build my plan</button>
    <div class="errbox" id="obErr"></div>
    <button class="btn btn-ghost" style="margin-top:10px" id="soBtn">Sign out</button>
  </div>`;
  chipRow("goalChips", ["Lose fat", "Build strength", "Keep endurance", "Get toned", "Run faster", "General health"], sel.goals, true);
  chipRow("winChips", [30, 45, 60, 75], sel, "window", false, (v) => v + "m");
  chipRow("dpwChips", [3, 4, 5, 6], sel, "dpw");
  dayRow();
  chipRow("expChips", ["New", "Intermediate", "Advanced"], sel, "exp", false, null, true);
  chipRow("paceChips", ["Gentle", "Steady", "Aggressive"], sel, "pace", false, null, true);
  $("buildBtn").onclick = buildPlan;
  $("soBtn").onclick = () => sb.auth.signOut();
}
function chipRow(id, items, store, key, multi, fmt, flex) {
  const el = $(id); el.innerHTML = "";
  items.forEach(it => {
    const on = multi ? store.has(it) : (store[key] === it);
    const c = document.createElement("div"); c.className = "chip" + (on ? " on" : ""); c.textContent = fmt ? fmt(it) : it;
    if (flex) c.style.flex = "1";
    c.onclick = () => {
      if (multi) { store.has(it) ? store.delete(it) : store.add(it); c.classList.toggle("on"); }
      else { store[key] = it;[...el.children].forEach(x => x.classList.remove("on")); c.classList.add("on"); }
    };
    el.appendChild(c);
  });
}
function dayRow() {
  const el = $("dayPick"); el.innerHTML = "";
  DOW.forEach(d => {
    const c = document.createElement("div"); c.className = "day" + (sel.days.has(d) ? " on" : ""); c.textContent = d[0];
    c.onclick = () => { sel.days.has(d) ? sel.days.delete(d) : sel.days.add(d); c.classList.toggle("on"); };
    el.appendChild(c);
  });
}
async function buildPlan() {
  const p = {
    freeTextGoal: $("goalText").value, goals: [...sel.goals],
    age: +$("f_age").value || null, weight_lb: +$("f_weight").value || null,
    injuries: $("f_injury").value, equipment: $("f_equip").value,
    workoutWindowMin: sel.window, daysPerWeek: sel.dpw,
    trainingDays: [...sel.days].sort((a, b) => DOW.indexOf(a) - DOW.indexOf(b)),
    experience: sel.exp.toLowerCase(), progressionPace: sel.pace.toLowerCase()
  };
  root().innerHTML = `<div class="scroll"><div class="center"><div class="ring"></div><h2 class="title" style="text-align:center;margin-top:18px">Building your plan…</h2><p class="sub" style="text-align:center">Reading your goals, respecting your limits, fitting your week.</p></div></div>`;
  try {
    const plan = await aiCall({ type: "generate", profile: p });
    // save profile answers
    await sb.from("profiles").update({
      free_text_goal: p.freeTextGoal, goals: p.goals, age: p.age, weight_lb: p.weight_lb,
      injuries: p.injuries, equipment: p.equipment, workout_window_min: p.workoutWindowMin,
      days_per_week: p.daysPerWeek, training_days: p.trainingDays, experience: p.experience,
      progression_pace: p.progressionPace, updated_at: new Date().toISOString()
    }).eq("user_id", session.user.id);
    // supersede old, insert new
    await sb.from("plans").update({ status: "superseded" }).eq("user_id", session.user.id).eq("status", "active");
    const ins = await sb.from("plans").insert({
      user_id: session.user.id, week_number: plan.weekNumber || 1, status: "active",
      plan_summary: plan.planSummary, coach_note: plan.coachNote, raw_json: plan
    }).select().maybeSingle();
    aiPlan = plan; aiPlanId = ins.data ? ins.data.id : null;
    openTab("today");
  } catch (e) {
    renderOnboarding();
    const er = $("obErr"); er.style.display = "block"; er.textContent = "Couldn't build the plan: " + e.message;
  }
}

// ---------- AI call ----------
async function aiCall(payload) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer " + session.access_token },
    body: JSON.stringify(payload)
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || ("Server error " + res.status));
  return payload.type === "adjust" ? j.text : j.plan;
}

// ---------- TABS ----------
function openTab(tab) {
  $("tabbar").style.display = "flex"; $("fbtn").style.display = "block";
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.tab === tab));
  const loaded = profile.plan_type === "loaded";
  if (tab === "today") loaded ? renderTodayLoaded() : renderTodayAI();
  else if (tab === "plan") loaded ? renderPlanLoaded() : renderPlanAI();
  else if (tab === "progress") renderProgress();
  else if (tab === "profile") renderProfile();
  window.scrollTo(0, 0);
}

// ---------- TODAY: loaded (tri) ----------
function renderTodayLoaded() {
  const wk = TRI_WEEKS[curWk - 1]; const loc = locateToday();
  const strip = DOW.map((dn, i) => {
    const day = wk.days[i], rest = day.sessions[0].sport === "Rest", isToday = curWk === loc.wk && i === loc.di;
    const dots = day.sessions.filter(s => s.sport !== "Rest").map(s => `<i style="background:${SPORT_COLOR[s.sport]}"></i>`).join("");
    return `<div class="wd ${i === curDi ? "on" : ""} ${rest ? "rest" : ""} ${isToday ? "today" : ""}" data-di="${i}"><div class="dn">${dn}</div><div class="dd">${dDate(curWk, i).getDate()}</div><div class="dots">${i === curDi ? "" : dots}</div></div>`;
  }).join("");
  const day = wk.days[curDi];
  let body = "";
  const evs = day.sessions.find(s => s.sport === "Event");
  if (evs) body += `<div class="event-banner"><span class="pill">Event</span><div style="font-size:19px;font-weight:800;margin:10px 0 4px">${esc(evs.title)}</div><div style="color:#C9CCD3;font-size:13px">${esc(evs.target)}</div></div>`;
  day.sessions.forEach((s, si) => { if (s.sport !== "Event") body += sessionCard(`${curWk}-${curDi}-${si}`, s, curWk, curDi, si); });
  if (day.sessions[0].sport === "Rest") body = `<div class="card" style="text-align:center;padding:28px 16px"><div style="font-size:30px">😴</div><div style="font-weight:800;font-size:18px;margin-top:8px">Rest Day</div><div class="muted" style="margin-top:4px">Full recovery. Sleep, eat, hydrate.</div></div>`;
  root().innerHTML = `<div class="appbar"><div><div class="hi">${fmtD(dDate(curWk, curDi))} · Week ${curWk} · ${esc(wk.phase)}</div><div class="nm">${curWk === loc.wk && curDi === loc.di ? "Today's training" : esc(DOW[curDi]) + "'s training"}</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll"><div class="weekstrip">${strip}</div><div class="muted" style="margin:2px 0 12px">${esc(wk.note)}</div>${body}</div>`;
  root().querySelectorAll(".wd").forEach(el => el.onclick = () => { curDi = +el.dataset.di; renderTodayLoaded(); });
}
function sessionCard(ref, s, wk, di, si) {
  const done = doneSet.has(ref), col = SPORT_COLOR[s.sport];
  const detail = (s.detail && s.detail.length) ? `<div class="detail">${s.detail.map(x => `<div>${esc(x)}</div>`).join("")}</div>` : "";
  const tss = s.tss ? `<span class="tss">TSS ${s.tss}</span>` : "";
  return `<div class="card sess" style="border-left-color:${col}">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="sport" style="background:${col}">${esc(s.sport)}</span>
      <div style="display:flex;align-items:center;gap:8px">${tss}<div class="check ${done ? "on" : ""}" data-ref="${ref}"></div></div></div>
    <div class="stitle">${esc(s.title)}</div><div class="starget">${esc(s.target)}</div>${detail}
    <div class="sessbtns"><button class="btn btn-gold btn-sm" style="flex:1" data-adj='${btoa(unescape(encodeURIComponent(JSON.stringify(s))))}'>Adjust with AI</button></div></div>`;
}

// ---------- TODAY: AI (friends) ----------
function renderTodayAI() {
  const plan = aiPlan; const todayAbbr = DOW[(new Date().getDay() + 6) % 7];
  window.__aiDay = window.__aiDay || todayAbbr;
  const strip = (plan.days || []).map(d => {
    const rest = d.type === "rest";
    return `<div class="wd ${d.day === window.__aiDay ? "on" : ""} ${rest ? "rest" : ""}" data-day="${d.day}"><div class="dn">${d.day}</div><div class="dd" style="font-size:10px;margin-top:4px">${rest ? "Rest" : (d.type[0].toUpperCase() + d.type.slice(1, 4))}</div></div>`;
  }).join("");
  const d = (plan.days || []).find(x => x.day === window.__aiDay) || { type: "rest", exercises: [] };
  let body = "";
  if (d.type === "rest") body = `<div class="card" style="text-align:center;padding:28px 16px"><div style="font-size:30px">😴</div><div style="font-weight:800;font-size:18px;margin-top:8px">Rest Day</div><div class="muted" style="margin-top:4px">${esc(d.cooldown || "Recovery. A light walk is optional.")}</div></div>`;
  else {
    body += `<div class="card"><div class="stitle" style="margin-top:0">${esc(d.title || "Workout")}</div><div class="starget">~${d.estMinutes || profile.workout_window_min || 45} min${d.warmup ? " · warm-up: " + esc(d.warmup) : ""}</div></div>`;
    (d.exercises || []).forEach((ex, xi) => {
      const ref = `ai-${window.__aiDay}-${xi}`, done = doneSet.has(ref), cardio = ex.kind === "cardio";
      const col = cardio ? SPORT_COLOR.Run : SPORT_COLOR.Strength;
      const meta = cardio ? `${esc(ex.cardio ? ex.cardio.modality : "cardio")} · ${esc(ex.cardio ? ex.cardio.target : "")}` : `${ex.sets || 3} × ${esc(ex.repTarget || "")}${ex.startWeight ? " · " + esc(ex.startWeight) : ""}`;
      body += `<div class="card sess" style="border-left-color:${col}">
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="sport" style="background:${col}">${cardio ? "Cardio" : "Strength"}</span><div class="check ${done ? "on" : ""}" data-ref="${ref}"></div></div>
        <div class="stitle">${esc(ex.name)}</div><div class="starget">${meta}</div>${ex.note ? `<div class="muted" style="margin-top:6px">${esc(ex.note)}</div>` : ""}
        <div class="sessbtns"><button class="btn btn-ghost btn-sm" style="flex:1" data-log='${btoa(unescape(encodeURIComponent(JSON.stringify({ name: ex.name, kind: ex.kind, sets: ex.sets }))))}'>Log</button>
        <button class="btn btn-gold btn-sm" style="flex:1" data-adj='${btoa(unescape(encodeURIComponent(JSON.stringify({ sport: cardio ? "Cardio" : "Strength", title: ex.name, target: meta, detail: [] }))))}'>Adjust</button></div></div>`;
    });
    if (d.cooldown) body += `<p class="muted" style="margin-top:12px">Cooldown: ${esc(d.cooldown)}</p>`;
  }
  root().innerHTML = `<div class="appbar"><div><div class="hi">Week ${aiPlan.weekNumber || 1} · ${esc(aiPlan.planSummary || "Your plan")}</div><div class="nm">Today</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll"><div class="weekstrip">${strip}</div>${aiPlan.coachNote ? `<div class="muted" style="margin:2px 0 12px">${esc(aiPlan.coachNote)}</div>` : ""}${body}</div>`;
  root().querySelectorAll(".wd").forEach(el => el.onclick = () => { window.__aiDay = el.dataset.day; renderTodayAI(); });
}

// ---------- click delegation (checks / log / adjust) ----------
document.addEventListener("click", async (e) => {
  const chk = e.target.closest(".check[data-ref]");
  if (chk) { await toggleCompletion(chk.dataset.ref); chk.classList.toggle("on"); return; }
  const lg = e.target.closest("[data-log]");
  if (lg) { openLog(JSON.parse(decodeURIComponent(escape(atob(lg.dataset.log))))); return; }
  const aj = e.target.closest("[data-adj]");
  if (aj) { openAdjust(JSON.parse(decodeURIComponent(escape(atob(aj.dataset.adj))))); return; }
});

// ---------- LOG sheet (AI strength/cardio) ----------
function openLog(ex) {
  let fields;
  if (ex.kind === "cardio") fields = `<div class="row"><div><div class="label" style="margin-top:0">Distance</div><input class="field" id="ld" placeholder="e.g. 3 km"></div><div><div class="label" style="margin-top:0">Time</div><input class="field" id="lt" placeholder="mm:ss"></div></div>`;
  else { let r = ""; const n = ex.sets || 3; for (let i = 1; i <= n; i++) r += `<div class="setrow"><div class="sn">${i}</div><input class="mini" id="w${i}" inputmode="decimal" placeholder="wt"><input class="mini" id="r${i}" inputmode="numeric" placeholder="reps"><div class="check" onclick="this.classList.toggle('on')"></div></div>`; fields = `<div class="setrow" style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase"><div class="sn">Set</div><div style="text-align:center">Weight</div><div style="text-align:center">Reps</div><div></div></div>${r}`; }
  openSheet(`<h2 class="title">${esc(ex.name)}</h2><p class="sub">Quick log.</p>${fields}<button class="btn btn-gold" style="margin-top:14px" id="lsave">Save</button><button class="btn btn-ghost" style="margin-top:9px" onclick="__closeModal()">Cancel</button>`);
  $("lsave").onclick = async () => {
    try {
      if (ex.kind === "cardio") {
        await sb.from("cardio_logs").insert({ user_id: session.user.id, modality: "run", avg_pace: ($("lt").value || ""), distance_km: null });
      } else {
        const rows = []; const n = ex.sets || 3;
        for (let i = 1; i <= n; i++) { const w = $("w" + i).value, r = $("r" + i).value; if (w || r) rows.push({ user_id: session.user.id, exercise_name: ex.name, set_number: i, weight_lb: +w || null, reps: +r || null }); }
        if (rows.length) await sb.from("strength_logs").insert(rows);
      }
      closeModal(); toast("Logged ✓");
    } catch (err) { toast("Save failed"); }
  };
}

// ---------- ADJUST with AI ----------
function openAdjust(s) {
  openSheet(`<h2 class="title">Adjust with AI</h2><p class="sub">${esc(s.title)}</p>
    <div class="label" style="margin-top:6px">What needs to change?</div>
    <textarea class="field" id="ajReq" rows="3" placeholder="e.g. only 30 min today / no pool / legs are trashed"></textarea>
    <div class="wrapchips" style="margin-top:9px">${["Short on time", "Tired / sore", "No pool", "Traveling", "Make it easier"].map(q => `<span class="pill" style="cursor:pointer" data-q="${q}">${q}</span>`).join("")}</div>
    <button class="btn btn-gold" style="margin-top:16px" id="ajGo">Get adjusted session</button>
    <div class="errbox" id="ajErr"></div><div id="ajOut"></div>
    <button class="btn btn-ghost" style="margin-top:12px" onclick="__closeModal()">Close</button>`);
  $("sheet").querySelectorAll("[data-q]").forEach(el => el.onclick = () => $("ajReq").value = el.dataset.q);
  $("ajGo").onclick = async () => {
    const btn = $("ajGo"); btn.disabled = true; btn.textContent = "Thinking…"; $("ajErr").style.display = "none";
    try {
      const txt = await aiCall({ type: "adjust", session: s, request: $("ajReq").value || "sensible swap" });
      $("ajOut").innerHTML = `<div class="aiout">${esc(txt)}</div>`;
    } catch (e) { const er = $("ajErr"); er.style.display = "block"; er.textContent = e.message; }
    btn.disabled = false; btn.textContent = "Get adjusted session";
  };
}

// ---------- PLAN ----------
function renderPlanLoaded() {
  const loc = locateToday();
  const rows = TRI_WEEKS.map(w => {
    const evt = w.days.map(d => d.sessions.find(s => s.sport === "Event")).filter(Boolean)[0];
    return `<div class="wkrow ${w.wk === loc.wk ? "cur" : ""}" data-wk="${w.wk}"><div class="wknum"><b>${w.wk}</b><span>wk</span></div>
      <div style="flex:1"><div style="font-weight:700;font-size:14.5px">${esc(w.phase)}${evt ? " · " + esc(evt.title.replace(/[^\x20-\x7E]/g, "").trim()) : ""}</div>
      <div class="muted">${fmtShort(dDate(w.wk, 0))} – ${fmtShort(dDate(w.wk, 6))} · ${esc(w.hours)}</div></div><div style="color:#C9CCD3;font-size:20px">›</div></div>`;
  }).join("");
  root().innerHTML = `<div class="appbar"><div><div class="hi">16 weeks · Jun 29 → Oct 17</div><div class="nm">Your plan</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll"><div class="card" style="background:linear-gradient(135deg,#1b1d22,#33373f);color:#fff;border:none"><div style="font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--gold);font-weight:800">A-Race</div><div style="font-size:19px;font-weight:800;margin:6px 0 2px">Half Distance Triathlon</div><div style="color:#C9CCD3;font-size:13px">Sat Oct 17 · ${daysToRace()} days away</div></div>
    <div class="card" style="margin-top:11px;padding:8px 15px">${rows}</div></div>`;
  root().querySelectorAll(".wkrow").forEach(el => el.onclick = () => { curWk = +el.dataset.wk; curDi = 0; openTab("today"); });
}
function renderPlanAI() {
  const plan = aiPlan;
  const rows = (plan.days || []).map(d => `<div class="wkrow"><div class="wknum" style="background:${d.type === "rest" ? "#F1F2F5" : "var(--gold)"};color:${d.type === "rest" ? "var(--ink-soft)" : "#fff"}"><b>${d.day}</b></div><div style="flex:1"><div style="font-weight:700;font-size:14.5px">${esc(d.title || (d.type[0].toUpperCase() + d.type.slice(1)))}</div><div class="muted">${d.type === "rest" ? "Rest" : (d.exercises || []).length + " exercises · ~" + (d.estMinutes || 45) + " min"}</div></div></div>`).join("");
  root().innerHTML = `<div class="appbar"><div><div class="hi">This week</div><div class="nm">Your plan</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll"><div class="card"><div class="muted" style="margin:0">${esc(plan.planSummary || "")}</div></div><div class="card" style="margin-top:11px;padding:8px 15px">${rows}</div>
    <button class="btn btn-ghost" style="margin-top:14px" onclick="__regen()">Regenerate this week</button></div>`;
}

// ---------- PROGRESS ----------
function renderProgress() {
  const bars = weights.slice(-10).map(x => { const mx = Math.max(...weights.map(v => v.weight_lb)), mn = Math.min(...weights.map(v => v.weight_lb)); const h = mx === mn ? 60 : 20 + (1 - ((x.weight_lb - mn) / (mx - mn))) * 80; return `<div class="bar" style="height:${h}%"></div>`; }).join("") || `<p class="muted">No weigh-ins yet.</p>`;
  const cw = weights.length ? weights[weights.length - 1].weight_lb : null;
  const loaded = profile.plan_type === "loaded";
  const doneN = doneSet.size;
  const extra = loaded ? `<div class="stat"><div class="v">${daysToRace()}</div><div class="l">Days to race</div></div>` : `<div class="stat"><div class="v">${(aiPlan && aiPlan.days ? aiPlan.days.filter(d => d.type !== "rest").length : 0)}</div><div class="l">Sessions/wk</div></div>`;
  root().innerHTML = `<div class="appbar"><div><div class="hi">How it's going</div><div class="nm">Progress</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll"><div class="card"><div style="display:flex"><div class="stat"><div class="v">${doneN}</div><div class="l">Done</div></div>${extra}<div class="stat"><div class="v">${weights.length}</div><div class="l">Weigh-ins</div></div></div></div>
    <div class="card"><div class="label" style="margin-top:0">Bodyweight ${cw ? "· " + cw + " lb" : ""}</div><div class="barwrap">${bars}</div>
    <div class="row" style="align-items:center;margin-top:12px"><input class="field" id="wIn" inputmode="decimal" placeholder="log today (lb)" style="flex:1"><button class="btn btn-gold btn-sm" style="padding:12px 16px" id="wSave">Save</button></div></div></div>`;
  $("wSave").onclick = async () => {
    const v = +$("wIn").value; if (!v) return;
    const today = new Date().toISOString().slice(0, 10);
    await sb.from("bodyweight_logs").upsert({ user_id: session.user.id, weight_lb: v, log_date: today }, { onConflict: "user_id,log_date" });
    await loadWeights(); renderProgress(); toast("Weight saved");
  };
}

// ---------- PROFILE ----------
function renderProfile() {
  const loaded = profile.plan_type === "loaded";
  root().innerHTML = `<div class="appbar"><div><div class="hi">Athlete</div><div class="nm">Profile</div></div><div class="avatar">${initial()}</div></div>
    <div class="scroll">
      <div class="card"><div class="label" style="margin-top:0">Account</div><p class="muted">${esc(session.user.email || "signed in")}</p></div>
      <div class="card"><div class="label" style="margin-top:0">Your plan</div><p class="muted">${loaded ? "Loaded: 16-week Half-Distance Triathlon + Hyrox." : "AI-generated hybrid plan from your onboarding."}</p>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" id="ptBtn">${loaded ? "Switch to an AI-generated plan" : "Load my triathlon plan"}</button></div>
      <div class="card"><div class="label" style="margin-top:0">Feedback</div><p class="muted">Spot something off? Tell us — it goes straight to the team.</p><button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" onclick="__feedback()">Send feedback</button></div>
      <button class="btn btn-ghost" style="margin-top:14px" id="soBtn">Sign out</button>
      <p class="muted" style="text-align:center;margin-top:12px">Swift · beta</p>
    </div>`;
  $("soBtn").onclick = () => sb.auth.signOut();
  $("ptBtn").onclick = async () => {
    const nt = loaded ? "ai" : "loaded";
    await sb.from("profiles").update({ plan_type: nt }).eq("user_id", session.user.id);
    profile.plan_type = nt;
    if (nt === "ai") { await loadAiPlan(); if (!aiPlan) { renderOnboarding(); return; } }
    openTab("today");
  };
}

// ---------- FEEDBACK ----------
function openFeedback() {
  openSheet(`<h2 class="title">Send feedback</h2><p class="sub">What worked, what didn't, what's confusing — anything.</p>
    <textarea class="field" id="fbTxt" rows="4" placeholder="Your feedback…"></textarea>
    <button class="btn btn-gold" style="margin-top:14px" id="fbSave">Send</button>
    <button class="btn btn-ghost" style="margin-top:9px" onclick="__closeModal()">Cancel</button>`);
  $("fbSave").onclick = async () => {
    const msg = $("fbTxt").value.trim(); if (!msg) return;
    await sb.from("feedback").insert({ user_id: session.user.id, email: session.user.email, message: msg, page: "app" });
    closeModal(); toast("Thanks — feedback sent 🙏");
  };
}

// ---------- misc ----------
function initial() { return ((profile && profile.email) || "S")[0].toUpperCase(); }
async function regen() {
  window.__aiDay = null;
  renderOnboarding();
}
// expose a few handlers used in inline onclick
window.__go = openTab;
window.__closeModal = closeModal;
window.__feedback = openFeedback;
window.__regen = regen;

boot();
