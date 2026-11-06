/* Встроенные тренажёры Учебника «Законы Ньютона»: шайба на льду (сила задаёт ускорение, а не скорость),
   тележки с пружиной (третий закон, сравнение масс), весы в лифте (вес и перегрузка). Каждый — <div data-sim="…">.
   g = 10 м/с², как в задачах главы. Зависит от assets/sim-core.js. */
(function(){
'use strict';
const {fmt, prep, arrow, text} = SC; const TAU = 2 * Math.PI, G = 10;
const q = (root, s) => root.querySelector(s);
const rows = r => r.map(x => '<dt>' + x[0] + '</dt><dd' + (x[2] ? ' class="' + x[2] + '"' : '') + '>' + x[1] + '</dd>').join('');

/* ---------- 1. Шайба на гладком льду ---------- */
function puck(root){
  const cv = q(root, 'canvas'), FW = 16, FH = 10;               // поле 16 × 10 м
  let x, y, vx, vy, t, trail, marks, nextMark, run = true, out = false;
  const fV = SC.slider(root, 'pkV', v => fmt(v, 1) + ' м/с', reset);
  const fF = SC.slider(root, 'pkF', v => fmt(v, 1) + ' Н');
  const fA = SC.slider(root, 'pkA', v => v + '°');
  const fM = SC.slider(root, 'pkM', v => fmt(v, 1) + ' кг');
  function reset(){ x = 1.5; y = FH / 2; vx = +q(root, '#pkV').value; vy = 0; t = 0; trail = [[x, y]]; marks = [[x, y]]; nextMark = 0.5; out = false; }
  reset();
  q(root, '#pkPlay').addEventListener('click', e => { run = !run; e.target.textContent = run ? 'Пауза' : 'Пуск'; });
  q(root, '#pkReset').addEventListener('click', () => { reset(); run = true; q(root, '#pkPlay').textContent = 'Пауза'; });
  SC.loop(cv, dt => {
    const on = q(root, '#pkOn').checked, F = on ? fF() : 0, th = fA() * Math.PI / 180, m = fM();
    const ax = F / m * Math.cos(th), ay = F / m * Math.sin(th);
    if (run && !out && !SC.reduce) {
      const n = 8, h = dt / n;
      for (let i = 0; i < n; i++) { vx += ax * h; vy += ay * h; x += vx * h; y += vy * h; t += h;
        if (t >= nextMark) { marks.push([x, y]); nextMark += 0.5; } }
      trail.push([x, y]); if (trail.length > 3000) trail.shift();
      if (x < 0 || x > FW || y < 0 || y > FH) out = true;
    }
    const {ctx, W, H} = prep(cv), C = SC.col(), s = Math.min(W / FW, H / FH), ox = (W - FW * s) / 2, oy = (H - FH * s) / 2;
    const X = u => ox + u * s, Y = u => oy + (FH - u) * s;
    ctx.fillStyle = C.paper; ctx.fillRect(ox, oy, FW * s, FH * s);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < FW; i++) { ctx.moveTo(X(i), Y(0)); ctx.lineTo(X(i), Y(FH)); }
    for (let j = 1; j < FH; j++) { ctx.moveTo(X(0), Y(j)); ctx.lineTo(X(FW), Y(j)); } ctx.stroke();
    ctx.strokeStyle = C.rule; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, FW * s, FH * s);
    text(ctx, 'клетка 1 м', ox + 6, oy + 12, {color: C.ink2, size: 12});
    ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5; ctx.beginPath(); trail.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke();
    marks.forEach(p => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 3, 0, TAU); ctx.fillStyle = C.ink2; ctx.fill(); });
    const px = X(x), py = Y(y);
    ctx.beginPath(); ctx.arc(px, py, Math.max(7, s * 0.28), 0, TAU); ctx.fillStyle = C.ink; ctx.fill();
    const kv = s * 0.9, kf = s * 1.4, ka = s * 1.4;
    arrow(ctx, px, py, px + vx * kv, py - vy * kv, C.v, 3, 'v');
    if (F > 0) { arrow(ctx, px, py, px + F * kf * Math.cos(th), py - F * kf * Math.sin(th), C.res, 5, 'F');
      arrow(ctx, px, py, px + ax * ka, py - ay * ka, C.a, 2.2, 'a', [-Math.sin(th) * 16, -Math.cos(th) * 16]); }
    if (out) text(ctx, 'Шайба покинула поле — нажмите «Сначала»', W / 2, oy + 26, {align: 'center', color: C.res, weight: 700, size: 15});
    const v = Math.hypot(vx, vy), a = Math.hypot(ax, ay), dot = vx * ax + vy * ay;
    const ang = v > 1e-6 && a > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, dot / v / a))) * 180 / Math.PI : NaN;
    const mode = a < 1e-9 ? ['скорость постоянна (первый закон)', 'g'] : v < 1e-6 ? ['разгон из покоя вдоль силы', ''] :
      Math.abs(ang) < 1 ? ['разгон по прямой', ''] : Math.abs(ang - 180) < 1 ? ['торможение по прямой', ''] :
      Math.abs(ang - 90) < 1 ? ['поворот без изменения модуля скорости', ''] : ang < 90 ? ['поворачивает и разгоняется', ''] : ['поворачивает и тормозит', ''];
    q(root, '#pkRead').innerHTML = rows([['t', fmt(t, 1) + ' с'], ['a = F/m', fmt(a, 2) + ' м/с²'], ['|v|', fmt(v, 2) + ' м/с'],
      ['угол между v и a', isFinite(ang) ? fmt(ang, 0) + '°' : '—'], ['что происходит', mode[0], mode[1]]]);
  });
}

/* ---------- 2. Тележки и сжатая пружина: третий закон ---------- */
function carts(root){
  const cv = q(root, 'canvas'), TW = 8, TAUP = 0.4, SLOW = 0.4, DM = 0.25;   // рельс 8 м, толчок 0,4 с, замедление показа, метки через 0,25 с
  let x1, x2, v1, v2, t, go, marks1, marks2, nm;
  const fm1 = SC.slider(root, 'ctM1', v => fmt(v, 1) + ' кг', reset), fm2 = SC.slider(root, 'ctM2', v => fmt(v, 1) + ' кг', reset), fF = SC.slider(root, 'ctF', v => fmt(v, 1) + ' Н', reset);
  function reset(){ x1 = TW / 2 - 0.6; x2 = TW / 2 + 0.6; v1 = 0; v2 = 0; t = 0; go = false; marks1 = [x1]; marks2 = [x2]; nm = DM; }
  reset();
  q(root, '#ctGo').addEventListener('click', () => { reset(); go = true; });
  q(root, '#ctReset').addEventListener('click', reset);
  SC.loop(cv, dt => {
    const m1 = fm1(), m2 = fm2(), F = fF();
    if (go) {
      const n = 10, h = dt * SLOW / n;
      for (let i = 0; i < n; i++) {
        const push = t < TAUP; const a1 = push ? -F / m1 : 0, a2 = push ? F / m2 : 0;
        v1 += a1 * h; v2 += a2 * h; x1 += v1 * h; x2 += v2 * h; t += h;
        if (t >= nm) { marks1.push(x1); marks2.push(x2); nm += DM; }
        if (x1 < 0.6) { x1 = 0.6; v1 = 0; } if (x2 > TW - 0.6) { x2 = TW - 0.6; v2 = 0; }
      }
      if (v1 === 0 && v2 === 0 && t > TAUP) go = false;
    }
    const {ctx, W, H} = prep(cv), C = SC.col(), s = W / TW, ry = H * 0.58, cw = 1.0 * s, ch = Math.min(0.5 * s, H * 0.2);
    const X = u => u * s;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(W, ry); ctx.stroke();
    for (let i = 0; i <= TW; i++) { ctx.beginPath(); ctx.moveTo(X(i), ry); ctx.lineTo(X(i), ry + 6); ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.stroke(); text(ctx, i + ' м', X(i), ry + 16, {align: i === 0 ? 'left' : i === TW ? 'right' : 'center', color: C.ink2, size: 11}); }
    [[marks1, C.v], [marks2, C.v]].forEach(([mk]) => mk.forEach(u => { ctx.beginPath(); ctx.arc(X(u), ry + 30, 3.2, 0, TAU); ctx.fillStyle = C.ink2; ctx.fill(); }));
    text(ctx, 'метки центров тележек через 0,25 с', 8, ry + 48, {color: C.ink2, size: 12});
    const cart = (u, m, lab) => { const cx = X(u); ctx.fillStyle = C.grid; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(cx - cw / 2, ry - ch - 9, cw, ch); ctx.fill(); ctx.stroke();
      [-0.3, 0.3].forEach(k => { ctx.beginPath(); ctx.arc(cx + k * cw, ry - 5, 5, 0, TAU); ctx.fillStyle = C.ink; ctx.fill(); });
      text(ctx, lab + ' = ' + fmt(m, 1) + ' кг', cx, ry - ch / 2 - 9, {align: 'center', size: Math.max(11, Math.min(14, cw / 7)), weight: 700}); };
    cart(x1, m1, 'm₁'); cart(x2, m2, 'm₂');
    const pushing = !go ? t === 0 : t < TAUP;
    if (pushing) { const a = X(x1) + cw / 2, b = X(x2) - cw / 2, yy = ry - ch / 2 - 9, n = 8; ctx.strokeStyle = C.f3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a, yy);
      for (let i = 1; i < n; i++) ctx.lineTo(a + (b - a) * i / n, yy + (i % 2 ? -7 : 7)); ctx.lineTo(b, yy); ctx.stroke(); }
    if (go && t < TAUP) { const L = F * s * 0.28, yy = ry - ch - 24;
      arrow(ctx, X(x1), yy, X(x1) - L, yy, C.res, 4, 'F₂₁', [-6, -14]); arrow(ctx, X(x2), yy, X(x2) + L, yy, C.res, 4, 'F₁₂', [6, -14]); }
    if (t >= TAUP) { const k = s * 0.35, yy = ry - ch - 24;
      if (v1) arrow(ctx, X(x1), yy, X(x1) + v1 * k, yy, C.v, 3, 'v₁', [-4, -14]); if (v2) arrow(ctx, X(x2), yy, X(x2) + v2 * k, yy, C.v, 3, 'v₂', [4, -14]); }
    if (!go && t === 0) text(ctx, 'пружина сжата и связана нитью — нажмите «Отпустить пружину»', W / 2, 22, {align: 'center', color: C.ink2, size: 13});
    const V1 = F * TAUP / m1, V2 = F * TAUP / m2;
    q(root, '#ctRead').innerHTML = rows([['F₁₂ = F₂₁', fmt(F, 1) + ' Н'], ['a₁ = F/m₁', fmt(F / m1, 2) + ' м/с²'], ['a₂ = F/m₂', fmt(F / m2, 2) + ' м/с²'],
      ['a₁ / a₂ = m₂ / m₁', fmt(m2 / m1, 2)], ['скорости после толчка', fmt(V1, 2) + ' и ' + fmt(V2, 2) + ' м/с'],
      ['m₁v₁ + m₂v₂ (с учётом знаков)', fmt(-m1 * V1 + m2 * V2, 2) + ' кг·м/с', 'g']]);
  });
}

/* ---------- 3. Весы в лифте ---------- */
function lift(root){
  const cv = q(root, 'canvas'), FLOOR = 3, VMAX = 2;
  let y = 0, trip = null, tt = 0, label = 'стоит';
  const fm = SC.slider(root, 'lfM', v => v + ' кг'), fa = SC.slider(root, 'lfA', v => fmt(v, 1) + ' м/с²');
  // поездка: массив точек {t, y, v, a, ph} с шагом 0,01 с
  function plan(kind){
    const pts = [], dt = 0.01, A = fa(); let yy = y, v = 0, t = 0;
    const push = (a, ph) => { pts.push({t, y: yy, v, a, ph}); v += a * dt; yy += v * dt; t += dt; };
    if (kind === 'cut' && yy < 6) yy = 3 * FLOOR;          // обрыв показываем с 4-го этажа
    for (let i = 0; i < 60; i++) push(0, 'стоит');
    if (kind === 'cut') {
      pts.cutAt = t;
      for (let i = 0; i < 80; i++) push(-G, 'свободное падение');
      while (v < -1e-9) push(2 * G, 'ловители тормозят');
      v = 0;
    } else {
      const target = kind === 'up' ? 3 * FLOOR : 0, D = Math.abs(target - yy), sg = Math.sign(target - yy) || 1;
      if (D > 0.01) {
        let vm = VMAX, t1 = vm / A, tc = (D - vm * vm / A) / vm; if (tc < 0) { vm = Math.sqrt(A * D); t1 = vm / A; tc = 0; }
        const n1 = Math.round(t1 / dt), nc = Math.round(tc / dt);
        for (let i = 0; i < n1; i++) push(sg * A, sg > 0 ? 'разгон вверх' : 'разгон вниз');
        for (let i = 0; i < nc; i++) push(0, sg > 0 ? 'равномерно вверх' : 'равномерно вниз');
        for (let i = 0; i < n1; i++) push(-sg * A, sg > 0 ? 'торможение при подъёме' : 'торможение при спуске');
        v = 0; yy = target;
      }
    }
    for (let i = 0; i < 80; i++) push(0, 'стоит');
    return pts;
  }
  root.querySelectorAll('[data-lf]').forEach(b => b.addEventListener('click', () => {
    trip = plan(b.dataset.lf); tt = 0; root.querySelectorAll('[data-lf]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  SC.loop(cv, dt => {
    const m = fm(); let cur = {y, v: 0, a: 0, ph: 'стоит'};
    if (trip) { tt += SC.reduce ? 1e9 : dt; const i = Math.min(trip.length - 1, Math.floor(tt / 0.01)); cur = trip[i]; y = cur.y; if (i === trip.length - 1) { y = cur.y; } }
    const P = m * (G + cur.a), n = P / (m * G);
    const {ctx, W, H} = prep(cv), C = SC.col();
    // шахта
    const narrow = W < 560, sw = W * (narrow ? 0.24 : 0.30), top = 16, bot = H - 22, hm = 4 * FLOOR + 0.6, s = (bot - top) / hm, sx = narrow ? 6 : 24;
    const Y = u => bot - u * s;
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    for (let f = 0; f <= 4; f++) { ctx.beginPath(); ctx.moveTo(sx, Y(f * FLOOR)); ctx.lineTo(sx + sw, Y(f * FLOOR)); ctx.stroke(); if (f < 4) text(ctx, f + 1 + ' эт.', narrow ? sx + 3 : sx + sw + 6, narrow ? Y(f * FLOOR + FLOOR) + 9 : Y(f * FLOOR) - 10, {color: C.ink2, size: narrow ? 9 : 11}); }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(sx, Y(hm), sw, hm * s);
    const cw = sw * 0.7, chh = 2.5 * s, cx = sx + (sw - cw) / 2, cyTop = Y(cur.y + 2.5);
    const broken = trip && trip.cutAt != null && tt >= trip.cutAt;
    if (!broken) { ctx.strokeStyle = C.ink2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx + sw / 2, Y(hm)); ctx.lineTo(sx + sw / 2, cyTop); ctx.stroke(); }
    else { ctx.strokeStyle = C.bad; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(sx + sw / 2, Y(hm)); ctx.lineTo(sx + sw / 2, Y(hm) + 30); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = C.sheet; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.fillRect(cx, cyTop, cw, chh); ctx.strokeRect(cx, cyTop, cw, chh);
    // человек на весах
    const fy = cyTop + chh - 4, mx = cx + cw / 2, hh = chh * 0.52, wl = Math.max(4, cw * 0.06);
    ctx.fillStyle = C.ink2; ctx.fillRect(mx - cw * 0.28, fy - 6, cw * 0.56, 6);
    ctx.strokeStyle = C.ink; ctx.lineWidth = wl * 0.6; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(mx - wl, fy - 6); ctx.lineTo(mx, fy - 6 - hh * 0.45); ctx.lineTo(mx + wl, fy - 6); ctx.moveTo(mx, fy - 6 - hh * 0.45); ctx.lineTo(mx, fy - 6 - hh * 0.85);
    ctx.moveTo(mx - wl * 1.6, fy - 6 - hh * 0.62); ctx.lineTo(mx, fy - 6 - hh * 0.78); ctx.lineTo(mx + wl * 1.6, fy - 6 - hh * 0.62); ctx.stroke();
    ctx.beginPath(); ctx.arc(mx, fy - 6 - hh * 0.95, wl * 1.3, 0, TAU); ctx.fillStyle = C.ink; ctx.fill();
    // табло весов
    const disp = fmt(P / G, 1) + ' кг';
    ctx.fillStyle = C.ink; ctx.fillRect(cx + 4, cyTop + 4, cw - 8, 20); text(ctx, disp, cx + cw / 2, cyTop + 14, {align: 'center', color: C.paper, mono: true, weight: 700, size: Math.max(9, Math.min(13, cw / 6.5))});
    if (Math.abs(cur.a) > 1e-9) arrow(ctx, cx - 10, cyTop + chh / 2, cx - 10, cyTop + chh / 2 - Math.sign(cur.a) * Math.min(40, 6 + Math.abs(cur.a) * 4), C.a, 3, 'a', [-10, 0]);
    // графики
    const gx = W * (narrow ? 0.40 : 0.42), gw = W - gx - 8, gh = (H - 50) / 2, Tm = trip ? trip[trip.length - 1].t : 10;
    const graph = (y0, title, f, lo, hi, col, ref, refLab) => {
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(gx, y0, gw, gh);
      const Yg = v => y0 + gh - (v - lo) / (hi - lo) * gh;
      if (lo < 0 && hi > 0) { ctx.beginPath(); ctx.moveTo(gx, Yg(0)); ctx.lineTo(gx + gw, Yg(0)); ctx.stroke(); }
      if (ref != null) { ctx.setLineDash([5, 4]); ctx.strokeStyle = C.ink2; ctx.beginPath(); ctx.moveTo(gx, Yg(ref)); ctx.lineTo(gx + gw, Yg(ref)); ctx.stroke(); ctx.setLineDash([]); text(ctx, refLab, gx + gw - 4, Yg(ref) - 8, {align: 'right', color: C.ink2, size: 11}); }
      text(ctx, title, gx + 6, y0 + 12, {color: col, weight: 700, size: 12});
      text(ctx, fmt(hi, 0), gx - 4, y0 + 6, {align: 'right', color: C.ink2, size: 10}); text(ctx, fmt(lo, 0), gx - 4, y0 + gh - 4, {align: 'right', color: C.ink2, size: 10});
      if (!trip) return; ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
      const iEnd = Math.min(trip.length - 1, Math.floor(tt / 0.01));
      for (let i = 0; i <= iEnd; i += 2) { const p = trip[i], xx = gx + p.t / Tm * gw, yy = Yg(f(p)); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
    };
    let aLo = -4, aHi = 4, pHi = 2 * m * G;
    if (trip) { trip.forEach(p => { aLo = Math.min(aLo, p.a - 1); aHi = Math.max(aHi, p.a + 1); pHi = Math.max(pHi, m * (G + p.a) * 1.1); }); }
    graph(16, 'a, м/с² (вверх +)', p => p.a, aLo, aHi, C.a);
    graph(32 + gh, 'P, Н', p => m * (G + p.a), 0, pHi, C.res, m * G, 'mg = ' + fmt(m * G, 0) + ' Н');
    text(ctx, 't, с → ' + fmt(Tm, 1), gx + gw, H - 6, {align: 'right', color: C.ink2, size: 11});
    q(root, '#lfRead').innerHTML = rows([['фаза', cur.ph], ['ускорение (вверх +)', fmt(cur.a, 1) + ' м/с²'], ['скорость (вверх +)', fmt(Math.abs(cur.v) < 1e-6 ? 0 : cur.v, 2) + ' м/с'],
      ['вес P = m(g + a)', fmt(P, 0) + ' Н'], ['весы показывают P/g', fmt(P / G, 1) + ' кг'], ['перегрузка n = P/mg', fmt(n, 2), n < 0.05 ? 'w' : '']]);
  });
}

const MAP = {puck, carts, lift};
document.querySelectorAll('[data-sim]').forEach(el => { const f = MAP[el.dataset.sim]; if (f) f(el); });
})();
