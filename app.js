import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TRI_WEEKS, TRI_START } from "./plan-data.js";

// ---------- globals ----------
const OWNER_EMAILS = ["drummonda08@gmail.com", "aaron@dbs-llc.co"];
let sb = null, session = null, profile = null;
let aiPlan = null, aiPlanId = null;
let doneSet = new Set(), weights = [], goals = [], benchmarks = [];
let curWk = 1, curDi = 0;
let chatHistory = [];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COMMON_LIFTS = ["Bench Press", "Back Squat", "Deadlift", "Overhead Press", "Pull-ups"];
const SPORT_COLOR = { Swim: "var(--swim)", Bike: "var(--bike)", Run: "var(--run)", Hyrox: "var(--hyrox)", Strength: "var(--str)", Brick: "var(--brick)", Event: "var(--event)", Rest: "#B5B9C1" };

const $ = (id) => document.getElementById(id);
const root = () => $("root");
const esc = (s) => (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const unb64 = (s) => JSON.parse(decodeURIComponent(escape(atob(s))));
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(window._t); window._t = setTimeout(() => t.classList.remove("show"), 2000); }
function closeModal() { $("modal").classList.remove("show"); }
function openSheet(html) { $("sheet").innerHTML = html; $("modal").classList.add("show"); }
const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------- dates ----------
function dDate(wk, di) { const d = new Date(TRI_START); d.setDate(d.getDate() + (wk - 1) * 7 + di); return d; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function fmtD(d) { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function fmtShort(d) { return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function locateToday() { const now = new Date(); for (let w = 1; w <= 16; w++) for (let i = 0; i < 7; i++) if (sameDay(dDate(w, i), now)) return { wk: w, di: i }; if (now < dDate(1, 0)) return { wk: 1, di: 0 }; return { wk: 16, di: 6 }; }
function daysToRace() { return Math.max(0, Math.round((dDate(16, 5) - new Date()) / 864e5)); }
function daysUntil(dateStr) { if (!dateStr) return null; return Math.round((new Date(dateStr) - new Date()) / 864e5); }

// ---------- boot ----------
async function boot() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    let url = (cfg.supabaseUrl || "").trim().replace(/\/+$/, "");
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    const anon = (cfg.supabaseAnonKey || "").trim();
    if (!url || !anon) { root().innerHTML = errScreen("Server keys aren't set yet. In Vercel add <b>SUPABASE_URL</b> and <b>SUPABASE_ANON_KEY</b>, then <b>Redeploy</b>."); return; }
    sb = createClient(url, anon);
    const { data } = await sb.auth.getSession();
    session = data.session;
    sb.auth.onAuthStateChange((_e, s) => { session = s; route(); });
    $("fbtn").onclick = openFeedback;
    document.querySelectorAll(".tab").forEach(t => t.onclick = () => openTab(t.dataset.tab));
    await route();
  } catch (e) { root().innerHTML = errScreen("Couldn't start: " + esc(e.message)); }
}
function errScreen(msg) { return `<div class="center"><div class="logo" style="font-size:34px;text-align:center;margin-bottom:10px">SWIFT<span class="dot">.</span></div><div class="card"><p class="sub" style="margin:0">${msg}</p></div></div>`; }

async function route() {
  const loc = locateToday(); curWk = loc.wk; curDi = loc.di;
  if (!session) { hideChrome(); renderLogin(); return; }
  await loadProfile();
  await Promise.all([loadCompletions(), loadWeights(), loadGoals(), loadBenchmarks()]);
  if (profile.plan_type === "loaded") { openTab("home"); return; }
  await loadAiPlan();
  if (!aiPlan) { hideChrome(); startOnboarding(); return; }
  openTab("home");
}
function hideChrome() { $("tabbar").style.display = "none"; $("fbtn").style.display = "none"; }

// ---------- loads ----------
async function loadProfile() {
  const uid = session.user.id;
  let { data } = await sb.from("profiles").select("*").eq("user_id", uid).maybeSingle();
  if (!data) { const ins = await sb.from("profiles").insert({ user_id: uid, email: session.user.email }).select().maybeSingle(); data = ins.data || { user_id: uid, email: session.user.email, plan_type: "ai" }; }
  profile = data;
}
async function loadAiPlan() { const { data } = await sb.from("plans").select("*").eq("user_id", session.user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(); aiPlan = data ? data.raw_json : null; aiPlanId = data ? data.id : null; }
async function loadCompletions() { const { data } = await sb.from("session_completions").select("ref,done").eq("user_id", session.user.id); doneSet = new Set((data || []).filter(r => r.done).map(r => r.ref)); }
async function loadWeights() { const { data } = await sb.from("bodyweight_logs").select("weight_lb,log_date").eq("user_id", session.user.id).order("log_date", { ascending: true }); weights = data || []; }
async function loadGoals() { const { data } = await sb.from("goals").select("*").eq("user_id", session.user.id).eq("status", "active").order("created_at", { ascending: true }); goals = data || []; }
async function loadBenchmarks() { const { data } = await sb.from("benchmark_lifts").select("*").eq("user_id", session.user.id).order("performed_on", { ascending: true }); benchmarks = data || []; }
async function toggleCompletion(ref) { const now = !doneSet.has(ref); if (now) doneSet.add(ref); else doneSet.delete(ref); await sb.from("session_completions").upsert({ user_id: session.user.id, ref, done: now }, { onConflict: "user_id,ref" }); }

function latestBenchmarks() {
  const by = {};
  benchmarks.forEach(b => { const k = b.lift; if (!by[k] || b.performed_on >= by[k].performed_on) by[k] = b; });
  const best = {}; benchmarks.forEach(b => { const k = b.lift; if (!best[k] || (b.weight_lb || 0) > (best[k].weight_lb || 0)) best[k] = b; });
  return Object.keys(by).map(k => ({ lift: k, latest: by[k], best: best[k] }));
}
function initial() { return ((profile && profile.email) || "S")[0].toUpperCase(); }
function isOwner() { return OWNER_EMAILS.includes((session.user.email || "").toLowerCase()); }

// ---------- LOGIN ----------
function renderLogin() {
  root().innerHTML = `<div class="scroll"><div class="center">
    <div class="logo" style="font-size:40px;text-align:center;margin-bottom:6px">SWIFT<span class="dot">.</span></div>
    <p class="sub" style="text-align:center">Leaner, stronger, fitter — your AI hybrid coach.</p>
    <div class="card"><button class="btn btn-dark" id="gBtn">Continue with Google</button>
      <div style="text-align:center;color:#B5B9C1;font-size:12px;margin:14px 0;font-weight:600">— or —</div>
      <div class="label" style="margin-top:0">Email</div><input class="field" id="emailIn" type="email" placeholder="you@email.com">
      <button class="btn btn-gold" style="margin-top:12px" id="mBtn">Email me a login link</button>
      <div class="errbox" id="logErr"></div><p id="logMsg" class="muted" style="margin-top:12px;text-align:center;display:none"></p></div>
    <p class="muted" style="text-align:center;margin-top:14px">New here? Just sign in — your account is created automatically.</p></div></div>`;
  $("gBtn").onclick = async () => { const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } }); if (error) le(error.message); };
  $("mBtn").onclick = async () => {
    const email = $("emailIn").value.trim(); if (!email) return le("Enter your email first.");
    $("mBtn").disabled = true; $("mBtn").textContent = "Sending…";
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    $("mBtn").disabled = false; $("mBtn").textContent = "Email me a login link";
    if (error) return le(error.message);
    const m = $("logMsg"); m.style.display = "block"; m.textContent = "Check your email for a login link, then come back here.";
  };
  function le(m) { const e = $("logErr"); e.style.display = "block"; e.textContent = m; }
}

// ---------- ONBOARDING (multi-step) ----------
let obStep = 0;
const ob = { goal: "", goals: new Set(["Lose fat", "Build strength"]), age: "", height: "", weight: "", goalWeight: "", targetDate: "", dpw: 4, days: new Set(["Mon", "Tue", "Thu", "Sat"]), window: 45, equipment: "", injury: "", exp: "Intermediate", pace: "Steady", lifts: {}, };
function startOnboarding() { obStep = 0; renderStep(); }
function renderStep() {
  const dots = [0, 1, 2, 3, 4].map(i => `<i class="${i <= obStep ? "on" : ""}"></i>`).join("");
  let inner = "";
  if (obStep === 0) inner = `<h2 class="title">What do you want to achieve?</h2><p class="sub">Tell Swift in your own words.</p>
    <textarea class="field" id="s_goal" rows="4" placeholder="e.g. Lose 15 lbs, get stronger, ~45 min a day at home with dumbbells, bad left knee.">${esc(ob.goal)}</textarea>
    <div class="label">Quick picks</div><div class="wrapchips" id="s_goalchips"></div>
    ${isOwner() ? `<button class="btn btn-ghost" style="margin-top:14px" id="loadTriBtn">I already have a plan — load it</button>` : ""}`;
  else if (obStep === 1) inner = `<h2 class="title">About you</h2><p class="sub">Sets your starting point.</p>
    <div class="row"><div><div class="label" style="margin-top:0">Age</div><input class="field" id="s_age" inputmode="numeric" value="${esc(ob.age)}"></div><div><div class="label" style="margin-top:0">Height</div><input class="field" id="s_height" value="${esc(ob.height)}" placeholder="5'11&quot;"></div></div>
    <div class="row" style="margin-top:6px"><div><div class="label" style="margin-top:0">Weight (lb)</div><input class="field" id="s_weight" inputmode="numeric" value="${esc(ob.weight)}"></div><div><div class="label" style="margin-top:0">Goal weight (lb)</div><input class="field" id="s_goalw" inputmode="numeric" value="${esc(ob.goalWeight)}"></div></div>
    <div class="label">Goal date</div><input class="field" id="s_target" type="date" value="${esc(ob.targetDate)}">`;
  else if (obStep === 2) inner = `<h2 class="title">When can you train?</h2><p class="sub">Swift builds around your week.</p>
    <div class="label">Days per week</div><div class="grid4" id="s_dpw"></div>
    <div class="label">Which days</div><div class="grid7" id="s_days"></div>
    <div class="label">Daily window</div><div class="grid4" id="s_win"></div>`;
  else if (obStep === 3) inner = `<h2 class="title">Equipment & body</h2><p class="sub">So plans fit what you've got.</p>
    <div class="label">Equipment</div><input class="field" id="s_equip" value="${esc(ob.equipment)}" placeholder="dumbbells, bench — or 'bodyweight only'">
    <div class="label">Injuries / limitations</div><input class="field" id="s_injury" value="${esc(ob.injury)}" placeholder="none, or e.g. bad knee">
    <div class="label">Experience</div><div class="wrapchips" id="s_exp"></div>
    <div class="label">Progression pace</div><div class="wrapchips" id="s_pace"></div>`;
  else inner = `<h2 class="title">Benchmark lifts</h2><p class="sub">Optional — your current numbers so we can track PRs. Leave blank if unsure.</p>
    ${COMMON_LIFTS.map(l => `<div class="row" style="margin-top:6px;align-items:center"><div style="flex:1.4"><div class="label" style="margin-top:0">${l}</div></div><input class="field" id="lf_${l.replace(/\W/g, '')}" inputmode="numeric" placeholder="${l === "Pull-ups" ? "reps" : "lb"}" value="${esc(ob.lifts[l] || "")}" style="flex:1"></div>`).join("")}`;
  const backBtn = obStep > 0 ? `<button class="btn btn-ghost" style="flex:1" id="s_back">Back</button>` : "";
  const nextLabel = obStep === 4 ? (isOwner() ? "Finish & load my plan" : "Build my plan") : "Next";
  root().innerHTML = `<div class="scroll"><div class="steps">${dots}</div>${inner}
    <div class="row" style="margin-top:22px">${backBtn}<button class="btn btn-gold" style="flex:2" id="s_next">${nextLabel}</button></div>
    <div class="errbox" id="s_err"></div>
    <button class="btn btn-ghost" style="margin-top:10px" id="s_out">Sign out</button></div>`;
  // wire step widgets
  if (obStep === 0) { chips("s_goalchips", ["Lose fat", "Build strength", "Keep endurance", "Get toned", "Run faster", "General health"], ob.goals, true); const lb = $("loadTriBtn"); if (lb) lb.onclick = ownerLoad; }
  if (obStep === 2) { chipsVal("s_dpw", [3, 4, 5, 6], "dpw", v => v); daysGrid("s_days"); chipsVal("s_win", [30, 45, 60, 75], "window", v => v + "m"); }
  if (obStep === 3) { chipsVal("s_exp", ["New", "Intermediate", "Advanced"], "exp", v => v, true); chipsVal("s_pace", ["Gentle", "Steady", "Aggressive"], "pace", v => v, true); }
  $("s_next").onclick = stepNext;
  if ($("s_back")) $("s_back").onclick = () => { saveStep(); obStep--; renderStep(); };
  $("s_out").onclick = () => sb.auth.signOut();
}
function chips(id, items, set, multi) { const el = $(id); el.innerHTML = ""; items.forEach(it => { const c = document.createElement("div"); c.className = "chip" + (set.has(it) ? " on" : ""); c.textContent = it; c.onclick = () => { set.has(it) ? set.delete(it) : set.add(it); c.classList.toggle("on"); }; el.appendChild(c); }); }
function chipsVal(id, items, key, fmt, flex) { const el = $(id); el.innerHTML = ""; items.forEach(it => { const c = document.createElement("div"); c.className = "chip" + (ob[key] === it ? " on" : ""); c.textContent = fmt(it); if (flex) c.style.flex = "1"; c.onclick = () => { ob[key] = it;[...el.children].forEach(x => x.classList.remove("on")); c.classList.add("on"); }; el.appendChild(c); }); }
function daysGrid(id) { const el = $(id); el.innerHTML = ""; DOW.forEach(d => { const c = document.createElement("div"); c.className = "day" + (ob.days.has(d) ? " on" : ""); c.textContent = d[0]; c.onclick = () => { ob.days.has(d) ? ob.days.delete(d) : ob.days.add(d); c.classList.toggle("on"); }; el.appendChild(c); }); }
function saveStep() {
  if (obStep === 0) ob.goal = $("s_goal").value;
  else if (obStep === 1) { ob.age = $("s_age").value; ob.height = $("s_height").value; ob.weight = $("s_weight").value; ob.goalWeight = $("s_goalw").value; ob.targetDate = $("s_target").value; }
  else if (obStep === 3) { ob.equipment = $("s_equip").value; ob.injury = $("s_injury").value; }
  else if (obStep === 4) COMMON_LIFTS.forEach(l => { const v = $("lf_" + l.replace(/\W/g, "")); if (v) ob.lifts[l] = v.value; });
}
function stepNext() { saveStep(); if (obStep < 4) { obStep++; renderStep(); } else finishOnboarding(); }
async function ownerLoad() { await sb.from("profiles").update({ plan_type: "loaded" }).eq("user_id", session.user.id); profile.plan_type = "loaded"; openTab("home"); }

async function finishOnboarding() {
  const p = {
    freeTextGoal: ob.goal, goals: [...ob.goals], age: +ob.age || null, weight_lb: +ob.weight || null,
    goalWeight_lb: +ob.goalWeight || null, targetDate: ob.targetDate || null, injuries: ob.injury, equipment: ob.equipment,
    workoutWindowMin: ob.window, daysPerWeek: ob.dpw, trainingDays: [...ob.days].sort((a, b) => DOW.indexOf(a) - DOW.indexOf(b)),
    experience: ob.exp.toLowerCase(), progressionPace: ob.pace.toLowerCase()
  };
  root().innerHTML = `<div class="scroll"><div class="center"><div class="ring"></div><h2 class="title" style="text-align:center;margin-top:18px">Setting up Swift…</h2></div></div>`;
  try {
    await sb.from("profiles").update({ free_text_goal: p.freeTextGoal, goals: p.goals, age: p.age, weight_lb: p.weight_lb, goal_weight_lb: p.goalWeight_lb, target_date: p.targetDate, injuries: p.injuries, equipment: p.equipment, workout_window_min: p.workoutWindowMin, days_per_week: p.daysPerWeek, training_days: p.trainingDays, experience: p.experience, progression_pace: p.progressionPace, updated_at: new Date().toISOString() }).eq("user_id", session.user.id);
    // benchmark lifts
    const rows = COMMON_LIFTS.filter(l => ob.lifts[l]).map(l => ({ user_id: session.user.id, lift: l, weight_lb: l === "Pull-ups" ? null : (+ob.lifts[l] || null), reps: l === "Pull-ups" ? (+ob.lifts[l] || null) : 1 }));
    if (rows.length) { await sb.from("benchmark_lifts").insert(rows); }
    // weight goal
    if (p.goalWeight_lb && p.targetDate) await sb.from("goals").insert({ user_id: session.user.id, goal_type: "weight", title: `Reach ${p.goalWeight_lb} lb`, target_value: p.goalWeight_lb, unit: "lb", target_date: p.targetDate });
    if (p.weight_lb) await sb.from("bodyweight_logs").upsert({ user_id: session.user.id, weight_lb: p.weight_lb, log_date: todayISO() }, { onConflict: "user_id,log_date" });
    await Promise.all([loadGoals(), loadBenchmarks(), loadWeights()]);
    if (isOwner()) { await sb.from("profiles").update({ plan_type: "loaded" }).eq("user_id", session.user.id); profile.plan_type = "loaded"; openTab("home"); return; }
    const plan = await aiCall({ type: "generate", profile: p });
    await sb.from("plans").update({ status: "superseded" }).eq("user_id", session.user.id).eq("status", "active");
    const ins = await sb.from("plans").insert({ user_id: session.user.id, week_number: plan.weekNumber || 1, status: "active", plan_summary: plan.planSummary, coach_note: plan.coachNote, raw_json: plan }).select().maybeSingle();
    aiPlan = plan; aiPlanId = ins.data ? ins.data.id : null;
    profile.plan_type = "ai"; openTab("home");
  } catch (e) { startOnboarding(); setTimeout(() => { const er = $("s_err"); if (er) { er.style.display = "block"; er.textContent = "Something went wrong: " + e.message; } }, 30); }
}

// ---------- AI ----------
async function aiCall(payload) {
  const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify(payload) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || ("Server error " + res.status));
  if (payload.type === "adjust") return j.text;
  if (payload.type === "chat") return j;
  return j.plan;
}

// ---------- today helpers ----------
function getToday() {
  if (profile.plan_type === "loaded") { const loc = locateToday(); return { mode: "loaded", wk: loc.wk, di: loc.di, day: TRI_WEEKS[loc.wk - 1].days[loc.di], phase: TRI_WEEKS[loc.wk - 1].phase }; }
  const abbr = DOW[(new Date().getDay() + 6) % 7];
  return { mode: "ai", abbr, day: (aiPlan.days || []).find(d => d.day === abbr) || { type: "rest", exercises: [] } };
}

// ---------- TABS ----------
function openTab(tab) {
  $("tabbar").style.display = "flex"; $("fbtn").style.display = "block";
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.tab === tab));
  if (tab === "home") renderHome();
  else if (tab === "plan") profile.plan_type === "loaded" ? renderPlanLoaded() : renderPlanAI();
  else if (tab === "progress") renderMetrics();
  else if (tab === "profile") renderProfile();
  window.scrollTo(0, 0);
}
window.__go = openTab;
window.__closeModal = closeModal;
window.__feedback = openFeedback;

// ---------- HOME ----------
function renderHome() {
  const t = getToday();
  const w = weights.length ? weights[weights.length - 1] : null;
  const loggedToday = w && w.log_date === todayISO();
  let overview;
  if (t.mode === "loaded") {
    const rest = t.day.sessions[0].sport === "Rest";
    const evt = t.day.sessions.find(s => s.sport === "Event");
    const lines = t.day.sessions.filter(s => s.sport !== "Rest").map(s => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span class="sport" style="background:${SPORT_COLOR[s.sport]}">${esc(s.sport)}</span><span style="font-size:13.5px;font-weight:600">${esc(s.title)}</span></div>`).join("");
    overview = `<div class="card" onclick="__openWorkout()"><div style="display:flex;justify-content:space-between;align-items:center"><div class="label" style="margin:0">Today · Week ${t.wk} · ${esc(t.phase)}</div><span style="color:#C9CCD3;font-size:20px">›</span></div>
      ${evt ? `<div class="stitle" style="margin-top:8px">${esc(evt.title)}</div><div class="starget">${esc(evt.target)}</div>` : (rest ? `<div class="stitle" style="margin-top:8px">Rest day 😴</div><div class="starget">Full recovery</div>` : lines)}
      <div class="muted" style="margin-top:10px">Tap for the full breakdown</div></div>`;
  } else {
    const d = t.day, rest = d.type === "rest";
    overview = `<div class="card" onclick="__openWorkout()"><div style="display:flex;justify-content:space-between;align-items:center"><div class="label" style="margin:0">Today's workout</div><span style="color:#C9CCD3;font-size:20px">›</span></div>
      <div class="stitle" style="margin-top:8px">${rest ? "Rest day 😴" : esc(d.title || "Workout")}</div>
      <div class="starget">${rest ? "Recovery" : (d.exercises || []).length + " exercises · ~" + (d.estMinutes || profile.workout_window_min || 45) + " min"}</div>
      <div class="muted" style="margin-top:10px">Tap for the full breakdown</div></div>`;
  }
  root().innerHTML = `<div class="appbar"><div><div class="hi">${fmtD(new Date())}</div><div class="nm">Hi ${esc((profile.email || "there").split("@")[0])}</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll">
      <div class="chatentry" onclick="__chat()"><div class="q">How can we help today?</div><div class="go">↗</div></div>
      <div style="height:12px"></div>${overview}
      <div class="card" style="margin-top:12px"><div class="label" style="margin-top:0">Today's weigh-in ${loggedToday ? "· logged ✓" : ""}</div>
        <div class="row" style="align-items:center;margin-top:2px"><input class="field" id="homeW" inputmode="decimal" placeholder="${w ? w.weight_lb + " lb last" : "enter weight (lb)"}" style="flex:1"><button class="btn btn-gold btn-sm" style="padding:12px 18px" id="homeWBtn">Save</button></div></div>
    </div>`;
  $("homeWBtn").onclick = async () => { const v = +$("homeW").value; if (!v) return; await sb.from("bodyweight_logs").upsert({ user_id: session.user.id, weight_lb: v, log_date: todayISO() }, { onConflict: "user_id,log_date" }); await loadWeights(); renderHome(); toast("Weight saved ✓"); };
}
window.__openWorkout = openWorkout;
window.__chat = renderChat;

// ---------- WORKOUT DETAIL ----------
function openWorkout() {
  $("tabbar").style.display = "flex"; $("fbtn").style.display = "block";
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.tab === "home"));
  profile.plan_type === "loaded" ? workoutLoaded() : workoutAI();
  window.scrollTo(0, 0);
}
function workoutLoaded() {
  const wk = TRI_WEEKS[curWk - 1], loc = locateToday();
  const strip = DOW.map((dn, i) => { const day = wk.days[i], rest = day.sessions[0].sport === "Rest", isT = curWk === loc.wk && i === loc.di; const dots = day.sessions.filter(s => s.sport !== "Rest").map(s => `<i style="background:${SPORT_COLOR[s.sport]}"></i>`).join(""); return `<div class="wd ${i === curDi ? "on" : ""} ${rest ? "rest" : ""} ${isT ? "today" : ""}" data-di="${i}"><div class="dn">${dn}</div><div class="dd">${dDate(curWk, i).getDate()}</div><div class="dots">${i === curDi ? "" : dots}</div></div>`; }).join("");
  const day = wk.days[curDi]; let body = "";
  const evs = day.sessions.find(s => s.sport === "Event");
  if (evs) body += `<div class="event-banner"><span class="pill">Event</span><div style="font-size:19px;font-weight:800;margin:10px 0 4px">${esc(evs.title)}</div><div style="color:#C9CCD3;font-size:13px">${esc(evs.target)}</div></div>`;
  day.sessions.forEach((s, si) => { if (s.sport !== "Event") body += sessionCard(`${curWk}-${curDi}-${si}`, s); });
  if (day.sessions[0].sport === "Rest") body = `<div class="card" style="text-align:center;padding:28px 16px"><div style="font-size:30px">😴</div><div style="font-weight:800;font-size:18px;margin-top:8px">Rest Day</div></div>`;
  root().innerHTML = `<div class="appbar"><span class="back" onclick="__go('home')" style="font-size:24px;cursor:pointer;width:30px">‹</span><div class="nm" style="font-size:17px">Week ${curWk} · ${esc(wk.phase)}</div><div style="width:30px"></div></div>
    <div class="scroll"><div class="weekstrip">${strip}</div><div class="muted" style="margin:2px 0 12px">${esc(wk.note)}</div>${body}</div>`;
  root().querySelectorAll(".wd").forEach(el => el.onclick = () => { curDi = +el.dataset.di; workoutLoaded(); });
}
function sessionCard(ref, s) {
  const done = doneSet.has(ref), col = SPORT_COLOR[s.sport];
  const detail = (s.detail && s.detail.length) ? `<div class="detail">${s.detail.map(x => `<div>${esc(x)}</div>`).join("")}</div>` : "";
  const tss = s.tss ? `<span class="tss">TSS ${s.tss}</span>` : "";
  return `<div class="card sess" style="border-left-color:${col}"><div style="display:flex;justify-content:space-between;align-items:center"><span class="sport" style="background:${col}">${esc(s.sport)}</span><div style="display:flex;align-items:center;gap:8px">${tss}<div class="check ${done ? "on" : ""}" data-ref="${ref}"></div></div></div>
    <div class="stitle">${esc(s.title)}</div><div class="starget">${esc(s.target)}</div>${detail}
    <div class="sessbtns"><button class="btn btn-gold btn-sm" style="flex:1" data-adj='${b64(s)}'>Adjust with AI</button></div></div>`;
}
function workoutAI() {
  const abbr = DOW[(new Date().getDay() + 6) % 7]; window.__aiDay = window.__aiDay || abbr;
  const plan = aiPlan;
  const strip = (plan.days || []).map(d => { const rest = d.type === "rest"; return `<div class="wd ${d.day === window.__aiDay ? "on" : ""} ${rest ? "rest" : ""}" data-day="${d.day}"><div class="dn">${d.day}</div><div class="dd" style="font-size:10px;margin-top:4px">${rest ? "Rest" : (d.type[0].toUpperCase() + d.type.slice(1, 4))}</div></div>`; }).join("");
  const d = (plan.days || []).find(x => x.day === window.__aiDay) || { type: "rest", exercises: [] };
  let body = "";
  if (d.type === "rest") body = `<div class="card" style="text-align:center;padding:28px 16px"><div style="font-size:30px">😴</div><div style="font-weight:800;font-size:18px;margin-top:8px">Rest Day</div><div class="muted" style="margin-top:4px">${esc(d.cooldown || "Recovery.")}</div></div>`;
  else { body += `<div class="card"><div class="stitle" style="margin-top:0">${esc(d.title || "Workout")}</div><div class="starget">~${d.estMinutes || 45} min${d.warmup ? " · warm-up: " + esc(d.warmup) : ""}</div></div>`;
    (d.exercises || []).forEach((ex, xi) => { const ref = `ai-${window.__aiDay}-${xi}`, done = doneSet.has(ref), cardio = ex.kind === "cardio", col = cardio ? SPORT_COLOR.Run : SPORT_COLOR.Strength; const meta = cardio ? `${esc(ex.cardio ? ex.cardio.modality : "cardio")} · ${esc(ex.cardio ? ex.cardio.target : "")}` : `${ex.sets || 3} × ${esc(ex.repTarget || "")}${ex.startWeight ? " · " + esc(ex.startWeight) : ""}`;
      body += `<div class="card sess" style="border-left-color:${col}"><div style="display:flex;justify-content:space-between;align-items:center"><span class="sport" style="background:${col}">${cardio ? "Cardio" : "Strength"}</span><div class="check ${done ? "on" : ""}" data-ref="${ref}"></div></div><div class="stitle">${esc(ex.name)}</div><div class="starget">${meta}</div>${ex.note ? `<div class="muted" style="margin-top:6px">${esc(ex.note)}</div>` : ""}
        <div class="sessbtns"><button class="btn btn-ghost btn-sm" style="flex:1" data-log='${b64({ name: ex.name, kind: ex.kind, sets: ex.sets })}'>Log</button><button class="btn btn-gold btn-sm" style="flex:1" data-adj='${b64({ sport: cardio ? "Cardio" : "Strength", title: ex.name, target: meta, detail: [] })}'>Adjust</button></div></div>`; });
    if (d.cooldown) body += `<p class="muted" style="margin-top:12px">Cooldown: ${esc(d.cooldown)}</p>`; }
  root().innerHTML = `<div class="appbar"><span class="back" onclick="__go('home')" style="font-size:24px;cursor:pointer;width:30px">‹</span><div class="nm" style="font-size:17px">This week</div><div style="width:30px"></div></div>
    <div class="scroll"><div class="weekstrip">${strip}</div>${aiPlan.coachNote ? `<div class="muted" style="margin:2px 0 12px">${esc(aiPlan.coachNote)}</div>` : ""}${body}</div>`;
  root().querySelectorAll(".wd").forEach(el => el.onclick = () => { window.__aiDay = el.dataset.day; workoutAI(); });
}

// ---------- click delegation ----------
document.addEventListener("click", async (e) => {
  const chk = e.target.closest(".check[data-ref]"); if (chk) { await toggleCompletion(chk.dataset.ref); chk.classList.toggle("on"); return; }
  const lg = e.target.closest("[data-log]"); if (lg) { openLog(unb64(lg.dataset.log)); return; }
  const aj = e.target.closest("[data-adj]"); if (aj) { openAdjust(unb64(aj.dataset.adj)); return; }
});

// ---------- CHAT ----------
function renderChat() {
  $("tabbar").style.display = "flex"; $("fbtn").style.display = "none";
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("on"));
  const msgs = chatHistory.length ? chatHistory.map(m => `<div class="msg ${m.role}">${esc(m.text)}</div>`).join("") : `<div class="msg ai">Hi! I'm your Swift coach. Ask me anything, tell me to adjust a workout, or just say "log my weight at 184" or "I benched 3×5 at 185." What's up?</div>`;
  root().innerHTML = `<div class="appbar"><span class="back" onclick="__go('home')" style="font-size:24px;cursor:pointer;width:30px">‹</span><div class="nm" style="font-size:18px">Coach</div><div style="width:30px"></div></div>
    <div class="scroll" style="padding-bottom:14px"><div class="chatwrap"><div class="msgs" id="msgs">${msgs}</div>
      <div class="chatbar"><input id="chatIn" placeholder="Message Swift…" autocomplete="off"><button id="chatSend">↑</button></div></div></div>`;
  const scroll = () => { const m = $("msgs"); m.scrollTop = m.scrollHeight; };
  scroll();
  const send = async () => {
    const txt = $("chatIn").value.trim(); if (!txt) return;
    $("chatIn").value = ""; chatHistory.push({ role: "me", text: txt });
    $("msgs").insertAdjacentHTML("beforeend", `<div class="msg me">${esc(txt)}</div><div class="msg ai" id="typing">…</div>`); scroll();
    try {
      const out = await aiCall({ type: "chat", message: txt, context: chatContext() });
      const executed = await runActions(out.actions || []);
      $("typing").remove();
      chatHistory.push({ role: "ai", text: out.reply });
      $("msgs").insertAdjacentHTML("beforeend", `<div class="msg ai">${esc(out.reply)}</div>` + (executed ? `<div class="msg sys">${esc(executed)}</div>` : "")); scroll();
    } catch (e) { const t = $("typing"); if (t) t.remove(); $("msgs").insertAdjacentHTML("beforeend", `<div class="msg sys">Couldn't reach the coach: ${esc(e.message)}</div>`); scroll(); }
  };
  $("chatSend").onclick = send;
  $("chatIn").addEventListener("keydown", (ev) => { if (ev.key === "Enter") send(); });
}
function chatContext() {
  const t = getToday();
  let today;
  if (t.mode === "loaded") today = { phase: t.phase, sessions: t.day.sessions.map(s => `${s.sport}: ${s.title} (${s.target})`) };
  else today = t.day && t.day.type !== "rest" ? { title: t.day.title, exercises: (t.day.exercises || []).map(e => e.name) } : { rest: true };
  return { planType: profile.plan_type, today, recentWeight_lb: weights.slice(-5).map(w => w.weight_lb), goals: goals.map(g => ({ title: g.title, type: g.goal_type, target: g.target_value, by: g.target_date })), benchmarks: latestBenchmarks().map(b => ({ lift: b.lift, weight_lb: b.latest.weight_lb, reps: b.latest.reps })) };
}
async function runActions(actions) {
  const notes = [];
  for (const a of actions) {
    try {
      if (a.type === "log_weight" && a.weight_lb) { await sb.from("bodyweight_logs").upsert({ user_id: session.user.id, weight_lb: a.weight_lb, log_date: todayISO() }, { onConflict: "user_id,log_date" }); await loadWeights(); notes.push(`Logged weight ${a.weight_lb} lb`); }
      else if (a.type === "log_strength" && a.sets && a.sets.length) { const rows = a.sets.map((s, i) => ({ user_id: session.user.id, exercise_name: a.name || "Lift", set_number: i + 1, weight_lb: s.weight_lb || null, reps: s.reps || null })); await sb.from("strength_logs").insert(rows); notes.push(`Logged ${a.sets.length} sets of ${a.name || "lift"}`); }
      else if (a.type === "set_goal" && a.title) { await sb.from("goals").insert({ user_id: session.user.id, goal_type: a.goal_type || "weight", title: a.title, target_value: a.target_value || null, unit: a.unit || null, target_date: a.target_date || null }); await loadGoals(); notes.push(`Added goal: ${a.title}`); }
    } catch (e) { /* ignore individual action failure */ }
  }
  return notes.join(" · ");
}

// ---------- LOG sheet ----------
function openLog(ex) {
  let fields;
  if (ex.kind === "cardio") fields = `<div class="row"><div><div class="label" style="margin-top:0">Distance</div><input class="field" id="ld" placeholder="e.g. 3 km"></div><div><div class="label" style="margin-top:0">Time</div><input class="field" id="lt" placeholder="mm:ss"></div></div>`;
  else { let r = ""; const n = ex.sets || 3; for (let i = 1; i <= n; i++) r += `<div class="setrow"><div class="sn">${i}</div><input class="mini" id="w${i}" inputmode="decimal" placeholder="wt"><input class="mini" id="r${i}" inputmode="numeric" placeholder="reps"><div class="check" onclick="this.classList.toggle('on')"></div></div>`; fields = `<div class="setrow" style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase"><div class="sn">Set</div><div style="text-align:center">Weight</div><div style="text-align:center">Reps</div><div></div></div>${r}`; }
  openSheet(`<h2 class="title">${esc(ex.name)}</h2><p class="sub">Quick log.</p>${fields}<button class="btn btn-gold" style="margin-top:14px" id="lsave">Save</button><button class="btn btn-ghost" style="margin-top:9px" onclick="__closeModal()">Cancel</button>`);
  $("lsave").onclick = async () => {
    try {
      if (ex.kind === "cardio") await sb.from("cardio_logs").insert({ user_id: session.user.id, modality: "run", avg_pace: $("lt").value || "" });
      else { const rows = []; const n = ex.sets || 3; for (let i = 1; i <= n; i++) { const w = $("w" + i).value, r = $("r" + i).value; if (w || r) rows.push({ user_id: session.user.id, exercise_name: ex.name, set_number: i, weight_lb: +w || null, reps: +r || null }); } if (rows.length) await sb.from("strength_logs").insert(rows); }
      closeModal(); toast("Logged ✓");
    } catch (e) { toast("Save failed"); }
  };
}

// ---------- ADJUST ----------
function openAdjust(s) {
  openSheet(`<h2 class="title">Adjust with AI</h2><p class="sub">${esc(s.title)}</p><div class="label" style="margin-top:6px">What needs to change?</div>
    <textarea class="field" id="ajReq" rows="3" placeholder="e.g. only 30 min today / no pool / legs are trashed"></textarea>
    <div class="wrapchips" style="margin-top:9px">${["Short on time", "Tired / sore", "No pool", "Traveling", "Make it easier"].map(q => `<span class="pill" style="cursor:pointer" data-q="${q}">${q}</span>`).join("")}</div>
    <button class="btn btn-gold" style="margin-top:16px" id="ajGo">Get adjusted session</button><div class="errbox" id="ajErr"></div><div id="ajOut"></div>
    <button class="btn btn-ghost" style="margin-top:12px" onclick="__closeModal()">Close</button>`);
  $("sheet").querySelectorAll("[data-q]").forEach(el => el.onclick = () => $("ajReq").value = el.dataset.q);
  $("ajGo").onclick = async () => { const btn = $("ajGo"); btn.disabled = true; btn.textContent = "Thinking…"; $("ajErr").style.display = "none"; try { const txt = await aiCall({ type: "adjust", session: s, request: $("ajReq").value || "sensible swap" }); $("ajOut").innerHTML = `<div class="aiout">${esc(txt)}</div>`; } catch (e) { const er = $("ajErr"); er.style.display = "block"; er.textContent = e.message; } btn.disabled = false; btn.textContent = "Get adjusted session"; };
}

// ---------- PLAN ----------
function renderPlanLoaded() {
  const loc = locateToday();
  const rows = TRI_WEEKS.map(w => { const evt = w.days.map(d => d.sessions.find(s => s.sport === "Event")).filter(Boolean)[0]; return `<div class="wkrow ${w.wk === loc.wk ? "cur" : ""}" data-wk="${w.wk}"><div class="wknum"><b>${w.wk}</b><span>wk</span></div><div style="flex:1"><div style="font-weight:700;font-size:14.5px">${esc(w.phase)}${evt ? " · " + esc(evt.title.replace(/[^\x20-\x7E]/g, "").trim()) : ""}</div><div class="muted">${fmtShort(dDate(w.wk, 0))} – ${fmtShort(dDate(w.wk, 6))} · ${esc(w.hours)}</div></div><div style="color:#C9CCD3;font-size:20px">›</div></div>`; }).join("");
  root().innerHTML = `<div class="appbar"><div><div class="hi">16 weeks · Jun 29 → Oct 17</div><div class="nm">Your plan</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll"><div class="card" style="background:linear-gradient(135deg,#1b1d22,#33373f);color:#fff;border:none"><div style="font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--gold);font-weight:800">A-Race</div><div style="font-size:19px;font-weight:800;margin:6px 0 2px">Half Distance Triathlon</div><div style="color:#C9CCD3;font-size:13px">Sat Oct 17 · ${daysToRace()} days away</div></div><div class="card" style="margin-top:11px;padding:8px 15px">${rows}</div></div>`;
  root().querySelectorAll(".wkrow").forEach(el => el.onclick = () => { curWk = +el.dataset.wk; curDi = 0; openWorkout(); });
}
function renderPlanAI() {
  const plan = aiPlan;
  const rows = (plan.days || []).map(d => `<div class="wkrow"><div class="wknum" style="background:${d.type === "rest" ? "#F1F2F5" : "var(--gold)"};color:${d.type === "rest" ? "var(--ink-soft)" : "#fff"}"><b>${d.day}</b></div><div style="flex:1"><div style="font-weight:700;font-size:14.5px">${esc(d.title || (d.type[0].toUpperCase() + d.type.slice(1)))}</div><div class="muted">${d.type === "rest" ? "Rest" : (d.exercises || []).length + " exercises · ~" + (d.estMinutes || 45) + " min"}</div></div></div>`).join("");
  root().innerHTML = `<div class="appbar"><div><div class="hi">This week</div><div class="nm">Your plan</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll"><div class="card"><div class="muted" style="margin:0">${esc(plan.planSummary || "")}</div></div><div class="card" style="margin-top:11px;padding:8px 15px">${rows}</div></div>`;
}

// ---------- METRICS ----------
function renderMetrics() {
  const bars = weights.slice(-12).map(x => { const mx = Math.max(...weights.map(v => v.weight_lb)), mn = Math.min(...weights.map(v => v.weight_lb)); const h = mx === mn ? 60 : 20 + (1 - ((x.weight_lb - mn) / (mx - mn))) * 80; return `<div class="bar" style="height:${h}%"></div>`; }).join("") || `<p class="muted">No weigh-ins yet.</p>`;
  const cw = weights.length ? weights[weights.length - 1].weight_lb : null;
  const start = weights.length ? weights[0].weight_lb : null;
  const delta = (start != null && cw != null) ? (cw - start).toFixed(1) : "0";
  const loaded = profile.plan_type === "loaded";
  const extra = loaded ? `<div class="stat"><div class="v">${daysToRace()}</div><div class="l">Days to race</div></div>` : `<div class="stat"><div class="v">${(aiPlan && aiPlan.days ? aiPlan.days.filter(d => d.type !== "rest").length : 0)}</div><div class="l">Sessions/wk</div></div>`;
  const goalCards = goals.length ? goals.map(g => {
    let prog = "";
    if (g.goal_type === "weight" && g.target_value && start != null && cw != null) { const total = Math.abs(start - g.target_value) || 1; const done = Math.min(1, Math.abs(start - cw) / total); prog = `<div class="gprog"><i style="width:${Math.round(done * 100)}%"></i></div>`; }
    const dd = daysUntil(g.target_date);
    return `<div class="goalcard"><div style="display:flex;justify-content:space-between;align-items:center"><div class="gt">${esc(g.title)}</div>${dd != null ? `<span class="count">${dd >= 0 ? dd + " days" : "past"}</span>` : ""}</div>${prog}</div>`;
  }).join("") : `<p class="muted">No goals yet — add one in Profile or ask the coach.</p>`;
  const lifts = latestBenchmarks();
  const liftRows = lifts.length ? lifts.map(b => `<div class="liftrow"><div class="ln">${esc(b.lift)}</div><div class="lv">${b.latest.weight_lb ? b.latest.weight_lb + " lb" : (b.latest.reps || "-") + " reps"} <small>${b.latest.reps && b.latest.weight_lb ? "×" + b.latest.reps : ""} · best ${b.best.weight_lb ? b.best.weight_lb + " lb" : (b.best.reps || "-")}</small></div></div>`).join("") : `<p class="muted">No benchmark lifts yet — add them in Profile or log via chat.</p>`;
  root().innerHTML = `<div class="appbar"><div><div class="hi">How it's going</div><div class="nm">Metrics</div></div><div class="avatar" onclick="__go('profile')">${initial()}</div></div>
    <div class="scroll">
      <div class="card"><div style="display:flex"><div class="stat"><div class="v">${doneSet.size}</div><div class="l">Done</div></div>${extra}<div class="stat"><div class="v">${weights.length}</div><div class="l">Weigh-ins</div></div></div></div>
      <div class="card"><div class="label" style="margin-top:0">Bodyweight ${cw ? "· " + cw + " lb" : ""} ${start != null ? `<span style="color:${delta <= 0 ? "var(--good)" : "var(--ink-soft)"}">${delta <= 0 ? "▼" : "▲"} ${Math.abs(delta)} lb</span>` : ""}</div><div class="barwrap">${bars}</div></div>
      <div class="label">Goals</div>${goalCards}
      <div class="label">Benchmark lifts</div><div class="card">${liftRows}</div>
    </div>`;
}

// ---------- PROFILE ----------
function renderProfile() {
  const loaded = profile.plan_type === "loaded";
  root().innerHTML = `<div class="appbar"><div><div class="hi">Athlete</div><div class="nm">Profile</div></div><div class="avatar">${initial()}</div></div>
    <div class="scroll">
      <div class="card"><div class="label" style="margin-top:0">Account</div><p class="muted">${esc(session.user.email || "signed in")}</p></div>
      <div class="card"><div class="label" style="margin-top:0">Your plan</div><p class="muted">${loaded ? "Loaded: 16-week Half-Distance Triathlon + Hyrox." : "AI-generated hybrid plan."}</p>
        ${isOwner() ? `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" id="ptBtn">${loaded ? "Switch to an AI-generated plan" : "Load my triathlon plan"}</button>` : ""}</div>
      <div class="card"><div class="label" style="margin-top:0">Benchmark lifts</div><p class="muted">Track your key lifts and PRs.</p><button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" id="addLift">+ Add / update a lift</button></div>
      <div class="card"><div class="label" style="margin-top:0">Goals</div><p class="muted">${goals.length} active.</p><button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px" id="addGoal">+ Add a goal</button></div>
      <div class="card"><div class="label" style="margin-top:0">Feedback</div><button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px" onclick="__feedback()">Send feedback</button></div>
      <button class="btn btn-ghost" style="margin-top:14px" id="soBtn">Sign out</button>
      <p class="muted" style="text-align:center;margin-top:12px">Swift · beta</p></div>`;
  $("soBtn").onclick = () => sb.auth.signOut();
  const pt = $("ptBtn"); if (pt) pt.onclick = async () => { const nt = loaded ? "ai" : "loaded"; await sb.from("profiles").update({ plan_type: nt }).eq("user_id", session.user.id); profile.plan_type = nt; if (nt === "ai") { await loadAiPlan(); if (!aiPlan) { hideChrome(); startOnboarding(); return; } } openTab("home"); };
  $("addLift").onclick = openLiftSheet;
  $("addGoal").onclick = openGoalSheet;
}
function openLiftSheet() {
  openSheet(`<h2 class="title">Log a lift</h2><p class="sub">Add a current number or a new PR.</p>
    <div class="label" style="margin-top:0">Lift</div><input class="field" id="lfName" list="lfList" placeholder="Bench Press"><datalist id="lfList">${COMMON_LIFTS.map(l => `<option value="${l}">`).join("")}</datalist>
    <div class="row" style="margin-top:8px"><div><div class="label" style="margin-top:0">Weight (lb)</div><input class="field" id="lfW" inputmode="decimal"></div><div><div class="label" style="margin-top:0">Reps</div><input class="field" id="lfR" inputmode="numeric" value="1"></div></div>
    <button class="btn btn-gold" style="margin-top:14px" id="lfSave">Save</button><button class="btn btn-ghost" style="margin-top:9px" onclick="__closeModal()">Cancel</button>`);
  $("lfSave").onclick = async () => { const name = $("lfName").value.trim(); if (!name) return; await sb.from("benchmark_lifts").insert({ user_id: session.user.id, lift: name, weight_lb: +$("lfW").value || null, reps: +$("lfR").value || 1 }); await loadBenchmarks(); closeModal(); toast("Lift saved ✓"); };
}
function openGoalSheet() {
  openSheet(`<h2 class="title">Add a goal</h2>
    <div class="label" style="margin-top:0">Type</div><select class="field" id="gType"><option value="weight">Bodyweight</option><option value="lift">Lift target</option><option value="event">Event / race</option><option value="consistency">Consistency</option></select>
    <div class="label">Title</div><input class="field" id="gTitle" placeholder="e.g. Reach 185 lb">
    <div class="row" style="margin-top:8px"><div><div class="label" style="margin-top:0">Target (number)</div><input class="field" id="gTarget" inputmode="decimal" placeholder="optional"></div><div><div class="label" style="margin-top:0">By date</div><input class="field" id="gDate" type="date"></div></div>
    <button class="btn btn-gold" style="margin-top:14px" id="gSave">Save goal</button><button class="btn btn-ghost" style="margin-top:9px" onclick="__closeModal()">Cancel</button>`);
  $("gSave").onclick = async () => { const title = $("gTitle").value.trim(); if (!title) return; await sb.from("goals").insert({ user_id: session.user.id, goal_type: $("gType").value, title, target_value: +$("gTarget").value || null, target_date: $("gDate").value || null }); await loadGoals(); closeModal(); toast("Goal added ✓"); };
}

// ---------- FEEDBACK ----------
function openFeedback() {
  openSheet(`<h2 class="title">Send feedback</h2><p class="sub">What worked, what didn't, anything.</p><textarea class="field" id="fbTxt" rows="4" placeholder="Your feedback…"></textarea>
    <button class="btn btn-gold" style="margin-top:14px" id="fbSave">Send</button><button class="btn btn-ghost" style="margin-top:9px" onclick="__closeModal()">Cancel</button>`);
  $("fbSave").onclick = async () => { const msg = $("fbTxt").value.trim(); if (!msg) return; await sb.from("feedback").insert({ user_id: session.user.id, email: session.user.email, message: msg, page: "app" }); closeModal(); toast("Thanks — feedback sent 🙏"); };
}

boot();
