/* Движок HTML-презентаций 7–9. Без зависимостей.
   Быстро листается: в DOM показан только текущий слайд; картинки и видео грузятся для соседних;
   видео и интерактивы работают только на активном слайде (на остальных остановлены).
   Писалка: перо, маркер, ластик, отмена, чистая доска; рисунки хранятся по слайдам. */
(function () {
  'use strict';
  const W = 1600, H = 900;
  const $ = (s, r = document) => r.querySelector(s);
  const stage = $('#stage');
  const slides = Array.from(stage.querySelectorAll(':scope > .slide'));
  const deckId = document.body.dataset.deck || location.pathname;
  let cur = -1, scale = 1;
  const widgets = new Map();            // slide element -> [{api, el}]

  /* ---------- масштаб ---------- */
  function fit() {
    const vw = innerWidth, vh = innerHeight;
    scale = Math.min(vw / W, vh / H);
    const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
    stage.style.transform = `translate(${ox}px,${oy}px) scale(${scale})`;
    Ink.resize();
  }

  /* ---------- ленивые медиа ---------- */
  function hydrate(sl) {
    if (!sl || sl._hyd) return;
    sl._hyd = true;
    sl.querySelectorAll('[data-src]').forEach(el => {
      if (el.tagName === 'VIDEO') { el.preload = 'auto'; el.src = el.dataset.src; }
      else el.src = el.dataset.src;
    });
  }
  function enter(sl) {
    sl.querySelectorAll('video').forEach(v => { if (v.dataset.auto !== '0') { v.currentTime = 0; const p = v.play(); if (p) p.catch(() => {}); } });
    let list = widgets.get(sl);
    if (!list) {
      list = [];
      sl.querySelectorAll('[data-widget]').forEach(el => {
        const f = (window.DeckWidgets || {})[el.dataset.widget];
        if (f) { try { list.push(f(el, Deck) || {}); } catch (e) { console.error(e); } }
      });
      widgets.set(sl, list);
    }
    list.forEach(w => w.start && w.start());
  }
  function leave(sl) {
    sl.querySelectorAll('video').forEach(v => v.pause());
    (widgets.get(sl) || []).forEach(w => w.stop && w.stop());
  }

  /* ---------- фрагменты ---------- */
  const frags = sl => Array.from(sl.querySelectorAll('.f'));
  function setFrags(sl, all) { frags(sl).forEach(f => f.classList.toggle('on', all)); }

  /* ---------- навигация ---------- */
  function go(i, fromBack) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === cur) return;
    if (cur >= 0) { leave(slides[cur]); slides[cur].classList.remove('active'); }
    const prev = cur; cur = i;
    const sl = slides[cur];
    for (let k = cur - 1; k <= cur + 2; k++) hydrate(slides[k]);
    setFrags(sl, !!fromBack);
    sl.classList.add('active');
    enter(sl);
    history.replaceState(null, '', '#' + (cur + 1));
    $('#cnt').textContent = (cur + 1) + ' / ' + slides.length;
    $('#progress').style.width = ((cur + 1) / slides.length * 100) + '%';
    $('#notes').innerHTML = sl.querySelector('.notes') ? sl.querySelector('.notes').innerHTML : '<i>Заметок к слайду нет</i>';
    Board.off();
    Ink.show(prev);
  }
  function next() {
    const hidden = frags(slides[cur]).find(f => !f.classList.contains('on'));
    if (hidden) { hidden.classList.add('on'); return; }
    go(cur + 1);
  }
  function prev() {
    const shown = frags(slides[cur]).filter(f => f.classList.contains('on'));
    if (shown.length && shown.length < frags(slides[cur]).length) { shown[shown.length - 1].classList.remove('on'); return; }
    go(cur - 1, true);
  }

  /* ---------- писалка ---------- */
  const COLORS = ['#D9534F', '#1F77B4', '#2E9C6B', '#1F2D3A', '#F0A500'];
  const Ink = (function () {
    const cv = $('#ink'), live = document.createElement('canvas');
    live.id = 'inklive'; live.style.cssText = 'position:absolute;left:0;top:0;width:1600px;height:900px;z-index:6;pointer-events:none';
    stage.appendChild(live);
    const ctx = cv.getContext('2d'), lctx = live.getContext('2d');
    let tool = 'none', color = COLORS[0], width = 4, store = {}, undo = {}, drawing = null, raf = 0, res = 1;
    try { store = JSON.parse(localStorage.getItem('ink:' + deckId) || '{}'); } catch (e) { store = {}; }
    const key = () => (Board.on ? 'b' : 's') + cur;
    let saveT = 0;
    function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('ink:' + deckId, JSON.stringify(store)); } catch (e) {} }, 600); }
    function resize() {
      res = Math.min(2.5, Math.max(1, scale * (devicePixelRatio || 1)));
      [cv, live].forEach(c => { c.width = Math.round(W * res); c.height = Math.round(H * res); });
      redraw();
    }
    function path(c, s) {
      const p = s.p; if (p.length < 2) return;
      c.save(); c.scale(res, res);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = s.c; c.lineWidth = s.w; c.globalAlpha = s.t === 'marker' ? 0.33 : 1;
      c.beginPath(); c.moveTo(p[0], p[1]);
      if (p.length === 2) c.lineTo(p[0] + 0.1, p[1]);
      for (let i = 2; i < p.length - 2; i += 2) {
        const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
        c.quadraticCurveTo(p[i], p[i + 1], mx, my);
      }
      c.lineTo(p[p.length - 2], p[p.length - 1]);
      c.stroke(); c.restore();
    }
    function redraw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      (store[key()] || []).forEach(s => path(ctx, s));
    }
    function pt(e) {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
    }
    function erase(x, y) {
      const list = store[key()]; if (!list) return;
      const R = 22 / 1, before = list.length;
      store[key()] = list.filter(s => {
        for (let i = 0; i < s.p.length; i += 2) if (Math.hypot(s.p[i] - x, s.p[i + 1] - y) < R + s.w / 2) return false;
        return true;
      });
      if (store[key()].length !== before) { (undo[key()] = undo[key()] || []).push({ restore: list }); redraw(); save(); }
    }
    function frame() {
      raf = 0; lctx.clearRect(0, 0, live.width, live.height);
      if (drawing) path(lctx, drawing);
    }
    cv.addEventListener('pointerdown', e => {
      if (tool === 'none') return;
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      const [x, y] = pt(e);
      if (tool === 'eraser') { erase(x, y); drawing = { erasing: true }; return; }
      drawing = { t: tool, c: color, w: tool === 'marker' ? width * 6 : width, p: [x, y] };
      if (!raf) raf = requestAnimationFrame(frame);
    });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) {
        const [x, y] = pt(ev);
        if (drawing.erasing) { erase(x, y); continue; }
        const p = drawing.p, lx = p[p.length - 2], ly = p[p.length - 1];
        if (Math.abs(x - lx) + Math.abs(y - ly) > 1.2) p.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
      }
      if (!drawing.erasing && !raf) raf = requestAnimationFrame(frame);
    });
    function end() {
      if (!drawing) return;
      if (!drawing.erasing) {
        (store[key()] = store[key()] || []).push(drawing);
        (undo[key()] = undo[key()] || []).push({ add: true });
        path(ctx, drawing); save();
      }
      drawing = null; lctx.clearRect(0, 0, live.width, live.height);
    }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('lostpointercapture', end);
    return {
      resize, redraw,
      show() { redraw(); },
      get tool() { return tool; },
      set(t) { tool = t; cv.classList.toggle('draw', t !== 'none'); UI.sync(); },
      color(c) { color = c; if (tool === 'none' || tool === 'eraser') this.set('pen'); UI.sync(); },
      get colorV() { return color; },
      width(w) { width = w; UI.sync(); }, get widthV() { return width; },
      undo() {
        const u = (undo[key()] || []).pop(); if (!u) return;
        if (u.add) (store[key()] || []).pop(); else if (u.restore) store[key()] = u.restore;
        redraw(); save();
      },
      clear() {
        const list = store[key()]; if (!list || !list.length) return;
        (undo[key()] = undo[key()] || []).push({ restore: list }); store[key()] = []; redraw(); save();
      },
    };
  })();

  /* ---------- чистая доска поверх слайда ---------- */
  const Board = {
    on: false,
    toggle() { this.on = !this.on; $('#board').classList.toggle('on', this.on); if (this.on && Ink.tool === 'none') Ink.set('pen'); Ink.redraw(); UI.sync(); },
    off() { if (this.on) { this.on = false; $('#board').classList.remove('on'); UI.sync(); } },
  };

  /* ---------- панель ---------- */
  const UI = (function () {
    const ui = document.createElement('div'); ui.id = 'ui';
    const B = (id, txt, title, fn) => `<button id="${id}" title="${title}">${txt}</button>`;
    ui.innerHTML = B('bPrev', '◀', 'Назад (←)') + '<span id="cnt" class="cnt"></span>' + B('bNext', '▶', 'Вперёд (→, пробел)') +
      '<span class="sep"></span>' + B('tNone', '🖱️', 'Указатель (Esc)') + B('tPen', '✏️', 'Перо (P)') + B('tMarker', '🖍️', 'Маркер (M)') + B('tEraser', '🧽', 'Ластик (E)') +
      '<span class="sep"></span>' + COLORS.map((c, i) => `<span class="sw" data-c="${c}" style="background:${c}" title="Цвет ${i + 1}"></span>`).join('') +
      B('tW', '●', 'Толщина линии') + '<span class="sep"></span>' + B('bUndo', '↶', 'Отменить (Ctrl+Z)') + B('bClear', '🗑️', 'Стереть всё на слайде (C)') +
      B('bBoard', '▦', 'Чистая доска (B)') + '<span class="sep"></span>' + B('bOver', '☰', 'Все слайды (O)') + B('bNotes', '🗒️', 'Заметки учителя (N)') +
      B('bFull', '⛶', 'Во весь экран (F)') + B('bHelp', '?', 'Клавиши (?)');
    document.body.appendChild(ui);
    const on = (id, fn) => $('#' + id).addEventListener('click', e => { e.stopPropagation(); fn(); });
    on('bPrev', prev); on('bNext', next);
    on('tNone', () => Ink.set('none')); on('tPen', () => Ink.set('pen')); on('tMarker', () => Ink.set('marker')); on('tEraser', () => Ink.set('eraser'));
    ui.querySelectorAll('.sw').forEach(s => s.addEventListener('click', e => { e.stopPropagation(); Ink.color(s.dataset.c); }));
    const widths = [3, 6, 11]; on('tW', () => Ink.width(widths[(widths.indexOf(Ink.widthV) + 1) % widths.length]));
    on('bUndo', () => Ink.undo()); on('bClear', () => Ink.clear()); on('bBoard', () => Board.toggle());
    on('bOver', overview); on('bNotes', () => $('#notes').classList.toggle('on')); on('bFull', full); on('bHelp', () => $('#help').classList.toggle('on'));
    let t = 0;
    function poke() { ui.classList.remove('hide'); clearTimeout(t); t = setTimeout(() => { if (!ui.matches(':hover')) ui.classList.add('hide'); }, 3500); }
    addEventListener('pointermove', poke, { passive: true }); addEventListener('pointerdown', poke, { passive: true });
    poke();
    return {
      sync() {
        const tl = Ink.tool;
        ['None', 'Pen', 'Marker', 'Eraser'].forEach(n => $('#t' + n).classList.toggle('on', tl === n.toLowerCase()));
        ui.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.c === Ink.colorV && (tl === 'pen' || tl === 'marker')));
        $('#tW').style.fontSize = ({ 3: 12, 6: 20, 11: 30 })[Ink.widthV] + 'px';
        $('#bBoard').classList.toggle('on', Board.on);
      },
    };
  })();

  function full() {
    const d = document;
    if (!d.fullscreenElement) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen || function () {}).call(d.documentElement);
    else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  }
  function overview() {
    const ov = $('#overview');
    if (ov.classList.contains('on')) { ov.classList.remove('on'); return; }
    ov.innerHTML = slides.map((s, i) => {
      const t = (s.querySelector('h2,h1') || {}).textContent || '';
      const c = (s.querySelector('.chip') || {}).textContent || '';
      return `<a href="#${i + 1}" data-i="${i}" class="${i === cur ? 'cur' : ''}"><b>${i + 1}. ${c}</b>${t}</a>`;
    }).join('');
    ov.classList.add('on');
  }
  $('#overview').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    $('#overview').classList.remove('on'); go(+a.dataset.i);
  });

  /* ---------- клавиши, клики, свайпы ---------- */
  let num = '';
  addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'я')) { Ink.undo(); e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(k)) { num += k; return; }
    if (k === 'Enter' && num) { go(+num - 1); num = ''; return; }
    num = '';
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': case 'Enter': next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': prev(); break;
      case 'Home': go(0); break; case 'End': go(slides.length - 1); break;
      case 'p': case 'з': Ink.set(Ink.tool === 'pen' ? 'none' : 'pen'); break;
      case 'm': case 'ь': Ink.set(Ink.tool === 'marker' ? 'none' : 'marker'); break;
      case 'e': case 'у': Ink.set(Ink.tool === 'eraser' ? 'none' : 'eraser'); break;
      case 'c': case 'с': Ink.clear(); break;
      case 'b': case 'и': Board.toggle(); break;
      case 'f': case 'а': full(); break;
      case 'o': case 'щ': overview(); break;
      case 'n': case 'т': $('#notes').classList.toggle('on'); break;
      case '?': case ',': $('#help').classList.toggle('on'); break;
      case 'Escape': if ($('#overview').classList.contains('on')) $('#overview').classList.remove('on'); else if (Board.on) Board.toggle(); else Ink.set('none'); $('#help').classList.remove('on'); break;
      default: return;
    }
    e.preventDefault();
  });
  // клик по пустому месту слайда — дальше (в режиме указателя)
  stage.addEventListener('click', e => {
    if (Ink.tool !== 'none' || Board.on) return;
    if (e.target.closest('button,input,select,label,a,[data-widget],.nonav,video')) return;
    if (getSelection && String(getSelection())) return;
    const r = stage.getBoundingClientRect();
    if ((e.clientX - r.left) / scale < W * 0.2) prev(); else next();
  });
  // свайп (только указатель, не перо)
  let sx = null, sy = 0;
  stage.addEventListener('touchstart', e => { if (Ink.tool === 'none' && e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (sx === null || Ink.tool !== 'none') return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > 2 * Math.abs(dy) && !e.target.closest('[data-widget],input')) (dx < 0 ? next : prev)();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (cur < 0) return;
    if (document.hidden) leave(slides[cur]); else enter(slides[cur]);
  });
  addEventListener('resize', fit);

  /* ---------- API для интерактивов ---------- */
  const Deck = {
    get scale() { return scale; },
    // canvas под размер элемента; возвращает ctx в координатах элемента (px сцены)
    canvas(cv) {
      const w = cv.clientWidth, h = cv.clientHeight, r = Math.min(2, Math.max(1, scale * (devicePixelRatio || 1)));
      if (cv.width !== Math.round(w * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); }
      const c = cv.getContext('2d'); c.setTransform(r, 0, 0, r, 0, 0); return { c, w, h };
    },
    point(e, el) { const b = el.getBoundingClientRect(); return [(e.clientX - b.left) / scale, (e.clientY - b.top) / scale]; },
    loop(fn) { // rAF-цикл, который можно остановить
      let id = 0, last = 0, run = false;
      const tick = t => { if (!run) return; const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t; fn(dt); id = requestAnimationFrame(tick); };
      return { start() { if (run) return; run = true; last = 0; id = requestAnimationFrame(tick); }, stop() { run = false; cancelAnimationFrame(id); } };
    },
    go, next, prev,
  };
  window.Deck = Deck;

  fit();
  const h = parseInt(location.hash.slice(1), 10);
  go(isFinite(h) ? h - 1 : 0);
  UI.sync();
})();
