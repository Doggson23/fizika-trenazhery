/* Интерактивы для слайдов. Каждый создаёт свою разметку внутри элемента [data-widget]
   и возвращает {start, stop}: цикл анимации идёт только на активном слайде. */
window.DeckWidgets = (function () {
  const COL = { dark: '#0B3C5D', blue: '#1F77B4', sky: '#5BB8E8', green: '#2E9C6B', teal: '#0F7B6C', hot: '#D9534F', ink: '#1F2D3A', muted: '#5B6B7A', line: '#9DB4C4', orange: '#E8892B', pale: '#EAF5FC' };
  const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toString().replace('.', ',');
  function ui(root, html) {
    root.innerHTML = html;
    root.querySelectorAll('input,button,select').forEach(el => el.classList.add('nonav'));
    return s => root.querySelector(s);
  }
  function arrow(c, x1, y1, x2, y2, col, w = 4, head = 14) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 2) return;
    const hh = Math.min(head, L * 0.5);
    c.strokeStyle = c.fillStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - hh * Math.cos(a) * 0.8, y2 - hh * Math.sin(a) * 0.8); c.stroke();
    c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - hh * Math.cos(a - 0.42), y2 - hh * Math.sin(a - 0.42));
    c.lineTo(x2 - hh * Math.cos(a + 0.42), y2 - hh * Math.sin(a + 0.42)); c.closePath(); c.fill();
  }
  function text(c, s, x, y, o = {}) {
    c.font = `${o.b ? '700 ' : ''}${Math.round((o.s || 22) * 1.15)}px Carlito, Calibri, sans-serif`;
    c.fillStyle = o.col || COL.ink; c.textAlign = o.al || 'left'; c.textBaseline = o.bl || 'alphabetic';
    c.fillText(s, x, y);
  }

  /* ---------- 7 кл: две наклонные плоскости Галилея (без трения) ---------- */
  function galileo(root, D) {
    const $ = ui(root, `<div class="widget" style="height:560px"><canvas></canvas></div>
      <div class="ctrls" style="margin-top:12px"><label>Наклон правой плоскости <input type="range" min="0" max="45" value="30" id="ga"><span id="gv" class="readout">30°</span></label>
      <button class="btn" id="go">▶ Пуск</button><button class="btn" id="rs">↺ Сначала</button></div>`);
    const cv = $('canvas'), sl = $('#ga');
    let s = 0, v = 0, phase = 'idle', camX = 0;          // s — путь вдоль трассы, px
    const g = 600, H0 = 230, a1 = 35 * Math.PI / 180, L1 = H0 / Math.sin(a1);
    const ang = () => +sl.value * Math.PI / 180;
    function pos(sv) { // координаты шарика по пути
      const x0 = 60, yb = 470;
      if (sv <= L1) return [x0 + sv * Math.cos(a1), yb - H0 + sv * Math.sin(a1)];
      const r = sv - L1, al = ang();
      return [x0 + L1 * Math.cos(a1) + r * Math.cos(al), yb - r * Math.sin(al)];
    }
    function draw() {
      const { c, w, h } = D.canvas(cv); c.clearRect(0, 0, w, h);
      const al = ang(), x0 = 60, yb = 470, xb = x0 + L1 * Math.cos(a1);
      const [bx, by] = pos(s);
      if (al === 0) camX = Math.max(0, bx - w * 0.55); else camX = 0;
      c.save(); c.translate(-camX, 0);
      // уровень старта
      // трасса
      c.fillStyle = '#d9e6ee'; c.strokeStyle = COL.dark; c.lineWidth = 4;
      c.beginPath(); c.moveTo(x0, yb - H0); c.lineTo(xb, yb);
      const R = al === 0 ? camX + w + 50 : xb + Math.min(1400, H0 / Math.tan(al) + 80);
      const yR = al === 0 ? yb : yb - (R - xb) * Math.tan(al);
      c.lineTo(R, yR); c.lineTo(R, yb + 60); c.lineTo(x0, yb + 60); c.closePath(); c.fill(); c.stroke();
      c.setLineDash([10, 8]); c.strokeStyle = COL.green; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, yb - H0); c.lineTo(camX + w, yb - H0); c.stroke(); c.setLineDash([]);
      text(c, 'высота старта', camX + 70, yb - H0 - 12, { col: COL.green, s: 22, b: true });
      // метки через 100 px на горизонтали
      if (al === 0) { c.fillStyle = COL.muted; for (let k = Math.floor(camX / 100) * 100; k < camX + w; k += 100) if (k > xb) c.fillRect(k, yb + 4, 2, 10); }
      // шарик
      c.beginPath(); c.arc(bx, by - 18, 18, 0, 7); c.fillStyle = COL.hot; c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2; const rot = s / 18; c.beginPath(); c.moveTo(bx, by - 18); c.lineTo(bx + 14 * Math.cos(rot), by - 18 + 14 * Math.sin(rot)); c.stroke();
      c.restore();
      // подписи
      let msg = 'Без трения шарик поднимается на ту же высоту, с которой скатился.';
      if (al === 0) msg = 'Горизонталь: подняться некуда — шарик катится бесконечно, скорость не меняется!';
      text(c, msg, 20, 40, { s: 24, b: true, col: COL.dark });
      if (phase !== 'idle' && s > L1) {
        const vv = Math.abs(v) / 60;
        text(c, `скорость: ${fmt(vv, 1)} м/с`, 20, 76, { s: 22, col: COL.blue });
      }
    }
    let dir = 1;
    const loop = D.loop(dt => {
      if (phase === 'run') {
        const al = s <= L1 ? a1 : ang();
        const acc = s <= L1 ? g * Math.sin(a1) : -g * Math.sin(al);
        v += acc * dt; s += v * dt;
        if (s < 0) { s = 0; v = 0; phase = 'idle'; }
      }
      draw();
    });
    root.querySelector('#go').onclick = () => { s = 0; v = 0; phase = 'run'; };
    root.querySelector('#rs').onclick = () => { s = 0; v = 0; phase = 'idle'; };
    sl.oninput = () => { root.querySelector('#gv').textContent = sl.value + '°'; s = 0; v = 0; phase = 'idle'; };
    return { start: loop.start, stop: loop.stop };
  }

  /* ---------- 7 кл: катится по разным поверхностям ---------- */
  function surfaces(root, D) {
    const S = [['песок', 0.6, '#E9D9A8'], ['ковёр', 0.3, '#C9A0A0'], ['пол', 0.12, '#D8C09A'], ['лёд', 0.03, '#CFEAF7'], ['без трения', 0, '#ffffff']];
    const $ = ui(root, `<div class="widget" style="height:470px"><canvas></canvas></div>
      <div class="ctrls" style="margin-top:12px">${S.map((s, i) => `<button class="btn${i === 0 ? ' on' : ''}" data-i="${i}">${s[0]}</button>`).join('')}
      <button class="btn" id="go">▶ Толкнуть</button></div>`);
    const cv = $('canvas'); let k = 0, x = 0, v = 0, run = false, cam = 0, trail = [];
    root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      root.querySelectorAll('[data-i]').forEach(q => q.classList.remove('on')); b.classList.add('on'); k = +b.dataset.i; x = 0; v = 0; run = false; cam = 0;
    });
    root.querySelector('#go').onclick = () => { x = 0; v = 420; run = true; cam = 0; };
    const loop = D.loop(dt => {
      if (run) { const a = S[k][1] * 9.8 * 60; v = Math.max(0, v - a * dt); x += v * dt; if (v === 0) run = false; }
      const { c, w, h } = D.canvas(cv); c.clearRect(0, 0, w, h);
      if (x - cam > w * 0.6) cam = x - w * 0.6;
      const yb = 330;
      c.fillStyle = S[k][2]; c.fillRect(0, yb, w, 90); c.strokeStyle = COL.dark; c.lineWidth = 3; c.beginPath(); c.moveTo(0, yb); c.lineTo(w, yb); c.stroke();
      c.fillStyle = COL.muted; for (let m = Math.ceil(cam / 60) * 60; m < cam + w; m += 60) { c.fillRect(60 + m - cam, yb + 6, 2, 12); if (m % 300 === 0) text(c, (m / 60) + ' м', 60 + m - cam, yb + 40, { s: 18, al: 'center', col: COL.muted }); }
      const bx = 60 + x - cam;
      c.beginPath(); c.arc(bx, yb - 26, 26, 0, 7); c.fillStyle = COL.blue; c.fill();
      if (v > 0) arrow(c, bx, yb - 70, bx + 30 + v * 0.25, yb - 70, COL.green, 5);
      text(c, `${S[k][0]}: путь ${fmt(x / 60, 1)} м, скорость ${fmt(v / 60, 1)} м/с`, 20, 40, { s: 26, b: true, col: COL.dark });
      text(c, k === 4 ? 'Ничто не тормозит — шарик сохраняет скорость (катится «вечно»)' : 'Тормозит трение: чем оно меньше, тем дальше катится шарик', 20, 76, { s: 22, col: COL.muted });
    });
    return { start: loop.start, stop: loop.stop };
  }

  /* ---------- 7 кл: тележки и пружина — сравниваем массы ---------- */
  function carts(root, D) {
    const $ = ui(root, `<div class="widget" style="height:430px"><canvas></canvas></div>
      <div class="ctrls" style="margin-top:12px"><label>левая $m_1$ <select id="m1"><option>1</option><option>2</option><option>3</option><option>4</option></select> кг</label>
      <label>правая $m_2$ <select id="m2"><option>1</option><option selected>2</option><option>3</option><option>4</option></select> кг</label>
      <button class="btn" id="go">✂ Пережечь нить</button><button class="btn" id="rs">↺</button></div>`);
    root.querySelectorAll('.ctrls label').forEach(l => l.innerHTML = l.innerHTML.replace('$m_1$', '<i>m</i><sub>1</sub>').replace('$m_2$', '<i>m</i><sub>2</sub>'));
    root.querySelectorAll('select').forEach(s => { s.className = 'btn nonav'; s.style.padding = '2px 8px'; });
    const cv = root.querySelector('canvas');
    let t = 0, run = false;
    const p = 6; // «импульс» пружины, усл. ед.
    const m1 = () => +root.querySelector('#m1').value, m2 = () => +root.querySelector('#m2').value;
    root.querySelector('#go').onclick = () => { t = 0; run = true; };
    root.querySelector('#rs').onclick = () => { t = 0; run = false; };
    root.querySelectorAll('select').forEach(s => s.onchange = () => { t = 0; run = false; });
    function cart(c, x, y, m, col) {
      const wd = 110, hg = 54;
      c.fillStyle = col; c.fillRect(x - wd / 2, y - hg, wd, hg - 12);
      for (let i = 0; i < m; i++) { c.fillStyle = COL.dark; c.fillRect(x - 46 + i * 24, y - hg - 26, 20, 26); }
      c.fillStyle = '#333'; [x - 34, x + 34].forEach(xx => { c.beginPath(); c.arc(xx, y - 10, 11, 0, 7); c.fill(); });
    }
    const loop = D.loop(dt => {
      if (run) t = Math.min(t + dt, 2.2);
      const { c, w, h } = D.canvas(cv); c.clearRect(0, 0, w, h);
      const yb = 300, xc = w / 2, v1 = p / m1(), v2 = p / m2(), k = 55;
      c.fillStyle = '#d9e6ee'; c.fillRect(0, yb, w, 20);
      const x1 = xc - 80 - v1 * k * t, x2 = xc + 80 + v2 * k * t;
      if (!run || t === 0) { // пружина и нить
        c.strokeStyle = COL.muted; c.lineWidth = 3; c.beginPath();
        for (let i = 0; i <= 10; i++) c.lineTo(xc - 25 + i * 5, yb - 32 + (i % 2 ? -10 : 10)); c.stroke();
        c.strokeStyle = COL.hot; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(xc - 25, yb - 50); c.lineTo(xc + 25, yb - 50); c.stroke(); c.setLineDash([]);
      }
      cart(c, x1, yb, m1(), COL.sky); cart(c, x2, yb, m2(), '#9fd6b8');
      if (run && t > 0) {
        arrow(c, x1 - 60, yb - 110, x1 - 60 - v1 * 40, yb - 110, COL.blue, 5);
        arrow(c, x2 + 60, yb - 110, x2 + 60 + v2 * 40, yb - 110, COL.green, 5);
        text(c, `v₁ = ${fmt(v1 / 2, 2)} м/с`, x1 - 60, yb - 128, { al: 'right', b: true, col: COL.blue });
        text(c, `v₂ = ${fmt(v2 / 2, 2)} м/с`, x2 + 60, yb - 128, { b: true, col: COL.green });
      }
      const r = m2() / m1();
      text(c, run ? `Скорости: v₁ : v₂ = ${fmt(v1 / v2, 2)}   ·   массы: m₂ : m₁ = ${fmt(r, 2)}` : 'Пружина сжата, тележки связаны нитью. Пережгите нить!', 20, 40, { s: 25, b: true, col: COL.dark });
      text(c, 'Тележка с большей массой получает меньшую скорость — она инертнее.', 20, 74, { s: 22, col: COL.muted });
    });
    return { start: loop.start, stop: loop.stop };
  }

  /* ---------- 8 кл: нагреваем лёд — график и состояние ---------- */
  function melt(root, D) {
    const $ = ui(root, `<div class="widget" style="height:520px"><canvas></canvas></div>
      <div class="ctrls" style="margin-top:12px"><label>масса льда <input type="range" id="mm" min="0.5" max="2" step="0.5" value="1"><span class="readout" id="mv">1 кг</span></label>
      <label>плитка <input type="range" id="pp" min="21" max="84" step="21" value="42"><span class="readout" id="pv">42 кДж/мин</span></label>
      <button class="btn" id="go">▶ Включить</button><button class="btn" id="rs">↺</button></div>`);
    const cv = $('canvas');
    const ci = 2100, cw = 4200, lam = 340000, T0 = -20;
    let Q = 0, run = false, tmin = 0, hist = [];
    const m = () => +$('#mm').value, P = () => +$('#pp').value * 1000; // Дж/мин
    function state(q) { // температура и доля расплавленного
      const q1 = ci * m() * (0 - T0), q2 = q1 + lam * m(), q3 = q2 + cw * m() * 100;
      if (q < q1) return [T0 + q / (ci * m()), 0, 'нагревание льда'];
      if (q < q2) return [0, (q - q1) / (lam * m()), 'плавление: $t$ не меняется'];
      if (q < q3) return [(q - q2) / (cw * m()), 1, 'нагревание воды'];
      return [100, 1, 'вода закипела — это следующая тема'];
    }
    function reset() { Q = 0; tmin = 0; hist = [[0, T0]]; run = false; }
    reset();
    $('#go').onclick = () => { run = !run; $('#go').textContent = run ? '⏸ Пауза' : '▶ Включить'; };
    $('#rs').onclick = () => { reset(); $('#go').textContent = '▶ Включить'; };
    $('#mm').oninput = () => { $('#mv').textContent = String($('#mm').value).replace('.', ',') + ' кг'; reset(); $('#go').textContent = '▶ Включить'; };
    $('#pp').oninput = () => { $('#pv').textContent = $('#pp').value + ' кДж/мин'; reset(); $('#go').textContent = '▶ Включить'; };
    // частицы
    const N = 49, base = []; for (let i = 0; i < N; i++) base.push([i % 7, Math.floor(i / 7)]);
    const rnd = base.map(() => [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 6.28]);
    let clock = 0;
    const loop = D.loop(dt => {
      clock += dt;
      const [T, frac, label] = state(Q);
      if (run && T < 100) { const dmin = dt * 1.5; tmin += dmin; Q += P() * dmin; const [T2] = state(Q); hist.push([tmin, T2]); }
      const { c, w, h } = D.canvas(cv); c.clearRect(0, 0, w, h);
      // график
      const gx = 80, gy = 40, gw = w - 520, gh = h - 110;
      const tmax = Math.max(10, Math.ceil((ci * m() * 20 + lam * m() + cw * m() * 100) / P() / 5) * 5);
      const X = t => gx + t / tmax * gw, Y = T => gy + (100 - T) / 130 * gh;
      c.strokeStyle = '#e1ebf1'; c.lineWidth = 1;
      for (let TT = -20; TT <= 100; TT += 10) { c.beginPath(); c.moveTo(gx, Y(TT)); c.lineTo(gx + gw, Y(TT)); c.stroke(); text(c, TT + '', gx - 10, Y(TT) + 7, { al: 'right', s: 17, col: COL.muted }); }
      const st = tmax <= 20 ? 2 : 5;
      for (let tt = 0; tt <= tmax; tt += st) { c.beginPath(); c.moveTo(X(tt), gy); c.lineTo(X(tt), gy + gh); c.stroke(); text(c, tt + '', X(tt), gy + gh + 24, { al: 'center', s: 17, col: COL.muted }); }
      c.strokeStyle = COL.dark; c.lineWidth = 2.5; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx, gy + gh); c.moveTo(gx, Y(0)); c.lineTo(gx + gw, Y(0)); c.stroke();
      text(c, 't, °C', gx + 8, gy - 12, { s: 20, b: true }); text(c, 'время, мин', gx + gw, gy + gh + 50, { al: 'right', s: 19, b: true });
      c.strokeStyle = COL.hot; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath();
      hist.forEach(([t, TT], i) => i ? c.lineTo(X(t), Y(TT)) : c.moveTo(X(t), Y(TT))); c.stroke();
      // термометр + показания
      const px = w - 410;
      c.fillStyle = '#F7FBFE'; c.fillRect(px, 30, 380, 470);
      text(c, `t = ${fmt(T, 1)} °C`, px + 20, 70, { s: 32, b: true, col: COL.hot });
      text(c, label.replace('$t$', 't'), px + 20, 106, { s: 22, b: true, col: COL.dark });
      text(c, `время: ${fmt(tmin, 1)} мин`, px + 20, 140, { s: 21, col: COL.muted });
      text(c, `получено: ${fmt(Q / 1000, 0)} кДж`, px + 20, 170, { s: 21, col: COL.muted });
      text(c, `расплавилось: ${Math.round(frac * 100)} %`, px + 20, 200, { s: 21, col: COL.muted });
      // частицы: доля frac «оторвана» от решётки
      const bx = px + 60, by = 230, step = 36, amp = 2 + Math.max(0, Math.min(1, (T + 20) / 20)) * 4;
      c.strokeStyle = COL.line; c.strokeRect(bx - 30, by - 10, 300, 260);
      for (let i = 0; i < N; i++) {
        const [gxI, gyI] = base[i], [rx, ry, ph] = rnd[i];
        const free = i / N < frac;
        let x = bx + gxI * step + 10, y = by + gyI * step + 15;
        if (free) { x += rx * 18 + Math.sin(clock * 3 + ph) * 10; y += ry * 18 + Math.cos(clock * 2.6 + ph) * 10; }
        else { x += Math.sin(clock * 12 + ph) * amp * 0.5; y += Math.cos(clock * 11 + ph) * amp * 0.5; }
        c.beginPath(); c.arc(x, y, 11, 0, 7); c.fillStyle = free ? COL.sky : COL.blue; c.fill();
      }
    });
    return { start: loop.start, stop: loop.stop };
  }

  /* ---------- 9 кл: сложение двух сил ---------- */
  function forces(root, D) {
    const $ = ui(root, `<div class="widget" style="height:540px"><canvas></canvas></div>
      <div class="ctrls" style="margin-top:12px"><label>F₁ <input type="range" id="f1" min="1" max="8" value="4"><span class="readout" id="v1">4 Н</span></label>
      <label>F₂ <input type="range" id="f2" min="1" max="8" value="3"><span class="readout" id="v2">3 Н</span></label>
      <button class="btn on" data-a="0">в одну сторону</button><button class="btn" data-a="180">навстречу</button><button class="btn" data-a="90">под 90°</button></div>`);
    const cv = $('canvas'); let A = 0;
    root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { root.querySelectorAll('[data-a]').forEach(q => q.classList.remove('on')); b.classList.add('on'); A = +b.dataset.a; });
    ['1', '2'].forEach(i => $('#f' + i).oninput = () => $('#v' + i).textContent = $('#f' + i).value + ' Н');
    const loop = D.loop(() => {
      const { c, w, h } = D.canvas(cv); c.clearRect(0, 0, w, h);
      const k = 50, ox = A === 180 ? w * 0.45 : 260, oy = A === 90 ? h - 90 : h * 0.55;
      c.strokeStyle = '#e4eef5'; c.lineWidth = 1;
      for (let x = ox % k; x < w; x += k) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = oy % k; y < h; y += k) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      const F1 = +$('#f1').value, F2 = +$('#f2').value, a = A * Math.PI / 180;
      const e1 = [ox + F1 * k, oy], e2 = [ox + F2 * k * Math.cos(a), oy - F2 * k * Math.sin(a)];
      const R = [F1 + F2 * Math.cos(a), F2 * Math.sin(a)], Rm = Math.hypot(R[0], R[1]);
      if (A === 90) { c.setLineDash([8, 6]); c.strokeStyle = COL.muted; c.lineWidth = 2; c.beginPath(); c.moveTo(e1[0], e1[1]); c.lineTo(e1[0] + e2[0] - ox, e2[1]); c.lineTo(e2[0], e2[1]); c.stroke(); c.setLineDash([]); }
      c.fillStyle = COL.dark; c.fillRect(ox - 30, oy - 30, 60, 60);
      arrow(c, ox, oy, e1[0], e1[1], COL.blue, 6); text(c, 'F₁', e1[0] - 10, e1[1] + (A === 180 ? 40 : -16), { b: true, s: 26, col: COL.blue });
      arrow(c, ox, A === 0 ? oy + 14 : oy, e2[0], e2[1] + (A === 0 ? 14 : 0), COL.green, 6); text(c, 'F₂', e2[0] + (A === 90 ? 14 : -10), e2[1] + (A === 0 ? 50 : A === 180 ? 40 : 10), { b: true, s: 26, col: COL.green });
      if (Rm > 0.01) arrow(c, ox, oy - (A === 0 ? 14 : 0), ox + R[0] * k, oy - R[1] * k - (A === 0 ? 14 : 0), COL.hot, 8, 20);
      let f = A === 0 ? `R = F₁ + F₂ = ${F1} + ${F2} = ${F1 + F2} Н` : A === 180 ? `R = |F₁ − F₂| = |${F1} − ${F2}| = ${Math.abs(F1 - F2)} Н` : `R = √(F₁² + F₂²) = √(${F1 * F1} + ${F2 * F2}) ≈ ${fmt(Rm, 2)} Н`;
      if (A === 180 && F1 === F2) f += ' — силы уравновешены!';
      text(c, f, 20, 42, { s: 28, b: true, col: COL.hot });
      text(c, '1 клетка = 1 Н', 20, 78, { s: 20, col: COL.muted });
    });
    return { start: loop.start, stop: loop.stop };
  }

  /* ---------- 9 кл: второй закон Ньютона ---------- */
  function newton2(root, D) {
    const $ = ui(root, `<div class="widget" style="height:500px"><canvas></canvas></div>
      <div class="ctrls" style="margin-top:12px"><label>тяга F <input type="range" id="ff" min="0" max="12" value="6"><span class="readout" id="fv">6 Н</span></label>
      <label>масса m <input type="range" id="mm" min="1" max="6" value="2"><span class="readout" id="mv">2 кг</span></label>
      <label><input type="checkbox" id="tr"> трение 2 Н</label>
      <button class="btn" id="go">▶ Пуск</button><button class="btn" id="rs">↺</button></div>`);
    const cv = $('canvas'); let x = 0, v = 0, t = 0, run = false, hist = [];
    const F = () => +$('#ff').value, m = () => +$('#mm').value, fr = () => $('#tr').checked ? 2 : 0;
    const R = () => (v > 0 || F() > fr()) ? F() - fr() : 0;
    function reset() { x = 0; v = 0; t = 0; run = false; hist = [[0, 0]]; }
    reset();
    $('#ff').oninput = () => { $('#fv').textContent = $('#ff').value + ' Н'; };
    $('#mm').oninput = () => { $('#mv').textContent = $('#mm').value + ' кг'; reset(); };
    $('#tr').onchange = reset;
    $('#go').onclick = () => { if (!run && t >= 4) reset(); run = !run; };
    $('#rs').onclick = reset;
    const loop = D.loop(dt => {
      if (run) { const a = R() / m(); v = Math.max(0, v + a * dt); x += v * dt; t += dt; hist.push([t, v]); if (t >= 4) run = false; }
      const { c, w, h } = D.canvas(cv); c.clearRect(0, 0, w, h);
      const yb = 210, kx = 18, bx = 80 + (x * kx) % (w - 640);
      c.fillStyle = '#d9e6ee'; c.fillRect(0, yb, w - 520, 16);
      // тележка
      c.fillStyle = COL.sky; c.fillRect(bx, yb - 60, 120, 48);
      for (let i = 0; i < m(); i++) { c.fillStyle = COL.dark; c.fillRect(bx + 6 + i * 19, yb - 84, 16, 24); }
      c.fillStyle = '#333'; [bx + 26, bx + 94].forEach(xx => { c.beginPath(); c.arc(xx, yb - 10, 11, 0, 7); c.fill(); });
      if (F() > 0) arrow(c, bx + 120, yb - 36, bx + 120 + F() * 14, yb - 36, COL.blue, 6);
      if (fr() && (v > 0 || F() > 0)) arrow(c, bx, yb - 4, bx - Math.min(F(), fr()) * 14, yb - 4, COL.orange, 5);
      const a = R() / m();
      text(c, `a = (F − Fтр) / m = (${F()} − ${Math.min(F(), fr())}) / ${m()} = ${fmt(a, 2)} м/с²`, 20, 42, { s: 27, b: true, col: COL.hot });
      text(c, `скорость v = ${fmt(v, 1)} м/с   ·   время ${fmt(t, 1)} с`, 20, 80, { s: 22, col: COL.dark });
      text(c, 'синяя стрелка — сила тяги, оранжевая — трение', 20, 300, { s: 19, col: COL.muted });
      // график v(t)
      const gx = w - 470, gy = 30, gw = 430, gh = 400, vmax = 24, X = tt => gx + tt / 4 * gw, Y = vv => gy + gh - vv / vmax * gh;
      c.strokeStyle = '#e1ebf1'; c.lineWidth = 1;
      for (let vv = 0; vv <= vmax; vv += 4) { c.beginPath(); c.moveTo(gx, Y(vv)); c.lineTo(gx + gw, Y(vv)); c.stroke(); text(c, vv + '', gx - 8, Y(vv) + 6, { al: 'right', s: 16, col: COL.muted }); }
      for (let tt = 0; tt <= 4; tt++) { c.beginPath(); c.moveTo(X(tt), gy); c.lineTo(X(tt), gy + gh); c.stroke(); text(c, tt + '', X(tt), gy + gh + 22, { al: 'center', s: 16, col: COL.muted }); }
      c.strokeStyle = COL.dark; c.lineWidth = 2; c.strokeRect(gx, gy, gw, gh);
      text(c, 'v, м/с', gx + 6, gy + 22, { s: 18, b: true }); text(c, 't, с', gx + gw - 6, gy + gh - 8, { s: 18, b: true, al: 'right' });
      c.strokeStyle = COL.hot; c.lineWidth = 4; c.beginPath(); hist.forEach(([tt, vv], i) => i ? c.lineTo(X(tt), Y(Math.min(vmax, vv))) : c.moveTo(X(tt), Y(vv))); c.stroke();
    });
    return { start: loop.start, stop: loop.stop };
  }

  return { galileo, surfaces, carts, melt, forces, newton2 };
})();
