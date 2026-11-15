// Autocheck in the page (pilot 15.11): setting «Автопроверка», the verdict card and what it does to the self-grade.
// Phone 390×844 and desktop 1440×900, classic and html.next. Off by default: without the setting nothing changes.
'use strict';
const { Suite, launch, openPage, rafRate, docOverflow } = require('./lib');
const { phoneUi, desktopUi, seed, ls } = require('./ui');

const KEY3 = 'guard let id else { return nil }\nreturn "/users/\\(id)"';
const A = {   // answers to opt, step 3 «Ранний выход» (index 2)
  ok: 'guard let userId = id else { return nil }\nreturn "/users/\\(userId)"',   // own name, long form — a verified variant
  no: 'return "/users/\\(id!)"',
  miss: 'guard let id else { return nil }\nreturn "users"',
  near: 'guard let id else { return nil }\nreturn "/user/\\(id)"',
};

async function scenario(s, b, ui, theme) {
  const tag = `${ui.name}/${theme}`;
  const { ctx, page, errors } = await openPage(b, s, ui.ctx, ui.hash);
  const js = (fn, arg) => page.evaluate(fn, arg);
  await js(t => { localStorage.clear(); localStorage.setItem('syn.theme', t); }, theme); await page.reload(); await ui.ready(page);
  await s.check(`${tag}: the theme is the one under test`, await js(() => document.documentElement.classList.contains('next')) === (theme === 'next'));
  const wipe = () => js(() => { for (const k of Object.keys(localStorage)) if (/^pm\.(seen|grade|steps|ans|redo|rans|recall|back|err|bank|bankAns|chk)\b/.test(k)) localStorage.removeItem(k); });
  const step = async (id, k, answer, how) => { await wipe(); await ui.open(page, id);
    await js(() => document.getElementById('tab-practice').click()); await page.waitForTimeout(350);
    await js(k => document.querySelector(`.rung[data-step="${k}"]`).click(), k); await page.waitForTimeout(250);
    if (answer != null) { await page.fill('#ans', answer); await page.waitForTimeout(80); }
    await js(h => { document.getElementById('ans').blur(); document.getElementById(h).click(); }, how || 'showKey'); await page.waitForTimeout(450); };
  const card = () => js(() => { const a = document.getElementById('ack'), d = id => { const b = document.getElementById(id); return b ? b.disabled : null; };
    return { v: a ? a.dataset.v : null, why: a ? a.dataset.why : null, text: a ? a.innerText : '', n: document.querySelectorAll('#ack').length, qs: a ? a.querySelectorAll('.ack-q').length : 0,
      ok: d('okBtn'), part: d('partBtn'), no: d('noBtn'), lock: (document.getElementById('ackLock') || {}).textContent || '' }; });
  const answer = (i, a) => js(([i, a]) => document.querySelector(`.ack-q[data-q="${i}"] [data-a="${a}"]`).click(), [i, a]);
  const press = id => js(id => document.getElementById(id).click(), id);

  // --- off by default: the page behaves as before
  await s.check(`${tag}: the setting is off by default`, await ls(page, 'pm.autocheck') == null && /ВЫКЛ/.test(await js(() => document.getElementById('ackBtn').textContent)));
  await step('opt', 2, A.no);
  let c = await card();
  await s.check(`${tag}: off — no verdict card, the grade buttons are open`, c.v === null && c.ok === false && c.part === false && c.no === false, c);
  await press('okBtn'); await page.waitForTimeout(250);
  await s.check(`${tag}: off — «ВСПОМНИЛ» is recorded as before`, ((await ls(page, 'pm.grade.opt')) || {}).s3 === 'ok');

  // --- on
  await js(() => document.getElementById('ackBtn').click());
  await s.check(`${tag}: the settings button turns it on and says so`, await ls(page, 'pm.autocheck') === true && /АВТОПРОВЕРКА: ВКЛ/.test(await js(() => document.getElementById('ackBtn').textContent)));

  await step('opt', 2, A.ok); c = await card();
  await s.check(`${tag}: a right answer in other words → «ВЕРНО», all grades open`, c.v === 'ok' && c.n === 1 && /ВЕРНО/.test(c.text) && c.ok === false && c.part === false, c);
  await s.check(`${tag}: «верно» reminds that the explanation is not judged`, /Пояснение/.test(c.text), c.text);
  await s.check(`${tag}: the card fits the screen`, (o => o.sw <= o.cw + 1)(await docOverflow(page)) && await js(() => { const r = document.getElementById('ack').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1 && r.width > 200; }));
  await press('okBtn'); await page.waitForTimeout(250);
  await s.check(`${tag}: after «верно» the grade is still the learner's press`, ((await ls(page, 'pm.grade.opt')) || {}).s3 === 'ok');

  await step('opt', 2, A.no); c = await card();
  await s.check(`${tag}: a known mistake → «НЕВЕРНО» with the mentor's note`, c.v === 'no' && /Force unwrap/.test(c.text), c);
  await s.check(`${tag}: «неверно» closes «ВСПОМНИЛ» and leaves the other two`, c.ok === true && c.part === false && c.no === false && /закрыто/.test(c.lock), c);
  await press('okBtn'); await page.waitForTimeout(200);   // a scripted click on a disabled button, and the guard inside mark()
  await js(() => { const b = document.getElementById('okBtn'); b.disabled = false; b.click(); }); await page.waitForTimeout(250);
  await s.check(`${tag}: a closed «ВСПОМНИЛ» cannot be forced`, !((await ls(page, 'pm.grade.opt')) || {}).s3 && await js(() => !!document.getElementById('ack')));
  await press('ackDispute'); c = await card();
  await s.check(`${tag}: «ПРОВЕРКА ОШИБЛАСЬ» opens the grade and says the dispute is logged`, c.ok === false && /Спор записан/.test(c.lock), c);
  await press('ackDispute'); c = await card();
  await s.check(`${tag}: the dispute can be taken back`, c.ok === true, c);
  await press('partBtn'); await page.waitForTimeout(250);
  await s.check(`${tag}: «ЧАСТИЧНО» after «неверно» is recorded`, ((await ls(page, 'pm.grade.opt')) || {}).s3 === 'part');

  await step('opt', 2, A.miss); c = await card();
  await s.check(`${tag}: a missing sign → «ПРОВЕРЬ» with a question, not a sentence`, c.v === 'check' && c.qs >= 1 && /\?/.test(c.text) && !/НЕВЕРНО/.test(c.text), c);
  await s.check(`${tag}: no grade before the questions are answered`, c.ok === true && c.part === true && c.no === true && /Ответь/.test(c.lock), c);
  await js(() => { ['okBtn', 'partBtn', 'noBtn'].forEach(id => { const b = document.getElementById(id); b.disabled = false; b.click(); }); }); await page.waitForTimeout(250);
  await s.check(`${tag}: unanswered questions cannot be skipped`, !((await ls(page, 'pm.grade.opt')) || {}).s3 && await js(() => !!document.getElementById('ack')));
  for (let i = 0; i < c.qs; i++) await answer(i, 'yes'); c = await card();
  await s.check(`${tag}: «да, это есть» on every question opens all grades`, c.ok === false && c.part === false && /Оценка за тобой/.test(c.lock), c);
  await answer(0, 'no'); c = await card();
  await s.check(`${tag}: «нет» closes «ВСПОМНИЛ» and shows why it matters`, c.ok === true && c.part === false && await js(() => { const w = document.querySelector('.ack-q[data-q="0"] .ack-why'); return !w.hidden && w.textContent.trim().length > 10; }), c);
  await press('noBtn'); await page.waitForTimeout(250);
  await s.check(`${tag}: the grade after the questions is recorded`, ((await ls(page, 'pm.grade.opt')) || {}).s3 === 'no');

  await step('opt', 2, A.near); c = await card();
  await s.check(`${tag}: one token away from the key → a pointed question`, c.v === 'check' && c.why === 'near' && /«\/user\/»|user/.test(c.text) && /Это меняет смысл\?/.test(c.text), c);
  await answer(0, 'yes'); c = await card();
  await s.check(`${tag}: «да, меняет» closes «ВСПОМНИЛ»`, c.ok === true && c.no === false, c);

  await step('opt', 0, 'Гость\nГость\n5\nоператор заменил пустую строку на запасное значение'); c = await card();
  await s.check(`${tag}: a known wrong output → «НЕВЕРНО» names the misconception`, c.v === 'no' && /пуст/i.test(c.text) && c.ok === true, c);
  await step('opt', 0, 'Гость\n\n0\nпустая строка это не nil, поэтому она остаётся'); c = await card();
  await s.check(`${tag}: the right output line by line → «ВЕРНО»`, c.v === 'ok' && /вывод совпал/.test(c.text), c);

  await step('opt', 4, 'nil это когда значения нет, поэтому нужно проверять'); c = await card();
  await s.check(`${tag}: an oral answer gets questions, never «верно» or «неверно»`, c.v === 'check' && c.qs >= 2 && !/НЕВЕРНО|ВЕРНО\b(?! )/.test(c.text.split('\n')[0].replace('ПРОВЕРЬ', '')), c);
  await s.check(`${tag}: oral — the card says how many points were found`, /из \d/.test(c.text), c.text.slice(0, 200));

  await step('opt', 2, null, 'dunno'); c = await card();
  await s.check(`${tag}: «не знаю — покажи» gets no verdict`, c.v === null, c);
  await step('coll', 1, 'let numbers = [1, 2, 3]\nprint(numbers.count)'); c = await card();
  await s.check(`${tag}: a topic without rubrics gets no verdict and open grades`, c.v === null && c.ok === false, c);
  // a bank task of a pilot topic
  await wipe(); await ui.open(page, 'opt'); await js(() => document.getElementById('tab-practice').click()); await page.waitForTimeout(350);
  await js(() => document.getElementById('bankRung').click()); await page.waitForTimeout(300);
  await page.fill('#ans', 'guard let days = parcel.daysLeft else { return "нет" }'); await js(() => { document.getElementById('ans').blur(); document.getElementById('showKey').click(); }); await page.waitForTimeout(450);
  c = await card();
  await s.check(`${tag}: a bank task with a rubric gets a verdict`, c.v !== null, c);
  if (ui.name === 'phone') await s.check(`${tag}: no animation loop after a verdict`, (await rafRate(page, 1500)) === 0, await rafRate(page, 500));
  await s.check(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 3));
  await s.shot(`autocheck-${ui.name}-${theme}`);
  await ctx.close();
}

async function run() {
  const s = new Suite('autocheck');
  const b = await launch();
  try { for (const ui of [phoneUi, desktopUi]) for (const theme of ['classic', 'next']) await scenario(s, b, ui, theme); }
  finally { await b.close(); }
  return { name: s.name, passed: s.passed, failed: s.failed, warnings: s.warnings };
}
module.exports = { run };
