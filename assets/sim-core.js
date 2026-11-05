/* Общие помощники тренажёров «Движение по окружности»: холст с учётом плотности пикселей, цвета из CSS,
   стрелки-векторы, ползунки с подписью, цикл анимации только для видимых холстов. Без зависимостей. */
(function(){
  'use strict';
  const SC = {};
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  SC.col = () => ({ink: css('--ink'), ink2: css('--ink-2'), rule: css('--rule'), grid: css('--grid'), paper: css('--paper'),
    sheet: css('--sheet'), f1: css('--f1'), f2: css('--f2'), f3: css('--f3'), res: css('--res'),
    v: css('--vv'), an: css('--an'), at: css('--at'), a: css('--aa'), ok: css('--ok'), bad: css('--bad'), warn: css('--warn')});
  SC.prep = function(cv){            // возвращает {ctx, W, H} в CSS-пикселях
    const W = cv.clientWidth, H = cv.clientHeight, d = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
    const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, W, H);
    return {ctx, W, H};
  };
  SC.arrow = function(ctx, x1, y1, x2, y2, color, lw, label, lab){
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); if (L < 2) return;
    lw = lw || 2.5; const h = Math.min(11 + lw, L * 0.45), ux = dx / L, uy = dy / L;
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * h * 0.7, y2 - uy * h * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - ux * h - uy * h * 0.42, y2 - uy * h + ux * h * 0.42);
    ctx.lineTo(x2 - ux * h + uy * h * 0.42, y2 - uy * h - ux * h * 0.42); ctx.closePath(); ctx.fill();
    if (label) { ctx.font = 'italic 600 15px ' + css('--body'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const o = lab || [ux * 14, uy * 14]; ctx.fillText(label, x2 + o[0], y2 + o[1]); }
    ctx.restore();
  };
  SC.text = function(ctx, s, x, y, o){
    o = o || {}; ctx.save(); ctx.fillStyle = o.color || css('--ink'); ctx.font = (o.italic ? 'italic ' : '') + (o.weight || 500) + ' ' + (o.size || 13) + 'px ' + (o.mono ? css('--mono') : css('--body'));
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle'; ctx.fillText(s, x, y); ctx.restore();
  };
  SC.fmt = function(x, d){            // число по-русски: десятичная запятая, неразрывный пробел в тысячах
    if (!isFinite(x)) return '—';
    d = d == null ? 2 : d; let s = Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(2).replace('e+', '·10^').replace('e-', '·10^−') : x.toFixed(d);
    s = s.replace('.', ','); if (!/·/.test(s)) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return s.replace('-', '−');
  };
  SC.num = s => parseFloat(String(s).replace(',', '.').replace('−', '-').replace(/\s/g, ''));
  // ползунок: <input type=range id=..> + <output id=..O>; fmt — функция подписи
  SC.slider = function(root, id, fmt, on){
    const el = root.querySelector('#' + id), out = root.querySelector('#' + id + 'O');
    const upd = () => { if (out) out.textContent = fmt ? fmt(+el.value) : el.value; on && on(); };
    el.addEventListener('input', upd); upd(); return () => +el.value;
  };
  // цикл анимации: draw(dt) вызывается только когда холст на экране и вкладка видима
  SC.loop = function(cv, draw){
    let vis = true, last = 0, raf = 0;
    const tick = t => { const dt = last ? Math.min((t - last) / 1000, 0.05) : 0; last = t; draw(dt); raf = vis ? requestAnimationFrame(tick) : 0; };
    if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => {
      vis = e.isIntersecting; if (vis && !raf) { last = 0; raf = requestAnimationFrame(tick); } })).observe(cv);
    raf = requestAnimationFrame(tick);
    return {redraw: () => draw(0)};
  };
  SC.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // вкладки: .tabs > button[data-tab], панели [data-pane]
  SC.tabs = function(root, onShow){
    const tabs = [...root.querySelectorAll('[data-tab]')], panes = [...root.querySelectorAll('[data-pane]')];
    const show = k => { tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.tab === k));
      panes.forEach(p => p.hidden = p.dataset.pane !== k); onShow && onShow(k); try { history.replaceState(null, '', '#' + k); } catch (e) {} };
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
    const h = (location.hash || '').slice(1); show(tabs.some(t => t.dataset.tab === h) ? h : tabs[0].dataset.tab);
  };
  // зубчатое колесо: центр, число зубьев z, делительный радиус r (px), угол поворота th; модуль в px = 2r/z
  SC.gear = function(ctx, cx, cy, z, r, th, fill, stroke){
    const m = 2 * r / z, ra = r + m, rf = r - 1.25 * m, step = 2 * Math.PI / z;
    ctx.save(); ctx.beginPath();
    for (let k = 0; k < z; k++) {
      const c = th + k * step;                       // центр зуба
      const a = [c - step * 0.5, c - step * 0.27, c - step * 0.15, c + step * 0.15, c + step * 0.27, c + step * 0.5];
      const R = [rf, rf, ra, ra, rf, rf];
      for (let j = 0; j < 6; j++) { const x = cx + R[j] * Math.cos(a[j]), y = cy + R[j] * Math.sin(a[j]); (k === 0 && j === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = stroke; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(3.5, Math.min(9, r * 0.12)), 0, 2 * Math.PI); ctx.fillStyle = stroke; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + rf * 0.85 * Math.cos(th), cy + rf * 0.85 * Math.sin(th)); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  };
  SC.rotArrow = function(ctx, cx, cy, r, dir, color){    // дуговая стрелка направления вращения (dir = ±1, +1 — против часовой на экране)
    if (!dir) return; ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
    const a0 = -Math.PI * 0.75, a1 = -Math.PI * 0.25; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    const ae = dir > 0 ? a0 : a1, tx = -Math.sin(ae) * (dir > 0 ? -1 : 1), ty = Math.cos(ae) * (dir > 0 ? -1 : 1);
    const x = cx + r * Math.cos(ae), y = cy + r * Math.sin(ae), h = 9;
    ctx.beginPath(); ctx.moveTo(x + tx * h, y + ty * h); ctx.lineTo(x - ty * h * 0.5, y + tx * h * 0.5); ctx.lineTo(x + ty * h * 0.5, y - tx * h * 0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  window.SC = SC;
})();
