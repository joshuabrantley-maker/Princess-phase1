// ── Plan data ─────────────────────────────────────────────
const WEEKS = [
  { label:'Wk 1', warmup:5, reps:8,  run:30,   walk:90, cool:4 },
  { label:'Wk 2', warmup:5, reps:8,  run:45,   walk:75, cool:4 },
  { label:'Wk 3', warmup:5, reps:10, run:60,   walk:60, cool:2 },
  { label:'Wk 4', warmup:5, reps:8,  run:90,   walk:60, cool:3 },
  { label:'Wk 5', warmup:5, reps:7,  run:120,  walk:60, cool:4 },
  { label:'Wk 6', warmup:5, reps:6,  run:180,  walk:60, cool:3 },
  { label:'Wk 7', warmup:5, reps:4,  run:300,  walk:60, cool:5 },
  { label:'Wk 8', warmup:5, reps:1,  run:1200, walk:0,  cool:5 },
];

const C = {
  warm: { badge:'#ffb347', fill:'rgba(255,179,71,.22)', glow:'rgba(255,179,71,.18)', btn:'btn-warm', iconBg:'rgba(255,179,71,.15)' },
  run:  { badge:'#ff5e5e', fill:'rgba(255,94,94,.22)',  glow:'rgba(255,94,94,.18)',  btn:'btn-run',  iconBg:'rgba(255,94,94,.15)'  },
  walk: { badge:'#4fc3f7', fill:'rgba(79,195,247,.22)', glow:'rgba(79,195,247,.18)', btn:'btn-walk', iconBg:'rgba(79,195,247,.15)' },
  cool: { badge:'#81c784', fill:'rgba(129,199,132,.22)',glow:'rgba(129,199,132,.18)',btn:'btn-cool', iconBg:'rgba(129,199,132,.15)'},
};

function buildSegs(w) {
  const s = [];
  s.push({ type:'warm', label:'Warm-Up', detail:`${w.warmup} min warm-up walk`, color:'warm', icon:'🌡️', dur:w.warmup*60 });

  if (w.label === 'Wk 8') {
    s.push({ type:'run', label:'20-Min Run', detail:'Continuous run — go get it!', color:'run', icon:'🏃', dur:1200 });
  } else {
    for (let i=1; i<=w.reps; i++) {
      const rL = w.run  < 60 ? `${w.run}s`  : `${w.run/60}m`;
      const wL = w.walk < 60 ? `${w.walk}s` : `${w.walk/60}m`;
      s.push({ type:'run',  label:`Run ${i}`,  detail:`${rL} run · interval ${i} of ${w.reps}`, color:'run',  icon:'🏃', dur:w.run  });
      s.push({ type:'walk', label:`Walk ${i}`, detail:`${wL} recovery walk`, color:'walk', icon:'🚶', dur:w.walk });
    }
  }

  s.push({ type:'cool', label:'Cool-Down', detail:`${w.cool} min cool-down walk`, color:'cool', icon:'❄️', dur:w.cool*60 });
  return s;
}

// ── State ─────────────────────────────────────────────────
let wkIdx   = 0;
let segs    = [];
let step    = 0;
let doneMs  = 0;
let totalMs = 0;
let segT0   = 0;
let paused  = false;
let pauseT0 = 0;
let raf     = null;

// ── Format helpers ────────────────────────────────────────
const fmt   = s => { s=Math.max(0,s|0); return `${String((s/60)|0).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
const fmtT  = s => s < 60 ? `${s}s` : `${s/60}m`;

// ── RAF loop ──────────────────────────────────────────────
function stopRaf()  { if (raf) { cancelAnimationFrame(raf); raf=null; } }
function startRaf() {
  stopRaf();
  if (!paused && step < segs.length)
    raf = requestAnimationFrame(tick);
}

function tick() {
  const seg   = segs[step];
  const elMs  = Date.now() - segT0;
  const elS   = elMs / 1000;
  const durS  = seg.dur;
  const remS  = Math.max(durS - elS, 0);
  const pct   = Math.min(elMs / (durS * 1000), 1);

  const fill = document.getElementById(`f${step}`);
  if (fill) fill.style.width = (pct * 100).toFixed(2) + '%';

  const sbf = document.getElementById('segBoxFill');
  if (sbf) sbf.style.width = (pct * 100).toFixed(2) + '%';

  const wbf  = document.getElementById('wkBoxFill');
  const wkEl = doneMs + elMs;
  const wkPc = Math.min(wkEl / totalMs, 1);
  if (wbf) wbf.style.width = (wkPc * 100).toFixed(2) + '%';

  document.getElementById('segMain').textContent = fmt(remS);
  document.getElementById('segSub').textContent  = fmt(elS) + ' elapsed';

  const wkElS  = wkEl / 1000;
  const wkRemS = Math.max(totalMs / 1000 - wkElS, 0);
  document.getElementById('wkMain').textContent = fmt(wkRemS);
  document.getElementById('wkSub').textContent  = fmt(wkElS) + ' elapsed';

  const cd = document.getElementById(`cd${step}`);
  if (cd) cd.textContent = fmt(remS);

  const ppct = (wkPc * 100).toFixed(2);
  document.getElementById('progFill').style.width = ppct + '%';
  document.getElementById('progPct').textContent  = Math.round(wkPc * 100) + '%';

  if (elS >= durS) { advance(true); return; }

  raf = requestAnimationFrame(tick);
}

// ── Navigation ────────────────────────────────────────────
function advance(auto) {
  if (step >= segs.length) return;

  const card = document.getElementById(`card${step}`);
  if (card) {
    card.classList.remove('active');
    card.classList.add('removing');
    card.addEventListener('animationend', () => card.remove(), { once: true });
  }

  doneMs += auto ? segs[step].dur * 1000 : (Date.now() - segT0);
  // If skipped early, subtract the skipped portion from total workout time
if (!auto) {
  const actual = Date.now() - segT0;                 // time you actually did
  const skipped = segs[step].dur*1000 - actual;      // time you skipped
  totalMs -= skipped;                                // reduce remaining workout time
}

  step++;

  if (step >= segs.length) { finish(); return; }

  segT0 = Date.now();
  activateCard(step);
  renderTapBtn();
  updateProgLabel();
  styleSegTimer();
  startRaf();
}

function skipCurrent() { if (!paused) advance(false); }

function goBack() {
  if (step === 0) return;

  const curCard = document.getElementById(`card${step}`);
  if (curCard) curCard.remove();

  step--;
  doneMs = Math.max(0, doneMs - segs[step].dur * 1000);
  segT0  = Date.now();

  const stack = document.getElementById('segStack');
  const newCard = makeCard(step, true);
  newCard.classList.add('entering');
  stack.insertBefore(newCard, stack.firstChild);

  activateCard(step);
  renderTapBtn();
  updateProgLabel();
  styleSegTimer();
  startRaf();
}

function togglePause() {
  if (paused) {
    segT0 += Date.now() - pauseT0;
    paused = false;
    document.getElementById('pauseBtn').textContent = '⏸ Pause';
    document.getElementById('pauseBtn').classList.add('paused');
    startRaf();
  } else {
    pauseT0 = Date.now();
    paused  = true;
    stopRaf();
    document.getElementById('pauseBtn').textContent = '▶ Resume';
    document.getElementById('pauseBtn').classList.remove('paused');
  }
}

function resetSession() {
  stopRaf();
  step   = 0;
  doneMs = 0;
  segT0  = Date.now();
  paused = false;
  document.getElementById('pauseBtn').textContent = '⏸ Pause';
  document.getElementById('pauseBtn').classList.add('paused');
  document.getElementById('completeBanner').classList.remove('show');
  document.getElementById('tapBtn').style.display = '';
  document.querySelectorAll('.ctrl-btn').forEach(b => b.style.display = '');
  buildStack();
  renderTapBtn();
  updateProgLabel();
  styleSegTimer();
  startRaf();
}

function finish() {
  stopRaf();
  document.getElementById('progFill').style.width = '100%';
  document.getElementById('progPct').textContent  = '100%';
  document.getElementById('progText').textContent = `All ${segs.length} segments done!`;
  document.getElementById('segMain').textContent  = '00:00';
  document.getElementById('wkMain').textContent   = '00:00';
  document.getElementById('segBoxFill').style.width = '100%';
  document.getElementById('wkBoxFill').style.width  = '100%';
  document.getElementById('tapBtn').style.display   = 'none';

  const w = WEEKS[wkIdx];
  document.getElementById('completeBanner').classList.add('show');

  // ⭐ Ask user for distance and save stats
  setTimeout(() => {
    const distance = prompt("Enter distance traveled (miles):");
    if (distance && !isNaN(distance)) {
      const totalSeconds = totalMs / 1000;   // total workout time in seconds

      // Save stats
      saveWorkoutStats(parseFloat(distance), totalSeconds);
      updateHomeStats();
      showRunSavedBanner();
      updateWeeklyStreak();
      updateStreakBadge();


      // ⭐ Get updated stats so we can show the run number
      const stats = JSON.parse(localStorage.getItem('runStats') || '[]');
      const lastRun = stats[stats.length - 1]; // the run we just saved
      const runNum = lastRun.runNumber;

      // ⭐ Final message including run number
      document.getElementById('doneMsg').textContent =
        `Run ${runNum} this week! You crushed ${w.label}! ${fmt(totalMs/1000)} of training done. Tap Reset to go again.`;
    }
  }, 500);
}

// ===== WEEKLY STREAK HELPERS =====

// Get the start of the current week (Sunday-based)
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

// Count runs in the current week
function getRunsThisWeek() {
  const stats = JSON.parse(localStorage.getItem('runStats') || '[]');
  const weekStart = getWeekStart();
  return stats.filter(run => new Date(run.date) >= weekStart).length;
}

// Update weekly streak based on LAST week’s performance
function updateWeeklyStreak() {
  const stats = JSON.parse(localStorage.getItem('runStats') || '[]');
  const now = new Date();

  const thisWeekStart = getWeekStart(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(thisWeekStart);

  const runsLastWeek = stats.filter(run => {
    const d = new Date(run.date);
    return d >= lastWeekStart && d < lastWeekEnd;
  }).length;

  let streak = parseInt(localStorage.getItem('weeklyStreak') || '0', 10);

  if (runsLastWeek >= 3) {
    streak += 1;
  } else {
    streak = 0;
  }

  localStorage.setItem('weeklyStreak', streak);
}
// Update the streak badge on the home screen
function updateStreakBadge() {
  const streak = parseInt(localStorage.getItem('weeklyStreak') || '0', 10);
  const el = document.getElementById('streakCount');
  if (!el) return;

  el.textContent = `🔥 Weekly Streak: ${streak} week${streak === 1 ? '' : 's'}`;
}

// ── Week loading ──────────────────────────────────────────
function selectWeek(i) {
  wkIdx = i;
  document.querySelectorAll('.week-btn').forEach((b,j) => b.classList.toggle('active', j===i));
  loadWeek(i);
}

function loadWeek(i) {
  stopRaf();
  const w   = WEEKS[i];
  segs      = buildSegs(w);
  totalMs   = segs.reduce((s,x) => s + x.dur*1000, 0);
  step      = 0;
  doneMs    = 0;
  segT0     = Date.now();
  paused    = false;
  document.getElementById('pauseBtn').textContent = '⏸ Pause';
  document.getElementById('pauseBtn').classList.add('paused');
  document.getElementById('completeBanner').classList.remove('show');
  document.getElementById('tapBtn').style.display = '';
  document.querySelectorAll('.ctrl-btn').forEach(b => b.style.display = '');

  const iStr = w.label==='Wk 8' ? '1 × 20 min continuous' : `${w.reps} × ${fmtT(w.run)} run / ${fmtT(w.walk)} walk`;
  document.getElementById('summary').innerHTML = `
    <div class="summary-pill">🌡️ Warm-up <span>${w.warmup} min</span></div>
    <div class="summary-pill">🔁 <span>${iStr}</span></div>
    <div class="summary-pill">❄️ Cool-down <span>${w.cool} min</span></div>
    <div class="summary-pill">⏱ <span>${fmt(totalMs/1000)}</span></div>
  `;

  buildStack();
  renderTapBtn();
  updateProgLabel();
  styleSegTimer();
  startRaf();
}

// ── Card builder ──────────────────────────────────────────
function makeCard(i, isActive) {
  const seg  = segs[i];
  const c    = C[seg.color];
  const card = document.createElement('div');
  card.className = 'seg-card' + (isActive ? ' active' : '');
  card.id = `card${i}`;
  if (isActive) {
    card.style.setProperty('--sc', c.badge);
    card.style.setProperty('--sg', c.glow);
    card.onclick = skipCurrent;
  }

  const badgeHtml = isActive
    ? `<div class="seg-badge" style="background:${c.badge}">NOW</div><div class="seg-cd" id="cd${i}">${fmt(seg.dur)}</div>`
    : `<div class="seg-cd">${fmt(seg.dur)}</div>`;

  card.innerHTML = `
    <div class="seg-fill" id="f${i}" style="background:${c.fill};width:0%"></div>
    <div class="seg-icon" style="background:${c.iconBg}">${seg.icon}</div>
    <div class="seg-info">
      <div class="seg-title">${seg.label}</div>
      <div class="seg-sub">${seg.detail}</div>
    </div>
    <div class="seg-right">${badgeHtml}</div>
  `;
  return card;
}

function buildStack() {
  const stack = document.getElementById('segStack');
  stack.innerHTML = '';
  segs.forEach((_, i) => {
    const card = makeCard(i, i === step);
    stack.appendChild(card);
  });
}

function activateCard(i) {
  const card = document.getElementById(`card${i}`);
  if (!card) return;
  const c = C[segs[i].color];
  card.classList.add('active');
  card.style.setProperty('--sc', c.badge);
  card.style.setProperty('--sg', c.glow);
  card.onclick = skipCurrent;

  const right = card.querySelector('.seg-right');
  if (right) right.innerHTML = `<div class="seg-badge" style="background:${c.badge}">NOW</div><div class="seg-cd" id="cd${i}">${fmt(segs[i].dur)}</div>`;

  const fill = card.querySelector('.seg-fill');
  if (fill) { fill.style.background = c.fill; fill.style.width = '0%'; }
}

function renderTapBtn() {
  if (step >= segs.length) return;
  const seg = segs[step];
  const c   = C[seg.color];
  const btn = document.getElementById('tapBtn');
  btn.className = `tap-btn ${c.btn}`;
  document.getElementById('tapLabel').textContent = `⏭ Skip: ${seg.label}`;
}

function updateProgLabel() {
  const total = segs.length;
  document.getElementById('progText').textContent = step < total
    ? `Step ${step+1} of ${total}`
    : `All ${total} done`;
}

function styleSegTimer() {
  if (step >= segs.length) return;
  const c   = C[segs[step].color];
  const box = document.getElementById('segBox');
  const sbf = document.getElementById('segBoxFill');
  box.style.setProperty('--tc', c.badge);
  sbf.style.background = c.fill;
  sbf.style.width = '0%';
}

// ── Init ──────────────────────────────────────────────────
function init() {
  const row = document.getElementById('weekRow');
  WEEKS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'week-btn' + (i===0?' active':'');
    b.textContent = w.label;
    b.onclick = () => selectWeek(i);
    row.appendChild(b);
  });
  loadWeek(0);
}

init();
updateHomeStats();   // ⭐ NEW — updates stats on load
updateStreakBadge();

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });

  const screen = document.getElementById(id);
  screen.classList.remove('hidden');
  screen.classList.add('active');
}

function goHome() {
  showScreen('homeScreen');
    updateHomeStats();      // refresh stats
  updateStreakBadge();    // refresh streak badge
}

function openPhase(num) {
  if (num === 1) {
    showScreen('phase1');
  }
}

function startTodaysWorkout() {
  openPhase(1);
}

function updateCountdown() {
  const raceDay = new Date("2027-02-25");
  const today = new Date();
  const diff = Math.ceil((raceDay - today) / (1000 * 60 * 60 * 24));
  document.getElementById("raceCountdown").textContent = `🏰 ${diff} days to go`;
}

updateCountdown();

function saveWorkoutStats(distanceMiles, totalSeconds) {
  const stats = JSON.parse(localStorage.getItem('runStats') || '[]');

  const now = new Date();
  const weekStart = new Date();
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday start

  // Count how many runs already happened this week
  let runsThisWeek = stats.filter(run => {
    const d = new Date(run.date);
    return d >= weekStart;
  }).length;

  const entry = {
    date: now.toISOString(),
    distance: distanceMiles,
    time: totalSeconds,
    pace: totalSeconds / distanceMiles,
    runNumber: runsThisWeek + 1   // ⭐ Auto-detected run number
  };

  stats.push(entry);
  localStorage.setItem('runStats', JSON.stringify(stats));

  console.log("Workout saved:", entry);
}

function updateHomeStats() {
  const stats = JSON.parse(localStorage.getItem('runStats') || '[]');
  if (stats.length === 0) return;

  const now = new Date();
  const weekStart = new Date();
  weekStart.setDate(now.getDate() - now.getDay());

 let totalMiles = 0;
  let miles7Days = 0;
  let longestRun = 0;
stats.forEach(run => {
  const d = new Date(run.date);

  // ⭐ cumulative total miles
  totalMiles += run.distance;

  // ⭐ last 7 days
  if ((now - d) / 86400000 <= 7) {
    miles7Days += run.distance;
  }

  // ⭐ longest run
  if (run.distance > longestRun) {
    longestRun = run.distance;
  }
});

  document.getElementById("statTotalMiles").innerText = totalMiles.toFixed(2);
  document.getElementById("statMiles7").innerText = miles7Days.toFixed(2);
  document.getElementById("statLongest").innerText = longestRun.toFixed(2);
  document.getElementById("statWorkouts").innerText = stats.length;
  
  updateWeeklyStreak();
updateStreakBadge();
  updatePaceChart();

}
function showRunSavedBanner() {
  const b = document.getElementById("runSavedBanner");
  b.classList.add("show");
  setTimeout(() => b.classList.remove("show"), 2500);
}

let paceChart = null;

function updatePaceChart() {
  const stats = JSON.parse(localStorage.getItem('runStats') || '[]');
  if (stats.length === 0) return;

  // Build labels (dates) and pace values
  const labels = stats.map(run => new Date(run.date).toLocaleDateString());
  const paces = stats.map(run => {
    const minutes = run.duration / 60;
    return minutes / run.distance; // minutes per mile
  });

  const ctx = document.getElementById('paceChart').getContext('2d');

  // Destroy previous chart if it exists
  if (paceChart) paceChart.destroy();

  // Build new chart
  paceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Pace (min/mile)',
        data: paces,
        borderColor: '#78a0ff',
        backgroundColor: 'rgba(120,160,255,0.2)',
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#78a0ff',
        pointHoverRadius: 6
      }]
    },
    options: {
      scales: {
        y: {
          ticks: { color: '#fff' }
        },
        x: {
          ticks: { color: '#fff' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#fff' }
        }
      }
    }
  });
}


