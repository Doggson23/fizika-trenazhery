/* Встроенные тренажёры Учебника «Сила упругости»: разрывная машина (диаграммы σ(ε) шести материалов, разгрузка,
   остаточная деформация), коэффициент Пуассона (брусок под нагрузкой), вязкоупругость (модели Максвелла и
   Кельвина–Фойгта: релаксация и ползучесть). Каждый — <section data-sim="…">. Зависит от assets/sim-core.js. */
(function(){
'use strict';
const {fmt, prep, arrow, text} = SC; const TAU = 2 * Math.PI;
const q = (root, s) => root.querySelector(s);
const rows = r => r.map(x => '<dt>' + x[0] + '</dt><dd' + (x[2] ? ' class="' + x[2] + '"' : '') + '>' + x[1] + '</dd>').join('');
const nf = x => { const a = Math.abs(x); return a < 1e-9 ? "0" : fmt(x, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3); };

/* ---------- 1. Разрывная машина ---------- */
// σ в МПа, ε — доля; E — МПа (наклон начального участка, им же идёт разгрузка)
const sq = t => t * t;
function alSigma(e){ // сплав алюминия: ε = σ/E + 0,002(σ/σ0,2)^n, обращаем делением пополам
  let lo = 0, hi = 320; for (let i = 0; i < 50; i++) { const s = (lo + hi) / 2, ee = s / 70000 + 0.002 * Math.pow(s / 250, 21.2); if (ee < e) lo = s; else hi = s; } return lo; }
const MATS = {
  steel: {name: 'Сталь (мягкая)', E: 200000, ef: 0.28, neck: 0.18, inset: 0.006, pts: [[0.012, 250, 'σт — площадка текучести'], [0.18, 420, 'σв'], [0.28, 330, 'разрыв']],
    s: e => e <= 0.0013 ? 200000 * e : e <= 0.0016 ? 260 - (e - 0.0013) / 0.0003 * 10 : e <= 0.02 ? 250 : e <= 0.18 ? 250 + 170 * (1 - sq(1 - (e - 0.02) / 0.16)) : 420 - 90 * sq((e - 0.18) / 0.1),
    stage: e => e <= 0.001 ? 'упругая, закон Гука' : e <= 0.0016 ? 'упругая, за пределом пропорциональности' : e <= 0.02 ? 'текучесть (площадка)' : e <= 0.18 ? 'упрочнение' : 'шейка'},
  al: {name: 'Сплав алюминия', E: 70000, ef: 0.14, neck: 0.10, inset: 0.012, pts: [[0.00557, 250, 'σ0,2'], [0.10, 300, 'σв'], [0.14, 260, 'разрыв']],
    s: e => e <= 0.10 ? alSigma(e) : 300 - 40 * sq((e - 0.10) / 0.04), stage: e => e <= 0.003 ? 'упругая' : e <= 0.10 ? 'пластическая, плавное упрочнение' : 'шейка'},
  iron: {name: 'Серый чугун', E: 100000, ef: 0.004, neck: 9, pts: [[0.004, 200, 'разрыв']], s: e => 200 * (1 - sq(1 - e / 0.004)), stage: () => 'почти упругая, хрупкая'},
  glass: {name: 'Стекло', E: 70000, ef: 50 / 70000, neck: 9, pts: [[50 / 70000, 50, 'разрыв']], s: e => 70000 * e, stage: () => 'упругая, хрупкая'},
  rubber: {name: 'Резина', E: 1.5, ef: 6, neck: 99, elastic: true, pts: [[6, 29.4, 'разрыв']], s: e => { const l = 1 + e; return 0.5 * (l - 1 / (l * l)) + 0.02 * Math.pow(l - 1, 4); },
    stage: e => e < 0.3 ? 'почти линейная' : e < 3 ? 'мягкий участок: молекулы распрямляются' : 'жёсткий участок: цепи вытянуты'},
  pe: {name: 'Полиэтилен', E: 200, ef: 6, neck: 0.1, pts: [[0.1, 10, 'σт'], [4, 8.5, 'шейка прошла весь образец'], [6, 18, 'разрыв']],
    s: e => e <= 0.1 ? 10 * (1 - sq(1 - e / 0.1)) : e <= 0.2 ? 10 - 20 * (e - 0.1) : e <= 4 ? 8 + 0.5 * (e - 0.2) / 3.8 : 8.5 + 9.5 * sq((e - 4) / 2),
    stage: e => e <= 0.1 ? 'упругая' : e <= 0.2 ? 'образуется шейка' : e <= 4 ? 'холодное течение: шейка бежит' : 'упрочнение вытянутых цепей'}
};
function tensile(root){
  const cv = q(root, 'canvas'), sl = q(root, '#tsE'); let M = MATS.steel, emax = 0, e = 0, broken = false, play = 0, path = [], unl = null;
  const eDisp = () => M.ef * 1.08;
  function reset(){ emax = 0; e = 0; broken = false; play = 0; path = [[0, 0]]; unl = null; sl.value = 0; sl.disabled = false; }
  function sigmaAt(x){ // напряжение с учётом истории: нагрузка по кривой, разгрузка — по прямой с наклоном E
    if (x >= emax) return M.s(x);
    if (M.elastic) { const smax = M.s(emax); return M.s(x) * Math.pow(x / emax, 1.2) * (smax ? 1 : 0); }
    return Math.max(0, M.s(emax) - M.E * (emax - x)); }
  function setE(x){ if (broken) return; x = Math.max(0, x);
    const res = M.elastic ? 0 : emax - M.s(emax) / M.E; if (x < res) x = res;   // ниже остаточной деформации не сожмёшь — образец провиснет
    if (x > emax) { const n = Math.ceil((x - emax) / (M.ef / 400)); for (let i = 1; i <= n; i++) { const xx = emax + (x - emax) * i / n; path.push([xx, M.s(xx)]); } emax = x; unl = null; }
    else { unl = unl || [[emax, M.s(emax)]]; unl.push([x, sigmaAt(x)]); }
    e = x; if (e >= M.ef) { e = M.ef; broken = true; play = 0; sl.disabled = true; }
    sl.value = Math.round(e / eDisp() * 1000); }
  root.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { root.querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', x === b)); M = MATS[b.dataset.m]; reset(); }));
  sl.addEventListener('input', () => { play = 0; setE(+sl.value / 1000 * eDisp()); });
  q(root, '#tsPlay').addEventListener('click', () => { if (broken) reset(); play = 1; });
  q(root, '#tsUnload').addEventListener('click', () => { if (!broken && emax > 0) play = -1; });
  q(root, '#tsReset').addEventListener('click', reset);
  reset();
  SC.slider(root, 'tsE', () => fmt(e * 100, e * 100 >= 10 ? 0 : e * 100 >= 1 ? 1 : 3) + ' %');
  SC.loop(cv, dt => {
    if (play === 1) setE(e + eDisp() / (SC.reduce ? 1 : 9) * dt * (SC.reduce ? 99 : 1));
    if (play === -1) { const res = M.elastic ? 0 : emax - M.s(emax) / M.E, step = Math.max((emax - res) / 2.5 * dt, 1e-9); if (e - step <= res) { setE(res); play = 0; } else setE(e - step); }
    q(root, '#tsEO').textContent = fmt(e * 100, e * 100 >= 10 ? 0 : e * 100 >= 1 ? 1 : 3) + ' %';
    const {ctx, W, H} = prep(cv), C = SC.col(); ctx.fillStyle = C.sheet; ctx.fillRect(0, 0, W, H); const smax = Math.max(...Array.from({length: 201}, (_, i) => M.s(M.ef * i / 200))) * 1.12;
    // образец
    const sw = Math.min(W * 0.26, 220), cx = sw / 2 + 10, top = 26, bot = H - 26, L0 = (bot - top) * 0.5, grip = 26;
    const vis = M.elastic ? Math.min(e, 6) / 6 : Math.min(1, e / M.ef) * (M.ef > 1 ? 1 : 0.6) + (M.ef < 0.01 ? e / M.ef * 0.04 : 0);
    const Lc = L0 * (1 + 0.8 * vis), y0 = (top + bot) / 2 - Lc / 2 - grip, wid = sw * 0.32, yA0 = y0 + grip;
    const nk = e > M.neck ? Math.min(1, (e - M.neck) / (M.ef - M.neck)) : 0, wmid = wid * (1 - 0.18 * vis) * (1 - 0.45 * nk);
    const yA = yA0, yB = yA + Lc, half = broken ? 10 : 0;
    ctx.fillStyle = C.ink2; ctx.fillRect(cx - sw * 0.38, yA - grip - (broken ? half : 0), sw * 0.76, grip); ctx.fillRect(cx - sw * 0.38, yB + (broken ? half : 0), sw * 0.76, grip);
    ctx.fillStyle = C.grid; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    const body = (ya, yb, cut) => { ctx.beginPath(); ctx.moveTo(cx - wid * 0.62, ya); ctx.lineTo(cx + wid * 0.62, ya);
      const ym = (ya + yb) / 2; ctx.bezierCurveTo(cx + wid / 2, ya + 12, cx + wmid / 2, ym - 30, cx + wmid / 2, cut === 'top' ? yb : ym);
      if (cut !== 'top') ctx.bezierCurveTo(cx + wmid / 2, ym + 30, cx + wid / 2, yb - 12, cx + wid * 0.62, yb);
      ctx.lineTo(cut === 'top' ? cx - wmid / 2 : cx - wid * 0.62, yb);
      if (cut !== 'top') ctx.bezierCurveTo(cx - wid / 2, yb - 12, cx - wmid / 2, ym + 30, cx - wmid / 2, ym);
      ctx.bezierCurveTo(cx - wmid / 2, ym - 30, cx - wid / 2, ya + 12, cx - wid * 0.62, ya); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    if (!broken) body(yA, yB); else { const mid = (yA + yB) / 2; ctx.save(); ctx.translate(0, -half); ctx.beginPath(); ctx.rect(0, 0, W, mid); ctx.clip(); body(yA, yB); ctx.restore(); ctx.save(); ctx.translate(0, half); ctx.beginPath(); ctx.rect(0, mid, W, H); ctx.clip(); body(yA, yB); ctx.restore(); }
    // метки рабочей длины
    ctx.strokeStyle = C.res; ctx.lineWidth = 1.5; [yA + Lc * 0.15, yB - Lc * 0.15].forEach(y => { ctx.beginPath(); ctx.moveTo(cx - wid * 0.7, y); ctx.lineTo(cx + wid * 0.7, y); ctx.stroke(); });
    if (broken) text(ctx, 'разрыв', cx, (yA + yB) / 2, {align: 'center', color: C.bad, weight: 700, size: 13});
    text(ctx, M.name, cx, 12, {align: 'center', weight: 700, size: 12});
    // диаграмма
    const gx = sw + 56, gy = 16, gw = W - gx - 16, gh = H - 52, ed = eDisp(), X = x => gx + x / ed * gw, Y = s => gy + gh - s / smax * gh;
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
    for (let i = 0; i <= 4; i++) { const v = smax / 1.12 * i / 4; text(ctx, nf(v), gx - 6, Y(v), {align: 'right', color: C.ink2, size: 11}); const xx = ed * i / 4; text(ctx, fmt(xx * 100, xx * 100 >= 10 ? 0 : xx * 100 >= 1 ? 1 : 2), X(xx), gy + gh + 12, {align: 'center', color: C.ink2, size: 11}); }
    text(ctx, 'σ, МПа', gx + 6, gy + 10, {color: C.ink2, size: 11}); text(ctx, 'ε, %', gx + gw - 4, gy + gh + 26, {align: 'right', color: C.ink2, size: 11});
    ctx.strokeStyle = C.rule; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i <= 300; i++) { const xx = M.ef * i / 300; i ? ctx.lineTo(X(xx), Y(M.s(xx))) : ctx.moveTo(X(xx), Y(M.s(xx))); } ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = C.f1; ctx.lineWidth = 3; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke();
    if (unl) { ctx.strokeStyle = C.a; ctx.lineWidth = 2.5; ctx.beginPath(); unl.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke(); }
    M.pts.forEach(([pe, ps, lab]) => { if (emax >= pe * 0.999 && pe / ed > 0.02) { ctx.beginPath(); ctx.arc(X(pe), Y(ps), 4, 0, TAU); ctx.fillStyle = C.ink2; ctx.fill(); const right = X(pe) > gx + gw - 150; text(ctx, lab, X(pe) + (right ? -8 : 6), Y(ps) - 10, {align: right ? 'right' : 'left', color: C.ink2, size: 12, weight: 600}); } });
    const sNow = sigmaAt(e); ctx.beginPath(); ctx.arc(X(e), Y(sNow), 6, 0, TAU); ctx.fillStyle = C.res; ctx.fill();
    // вставка: начальный участок
    if (M.inset) { const iw = Math.min(170, gw * 0.42), ih = Math.min(110, gh * 0.42), ix = gx + gw - iw - 8, iy = gy + gh - ih - 8, ie = M.inset, is = smax / 1.12 * 0.75;
      const IX = x => ix + x / ie * iw, IY = s => iy + ih - Math.min(s, is) / is * ih;
      ctx.fillStyle = C.sheet; ctx.fillRect(ix, iy, iw, ih); ctx.strokeStyle = C.rule; ctx.strokeRect(ix, iy, iw, ih);
      ctx.strokeStyle = C.rule; ctx.setLineDash([3, 4]); ctx.beginPath(); for (let i = 0; i <= 120; i++) { const xx = ie * i / 120; i ? ctx.lineTo(IX(xx), IY(M.s(xx))) : ctx.moveTo(IX(xx), IY(M.s(xx))); } ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = C.f1; ctx.lineWidth = 2.5; ctx.beginPath(); let first = true; path.forEach(p => { if (p[0] <= ie) { first ? ctx.moveTo(IX(p[0]), IY(p[1])) : ctx.lineTo(IX(p[0]), IY(p[1])); first = false; } }); ctx.stroke();
      if (unl) { ctx.strokeStyle = C.a; ctx.beginPath(); let f2 = true; unl.forEach(p => { if (p[0] <= ie) { f2 ? ctx.moveTo(IX(p[0]), IY(p[1])) : ctx.lineTo(IX(p[0]), IY(p[1])); f2 = false; } }); ctx.stroke(); }
      if (e <= ie) { ctx.beginPath(); ctx.arc(IX(e), IY(sNow), 4, 0, TAU); ctx.fillStyle = C.res; ctx.fill(); }
      text(ctx, 'начало, ε до ' + fmt(ie * 100, 1) + ' %', ix + 6, iy + 10, {color: C.ink2, size: 11}); }
    const res = M.elastic ? 0 : Math.max(0, emax - M.s(emax) / M.E), unloading = e < emax - 1e-12;
    q(root, '#tsRead').innerHTML = rows([['напряжение σ', nf(sNow) + ' МПа'], ['деформация ε', fmt(e * 100, e * 100 >= 10 ? 1 : 3) + ' %'],
      ['стадия', broken ? 'образец разрушен' : unloading ? 'разгрузка' : M.stage(e), broken ? 'w' : ''], ['модуль Юнга (начальный наклон)', nf(M.E / 1000) + ' ГПа'],
      ['остаточная деформация после разгрузки', M.elastic ? '0 (резина упругая, но при разгрузке идёт ниже — гистерезис)' : fmt(res * 100, res * 100 >= 1 ? 1 : 3) + ' %']]);
  });
}

/* ---------- 2. Коэффициент Пуассона ---------- */
function poisson(root){
  const cv = q(root, 'canvas'), fe = SC.slider(root, 'psE', v => (v > 0 ? '+' : '') + v + ' %'), fn = SC.slider(root, 'psN', v => fmt(v, 2));
  root.querySelectorAll('[data-nu]').forEach(b => b.addEventListener('click', () => { root.querySelectorAll('[data-nu]').forEach(x => x.setAttribute('aria-pressed', x === b)); const el = q(root, '#psN'); el.value = b.dataset.nu; el.dispatchEvent(new Event('input')); }));
  SC.loop(cv, () => {
    const e = fe() / 100, nu = fn(), et = -nu * e, {ctx, W, H} = prep(cv), C = SC.col(); ctx.fillStyle = C.sheet; ctx.fillRect(0, 0, W, H);
    const L0 = W * 0.42, D0 = H * 0.38, L = L0 * (1 + e), D = D0 * (1 + et), cx = W / 2, cy = H / 2;
    ctx.fillStyle = C.grid; ctx.fillRect(cx - L / 2, cy - D / 2, L, D); ctx.strokeStyle = C.f1; ctx.lineWidth = 2.5; ctx.strokeRect(cx - L / 2, cy - D / 2, L, D);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5; ctx.strokeRect(cx - L0 / 2, cy - D0 / 2, L0, D0); ctx.setLineDash([]);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; for (let i = 1; i < 8; i++) { const x = cx - L / 2 + L * i / 8; ctx.beginPath(); ctx.moveTo(x, cy - D / 2); ctx.lineTo(x, cy + D / 2); ctx.stroke(); }
    for (let j = 1; j < 4; j++) { const y = cy - D / 2 + D * j / 4; ctx.beginPath(); ctx.moveTo(cx - L / 2, y); ctx.lineTo(cx + L / 2, y); ctx.stroke(); }
    const sgn = Math.sign(e), al = Math.min(70, 20 + Math.abs(e) * 200);
    if (sgn) { arrow(ctx, cx + L / 2 + (sgn > 0 ? 6 : 6 + al), cy, cx + L / 2 + (sgn > 0 ? 6 + al : 6), cy, C.res, 4, 'F', [0, -14]); arrow(ctx, cx - L / 2 - (sgn > 0 ? 6 : 6 + al), cy, cx - L / 2 - (sgn > 0 ? 6 + al : 6), cy, C.res, 4, 'F', [0, -14]); }
    text(ctx, 'l₀ → l = l₀(1 + ε)', cx, cy + D0 / 2 + Math.max(0, D - D0) / 2 + 24, {align: 'center', color: C.ink2, size: 13});
    text(ctx, 'd = d₀(1 − νε)', cx + L / 2 + 10, cy - D / 2 - 12, {color: C.ink2, size: 13});
    const dV = (1 + e) * (1 + et) * (1 + et) - 1;
    q(root, '#psRead').innerHTML = rows([['продольная ε', fmt(e * 100, 0) + ' %'], ['поперечная ε⊥ = −νε', fmt(et * 100, 1) + ' %'],
      ['объём: точно', (dV >= 0 ? '+' : '') + fmt(dV * 100, 1) + ' %', Math.abs(dV) < 0.005 ? 'g' : ''], ['объём: формула ε(1 − 2ν)', (e * (1 - 2 * nu) >= 0 ? '+' : '') + fmt(e * (1 - 2 * nu) * 100, 1) + ' %'],
      ['что видим', nu < 0 ? (e > 0 ? 'растянули — стал толще (ауксетик)' : 'сжали — стал тоньше') : nu === 0 ? 'поперечный размер не меняется' : (e > 0 ? 'растянули — стал тоньше' : e < 0 ? 'сжали — раздался в стороны' : 'без нагрузки')]]);
  });
}

/* ---------- 3. Вязкоупругость ---------- */
function visco(root){
  const cv = q(root, 'canvas'), fk = SC.slider(root, 'vsK', v => v + ' Н/м'), fb = SC.slider(root, 'vsB', v => v + ' Н·с/м');
  let md = 'mx', ex = 'hold', run = null, tt = 0;
  const T_END = 8, X0 = 0.05, RAMP = 0.1, F0 = 10, TOFF = 4, DT = 0.0005;
  function simulate(){
    const k = fk(), b = fb(), out = []; let xs = 0, xd = 0, x = 0;
    for (let i = 0, t = 0; t <= T_END + 1e-9; i++, t = i * DT) {
      let F;
      if (ex === 'hold') { const xp = Math.min(1, t / RAMP) * X0, vp = t < RAMP ? X0 / RAMP : 0;
        if (md === 'mx') { xs = xp - xd; F = k * xs; xd += F / b * DT; x = xp; } else { x = xp; F = k * x + b * vp; } }
      else { F = t < TOFF ? F0 : 0;
        if (md === 'mx') { xs = F / k; x = xs + xd; xd += F / b * DT; } else { x += (F - k * x) / b * DT; } }
      if (i % 20 === 0) out.push({t, x, F, ref: ex === 'hold' ? k * Math.min(1, t / RAMP) * X0 : F / k});
    }
    return out;
  }
  function start(){ run = simulate(); tt = 0; }
  root.querySelectorAll('[data-vm]').forEach(b => b.addEventListener('click', () => { md = b.dataset.vm; root.querySelectorAll('[data-vm]').forEach(x => x.setAttribute('aria-pressed', x === b)); start(); }));
  root.querySelectorAll('[data-vx]').forEach(b => b.addEventListener('click', () => { ex = b.dataset.vx; root.querySelectorAll('[data-vx]').forEach(x => x.setAttribute('aria-pressed', x === b)); start(); }));
  q(root, '#vsGo').addEventListener('click', start);
  start();
  SC.loop(cv, dt => {
    if (run) tt = Math.min(T_END, tt + (SC.reduce ? T_END : dt));
    const {ctx, W, H} = prep(cv), C = SC.col(); ctx.fillStyle = C.sheet; ctx.fillRect(0, 0, W, H); const k = fk(), b = fb(), tau = b / k, i = Math.min(run.length - 1, Math.floor(tt / (DT * 20))), cur = run[i];
    const xmaxRun = Math.max(...run.map(p => Math.max(p.x, ex === 'force' ? p.ref : 0)), 0.01);
    // схема
    const sy = 46, wx = 30, base = Math.min(W * 0.32, 260), sc = Math.min((W - wx - base - 60) / xmaxRun, 1200), xe = wx + base + cur.x * sc;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx, sy - 30); ctx.lineTo(wx, sy + 30); ctx.stroke();
    const spring = (x1, x2, y, n) => { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x1, y); const L = x2 - x1, lead = Math.min(10, L * 0.15);
      ctx.lineTo(x1 + lead, y); for (let j = 0; j < n; j++) ctx.lineTo(x1 + lead + (L - 2 * lead) * (j + 0.5) / n, y + (j % 2 ? -8 : 8)); ctx.lineTo(x2 - lead, y); ctx.lineTo(x2, y); ctx.stroke(); };
    const damper = (x1, x2, y, piston) => { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; const c0 = x1 + 10, c1 = x1 + 10 + base * 0.45; ctx.beginPath();
      ctx.moveTo(c0, y - 11); ctx.lineTo(c1, y - 11); ctx.lineTo(c1, y + 11); ctx.lineTo(c0, y + 11); ctx.moveTo(x1, y); ctx.lineTo(c0, y); ctx.stroke();
      ctx.fillStyle = C.grid; ctx.fillRect(c0 + 1, y - 10, c1 - c0 - 1, 20); const px = Math.min(c1 - 4, c0 + 6 + piston); ctx.beginPath(); ctx.moveTo(px, y - 9); ctx.lineTo(px, y + 9); ctx.moveTo(px, y); ctx.lineTo(x2, y); ctx.lineWidth = 2.4; ctx.stroke(); };
    if (md === 'mx') { const k_ = k, xsNow = cur.F / k_, xdNow = cur.x - xsNow, mid = wx + base * 0.5 + xsNow * sc;
      spring(wx, mid, sy, 7); damper(mid, xe, sy, xdNow * sc); }
    else { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xe, sy - 30); ctx.lineTo(xe, sy + 30); ctx.stroke(); spring(wx, xe, sy - 16, 8); damper(wx, xe, sy + 16, cur.x * sc + base * 0.3); }
    ctx.beginPath(); ctx.arc(xe, sy, 3, 0, TAU); ctx.fillStyle = C.ink; ctx.fill();
    if (Math.abs(cur.F) > 1e-6) arrow(ctx, xe + 4, sy, xe + 4 + Math.min(60, 8 + Math.abs(cur.F) * 3), sy, C.res, 3, 'F', [0, -14]);
    text(ctx, md === 'mx' ? 'Максвелл: пружина + демпфер последовательно' : 'Кельвин–Фойгт: пружина ∥ демпфер', wx, 10, {color: C.ink2, size: 12, weight: 600});
    // графики
    const gx = 48, gw = W - gx - 14, g1 = 96, gh = (H - g1 - 40) / 2;
    const plot = (y0, f, fr, title, col, unit, cap) => {
      let hi = Math.max(...run.map(p => Math.max(f(p), fr ? fr(p) : 0)), 1e-6); if (cap) hi = Math.min(hi, cap); hi *= 1.1;
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(gx, y0, gw, gh); const X = t => gx + t / T_END * gw, Y = v => y0 + gh - Math.min(v, hi) / hi * gh;
      text(ctx, title, gx + 6, y0 + 10, {color: col, size: 12, weight: 700}); text(ctx, nf(hi / 1.1 * (unit === 'см' ? 100 : 1)), gx - 4, Y(hi / 1.1), {align: 'right', color: C.ink2, size: 10}); text(ctx, '0', gx - 4, y0 + gh, {align: 'right', color: C.ink2, size: 10});
      if (fr) { ctx.strokeStyle = C.ink2; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); run.forEach((p, j) => j ? ctx.lineTo(X(p.t), Y(fr(p))) : ctx.moveTo(X(p.t), Y(fr(p)))); ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath(); for (let j = 0; j <= i; j++) { const p = run[j]; j ? ctx.lineTo(X(p.t), Y(f(p))) : ctx.moveTo(X(p.t), Y(f(p))); } ctx.stroke();
      const tm = tau; if (tm < T_END) { ctx.strokeStyle = C.rule; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(X(tm), y0); ctx.lineTo(X(tm), y0 + gh); ctx.stroke(); ctx.setLineDash([]); text(ctx, 'τ', X(tm) + 4, y0 + gh - 8, {color: C.ink2, size: 12}); }
      return hi; };
    plot(g1, p => p.x, ex === 'force' ? p => p.ref * (p.t < TOFF ? 1 : 0) : null, 'x, см', C.f1, 'см');
    const capF = md === 'kv' && ex === 'hold' ? k * X0 * 2.2 : null;
    plot(g1 + gh + 16, p => p.F, ex === 'hold' ? p => p.ref : null, 'F, Н' + (capF ? ' (при рывке сила уходит за край: b·v = ' + nf(b * X0 / RAMP) + ' Н)' : ''), C.res, 'Н', capF);
    text(ctx, 't, с → 8', gx + gw, H - 8, {align: 'right', color: C.ink2, size: 11});
    q(root, '#vsRead').innerHTML = rows([['время релаксации τ = b/k', nf(tau) + ' с'], ['t', fmt(cur.t, 1) + ' с'], ['удлинение x', nf(cur.x * 100) + ' см'], ['сила F', nf(cur.F) + ' Н'],
      ['что видно', md === 'mx' ? (ex === 'hold' ? 'сила спадает: релаксация' : 'течёт, пока действует сила; после — упругий откат пружины, остаток остаётся') : (ex === 'hold' ? 'мгновенный рывок требует огромной силы, потом F = kx' : 'ползучесть к F/k, после снятия силы — медленный возврат')]]);
  });
}

const MAP = {tensile, poisson, visco};
document.querySelectorAll('[data-sim]').forEach(el => { const f = MAP[el.dataset.sim]; if (f) f(el); });
})();
