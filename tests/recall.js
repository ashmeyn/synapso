// Honest practice (review 14.11, leak 1.3 and item 22), phone and desktop:
// 1.3 — once the key of a step has been seen, the step opens with an EMPTY field next time (the unfinished draft of a step
//       whose key was never opened is still restored); the previous answer is offered only after the key;
//       text typed after the key is open is not saved (no copying the key into the stored answer).
// 22  — setting «БЕЗ ПОДСКАЗОК» (pm.strict, off by default): while a step is being answered, the Теория and Шпаргалка
//       tabs are closed until the key opens.
'use strict';
const { Suite, launch, openPage, ensureDist } = require('./lib');
const { phoneUi, desktopUi, seed, ls } = require('./ui');

const A1 = 'ANSWER-ONE: напечатает Нора и потом Optional';
const A2 = 'ANSWER-TWO: сначала имя, затем обёртка Optional';

async function suite(ui) {
  const s = new Suite('recall-' + ui.name);
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, ui.ctx, ui.hash, { noGL: true });
  const tap = sel => (ui.touch ? page.tap(sel) : page.click(sel));
  const js = (fn, a) => page.evaluate(fn, a);
  const practice = async (id, step) => { await ui.open(page, id); await tap('#tab-practice'); await page.waitForTimeout(350);
    await js(k => document.querySelector(`.rung[data-step="${k}"]`).click(), step); await page.waitForTimeout(250); };
  const field = () => js(() => ({ val: document.getElementById('ans').value, keyOpen: document.getElementById('keyBox').textContent.trim().length > 0,
    dis: document.getElementById('showKey').disabled, prev: !!document.getElementById('prevBtn') }));
  const tabOn = n => js(n => document.getElementById('tab-' + n).getAttribute('aria-selected') === 'true', n);
  try {
    await ui.ready(page);
    await seed(page, {}); await ui.ready(page);

    // ---------- 1.3 a: a draft of a step whose key was never opened survives a reload ----------
    await practice('opt', 0);
    await page.fill('#ans', A1); await page.waitForTimeout(100);
    await page.reload(); await ui.ready(page);
    await practice('opt', 0);
    let f = await field();
    await s.check('draft before the key: restored after reload', f.val === A1 && !f.keyOpen, f);

    // ---------- 1.3 b: key opened, text typed afterwards is not stored; next time the field is empty ----------
    await js(() => document.getElementById('showKey').click()); await page.waitForTimeout(300);
    await js(() => { const ta = document.getElementById('ans'); ta.value += '\nCOPIED FROM KEY'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(100);
    await s.check('text typed after the key is not saved', (await ls(page, 'pm.ans.opt.s1')) === A1, await ls(page, 'pm.ans.opt.s1'));
    await page.reload(); await ui.ready(page);   // key seen, no grade given
    await practice('opt', 0);
    f = await field();
    await s.check('key was seen (no grade): the field is empty next time', f.val === '' && !f.keyOpen && f.dis, f);
    await s.check('the previous answer is not on screen before the key', !(await js(() => document.getElementById('pane-practice').innerText.includes('ANSWER-ONE'))));
    await page.fill('#ans', A2); await page.waitForTimeout(100);
    await s.check('the new attempt is drafted separately, the old answer is kept', (await ls(page, 'pm.redo.opt.s1')) === A2 && (await ls(page, 'pm.ans.opt.s1')) === A1);
    await js(() => document.getElementById('showKey').click()); await page.waitForTimeout(300);
    f = await field();
    await s.check('after the key: «показать прошлый ответ» is offered', f.prev, f);
    await js(() => document.getElementById('prevBtn').click()); await page.waitForTimeout(150);
    await s.check('the previous answer is shown on request', await js(() => document.getElementById('prevBox').innerText.includes('ANSWER-ONE')));
    await js(() => document.getElementById('okBtn').click()); await page.waitForTimeout(300);
    await s.check('graded «вспомнил»: the new answer becomes the stored one, the draft is cleared',
      (await ls(page, 'pm.ans.opt.s1')) === A2 && !(await ls(page, 'pm.redo.opt.s1')), [await ls(page, 'pm.ans.opt.s1'), await ls(page, 'pm.redo.opt.s1')]);

    // ---------- 1.3 c: progress made before this change — a graded step opens empty, the old answer comes after the key ----------
    await seed(page, { 'pm.steps.opt': JSON.stringify({ s2: 'ok' }), 'pm.ans.opt.s2': JSON.stringify('OLD-S2 guard let name = user.name else { return "Гость" }'),
      'pm.ans.opt.s3': JSON.stringify('DRAFT-S3 not graded yet') });
    await ui.ready(page);
    await practice('opt', 1);
    f = await field();
    await s.check('old graded step: opens with an empty field', f.val === '' && f.dis, f);
    await s.check('old answer is kept in storage', String(await ls(page, 'pm.ans.opt.s2')).startsWith('OLD-S2'));
    await js(k => document.querySelector(`.rung[data-step="${k}"]`).click(), 2); await page.waitForTimeout(250);
    f = await field();
    await s.check('old ungraded draft: still restored', f.val === 'DRAFT-S3 not graded yet', f);

    // ---------- 22: «без подсказок» ----------
    await seed(page, {}); await ui.ready(page);
    await s.check('strict mode is off by default', (await ls(page, 'pm.strict')) === null && /ВЫКЛ/.test(await js(() => document.getElementById('strictBtn').textContent)));
    await practice('opt', 0);
    await page.fill('#ans', 'начал отвечать'); await page.waitForTimeout(100);
    await js(() => document.getElementById('tab-theory').click()); await page.waitForTimeout(350);
    await s.check('strict off: Теория opens while answering (as before)', await tabOn('theory'));
    await js(() => document.getElementById('strictBtn').click()); await page.waitForTimeout(100);
    await s.check('strict on: stored and shown on the button', (await ls(page, 'pm.strict')) === true && /ВКЛ/.test(await js(() => document.getElementById('strictBtn').textContent)));
    await js(() => document.getElementById('tab-practice').click()); await page.waitForTimeout(350);
    f = await field();
    await s.check('the unfinished draft is still in the field', f.val === 'начал отвечать', f);
    for (const n of ['theory', 'cheat']) {
      await js(n => document.getElementById('tab-' + n).click(), n); await page.waitForTimeout(300);
      await s.check(`strict on: «${n}» stays closed while answering`, (await tabOn('practice')) && !(await tabOn(n)));
    }
    const note = await js(() => { const e = document.getElementById('strictNote'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { t: e.textContent, w: r.width, right: r.right, vw: innerWidth }; });
    await s.check('strict on: a note says why the tab is closed', !!note && /БЕЗ ПОДСКАЗОК/i.test(note.t) && note.right <= note.vw + 1, note);
    await js(() => document.getElementById('tab-tasks').click()); await page.waitForTimeout(300);
    await s.check('strict on: «Задания» is not locked', await tabOn('tasks'));
    await js(() => document.getElementById('tab-practice').click()); await page.waitForTimeout(350);
    await js(() => document.getElementById('dunno').click()); await page.waitForTimeout(300);
    await js(() => document.getElementById('tab-theory').click()); await page.waitForTimeout(350);
    await s.check('strict on: after the key Теория opens again', await tabOn('theory'));
    await js(() => document.getElementById('tab-practice').click()); await page.waitForTimeout(350);
    await js(k => document.querySelector(`.rung[data-step="${k}"]`).click(), 0); await page.waitForTimeout(250);
    f = await field();
    await js(() => document.getElementById('tab-cheat').click()); await page.waitForTimeout(300);
    await s.check('strict on: a step seen before is locked from the start (empty field)', f.val === '' && (await tabOn('practice')), f);
    await js(k => document.querySelector(`.rung[data-step="${k}"]`).click(), 3); await page.waitForTimeout(250);
    await js(() => document.getElementById('tab-theory').click()); await page.waitForTimeout(350);
    await s.check('strict on: a new step with an empty field is not locked yet', await tabOn('theory'));
    await page.reload(); await ui.ready(page);
    await s.check('strict mode survives a reload', (await ls(page, 'pm.strict')) === true && /ВКЛ/.test(await js(() => document.getElementById('strictBtn').textContent)));
    await js(() => document.getElementById('strictBtn').click());
    await s.check('strict mode can be switched off', (await ls(page, 'pm.strict')) === false);
    await s.check('no page errors', !errors.length, errors.slice(0, 3));
  } finally { await browser.close(); }
  return s.result();
}

async function run() {
  ensureDist();
  const a = await suite(phoneUi), b = await suite(desktopUi);
  return { name: 'recall', passed: a.passed + b.passed, failed: a.failed.concat(b.failed), warnings: a.warnings.concat(b.warnings) };
}

module.exports = { run };
