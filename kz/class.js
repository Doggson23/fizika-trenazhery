/* Страница класса: всё содержимое берётся из data.json рядом со страницей (правится без программирования, формат — kz/README.md). */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // мини-разметка: **жирный**, *курсив*, [текст](ссылка)
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const TYPE = { presentation: ['Презентация', 'pres'], sheet: ['Листок', 'sheet'], hw: ['ДЗ', 'hw'], sr: ['СР', 'sheet'], test: ['Тест', 'test'], trainer: ['Тренажёр', 'trainer'], doc: ['Файл', 'sheet'], link: ['Ссылка', 'sheet'] };
  const fmtDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}.${m}`; };
  const now = new Date();
  const visible = it => !it.hidden && (!it.show_from || new Date(it.show_from) <= now);
  const file = it => { const t = TYPE[it.type] || TYPE.doc; return `<a class="f" href="${esc(it.url)}" target="_blank" rel="noopener"><span class="t ${t[1]}">${t[0]}</span>${md(it.title)}</a>`; };
  fetch('data.json?v=' + Date.now()).then(r => r.json()).then(D => {
    document.title = D.title;
    $('#title').textContent = D.title;
    $('#kicker').textContent = D.kicker || 'Физика';
    $('#upd').textContent = D.updated ? 'Обновлено ' + fmtDate(D.updated) : '';
    let h = '';
    if (D.notice) h += `<div class="notice">${md(D.notice)}</div>`;
    const hws = (D.homework || []).filter(visible);
    if (hws.length) {
      h += '<h2>Домашнее задание</h2>';
      hws.forEach((w, i) => {
        h += `<div class="card ${i === 0 ? 'hw' : ''}"><div class="due">к ${fmtDate(w.due)}</div><h3>${md(w.title)}</h3>`;
        if (w.read && w.read.length) h += `<div class="lbl">Прочитать</div><ul class="l">${w.read.map(x => `<li>${md(x)}</li>`).join('')}</ul>`;
        if (w.solve && w.solve.length) h += `<div class="lbl">Решить</div><ul class="l">${w.solve.map(x => `<li>${md(x)}</li>`).join('')}</ul>`;
        if (w.note) h += `<p>${md(w.note)}</p>`;
        const f = (w.files || []).filter(visible); if (f.length) h += `<div class="files">${f.map(file).join('')}</div>`;
        h += '</div>';
      });
    }
    const tests = (D.tests || []).filter(visible);
    if (tests.length) h += `<h2>Тренажёры и тесты</h2><div class="card">${D.tests_note ? `<p class="muted" style="margin-top:0">${md(D.tests_note)}</p>` : ''}<div class="files">${tests.map(file).join('')}</div></div>`;
    const ls = (D.lessons || []).filter(visible);
    if (ls.length) {
      h += '<h2>Материалы уроков</h2><div class="card">';
      ls.forEach(l => {
        const f = (l.files || []).filter(visible);
        h += `<div class="lesson"><div class="d">${fmtDate(l.date)}</div><div class="tp">${md(l.topic)}</div>${l.note ? `<div class="muted">${md(l.note)}</div>` : ''}${f.length ? `<div class="files">${f.map(file).join('')}</div>` : ''}</div>`;
      });
      h += '</div>';
    }
    if (D.folder) h += `<h2>Все материалы</h2><div class="card">${md(D.folder)}</div>`;
    $('#app').innerHTML = h;
  }).catch(e => { $('#app').innerHTML = '<div class="notice">Не удалось загрузить страницу. Обновите её через минуту.</div>'; console.error(e); });
})();
