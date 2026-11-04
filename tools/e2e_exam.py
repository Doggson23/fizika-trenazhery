# e2e: новый движок против старой страницы на одинаковых ответах; мок Apps Script.
import json, subprocess, time, sys
from playwright.sync_api import sync_playwright
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8077', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
EP = 'https://script.google.com/macros/s/'
ANS = {1:'431',2:'214',3:'2',4:'1235',5:'2',6:'20',7:'2700',8:'26',9:'23',10:'2',11:'1',12:'13',13:'По инерции',14:'400',15:'90',16:'16'}
fails = []
def ok(c, msg):
    print(('PASS ' if c else 'FAIL ') + msg)
    if not c: fails.append(msg)
def mock(page, store, resp=None):
    def h(route):
        store.append(json.loads(route.request.post_data))
        route.fulfill(status=200, content_type='application/json', body=json.dumps(resp or {'ok': True, 'attempt': len(store), 'max': 5}))
    page.route(EP + '**', h)
# Полные версии Т1/Т2 (с ключами, проверка в браузере — режим client) и решения — не на сайте, а в kit/tren_site/tests_private/ на ПК учителя.
PRIV = sys.argv[1] if len(sys.argv) > 1 else r'D:\Работа\AI\kit\tren_site\tests_private'
FULL = open(os.path.join(PRIV, 'oge-kin-t2.json'), encoding='utf-8').read()
SOLS = open(os.path.join(PRIV, 'oge-kin-t2.solutions.json'), encoding='utf-8').read()
FULL1 = open(os.path.join(PRIV, 'oge-kin-t1.json'), encoding='utf-8').read()
with sync_playwright() as p:
    b0 = p.chromium.launch()
    class _B:   # у каждой страницы свой контекст (свой localStorage) и подмена Т2 на полную версию
        def new_page(self, **kw):
            c = b0.new_context(**kw)
            c.route('**/tests/oge-kin-t2.json', lambda r: r.fulfill(status=200, content_type='application/json', body=FULL))
            c.route('**/tests/oge-kin-t1.json', lambda r: r.fulfill(status=200, content_type='application/json', body=FULL1))
            c.route('**/tests/oge-kin-t2.solutions.json', lambda r: r.fulfill(status=200, content_type='application/json', body=SOLS))
            return c.new_page()
    b = _B()
    # --- старая страница
    pg = b.new_page(); old = []; mock(pg, old); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8077/oge-kinematika.html'); pg.fill('#name', 'Иванов Пётр')
    for n, a in ANS.items():
        pg.click('#nav button:nth-child(%d)' % n); pg.fill('#ans', a); pg.click('#chk')
    pg.click('#send'); pg.wait_for_timeout(500)
    ok(len(old) == 1, 'старая страница отправила 1 раз')
    # --- Т2
    pg = b.new_page(); new = []; mock(pg, new); pg.on('dialog', lambda d: d.accept())
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8077/exam.html?t=oge-kin-t2'); pg.wait_for_selector('#task-16 input')
    ok(pg.locator('section.task').count() == 16, 'Т2: 16 заданий на одной странице')
    pg.fill('#name', 'Иванов Пётр')
    for n, a in ANS.items():
        sel = '#task-%d textarea' % n if n == 13 else '#task-%d input[data-n]' % n
        pg.fill(sel, a)
    ok(pg.locator('#res tr').count() == 0, 'Т2: до сдачи результатов не видно')
    ok(pg.locator('.msg.ok, .msg.bad').count() == 0, 'Т2: до сдачи нет вердиктов')
    pg.click('#send'); pg.wait_for_selector('.modal'); ok('финальная' in pg.inner_text('.modal').lower(), 'Т2: после «Сдать» вопрос о финальной попытке')
    pg.click('.modal button[data-a="0"]'); pg.wait_for_timeout(500)
    ok(len(new) == 1, 'Т2: отправлено 1 раз')
    ok(pg.locator('.sol:not([hidden])').count() == 0, 'Т2: «Нет» — решения не открываются')
    ok(pg.locator('#task-1 input').is_disabled(), 'Т2: после сдачи поля заблокированы')
    ok(pg.locator('#res tr').count() == 17, 'Т2: после сдачи таблица результатов')
    o, n_ = old[0], new[0]
    ncols = [c for c in n_['cols'] if c['h'] != 'Финальная']
    ok(any(c['h'] == 'Финальная' and c['v'] == 'нет' for c in n_['cols']) and n_['final'] is False, 'Т2: в отправке «Финальная: нет»')
    ok(o['cols'] == ncols, 'Т2: остальные столбцы совпадают со старой страницей')
    if o['cols'] != ncols:
        for a, c in zip(o['cols'], ncols):
            if a != c: print('   old', a, '\n   new', c)
    ok(o['teacher'] == n_['teacher'] and o['scale'] == n_['scale'] and o['autoCol'] == n_['autoCol'] and o['prelimCol'] == n_['prelimCol'], 'Т2: teacher/scale/autoCol/prelimCol совпадают')
    ok(n_['sheet'] == 'ОГЭ кинематика · Т2' and n_['trainer'] == 'oge-kin-t2' and n_['max_attempts'] == 5, 'Т2: свой лист и trainer, max_attempts=5')
    # повтор отправки той же попытки — тот же id
    ok(pg.locator('#send').is_hidden(), 'Т2: после успешной отправки кнопка скрыта')
    ok(pg.locator('#again').is_visible(), 'Т2: доступна новая попытка')
    pg.click('#again'); pg.wait_for_timeout(200)
    ok(pg.locator('#task-1 input').input_value() == '' and not pg.locator('#task-1 input').is_disabled(), 'Т2: новая попытка очищает поля')
    ok(not errs, 'Т2: нет ошибок JS ' + ';'.join(errs))
    # --- Т2: сбой сети → повтор с тем же id
    pg = b.new_page(); pg.on('dialog', lambda d: d.accept()); calls = []
    def flaky(route):
        calls.append(json.loads(route.request.post_data))
        if len(calls) == 1: route.abort()
        else: route.fulfill(status=200, content_type='application/json', body='{"ok":true,"attempt":1,"max":5}')
    pg.route(EP + '**', flaky)
    pg.goto('http://localhost:8077/exam.html?t=oge-kin-t2'); pg.wait_for_selector('#task-1 input')
    pg.fill('#name', 'Петров Иван'); pg.fill('#task-3 input[data-n]', '2'); pg.click('#send'); pg.click('.modal button[data-a="0"]'); pg.wait_for_timeout(400)
    ok(pg.locator('#xMsg.bad').count() == 1 and pg.locator('#send').inner_text() == 'Отправить ещё раз', 'Т2: при сбое — «Отправить ещё раз»')
    pg.click('#send'); pg.wait_for_timeout(400)
    ok(len(calls) == 2 and calls[0]['id'] == calls[1]['id'], 'Т2: повтор с тем же id (попытка не тратится)')
    # --- Т1
    pg = b.new_page(); t1 = []; mock(pg, t1, {'ok': True, 'attempt': 1}); pg.on('dialog', lambda d: d.accept())
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8077/exam.html?t=oge-kin-t1'); pg.wait_for_selector('#task-1 input')
    pg.fill('#task-1 input[data-n]', '431')
    pg.reload(); pg.wait_for_selector('#task-1 input')
    ok(pg.locator('#task-1 input').input_value() == '431', 'Т1: ответ хранится до «Проверить» (после перезагрузки)')
    ok(pg.locator('#msg-1.ok').count() == 0, 'Т1: до проверки вердикта нет')
    pg.click('#task-1 button[data-chk]'); 
    ok(pg.locator('#msg-1.ok').count() == 1, 'Т1: «Проверить» у задания — верно')
    pg.fill('#task-1 input[data-n]', '432')
    ok('изменён' in pg.locator('#msg-1').inner_text(), 'Т1: изменённый ответ просит перепроверки')
    pg.click('#task-1 button[data-chk]'); ok(pg.locator('#msg-1.part').count() == 1, 'Т1: перепроверка — частично')
    pg.fill('#task-2 input[data-n]', '241'); pg.fill('#task-3 input[data-n]', '4')
    pg.click('button[data-chkblock="0"]')
    ok(pg.locator('#msg-2.ok').count() == 1 and pg.locator('#msg-3.bad').count() == 1, 'Т1: «Проверить часть 1» проверяет блок')
    pg.fill('#name', 'Сидорова Анна'); pg.click('#send'); pg.wait_for_timeout(300); pg.click('#send'); pg.wait_for_timeout(300)
    ok(len(t1) == 2 and t1[0]['id'] != t1[1]['id'] and t1[1]['max_attempts'] == 0, 'Т1: отправлять можно сколько угодно, у каждой отправки свой id')
    ok(not errs, 'Т1: нет ошибок JS ' + ';'.join(errs))
    # --- Т3: мягкий таймер на копии с timer
    X = json.loads(FULL); X.update(id='zz-t3-test', type='exam-mock', timer={'minutes': 1, 'mode': 'soft'})
    pg = b.new_page(); t3 = []; mock(pg, t3); pg.on('dialog', lambda d: d.accept())
    pg.route('**/tests/zz-t3-test.json', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(X)))
    pg.goto('http://localhost:8077/exam.html?t=zz-t3-test'); pg.wait_for_selector('#go')
    pg.evaluate("localStorage.clear()"); pg.click('#go'); pg.wait_for_timeout(1200)
    ok('осталось' in pg.locator('#timer').inner_text(), 'Т3: таймер идёт')
    pg.evaluate("(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('exam:zz'));const s=JSON.parse(localStorage[k]);s.t0=Date.now()-61000;localStorage[k]=JSON.stringify(s)})()")
    pg.reload(); pg.wait_for_selector('#timer'); pg.wait_for_timeout(1200)
    ok('время вышло' in pg.locator('#timer').inner_text() and not pg.locator('#task-1 input').is_disabled(), 'Т3: время вышло — предупреждение, поля открыты')
    pg.fill('#name', 'Кузнецов Олег'); pg.fill('#task-1 input[data-n]', '431'); pg.click('#send'); pg.click('.modal button[data-a="0"]'); pg.wait_for_timeout(400)
    ok(t3 and any(c['h'] == 'Время, мин' for c in t3[0]['cols']), 'Т3: в отправке есть «Время, мин»')

    # --- Т2: финальная попытка → решения, работа над ошибками, рейтинг (второй приём)
    V2 = 'https://script.google.com/macros/s/V2TEST/exec'
    pg = b.new_page(); pg.on('dialog', lambda d: d.accept()); got = []; errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body='window.TR_ENDPOINT="x";window.TR_ENDPOINT_V2="%s";' % V2))
    def v2(route):
        d = json.loads(route.request.post_data); got.append(d)
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'rating': sum(1 for g in got if g.get('kind') == 'fix' and g['done'])} if d.get('kind') == 'fix' else {'ok': True, 'attempt': 1, 'max': 5, 'final': d.get('final')}))
    pg.route(V2, v2)
    pg.goto('http://localhost:8077/exam.html?t=oge-kin-t2'); pg.wait_for_selector('#task-1 input')
    ok(pg.locator('details.ref[open]').count() == 1 and pg.evaluate("document.querySelector('details.ref').compareDocumentPosition(document.getElementById('name')) & 4") > 0, 'справочные данные вверху и раскрыты')
    pg.fill('#name', 'Орлова Мария')
    for n, a in ANS.items():
        pg.fill('#task-%d textarea' % n if n == 13 else '#task-%d input[data-n]' % n, a)
    pg.click('#send'); pg.click('.modal button[data-a="1"]'); pg.wait_for_selector('#sol-16:not([hidden]) .katex', timeout=5000)
    ok(got[0]['final'] is True and any(c['h'] == 'Финальная' and c['v'] == 'да' for c in got[0]['cols']), 'финальная: в отправке «да»')
    ok(pg.locator('.sol:not([hidden])').count() == 16, 'финальная: решения всех 16 заданий')
    ok(pg.locator('.sol .katex').count() > 5, 'формулы в решениях отрисованы KaTeX')
    wrong = [2, 8, 10, 15]   # в ANS неверные ответы
    ok(sorted(int(x) for x in pg.eval_on_selector_all('input[data-fix]', 'els => els.map(e => e.dataset.fix)')) == sorted(wrong + [13]), 'галочки только у заданий с ошибками и у объяснения (13)')
    ok(pg.locator('#send').is_hidden() and pg.locator('#again').is_hidden(), 'финальная: отправлять и начинать заново нельзя')
    pg.check('input[data-fix="8"]'); pg.wait_for_timeout(300); pg.check('input[data-fix="10"]'); pg.wait_for_timeout(300)
    fx = [g for g in got if g.get('kind') == 'fix']
    ok(len(fx) == 2 and fx[0]['n'] == 8 and fx[0]['done'] is True and fx[0]['attempt_id'] == got[0]['id'], 'галочка уходит во второй приём (kind: fix)')
    ok('мой рейтинг: 2' in pg.inner_text('#total') and 'работа над ошибками: 2/5' in pg.inner_text('#total'), 'рейтинг и счётчик работы над ошибками')
    pg.reload(); pg.wait_for_selector('#sol-1:not([hidden])')
    ok(pg.locator('input[data-fix="8"]').is_checked() and pg.locator('#task-1 input').is_disabled(), 'после перезагрузки: решения открыты, галочки на месте')
    ok(not errs, 'финальная: нет ошибок JS ' + ';'.join(errs))
    # --- последняя (5-я) попытка — финальная без вопроса
    pg = b.new_page(); pg.on('dialog', lambda d: d.accept()); last = []; mock(pg, last)
    pg.goto('http://localhost:8077/exam.html?t=oge-kin-t2'); pg.wait_for_selector('#task-1 input')
    pg.evaluate("(()=>{const k='exam:oge-kin-t2:v1';localStorage[k]=JSON.stringify({name:'Белов Ян',attempt:5,sent:[1,2,3,4]})})()"); pg.reload(); pg.wait_for_selector('#task-1 input')
    pg.fill('#task-1 input[data-n]', '431'); pg.click('#send'); pg.wait_for_timeout(600)
    ok(pg.locator('.modal').count() == 0 and last and last[0]['final'] is True and pg.locator('#sol-1:not([hidden])').count() == 1, '5-я попытка — финальная автоматически, решения открыты')
    # --- плохой адрес
    pg = b.new_page(); pg.goto('http://localhost:8077/exam.html?t=../x'); ok('Не указан' in pg.inner_text('#app'), 'защита от плохого ?t=')
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.goto('http://localhost:8077/exam.html?t=oge-kin-t2'); pg.wait_for_selector('#task-5 img')
    pg.screenshot(path='/tmp/t2-mobile.png', full_page=False)
    pg.locator('#task-10').scroll_into_view_if_needed(); pg.screenshot(path='/tmp/t2-mobile-10.png')
    b0.close()
srv.terminate()
print('\nИТОГ:', 'всё прошло' if not fails else '%d FAIL' % len(fails))
