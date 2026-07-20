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
