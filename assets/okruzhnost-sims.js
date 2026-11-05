/* Встроенные тренажёры Учебника «Движение по окружности»: единичная окружность, точка на окружности (v, aₙ, aτ,
   стробоскоп), катящееся колесо (скорости точек обода, циклоида, проскальзывание). Каждый — <div data-sim="…">. */
(function(){
'use strict';
const {fmt, prep, arrow, text} = SC; const TAU = 2 * Math.PI;
const q = (root, s) => root.querySelector(s);

/* ---------- 1. Единичная окружность: радиан, sin, cos, tg ---------- */
function trig(root){
  const cv = q(root, 'canvas'), get = SC.slider(root, 'tgPhi', v => v + '° = ' + fmt(v * Math.PI / 180, 2) + ' рад');
  let play = false; q(root, '#tgPlay').addEventListener('click', e => { play = !play; e.target.textContent = play ? 'Стоп' : 'Пуск'; });
  SC.loop(cv, dt => {
    const inp = q(root, '#tgPhi'); if (play) { inp.value = (+inp.value + dt * 30) % 360; inp.dispatchEvent(new Event('input')); }
    const {ctx, W, H} = prep(cv), C = SC.col(), phi = get() * Math.PI / 180, R = Math.min(W * 0.42, H) / 2 - 16, cx = R + 26, cy = H / 2;
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - R - 14, cy); ctx.lineTo(cx + R + 14, cy); ctx.moveTo(cx, cy + R + 14); ctx.lineTo(cx, cy - R - 14); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5; ctx.stroke();
    const x = cx + R * Math.cos(phi), y = cy - R * Math.sin(phi);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, -phi, true); ctx.strokeStyle = C.res; ctx.lineWidth = 5; ctx.stroke();       // дуга s = Rφ
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.18, 0, -phi, true); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = C.f1; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, cy); ctx.stroke();           // cos
    ctx.strokeStyle = C.an; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, y); ctx.stroke();                               // sin
    if (Math.abs(Math.cos(phi)) > 0.12) { const ty = cy - R * Math.tan(phi); ctx.strokeStyle = C.at; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(cx + R, cy); ctx.lineTo(cx + R, Math.max(4, Math.min(H - 4, ty))); ctx.stroke(); ctx.setLineDash([]); }
    ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fillStyle = C.ink; ctx.fill();
    text(ctx, 'cos φ', (cx + x) / 2, cy + 14, {align: 'center', color: C.f1, italic: true}); text(ctx, 'sin φ', x + 8, (cy + y) / 2, {color: C.an, italic: true});
    // графики справа
    const gx = cx + R + 40, gw = W - gx - 14, A = R * 0.8; if (gw < 80) return;
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, cy); ctx.lineTo(gx + gw, cy); ctx.stroke();
    [['sin', Math.sin, C.an], ['cos', Math.cos, C.f1]].forEach(([n, f, c]) => { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const a = i / 200 * TAU, xx = gx + gw * i / 200, yy = cy - A * f(a); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
      ctx.beginPath(); ctx.arc(gx + gw * phi / TAU, cy - A * f(phi), 4.5, 0, TAU); ctx.fillStyle = c; ctx.fill(); });
    ['0', 'π/2', 'π', '3π/2', '2π'].forEach((s, i) => text(ctx, s, gx + gw * i / 4, cy + A + 18, {align: 'center', color: C.ink2, size: 12}));
    const out = q(root, '#tgRead'); out.innerHTML = '<dt>sin φ</dt><dd>' + fmt(Math.sin(phi), 3) + '</dd><dt>cos φ</dt><dd>' + fmt(Math.cos(phi), 3) + '</dd><dt>tg φ</dt><dd>' + (Math.abs(Math.cos(phi)) < 1e-3 ? 'не существует' : fmt(Math.tan(phi), 3)) + '</dd><dt>дуга s = Rφ при R = 1</dt><dd>' + fmt(phi, 3) + '</dd>';
  });
}

/* ---------- 2. Точка на окружности: v, aₙ, aτ, a и стробоскоп ---------- */
function point(root){
  const cv = q(root, 'canvas'); const g = {}; let t = 0, run = true, marks = [], lastMark = -1;
  ['ptW', 'ptE', 'ptR'].forEach(id => g[id] = SC.slider(root, id, {ptW: v => fmt(v, 2) + ' рад/с', ptE: v => fmt(v, 2) + ' рад/с²', ptR: v => fmt(v, 1) + ' м'}[id], reset));
  function reset(){ t = 0; marks = []; lastMark = -1; }
  q(root, '#ptPlay').addEventListener('click', e => { run = !run; e.target.textContent = run ? 'Пауза' : 'Пуск'; });
  q(root, '#ptReset').addEventListener('click', reset);
  SC.loop(cv, dt => {
    const w0 = g.ptW(), e = g.ptE(), Rm = g.ptR(); if (run && !SC.reduce) t += dt;
    let w = w0 + e * t; if (w0 * w < 0 || (w0 === 0 && e === 0)) { /* остановка при торможении */ if (w0 * w < 0) { t = -w0 / e; w = 0; run = false; q(root, '#ptPlay').textContent = 'Пуск'; } }
    const phi = w0 * t + e * t * t / 2;
    const k = Math.floor(t / 0.25); if (k !== lastMark) { lastMark = k; marks.push(phi); if (marks.length > 60) marks.shift(); }
    const {ctx, W, H} = prep(cv), C = SC.col(), cx = W * 0.42, cy = H / 2, R = Math.min(W * 0.36, H * 0.38);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.strokeStyle = C.rule; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fillStyle = C.ink2; ctx.fill();
    marks.forEach((p, i) => { ctx.globalAlpha = 0.15 + 0.85 * i / marks.length; ctx.beginPath(); ctx.arc(cx + R * Math.cos(p), cy - R * Math.sin(p), 3.5, 0, TAU); ctx.fillStyle = C.ink2; ctx.fill(); }); ctx.globalAlpha = 1;
    const x = cx + R * Math.cos(phi), y = cy - R * Math.sin(phi);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    const v = w * Rm, an = w * w * Rm, at = e * Rm, a = Math.hypot(an, at);
    // масштабы: скорость и ускорение — отдельные
    const sv = 70 / Math.max(1, Math.abs(w0) * Rm + Math.abs(e) * Rm * 3), sa = 80 / Math.max(1, Math.max(an, Math.abs(at)) * 1.0, (Math.abs(w0) + Math.abs(e) * 3) ** 2 * Rm);
    const tx = -Math.sin(phi), ty = -Math.cos(phi), nx = -Math.cos(phi), ny = Math.sin(phi);           // касательная (по φ) и к центру, экранные
    arrow(ctx, x, y, x + tx * v * sv, y + ty * v * sv, C.v, 3, 'v');
    if (q(root, '#ptA').checked) { arrow(ctx, x, y, x + nx * an * sa, y + ny * an * sa, C.an, 2.5, 'aₙ'); arrow(ctx, x, y, x + tx * at * sa, y + ty * at * sa, C.at, 2.5, 'aτ');
      arrow(ctx, x, y, x + (nx * an + tx * at) * sa, y + (ny * an + tx * 0 + ty * at) * sa, C.a, 3, 'a'); }
    ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fillStyle = C.ink; ctx.fill();
    text(ctx, 'метки — через 0,25 с', 10, 14, {color: C.ink2, size: 12});
    q(root, '#ptRead').innerHTML = [['t', fmt(t, 2) + ' с'], ['φ', fmt(phi, 2) + ' рад (' + fmt(phi / TAU, 2) + ' об.)'], ['ω = ω₀ + εt', fmt(w, 2) + ' рад/с'], ['v = ωR', fmt(v, 2) + ' м/с'],
      ['aₙ = ω²R', fmt(an, 2) + ' м/с²'], ['aτ = εR', fmt(at, 2) + ' м/с²'], ['a = √(aₙ² + aτ²)', fmt(a, 2) + ' м/с²'], ['угол между a и v', fmt(Math.atan2(an, at) * 180 / Math.PI, 1) + '°']]
      .map(r => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('');
  });
}

/* ---------- 3. Катящееся колесо: v₀, ωR, их сумма, циклоида, проскальзывание ---------- */
function wheel(root){
  const cv = q(root, 'canvas'); const g = {}; let s = 0, th = 0, trail = [], vecMode = 'sum', follow = true;
  ['whV', 'whK', 'whZ'].forEach(id => g[id] = SC.slider(root, id, {whV: v => fmt(v, 1) + ' м/с', whK: v => fmt(v, 2) + (Math.abs(v - 1) < 1e-9 ? ' — без проскальзывания' : v > 1 ? ' — буксует' : ' — юз'), whZ: v => '×' + fmt(v, 1)}[id], () => { trail = []; }));
  root.querySelectorAll('[data-vm]').forEach(b => b.addEventListener('click', () => { vecMode = b.dataset.vm; root.querySelectorAll('[data-vm]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  q(root, '#whCam').addEventListener('change', e => { follow = e.target.checked; trail = []; s = 0; });
  SC.loop(cv, dt => {
    const v0 = g.whV(), kk = g.whK(), zoom = g.whZ(), Rm = 0.35, w = kk * v0 / Rm;     // ωR = k·v₀
    const {ctx, W, H} = prep(cv), C = SC.col(), sc = 120 * zoom / 1.0 * Math.min(1, W / 900);   // px на метр
    const R = Rm * sc, gy = H - 40, slow = 0.25;                                  // замедление ×4
    if (!SC.reduce) { s += v0 * dt * slow; th += w * dt * slow; }
    const camX = follow ? s * sc - W / 2 : 0, cx = 60 + s * sc - camX - (follow ? 60 : 0), cy = gy - R;
    if (!follow && cx - R > W) { s = 0; trail = []; }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    ctx.strokeStyle = C.rule; for (let x = -((camX % 40) + 40) % 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x - 10, gy + 10); ctx.stroke(); }
    // след точки обода (циклоида)
    const px = s * sc - R * Math.sin(th), py = -R * Math.cos(th);                 // точка, бывшая внизу при th = 0 (в мировых px)
    trail.push([s * sc + R * Math.sin(-th), R * Math.cos(th)]); if (trail.length > 900) trail.shift();
    ctx.strokeStyle = C.res; ctx.lineWidth = 2; ctx.beginPath(); trail.forEach((p, i) => { const xx = 60 + p[0] - camX - (follow ? 60 : 0), yy = cy + p[1]; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = C.grid; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = th + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); ctx.lineWidth = 1.5; ctx.stroke(); }
    // векторы скоростей восьми точек обода
    const sv = 34 / Math.max(v0, 0.5) * Math.min(1.4, zoom);
    for (let i = 0; i < 8; i++) { const a = th + i * TAU / 8 + Math.PI / 2, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const rx = -Math.sin(a) * w * Rm, ry = Math.cos(a) * w * Rm;          // вращательная (по часовой на экране при w > 0)
      if (vecMode !== 'sum') { arrow(ctx, x, y, x + v0 * sv, y, C.v, 2); arrow(ctx, x, y, x + rx * sv, y + ry * sv, C.at, 2); }
      if (vecMode !== 'parts') arrow(ctx, x, y, x + (v0 + rx) * sv, y + ry * sv, C.an, 2.6);
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fillStyle = C.ink; ctx.fill(); }
    arrow(ctx, cx, cy, cx + v0 * sv, cy, C.v, 3, 'v₀');
    // мгновенный центр скоростей: на вертикали через ось, на расстоянии v₀/ω ниже оси
    if (Math.abs(w) > 1e-6) { const d = v0 / w * sc; const my = cy + d; if (my > -50 && my < H + 50) { ctx.beginPath(); ctx.arc(cx, my, 6, 0, TAU); ctx.fillStyle = C.a; ctx.fill(); text(ctx, 'МЦС', cx + 10, my - 10, {color: C.a, weight: 700, size: 12}); } }
    const top = v0 + w * Rm, bot = v0 - w * Rm;
    q(root, '#whRead').innerHTML = [['v₀ (ось)', fmt(v0, 2) + ' м/с'], ['ωR', fmt(w * Rm, 2) + ' м/с'], ['верхняя точка v₀ + ωR', fmt(top, 2) + ' м/с'], ['нижняя точка v₀ − ωR', fmt(bot, 2) + ' м/с', Math.abs(bot) < 1e-9 ? 'g' : 'w'], ['МЦС ниже оси на v₀/ω', Math.abs(w) < 1e-6 ? '—' : fmt(v0 / w, 3) + ' м']]
      .map(r => '<dt>' + r[0] + '</dt><dd' + (r[2] ? ' class="' + r[2] + '"' : '') + '>' + r[1] + '</dd>').join('');
  });
}

const MAP = {trig, point, wheel};
document.querySelectorAll('[data-sim]').forEach(el => { const f = MAP[el.dataset.sim]; if (f) f(el); });
})();
