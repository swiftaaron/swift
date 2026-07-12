// Aaron's 16-week Half-Distance Triathlon + Hyrox plan, redesigned weekly template.
// Start: Mon Jun 29 2026. Events: 75-mi ride Jul 18 (Wk3), Hyrox Sim Aug 22 (Wk8), Race Oct 17 (Wk16).
export const TRI_START = new Date(2026, 5, 29);

const HY = {
  A: { title: "Home Hyrox A — Strength Endurance", detail: ["4 rounds, minimal rest:", "• Row 250m", "• KB front-rack reverse lunges ×10/side", "• Burpee broad jumps ×10", "• KB farmers carry 40m", "• KB/DB goblet thrusters ×15"] },
  B: { title: "Home Hyrox B — Engine / Cardio", detail: ["4 rounds:", "• Row 500m", "• Barbell or KB reverse lunges ×10/side", "• KB swings ×20", "• Squat jumps ×10", "• Wall sit 30s"] },
  C: { title: "Home Hyrox C — Sim / Race Flow", detail: ["Continuous circuit, lighter loads — form & transitions:", "• Row 1000m", "• KB thrusters ×15", "• Bent-over barbell rows ×15", "• Burpee broad jumps ×10", "• Row 1000m", "• KB farmers carry 40m", "• KB reverse lunges ×20", "• KB goblet squats ×20"] }
};
const GYM_DETAIL = ["Compromised-running intervals — push Z4/Z5:", "5–6 rounds:", "• Run 400m hard", "• 1 station (rotate): rower 250m sprint / KB swings ×20 / thrusters ×12 / burpees ×12 / loaded lunges ×20", "Short rest, keep HR high. Hardest session of the week — no triathlon work today."];

const S = (t, y, tss) => ({ sport: "Swim", title: t, target: y + " yds", tss: tss || 0 });
const R = (t, tg, tss, d) => ({ sport: "Run", title: t, target: tg, tss: tss || 0, detail: d || [] });
const Bk = (t, tg, tss) => ({ sport: "Bike", title: t, target: tg, tss: tss || 0 });
const St = (t, tg) => ({ sport: "Strength", title: t, target: tg || "", tss: 0 });
const hy = (l) => ({ sport: "Hyrox", title: HY[l].title, target: "Home · ~30–40 min", detail: HY[l].detail, tss: 0 });
const gym = (tg) => ({ sport: "Hyrox", title: "Gym Hyrox — Z4/Z5", target: tg || "~45–60 min · high intensity", detail: GYM_DETAIL, tss: 0 });
const brick = (tg, tss) => ({ sport: "Brick", title: "Brick Run (off the bike)", target: tg, tss: tss || 0 });
const rest = () => ({ sport: "Rest", title: "Rest Day", target: "Full recovery — non-negotiable", tss: 0 });
const ev = (t, tg) => ({ sport: "Event", title: t, target: tg, tss: 0 });
const D = (...s) => ({ sessions: s });

export const TRI_WEEKS = [
 {wk:1,phase:"Base",hours:"6–7h",note:"Transition / base week — keep it easy and build the routine.",days:[
   D(hy("A"),S("Swim // 100's // 1000",1000,1)),
   D(R("Run // Zone 2 + Strides // 40 min","40 min easy + strides",28),S("Swim // 100's // 1000",1000,1)),
   D(Bk("Bike // Shorty Bursts // 45 min","45 min Z2 + short bursts",34)),
   D(gym()),
   D(R("Run // Zone 2 + Strides // 50 min","50 min easy + strides",35)),
   D(Bk("Bike // Easy + Aero Intervals // 1:05","1h05 Z2 + aero",49)),
   D(rest())]},
 {wk:2,phase:"Build 1",hours:"9h",note:"First real build week. Long run moves to Friday.",days:[
   D(hy("B"),S("Swim // 100's // 1000",1000,1)),
   D(R("Run // Zone 2 + Strides // 40 min","40 min + strides",28),St("Ankle Work","30 min"),S("Swim // 100's // 1500",1500,4)),
   D(Bk("Bike // Easy + Aero Intervals // 1:05","1h05 Z2 + aero",49)),
   D(gym()),
   D(R("Run // Zone 2 // 7 miles","7 mi · 1h13 easy",49)),
   D(Bk("Bike // Z2 Time // 1:10","1h10 Z2",56),brick("Z3 · 2 miles · ~25 min",15)),
   D(rest())]},
 {wk:3,phase:"Build 1",hours:"~9h",note:"🎂 75-mile Birthday Ride Saturday — long run cut short to keep legs fresh.",days:[
   D(hy("C"),S("Swim // 100's // 1500",1500,4)),
   D(R("Run // Zone 2 + Strides // 50 min","50 min + strides",35),St("Core + Plyo","45 min"),S("Swim // 500's // 1500",1500,1)),
   D(Bk("Bike // Easy + Aero Intervals // 1:05","1h05 Z2 + aero",49)),
   D(gym("Moderate — save the legs for Saturday")),
   D(R("Run // Easy Z2 // 30–40 min","Short pre-ride primer (reduced)",25)),
   D(ev("🎂 75-Mile Birthday Ride","~3.5–4h · 75 mi · steady aerobic")),
   D(rest())]},
 {wk:4,phase:"Recovery",hours:"~9h",note:"Recovery week — volume holds, intensity eases.",days:[
   D(hy("A"),S("Swim // 500's // 2000",2000,5)),
   D(R("Run // Zone 2 + Strides // 50 min","50 min + strides",35),S("Swim // 500's // 2000",2000,5)),
   D(Bk("Bike // Easy + Aero Intervals // 1:05","1h05 Z2 + aero",49)),
   D(gym("Lighter — recovery week")),
   D(R("Run // Zone 2 // 7 miles","7 mi · 1h13 easy",49)),
   D(Bk("Bike // Z2 Time // 1:20","1h20 Z2",48)),
   D(rest())]},
 {wk:5,phase:"Build 2",hours:"~10.5h",note:"Intensity returns — hills Tuesday, swim volume climbs.",days:[
   D(hy("B"),S("Swim // Long Sets // 2000",2000,62)),
   D(R("Run // Hill Repeats // 3 reps/set","50 min · hill repeats",24),St("Core + Plyo","45 min"),S("Swim // Tempo Mix-Up // 2500",2500,0)),
   D(Bk("Bike // Easy + Aero Intervals // 1:05","1h05 Z2 + aero",49)),
   D(gym()),
   D(R("Run // Zone 2 // 8 miles","8 mi · 1h24 easy",56)),
   D(Bk("Bike // Z1/Z2 + Z3/Z4 Mix // 1:30","1h30 mixed",56),brick("Z3 · 2 miles · ~25 min",15)),
   D(rest())]},
 {wk:6,phase:"Build 2",hours:"12h",note:"Biggest week yet — 2h long bike Saturday.",days:[
   D(hy("C"),S("Swim // Long Sets // 2500",2500,78)),
   D(R("Run // Hill Repeats // 3 reps/set","50 min · hill repeats",24),St("Squats / DL / Press / Rows / Core","40 min"),S("Swim // Strength + Toys // 3000",3000,0)),
   D(Bk("Bike // Force Reps // 2×3","1h · low-cadence force reps",59)),
   D(gym()),
   D(R("Run // Zone 2 // 8 miles","8 mi · 1h24 easy",56)),
   D(Bk("Bike // Z1/Z2 + Z3/Z4 Mix // 2:00","2h mixed",92),brick("Z2 · 30 min",18)),
   D(rest())]},
 {wk:7,phase:"Recovery",hours:"~9.7h",note:"Recovery week before the Build-3 block.",days:[
   D(hy("A"),S("Swim // Threshold + Moderate // 2500",2500,0)),
   D(R("Run // Zone 2 + Strides // 1:00","1h + strides",42),S("Swim // Tempo Mix-Up // 3000",3000,0)),
   D(Bk("Bike // Easy + Aero Intervals // 1:05","1h05 Z2 + aero",49)),
   D(gym("Lighter — recovery week")),
   D(R("Run // Zone 2 // 8 miles","8 mi · 1h24 easy",56)),
   D(Bk("Bike // Z2 Time // 1:30","1h30 Z2",56)),
   D(rest())]},
 {wk:8,phase:"Build 3",hours:"~12h",note:"🏁 HYROX Race Simulator Saturday (Aug 22). Thu & Fri eased to be fresh.",days:[
   D(hy("C"),S("Swim // Long Sets // 3000",3000,78)),
   D(R("Run // Race Effort Ladder // Group B","45 min · race-effort ladder",38),St("Upper Body","45 min"),S("Swim // Strength + Toys // 3500",3500,0)),
   D(Bk("Bike // Cruise Intervals → Z2 // 1:10","1h10 Z2 w/ cruise efforts",56)),
   D(gym("LIGHT — short openers only, taper into Saturday")),
   D(R("Run // Zone 2 // 7 miles","7 mi easy (reduced before sim)",49)),
   D(ev("🏁 HYROX Race Simulator","Aug 22 · full race effort — replaces today's brick/bike")),
   D(rest())]},
 {wk:9,phase:"Build 3",hours:"~11.3h",note:"Back to full build after the sim — long run steps up to 9 miles.",days:[
   D(hy("B"),S("Swim // Drills + Aerobic // 3000",3000,62)),
   D(R("Run // Race Effort Ladder // Group C","42 min · race-effort ladder",34),St("Squats / Push-ups / Swings / Rows / Plank","40 min"),S("Swim // Buoy Sets // 3000",3000,78)),
   D(Bk("Bike // Easy + Aero Intervals // 1:05","1h05 Z2 + aero",49)),
   D(gym()),
   D(R("Run // Zone 2 // 9 miles","9 mi · 1h34 easy",63)),
   D(Bk("Bike // Z2 Time // 1:30","1h30 Z2",56),brick("Z2 · 30 min",18)),
   D(rest())]},
 {wk:10,phase:"Recovery",hours:"~10.8h",note:"Recovery week — long run quietly builds to 10 miles.",days:[
   D(hy("A"),S("Swim // Mix & Match // 3000 straight",3000,1)),
   D(R("Run // Zone 2 // 7 miles","7 mi · 1h13 easy",49),S("Swim // Drill Sets // 2000",2000,2)),
   D(Bk("Bike // Z2 Time // 1:10","1h10 Z2",56)),
   D(gym("Lighter — recovery week")),
   D(R("Run // Zone 2 // 10 miles","10 mi · 1h35 easy",95)),
   D(Bk("Bike // Z2 Time // 1:30","1h30 Z2",56)),
   D(rest())]},
 {wk:11,phase:"Peak Build",hours:"~12.8h",note:"Peak block begins — fartlek long run, 2h long bike + brick.",days:[
   D(hy("C"),S("Swim // Threshold + Moderate // 3000",3000,41)),
   D(R("Run // Race Effort Ladder // Group A","46 min · race-effort ladder",39),St("Band Work","25 min"),S("Swim // Drills + Speed + Volume // 3000",3000,0)),
   D(Bk("Bike // Z2 Time // 1:10","1h10 Z2",56)),
   D(gym()),
   D(R("Run // Long Run // Fartlek (Option B)","1h40 · fartlek",107)),
   D(Bk("Bike // Easy + Aero Intervals // 2:00","2h Z2 + aero",91),brick("Z2 · 45 min",28)),
   D(rest())]},
 {wk:12,phase:"Peak Build",hours:"~13.2h",note:"Goal-race-pace work begins. 11-mile long run.",days:[
   D(hy("B"),S("Swim // Drills + Aerobic // 3000",3000,62)),
   D(R("Run // Goal Race Pace // 2 reps (Option C)","47 min · 5 mi w/ race-pace reps",50),St("Core Circuit","40 min"),S("Swim // Mini Sprints // 3000",3000,0)),
   D(Bk("Bike // Z2 Time // 1:20","1h20 Z2",48)),
   D(gym()),
   D(R("Run // Zone 2 // 11 miles","11 mi · 1h44 easy",104)),
   D(Bk("Bike // Z1/Z2 + Z3/Z4 Mix // 2:00","2h mixed",92),brick("Z2 · 1:00",38)),
   D(rest())]},
 {wk:13,phase:"Peak Week",hours:"~14h",note:"Highest-volume week. Big race-pace run + long brick. Then we taper.",days:[
   D(hy("A"),S("Swim // Long Sets // 3000",3000,78)),
   D(R("Run // Goal Race Pace // 2 reps (Option B)","1h04 · 7 mi w/ race-pace reps",73),St("Hip Flexor","40 min"),S("Swim // Speed // 3000",3000,1)),
   D(Bk("Bike // Z2 Time // 1:30","1h30 Z2",56)),
   D(gym()),
   D(R("Run // Long Run // Aerobic + Bursts (Option A)","2h17 long run",97)),
   D(Bk("Bike // Z2 Miles // 40 mi","2h · 40 mi",83),brick("Z2 · 1:00",38)),
   D(rest())]},
 {wk:14,phase:"Taper",hours:"~9h (reduced)",note:"Taper begins — volume pulled back. Keep some snap, cut the load.",days:[
   D(hy("B"),S("Swim // Mix & Match // 3000",3000,1)),
   D(R("Run // Zone 2 // 7 miles","7 mi · easy",49),S("Swim // Shorty + Zippy // 3000",3000,0)),
   D(Bk("Bike // Z2 Time // 1:10","1h10 Z2",56)),
   D(gym("Reduced volume — taper")),
   D(R("Run // Zone 2 // 9 miles","9 mi (reduced from 11 — taper)",80)),
   D(Bk("Bike // Z2 // ~1:30","~1h30 (reduced from 40 mi — taper)",60)),
   D(rest())]},
 {wk:15,phase:"Taper",hours:"~7h (sharply reduced)",note:"Taper week 2 — deliberately much lighter than the raw plan. Stay sharp, arrive fresh.",days:[
   D(hy("C"),S("Swim // Threshold + Moderate // 2500 (reduced)",2500,0)),
   D(R("Run // Race-Pace Sharpener // 3–4 short efforts","~40 min · low volume, keep the snap",30),S("Swim // Speed Drills // 2500",2500,0)),
   D(Bk("Bike // Z2 // 1:00 + a few openers","~1h easy w/ short openers",45)),
   D(gym("SHORT & sharp — low volume, not the usual grind")),
   D(R("Run // Zone 2 // 6 miles easy","~50 min easy",40)),
   D(Bk("Bike // Z2 // ~1:00 + 3×3 min openers","Easy — NOT the raw plan's 3h",40)),
   D(rest())]},
 {wk:16,phase:"Race Week",hours:"~4.5h",note:"🏁 Race week — Half Distance Triathlon Saturday Oct 17. Short, sharp openers only.",days:[
   D(S("Swim // Tempo Sets // 2000 (light)",2000,0),St("Optional easy mobility","10–15 min")),
   D(R("Run // Tempo // Mile Repeats (Group C)","38 min · 4 mi w/ short reps",39)),
   D(Bk("Bike // Tempo + Z4 openers","1h w/ short race-effort efforts",45),S("Swim // 500's // 1500",1500,1)),
   D(R("Run // Short shakeout (light)","~20 min very easy",0),Bk("Bike // 30 min @ race-effort Z3 (openers)","30 min",26)),
   D(S("Swim // Race-prep / short drill set","Easy · pre-race feel for the water",0)),
   D(ev("🏁 RACE DAY — Half Distance Triathlon","Oct 17 · A-Race · leave it all out there")),
   D(rest())]}
];
