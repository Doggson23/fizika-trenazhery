/* Общие помощники тренажёров главы «Законы Ньютона»: разбор ответа (запятая, дробь 4/3), сравнение с допуском,
   красивые числа для условий, счёт и серия, лесенка подсказок. Без зависимостей, кроме SC.fmt из sim-core.js. */
(function(){
  'use strict';
  const TR = {};
  TR.G = 10;
  TR.num = s => { s = String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    if (/^-?[\d.]+\/[\d.]+$/.test(s)) { const [a, b] = s.split('/').map(Number); return a / b; }
    return s === '' ? NaN : Number(s); };
  TR.close = (x, y, rel, abs) => Math.abs(x - y) <= Math.max(abs || 1e-9, (rel == null ? 0.01 : rel) * Math.abs(y));
  // число для условия задачи: целое без запятой, иначе 1–2 знака
  TR.nf = x => { const a = Math.abs(x); if (a >= 100) return SC.fmt(Math.round(x), 0); const r = a >= 10 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100; return SC.fmt(r, Number.isInteger(r) ? 0 : Math.round(r * 10) === r * 10 ? 1 : 2); };
  TR.pick = a => a[Math.floor(Math.random() * a.length)];
  TR.rnd = (lo, hi, step) => lo + step * Math.floor(Math.random() * (Math.round((hi - lo) / step) + 1));
  TR.rows = r => r.map(x => '<dt>' + x[0] + '</dt><dd' + (x[2] ? ' class="' + x[2] + '"' : '') + '>' + x[1] + '</dd>').join('');
  // счёт: элементы с id prefix+'Ok', prefix+'All', prefix+'Ser'
  TR.score = function(prefix){
    const s = {ok: 0, all: 0, ser: 0}; const $ = id => document.getElementById(prefix + id);
    s.add = good => { s.all++; if (good) { s.ok++; s.ser++; } else s.ser = 0; $('Ok').textContent = s.ok; $('All').textContent = s.all; $('Ser').textContent = s.ser; };
    return s;
  };
  // сообщение: el — .msg, kind — ok | bad | info
  TR.msg = (el, kind, html) => { el.className = 'msg ' + kind; el.innerHTML = html; };
  TR.clear = el => { el.className = 'msg'; el.innerHTML = ''; };
  window.TR = TR;
})();
