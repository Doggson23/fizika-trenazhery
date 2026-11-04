// Движок тестов: exam.html?t=<id> читает tests/<id>.json.
// Режимы (hub/платформа_тестов.md): exam-topic = Т1 (проверка по выбору ученика),
// exam-section = Т2 (проверка после сдачи), exam-mock = Т3 (пробник, мягкий таймер).
// Отправка — тот же POST в Apps Script, что у oge-kinematika.html (поля v, id, trainer, sheet, name, cols, …).
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('app');
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const fail = msg => { app.innerHTML = '<p class="err">' + esc(msg) + '</p>'; };
  const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : (a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many); };
  const balls = n => n + ' ' + plural(n, 'балл', 'балла', 'баллов');

  const tid = (new URLSearchParams(location.search).get('t') || '').trim();
  if (!/^[a-z0-9-]{1,64}$/.test(tid)) { fail('Не указан тест. Откройте ссылку из оглавления.'); return; }
  fetch('tests/' + tid + '.json', {cache: 'no-cache'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start).catch(() => fail('Тест «' + tid + '» не найден. Проверьте ссылку.'));

  // ---------- проверка одного ответа: {pts, status: ok|part|bad|wait|none, ok?, note?} (как в oge-kinematika.html)
  const norm = s => String(s || '').trim().replace(/\s+/g, '').replace(/[.,]/g, ',');
  const num = s => { s = String(s || '').trim().replace(',', '.').replace(/\s+/g, '').replace('−', '-'); const m = s.match(/^(-?\d*\.?\d+)\/(\d*\.?\d+)$/); return m ? parseFloat(m[1]) / parseFloat(m[2]) : parseFloat(s); };
  function check(t, ans){
    ans = String(ans == null ? '' : ans);
    if (ans.trim() === '') return {pts: 0, status: 'none'};
    const k = t.kind;
    if (k === 'one') return norm(ans) === String(t.key) ? {pts: t.pts, status: 'ok'} : {pts: 0, status: 'bad'};
    if (k === 'seq') { const a = norm(ans).replace(/,/g, ''), key = String(t.key); if (a === key) return {pts: t.pts, status: 'ok'};
      if (a.length === key.length && t.pts >= 2) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== key[i]) d++; if (d === 1) return {pts: t.pts - 1, status: 'part', note: 'Одна позиция неверна — ' + (t.pts - 1) + ' из ' + t.pts + '.'}; }
      return {pts: 0, status: 'bad'}; }
    if (k === 'set') { const a = [...new Set(norm(ans).replace(/,/g, '').split(''))].sort().join(''), key = String(t.key).split('').sort().join('');
      if (a === key) return {pts: t.pts, status: 'ok'}; if (a.length > key.length) return {pts: 0, status: 'bad', note: 'Записано больше цифр, чем нужно, — 0 баллов.'};
      const hit = a.split('').filter(c => key.includes(c)).length; return hit === key.length - 1 && t.pts >= 2 ? {pts: t.pts - 1, status: 'part', note: 'Одна цифра неверна — ' + (t.pts - 1) + ' из ' + t.pts + '.'} : {pts: 0, status: 'bad'}; }
    if (k === 'num') { const v = num(ans); if (isNaN(v)) return {pts: 0, status: 'bad', note: 'Нужно число.'};
      const tol = t.tol != null ? t.tol : Math.max(0.005 * Math.abs(t.key), 1e-9); return Math.abs(v - t.key) <= tol ? {pts: t.pts, status: 'ok'} : {pts: 0, status: 'bad'}; }
    if (k === 'calc' || k === 'exp') { const v = num(ans); if (isNaN(v)) return {pts: 0, status: 'wait', note: 'Нужно число.'};
      return Math.abs(v - t.key) <= (t.tol || 0) ? {pts: t.pts, status: 'wait', ok: true, note: 'Числовой ответ верный. До ' + balls(t.pts) + ' — после проверки решения учителем.'}
        : {pts: 0, status: 'wait', ok: false, note: 'Числовой ответ не совпал с ключом. Проверьте «дано», перевод единиц и формулы; баллы за верные формулы учитель может поставить и при ошибке в счёте.'}; }
    return {pts: 0, status: 'wait'};   // text
  }
  const isAuto = t => ['one', 'seq', 'set', 'num'].includes(t.kind);

  function start(X){
    const T = [], blockOf = {};
    X.blocks.forEach((b, bi) => b.tasks.forEach(t => { T.push(t); blockOf[t.n] = bi; }));
    const byN = n => T.find(t => t.n === n);
    const hasPhoto = t => !!(t.photo || X.blocks[blockOf[t.n]].photo);
    const MODE = X.check_mode || (X.type === 'exam-topic' ? 'on_demand' : 'after_submit');
    const T1 = MODE === 'on_demand';
    const MAXATT = X.attempts || 0;                       // 0 — без ограничения
    const TIMER = X.timer && X.timer.minutes ? X.timer : null;
    const thr = (X.scale && X.scale.grades || []).slice().sort((a, b) => b[0] - a[0]);
    const GRADE = p => { for (const [min, g] of thr) if (p >= min) return g; return '2'; };
    const MAXPTS = T.reduce((a, t) => a + t.pts, 0);
    const KEY = 'exam:' + X.id + ':v' + (X.version || 1);
    // второй приём (Code_v2.gs: финальная попытка, работа над ошибками, рейтинг); пусто — прежний приём
    const V2 = (window.TR_ENDPOINT_V2 || '').trim(), ENDPOINT = V2 || (window.TR_ENDPOINT || '').trim();
    const EXAM = !T1;                                      // Т2/Т3: финальная попытка и решения
    // grading: server — ключей на странице нет: баллы, вердикты и (после финальной) решения присылает Code_v2.gs
    const SERVER = X.grading === 'server';
    const gr = (t, a) => SERVER ? ((st.res && st.res[t.n]) || {pts: 0, status: String(a == null ? '' : a).trim() ? 'wait' : 'none', note: 'Проверка — после отправки учителю.'}) : check(t, a);
    const TYPE_LABEL = {'exam-topic': 'Т1 · тренажёр по темам', 'exam-section': 'Т2 · тест по разделу', 'exam-mock': 'Т3 · пробник', 'dz': 'ДЗ'};
    document.title = X.title;

    // final — ученик назвал попытку финальной; closed — попытки закончены, открыты решения; fix — «работа над ошибками» по номерам
    let st = {name: '', a: {}, chk: {}, photos: {}, attempt: 1, id: uid(), done: false, sentOk: false, limit: false, sent: [], t0: null,
      final: false, closed: false, fix: {}, rating: null, finalId: '', res: null, sol: null};
    try { const s = localStorage.getItem(KEY); if (s) st = Object.assign(st, JSON.parse(s)); } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { flash('Не хватает места на устройстве: удалите лишние фото.', 'bad'); } };

    // ---------- статус задания для показа
    const shown = t => T1 ? (t.n in st.chk) : st.done;
    function statusOf(t){
      const a = st.a[t.n], ph = (st.photos[t.n] || []).length;
      if (!shown(t)) return (a && String(a).trim()) || ph ? 'filled' : 'none';
      const r = gr(t, T1 ? st.chk[t.n] : a);
      if (t.kind === 'text' && (a || ph)) return 'wait';
      if (r.status === 'none' && ph) return 'wait';
      return r.status;
    }
    function rows(){ return T.map(t => { const r = gr(t, st.a[t.n]);
      return {t, n: t.n, topic: t.topic, max: t.pts, ans: st.a[t.n] || '', auto: isAuto(t), pts: isAuto(t) ? r.pts : (r.ok ? t.pts : 0), ok: r.ok, status: st.done || !T1 ? statusOf(t) : statusOf(t), photos: (st.photos[t.n] || []).length}; }); }
    function totals(rs){ const p1 = rs.filter(r => r.auto).reduce((a, r) => a + r.pts, 0), p2 = rs.filter(r => !r.auto).reduce((a, r) => a + r.pts, 0); return {p1, p2, pt: p1 + p2}; }
    const maxAuto = T.filter(isAuto).reduce((a, t) => a + t.pts, 0), maxMan = MAXPTS - maxAuto;

    // ---------- каркас страницы
    const intro = X.intro ? '<p class="sub">' + X.intro + '</p>' : '';
    const how = T1 ? 'Проверка — по кнопке «Проверить» у задания или у части.' : 'Проверка — после кнопки «Сдать работу» внизу страницы.';
    const att = MAXATT ? 'Попыток: ' + MAXATT + '.' : 'Попытки не ограничены.';
    let h = '<header><div class="eyebrow">' + esc(X.eyebrow || '') + '</div><h1>' + esc(X.title) + '</h1>' + intro +
      '<p class="sub"><span class="badge">' + esc(TYPE_LABEL[X.type] || X.type) + '</span> ' + how + ' ' + att +
      (TIMER ? ' Время: ' + TIMER.minutes + ' мин (по истечении — предупреждение, сдать можно).' : '') + ' Ответы сохраняются на этом устройстве.' +
      (EXAM ? ' После сдачи вас спросят, финальная ли это попытка: после финальной откроются решения всех заданий.' : '') + '</p></header>';
    if (X.reference) h += '<section class="card"><details class="ref" open><summary>Справочные данные</summary>' + X.reference + '</details></section>';
    h += '<section class="card"><div class="field"><label for="name">Фамилия, имя</label><input id="name" autocomplete="name" placeholder="обязательно для отправки"><span></span></div>' +
      (TIMER ? '<div class="btns"><button class="b" id="go">Начать — запустить таймер</button></div>' : '') + '</section>';
    h += '<div class="sticky"><div class="row"><p class="att" id="att"></p><span class="timer" id="timer"></span></div><div class="bar"><i id="bar"></i></div><div class="nav" id="nav" aria-label="Переход к заданию"></div></div>';
    X.blocks.forEach((b, bi) => {
      h += '<div class="blockhead"><h2>' + esc(b.title) + '</h2>' + (T1 ? '<button class="b ghost" data-chkblock="' + bi + '">Проверить ' + esc(b.title.toLowerCase()) + '</button>' : '') + '</div>';
      if (b.hint) h += '<p class="foot">' + esc(b.hint) + '</p>';
      b.tasks.forEach(t => { h += '<section class="card task" id="task-' + t.n + '"></section>'; });
    });
    h += '<section class="card" id="resCard"><h2>Результат</h2><div class="total" id="total"></div><p class="foot" id="scaleNote"></p>' +
      '<div class="btns"><button class="b" id="send"></button><button class="b" id="again" hidden>Начать новую попытку</button><button class="b ghost" id="dlHtml">Скачать отчёт</button></div>' +
      '<div class="msg" id="xMsg" role="status" aria-live="polite"></div><table class="res" id="res"></table></section>';
    if (X.links && X.links.length) h += '<section class="card"><h2>Ещё потренироваться</h2><ul>' + X.links.map(l => '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + '</a>' + (l.note ? ' — ' + esc(l.note) : '') + '</li>').join('') + '</ul></section>';
    app.innerHTML = h;
    const flash = (text, cls) => { const m = $('xMsg'); m.className = 'msg ' + (cls || 'info'); m.textContent = text; };

    // ---------- одно задание
    function renderTask(t){
      const el = $('task-' + t.n), a = st.a[t.n] || '', locked = st.done || st.limit;
      let s = '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h2>Задание ' + t.n + '</h2><span class="pts">' + balls(t.pts) + ' · ' + esc(t.topic || '') + '</span></div>';
      s += t.text;
      if (t.ref) s += '<p class="foot"><b>Справочно:</b> ' + t.ref + '</p>';
      if (t.fig) s += '<div class="fig"><img src="' + esc(t.fig) + '" alt="рисунок к заданию ' + t.n + '" loading="lazy"></div>';
      if (t.kind === 'text') s += '<div class="field" style="grid-template-columns:1fr"><textarea data-n="' + t.n + '" placeholder="Краткий ответ в одну-две фразы (полное объяснение — на листе, фото ниже)"' + (locked ? ' disabled' : '') + '>' + esc(a) + '</textarea></div>';
      else { const ph = t.kind === 'seq' ? ('цифры: ' + (t.lab || '')) : t.kind === 'set' ? 'цифры ответа' : t.kind === 'one' ? 'номер ответа' : 'число';
        const dec = ['num', 'calc', 'exp'].includes(t.kind);
        s += '<div class="field"><label for="ans-' + t.n + '">Ответ:</label><input id="ans-' + t.n + '" data-n="' + t.n + '" inputmode="' + (dec ? 'decimal' : 'numeric') + '" autocomplete="off" placeholder="' + ph + '" value="' + esc(a) + '"' + (locked ? ' disabled' : '') + '><span>' + esc(t.unit || '') + '</span></div>'; }
      if (hasPhoto(t)) { s += '<label class="upload">📷 Приложить фото решения<input type="file" data-photo="' + t.n + '" accept="image/*" multiple capture="environment"' + (locked ? ' disabled' : '') + '></label><div class="photos" id="photos-' + t.n + '"></div>'; }
      if (T1 && !locked) s += '<div class="btns"><button class="b" data-chk="' + t.n + '">' + (hasPhoto(t) || !isAuto(t) ? 'Сохранить и проверить ответ' : 'Проверить') + '</button></div>';
      if (t.source && (t.source.rights || t.source.url)) s += '<p class="src">Источник: ' + esc(t.source.rights || '') + (t.source.number ? ', задание ' + esc(t.source.number) : '') + (t.source.url ? ' · <a href="' + esc(t.source.url) + '" target="_blank" rel="noopener">ссылка</a>' : '') + '</p>';
      s += '<div class="msg" id="msg-' + t.n + '" role="status" aria-live="polite"></div><div class="sol" id="sol-' + t.n + '" hidden></div>';
      el.innerHTML = s;
      if (hasPhoto(t)) renderPhotos(t.n);
      showMsg(t);
      if (st.closed) renderSol(t);
    }

    // ---------- решения после финальной попытки + «Выполнил работу над ошибками»
    let SOL = null;
    const keyText = t => t.kind === 'text' || t.key == null ? 'см. решение' : String(t.key) + (t.unit ? ' ' + t.unit : '');
    const needsFix = t => { const r = gr(t, st.a[t.n]); return !(r.status === 'ok' || r.ok === true); };
    function renderSol(t){
      const box = $('sol-' + t.n); if (!box) return;
      const s = SOL && ((t.tid && SOL[t.tid]) || SOL[t.n]);
      let h = '<p><b>Ваш ответ:</b> ' + (st.a[t.n] ? esc(st.a[t.n]) : '—') + ' · <b>верный ответ:</b> ' + esc(s && s.answer || keyText(t)) + '</p>';
      h += s && s.html ? '<div class="solbody"><b>Решение.</b> ' + s.html + '</div>' : '<p class="foot">Решение к этому заданию учитель ещё не добавил.</p>';
      if (needsFix(t)) h += '<label class="fix"><input type="checkbox" data-fix="' + t.n + '"' + (st.fix[t.n] ? ' checked' : '') + '> Выполнил работу над ошибками</label>';
      box.innerHTML = h; box.hidden = false;
    }
    async function openSolutions(){
      if (SERVER) SOL = st.sol || {};
      else try { const r = await fetch('tests/' + X.id + '.solutions.json', {cache: 'no-cache'}); SOL = r.ok ? (await r.json()).solutions : {}; } catch (e) { SOL = {}; }
      T.forEach(renderSol); renderRes(); typeset();
    }
    function typeset(){
      const run = () => window.renderMathInElement && renderMathInElement(app, {delimiters: [{left: '$', right: '$', display: false}], throwOnError: false});
      if (window.renderMathInElement) return run();
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'assets/katex/katex.min.css'; document.head.appendChild(css);
      const a = document.createElement('script'); a.src = 'assets/katex/katex.min.js';
      a.onload = () => { const b = document.createElement('script'); b.src = 'assets/katex/auto-render.min.js'; b.onload = run; document.head.appendChild(b); };
      document.head.appendChild(a);
    }
    async function sendFix(n, done){
      st.fix[n] = done; if (!done) delete st.fix[n]; save(); renderRes();
      if (!V2) return;                                   // прежний приём не знает kind:'fix' — копим на устройстве
      try { const r = await (await fetch(V2, {method: 'POST', body: JSON.stringify({v: 2, kind: 'fix', trainer: X.trainer || X.id, sheet: X.sheet || X.title, title: X.title, name: st.name.trim(), n, done, attempt_id: st.finalId}), redirect: 'follow'})).json();
        if (r.ok && r.rating != null) { st.rating = r.rating; save(); renderRes(); } else if (!r.ok) flash('Отметка не сохранилась у учителя (' + (r.error || 'ошибка') + '). Нажмите галочку ещё раз.', 'bad');
      } catch (e) { flash('Нет связи: отметка сохранится у учителя, когда вы нажмёте галочку ещё раз с интернетом.', 'bad'); }
    }
    function showMsg(t){
      const m = $('msg-' + t.n); if (!m) return;
      if (!shown(t)) { m.className = 'msg'; return; }
      const a = T1 ? st.chk[t.n] : st.a[t.n], r = gr(t, a), ph = (st.photos[t.n] || []).length;
      if (T1 && String(st.a[t.n] || '') !== String(st.chk[t.n] || '')) { m.className = 'msg info'; m.textContent = 'Ответ изменён после проверки — нажмите «Проверить» ещё раз.'; return; }
      if (!a && !ph) { m.className = 'msg'; return; }
      if (t.kind === 'text') { m.className = 'msg info'; m.textContent = 'Сохранено. Объяснение проверит учитель по фото (до ' + balls(t.pts) + ').'; return; }
      if (r.status === 'wait') { m.className = 'msg ' + (r.ok ? 'info' : 'part'); m.textContent = r.note || 'Сохранено, ждёт проверки учителя.'; return; }
      if (r.status === 'none') { m.className = 'msg info'; m.textContent = 'Ответа нет, есть фото — проверит учитель.'; return; }
      m.className = 'msg ' + r.status;
      m.textContent = r.status === 'ok' ? 'Верно! ' + balls(r.pts) + '.' : (r.status === 'part' ? r.note : 'Неверно. ' + (r.note || (T1 ? 'Перечитайте условие — ответ можно исправить и проверить снова.' : '')));
    }

    // ---------- фото: сжимаем до 1280 px по длинной стороне, JPEG 0.8 (как в oge-kinematika.html)
    function addPhotos(n, files){
      const room = 4 - (st.photos[n] || []).length; if (room <= 0) { const m = $('msg-' + n); m.className = 'msg info'; m.textContent = 'К заданию можно приложить не больше 4 фото.'; return; }
      [...files].slice(0, room).forEach(f => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
        const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); (st.photos[n] = st.photos[n] || []).push(c.toDataURL('image/jpeg', 0.8)); save(); renderPhotos(n); refresh(); }; im.src = r.result; }; r.readAsDataURL(f); });
    }
    function renderPhotos(n){
      const box = $('photos-' + n); if (!box) return; box.innerHTML = '';
      (st.photos[n] || []).forEach((src, i) => { const f = document.createElement('figure'); f.innerHTML = '<img src="' + src + '" alt="фото решения ' + (i + 1) + '"><button aria-label="удалить фото">×</button>';
        const b = f.querySelector('button'); if (st.done) b.hidden = true; b.addEventListener('click', () => { if (st.done) return; st.photos[n].splice(i, 1); save(); renderPhotos(n); refresh(); }); box.appendChild(f); });
    }

    // ---------- навигация, итог
    function renderNav(){
      const nav = $('nav'); nav.innerHTML = ''; let done = 0;
      T.forEach(t => { const b = document.createElement('button'), s = statusOf(t); b.textContent = t.n;
        if (s !== 'none') { b.className = s; done++; }
        if (T1 && (t.n in st.chk) && String(st.a[t.n] || '') !== String(st.chk[t.n] || '')) b.classList.add('edited');
        b.addEventListener('click', () => $('task-' + t.n).scrollIntoView({behavior: 'smooth', block: 'start'})); nav.appendChild(b); });
      $('bar').style.width = (100 * done / T.length) + '%';
    }
    const SW = {ok: 'верно', part: 'частично', bad: 'неверно', wait: 'к проверке', none: '—', filled: 'дан ответ'};
    function renderRes(){
      const rs = rows(), tt = totals(rs), show = T1 || st.done;
      const filled = rs.filter(r => r.ans || r.photos).length;
      $('total').innerHTML = show
        ? '<span>авто: <b>' + tt.p1 + '</b>/' + maxAuto + '</span>' + (maxMan ? '<span>к проверке учителем (по ответам): <b>' + tt.p2 + '</b>/' + maxMan + '</span>' : '') + '<span>итого: <b>' + tt.pt + '</b>/' + MAXPTS + '</span><span>отметка: <b>' + (thr.length ? GRADE(tt.pt) : '—') + '</b></span>'
        : '<span>заполнено: <b>' + filled + '</b> из ' + T.length + '</span>';
      if (st.closed) { const need = T.filter(needsFix).length, did = T.filter(t => needsFix(t) && st.fix[t.n]).length;
        $('total').innerHTML += '<span>работа над ошибками: <b>' + did + '</b>/' + need + '</span>' + (st.rating != null ? '<span>мой рейтинг: <b>' + st.rating + '</b></span>' : ''); }
      $('scaleNote').textContent = show ? ((maxMan ? 'Баллы за развёрнутые ответы здесь предварительные (по числовому ответу); окончательные ставит учитель по фото решения. ' : '') + (X.scale && X.scale.note || '')) + (T1 ? ' В итоге — все ответы в полях, проверенные и нет.' : '')
        : 'Результат появится после сдачи работы.';
      $('res').innerHTML = show ? '<tr><th>№</th><th>Тема</th><th>Ответ</th><th>Статус</th><th>Баллы</th></tr>' + rs.map(r => '<tr><td class="n">' + r.n + '</td><td>' + esc(r.topic) + '</td><td>' + (r.ans ? esc(String(r.ans).slice(0, 60)) : '—') + (r.photos ? ' 📷' + r.photos : '') + '</td><td>' + SW[statusOf(r.t)] + '</td><td class="n">' + r.pts + '/' + r.max + '</td></tr>').join('') : '';
    }
    function renderAtt(){
      const n = st.sent.length;
      $('att').textContent = st.closed ? 'Попытки закончены: финальной стала попытка ' + st.attempt + '. Ниже — решения и работа над ошибками' : st.limit ? 'Все ' + MAXATT + ' попыток использованы' : MAXATT ? ('Попытка ' + st.attempt + ' из ' + MAXATT + (st.done ? (st.sentOk ? ' · отправлена' : ' · сдана, не отправлена') : '')) : (n ? 'Отправлено учителю: ' + n : 'Тренировка');
      const send = $('send');
      if (T1) { send.textContent = 'Отправить учителю'; send.hidden = false; }
      else { send.textContent = st.done ? 'Отправить ещё раз' : 'Сдать работу'; send.hidden = (st.done && st.sentOk) || st.closed; }
      $('again').hidden = T1 || st.closed || st.final || !st.done || !(st.sentOk || !ENDPOINT) || st.limit || (MAXATT && st.attempt >= MAXATT);
      $('name').disabled = (!T1 && st.done) || (MAXATT > 0 && n > 0);
      if ($('go')) $('go').hidden = !!st.t0;
    }
    function refresh(){ renderNav(); renderRes(); renderAtt(); }
    function renderAll(){ T.forEach(renderTask); refresh(); tick(); if (st.closed && SOL) typeset(); }
    function closeAttempts(){ st.closed = true; st.final = true; save(); renderAll(); openSolutions(); }
    // модальный вопрос с двумя кнопками (confirm() не даёт подписать кнопки)
    function ask(title, text, yes, no){ return new Promise(res => { const d = document.createElement('div'); d.className = 'modal';
      d.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-labelledby="askT"><h2 id="askT">' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="btns"><button class="b" data-a="1">' + esc(yes) + '</button><button class="b ghost" data-a="0">' + esc(no) + '</button></div></div>';
      d.addEventListener('click', e => { const a = e.target.dataset.a; if (a != null) { d.remove(); res(a === '1'); } }); document.body.appendChild(d); d.querySelector('button').focus(); }); }

    // ---------- мягкий таймер
    function tick(){
      if (!TIMER) return; const el = $('timer');
      if (!st.t0) { el.textContent = 'таймер: ' + TIMER.minutes + ' мин'; return; }
      const left = TIMER.minutes * 60 - Math.floor((Date.now() - st.t0) / 1000), a = Math.abs(left);
      const f = x => String(x).padStart(2, '0'), txt = Math.floor(a / 3600) + ':' + f(Math.floor(a % 3600 / 60)) + ':' + f(a % 60);
      if (st.done) { el.textContent = 'затрачено ' + elapsedMin() + ' мин'; el.className = 'timer'; return; }
      el.textContent = left >= 0 ? 'осталось ' + txt : 'время вышло (+' + txt + ') — сдайте работу'; el.className = 'timer' + (left < 0 ? ' over' : '');
    }
    const elapsedMin = () => st.t0 ? Math.round(((st.doneAt || Date.now()) - st.t0) / 60000) : '';
    if (TIMER) setInterval(tick, 1000);
    const startTimer = () => { if (TIMER && !st.t0 && !st.done) { st.t0 = Date.now(); save(); tick(); renderAtt(); } };

    // ---------- события
    app.addEventListener('input', e => { const n = +e.target.dataset.n; if (!n || st.done) return; st.a[n] = e.target.value; startTimer(); save(); renderNav(); renderRes(); if (T1) showMsg(byN(n)); });
    app.addEventListener('keydown', e => { const n = +e.target.dataset.n; if (n && e.key === 'Enter' && T1 && e.target.tagName === 'INPUT') { doCheck([n]); } });
    app.addEventListener('change', e => { const n = +e.target.dataset.photo; if (n && !st.done) { startTimer(); addPhotos(n, e.target.files); }
      const f = +e.target.dataset.fix; if (f && st.closed) sendFix(f, e.target.checked); });
    app.addEventListener('click', e => {
      const c = e.target.dataset.chk, cb = e.target.dataset.chkblock;
      if (c) doCheck([+c]);
      if (cb != null) doCheck(X.blocks[+cb].tasks.map(t => t.n));
    });
    async function doCheck(ns){
      let empty = 0; const go = [];
      ns.forEach(n => { const v = st.a[n] || ''; if (!String(v).trim() && !(st.photos[n] || []).length) { empty++; return; } go.push(n); });
      if (SERVER && go.length) {                         // ключей на странице нет — спрашиваем сервер, он ничего не записывает
        if (!V2) { flash('Проверка ответов работает через сервер учителя, а он пока не подключён.', 'bad'); return; }
        go.forEach(n => { const m = $('msg-' + n); if (m) { m.className = 'msg info'; m.textContent = 'Проверяю…'; } });
        try { const r = await (await fetch(V2, {method: 'POST', body: JSON.stringify(Object.assign({v: 2, kind: 'check', trainer: X.trainer || X.id, answers: Object.fromEntries(go.map(n => [n, st.a[n] || '']))}, tidMaps(go))), redirect: 'follow'})).json();
          if (!r.ok) throw new Error(r.error); st.res = Object.assign(st.res || {}, r.results);
        } catch (e) { go.forEach(n => { const m = $('msg-' + n); if (m) { m.className = 'msg bad'; m.textContent = 'Нет связи с сервером — проверьте интернет и нажмите «Проверить» ещё раз.'; } }); return; }
      }
      go.forEach(n => { st.chk[n] = st.a[n] || ''; showMsg(byN(n)); });
      save(); refresh();
      if (ns.length === 1 && empty) { const m = $('msg-' + ns[0]); m.className = 'msg info'; m.textContent = 'Сначала введите ответ.'; }
    }
    if ($('go')) $('go').addEventListener('click', startTimer);
    $('name').value = st.name || ''; $('name').addEventListener('input', () => { st.name = $('name').value; save(); });

    // ---------- отчёт файлом (запасной путь без сети)
    const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
    function reportHtml(){
      const rs = rows(), tt = totals(rs);
      const tr = rs.map(r => '<tr><td>' + r.n + '</td><td>' + esc(r.topic) + '</td><td>' + esc(r.ans || '—') + '</td><td>' + SW[statusOf(r.t)] + '</td><td>' + (r.auto ? r.pts : (r.pts ? r.pts + ' (по ответу)' : '0')) + '/' + r.max + '</td>' +
        (!r.auto ? '<td><input type="number" min="0" max="' + r.max + '" data-n="' + r.n + '" value="' + (r.pts || '') + '" style="width:3.5em"></td>' : '<td>' + r.pts + '</td>') + '</tr>').join('');
      const ph = T.filter(hasPhoto).map(t => (st.photos[t.n] || []).length ? '<h3>Задание ' + t.n + ' — ' + esc(t.topic) + (st.a[t.n] ? ' · ответ: ' + esc(st.a[t.n]) : '') + '</h3>' + st.photos[t.n].map(s => '<img src="' + s + '">').join('') : '').join('');
      const g = JSON.stringify(thr);
      return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Отчёт · ' + esc(st.name) + '</title>' +
        '<style>body{font:15px/1.45 system-ui,sans-serif;max-width:900px;margin:16px auto;padding:0 12px;color:#0B3C5D}table{border-collapse:collapse;width:100%}td,th{border:1px solid #BFD7E6;padding:4px 7px;font-size:14px;vertical-align:top}th{background:#EAF5FC}img{max-width:100%;border:1px solid #BFD7E6;border-radius:8px;margin:6px 0}h3{margin:18px 0 4px}.tot{font-weight:700}</style></head><body>' +
        '<h1>' + esc(X.title) + ' · отчёт</h1><p><b>' + esc(st.name || 'без имени') + '</b> · ' + stamp() + ' · попытка ' + st.attempt + (TIMER && st.t0 ? ' · ' + elapsedMin() + ' мин' : '') + '</p>' +
        '<table><tr><th>№</th><th>Тема</th><th>Ответ</th><th>Статус</th><th>Баллы (авто)</th><th>Баллы учителя</th></tr>' + tr +
        '<tr class="tot"><td colspan="4">Авто</td><td>' + tt.p1 + '/' + maxAuto + '</td><td>' + tt.p1 + '</td></tr><tr class="tot"><td colspan="4">Учитель</td><td>' + tt.p2 + '/' + maxMan + ' (предв.)</td><td id="s2">' + tt.p2 + '</td></tr>' +
        '<tr class="tot"><td colspan="4">Итого / отметка</td><td>' + tt.pt + '/' + MAXPTS + ' · «' + GRADE(tt.pt) + '»</td><td id="s3">' + tt.pt + ' · «' + GRADE(tt.pt) + '»</td></tr></table>' +
        '<p>Учитель: впишите баллы в последний столбец — итог и отметка пересчитаются.</p>' +
        '<script>var P1=' + tt.p1 + ',G=' + g + ';function gr(t){for(var i=0;i<G.length;i++)if(t>=G[i][0])return G[i][1];return"2"}document.querySelectorAll("input[data-n]").forEach(function(i){i.addEventListener("input",function(){var s=0;document.querySelectorAll("input[data-n]").forEach(function(x){s+=+x.value||0});var t=P1+s;document.getElementById("s2").textContent=s;document.getElementById("s3").textContent=t+" · «"+gr(t)+"»"})});<\/script>' +
        (ph ? '<h2>Фото решений</h2>' + ph : '<p>Фото решений не приложены.</p>') + '</body></html>';
    }
    const TL = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
    const lat = s => (s || 'uchenik').toLowerCase().split('').map(ch => TL[ch] !== undefined ? TL[ch] : ch).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'uchenik';
    $('dlHtml').addEventListener('click', () => { const b = new Blob([reportHtml()], {type: 'text/html;charset=utf-8'}), u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = X.id + '-otchet-' + lat(st.name) + '-p' + st.attempt + '.html'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 1000); });

    // ---------- отправка: тот же протокол, что у oge-kinematika.html (Code.gs 2026-11-04b)
    function payload(){
      const rs = rows(), tt = totals(rs);
      const cols = [['Часть 1 (авто)', tt.p1], ['Часть 2 (предв.)', tt.p2], ['Предв. итог', tt.pt], ['Предв. отметка', GRADE(tt.pt)]];
      if (EXAM) cols.push(['Финальная', st.final ? 'да' : 'нет']);
      if (TIMER) cols.push(['Время, мин', elapsedMin()]);
      rs.forEach(r => cols.push(['№' + r.n, (r.ans || '—') + (r.auto ? ' · ' + r.pts + '/' + r.max : (r.ans && (r.t.kind === 'calc' || r.t.kind === 'exp') ? (r.ok ? ' · ответ верный' : ' · ответ не совпал') : '')) + (r.photos ? ' · фото ' + r.photos : '')]));
      const photos = {}; T.filter(hasPhoto).forEach(t => { if ((st.photos[t.n] || []).length) photos[t.n] = st.photos[t.n]; });
      return {v: 1, id: st.id, trainer: X.trainer || X.id, sheet: X.sheet || X.title, name: st.name.trim(), client_attempt: st.attempt,
        type: X.type, check_mode: MODE, max_attempts: MAXATT, final: !!st.final, test: X.id, answers: st.a, ...tidMaps(),
        cols: cols.map(c => ({h: c[0], v: c[1]})), autoCol: 'Часть 1 (авто)', prelimCol: 'Предв. итог',
        teacher: T.filter(t => !isAuto(t)).map(t => ({h: '№' + t.n + ' учитель', max: t.pts})),
        scale: thr.map(x => x[0]).sort((a, b) => a - b), photos};
    }
    // tid — устойчивый id задания: сервер ищет ключ по нему, номер n — только порядок на странице
    function tidMaps(ns){ const at = {}, order = {}; T.forEach(t => { if (!t.tid) return; order[t.tid] = t.n; if (!ns || ns.includes(t.n)) at[t.tid] = st.a[t.n] || ''; }); return Object.keys(order).length ? {answers_tid: at, order} : {}; }
    const hasAny = () => Object.keys(st.a).some(k => String(st.a[k]).trim()) || Object.keys(st.photos).some(k => st.photos[k].length);
    $('send').addEventListener('click', async () => {
      if ((st.name || '').trim().split(/\s+/).filter(Boolean).length < 2) { flash('Впишите фамилию и имя (вверху страницы) — без них ответы не дойдут до учителя.', 'bad'); $('name').focus(); return; }
      if (!hasAny()) { flash('Пока нет ни одного ответа.', 'bad'); return; }
      if (!T1 && !st.done) {
        const left = T.filter(t => !(st.a[t.n] && String(st.a[t.n]).trim()) && !(st.photos[t.n] || []).length).map(t => t.n);
        if (!confirm('Сдать работу' + (MAXATT ? ' (попытка ' + st.attempt + ' из ' + MAXATT + ')' : '') + '?' + (left.length ? ' Без ответа: ' + left.join(', ') + '.' : '') + ' После сдачи ответы изменить нельзя.')) return;
        const last = MAXATT && st.attempt >= MAXATT;
        st.final = last ? true : await ask('Это ваша финальная попытка?',
          'Если «Да» — больше попыток не будет: откроются решения всех заданий, и вы сможете сделать работу над ошибками. Если «Нет» — после отправки можно начать новую попытку' + (MAXATT ? ' (осталось ' + (MAXATT - st.attempt) + ')' : '') + '.',
          'Да, финальная', 'Нет, буду ещё пробовать');
        if (st.final) st.finalId = st.id;
        st.done = true; st.doneAt = Date.now(); save(); renderAll();
        $('resCard').scrollIntoView({behavior: 'smooth', block: 'start'});
      } else if (T1 && !confirm('Отправить учителю текущие ответы?')) return;
      if (!ENDPOINT) { flash('Отправка пока не настроена. Нажмите «Скачать отчёт» и пришлите файл учителю.', 'info'); if (st.final && !SERVER) closeAttempts(); return; }
      const btn = $('send'); btn.disabled = true; btn.textContent = 'Отправляю…'; flash('Отправляю ответы' + (Object.keys(st.photos).some(k => st.photos[k].length) ? ' и фото' : '') + '…', 'info');
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 90000);
      try {
        const res = await fetch(ENDPOINT, {method: 'POST', body: JSON.stringify(payload()), signal: ctl.signal, redirect: 'follow'}), r = await res.json();
        if (r.results) st.res = r.results; if (r.solutions) st.sol = r.solutions;
        if (SERVER && r.ok && !r.results) flash('Ответы отправлены, но проверка на сервере не подключена — баллы посчитает учитель.', 'info');
        if (r.ok) {
          st.attempt = r.attempt || st.attempt; st.sent.push({attempt: st.attempt, at: new Date().toISOString(), pt: totals(rows()).pt});
          if (MAXATT && r.max && r.attempt >= r.max) st.limit = true;
          if (T1) { st.attempt += 1; st.id = uid(); flash('Готово: ответы отправлены учителю. Можно тренироваться дальше.', 'ok'); }
          else { st.sentOk = true; flash('Готово: попытка ' + st.attempt + ' отправлена учителю.' + (st.final ? ' Попытка финальная — ниже решения всех заданий.' : (MAXATT ? ' Можно начать новую — осталось ' + (MAXATT - st.attempt) + '.' : '')), 'ok'); }
          save(); if (st.final) closeAttempts();
        } else if (r.error === 'final') { st.done = true; st.final = true; save(); flash('Для «' + st.name.trim() + '» финальная попытка уже отправлена — больше отправлять нельзя.', 'bad'); closeAttempts(); }
        else if (r.error === 'limit') { st.done = true; st.limit = true; save(); flash('Для «' + st.name.trim() + '» уже отправлено ' + r.used + ' попыток из ' + r.max + '. Больше отправлять нельзя.', 'bad'); if (EXAM) closeAttempts(); }
        else if (r.error === 'name') flash('Проверьте фамилию и имя.', 'bad');
        else flash('Не получилось отправить (' + (r.error || 'ошибка') + '). Попробуйте ещё раз или нажмите «Скачать отчёт».', 'bad');
      } catch (e) { flash('Нет связи с сервером. Проверьте интернет и нажмите кнопку ещё раз — повтор не съест попытку.', 'bad'); }
      finally { clearTimeout(timer); btn.disabled = false; renderAll(); }
    });
    $('again').addEventListener('click', () => {
      if (st.limit || (MAXATT && st.attempt >= MAXATT)) return;
      if (!confirm('Начать попытку ' + (st.attempt + 1) + (MAXATT ? ' из ' + MAXATT : '') + '? Ответы и фото прошлой попытки сотрутся с этого устройства (у учителя они сохранены).')) return;
      st = Object.assign(st, {a: {}, chk: {}, photos: {}, attempt: st.attempt + 1, id: uid(), done: false, sentOk: false, t0: null, doneAt: null, res: null}); save(); $('xMsg').className = 'msg'; renderAll(); window.scrollTo({top: 0});
    });

    renderAll();
    if (st.closed) openSolutions();
  }
})();
