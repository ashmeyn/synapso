// Nothing is lost half-way (review 14.11, bugs 4 and 6), phone and desktop:
// «Выгрузка» keeps its position, grades and the unfinished draft over a reload and over «← К уроку» (pm.outRun.<id>).
'use strict';
const { Suite, launch, openPage, ensureDist } = require('./lib');
const { phoneUi, desktopUi, seed, ls } = require('./ui');

const DAY = 86400000;
const A1 = 'Потому что тип строки опциональный и компилятор требует развернуть значение';
const A2 = 'черновик второго ответа: экран покажет пустую строку вместо гостя';

async function suite(ui) {
  const s = new Suite('resume-' + ui.name);
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, ui.ctx, ui.hash, { noGL: true });
  const tap = sel => (ui.touch ? page.tap(sel) : page.click(sel));
  const toOut = async () => { await ui.open(page, 'opt'); await ui.revealTheory(page); await page.evaluate(() => document.getElementById('toOut').click()); await page.waitForSelector('#out', { timeout: 5000 }); await page.waitForTimeout(150); };
  const outState = () => page.evaluate(() => ({ h: (document.querySelector('.out-h span') || {}).textContent || '', val: (document.getElementById('outAns') || {}).value,
    key: (document.getElementById('outKey') || {}).textContent || '', grade: !!document.querySelector('#outKey [data-g]') }));
  try {
    await ui.ready(page);
    await seed(page, {}); await ui.ready(page);

    // ---------- «Выгрузка»: answer 1 graded, answer 2 half-typed -> reload ----------
    await toOut();
    await page.fill('#outAns', A1); await page.click('#outShow'); await page.waitForTimeout(150);
    await page.click('#outKey [data-g="ok"]'); await page.waitForTimeout(200);
    await page.fill('#outAns', A2); await page.waitForTimeout(100);
    await page.reload(); await ui.ready(page);
    await toOut();
    let st = await outState();
    await s.check('reload: «Выгрузка» resumes on question 2', /ВОПРОС\s*2\s*\/\s*3/.test(st.h), st);
    await s.check('reload: the unfinished draft is back', st.val === A2, st);
    await s.check('reload: the answer is still closed', st.key.trim() === '' && !st.grade, st);
    await s.check('reload: nothing counted yet', (await ls(page, 'pm.out.opt')) === null);

    // ---------- «← К уроку» and back ----------
    await page.click('#outBack'); await page.waitForTimeout(200);
    await ui.revealTheory(page);
    await page.evaluate(() => document.getElementById('toOut').click()); await page.waitForSelector('#out'); await page.waitForTimeout(150);
    st = await outState();
    await s.check('«К уроку» and back: still question 2 with the draft', /ВОПРОС\s*2/.test(st.h) && st.val === A2, st);

    // ---------- answer opened, reload before grading: the answer is shown again (no second blind try) ----------
    await page.click('#outShow'); await page.waitForTimeout(150);
    await page.reload(); await ui.ready(page);
    await toOut();
    st = await outState();
    await s.check('reload after reveal: question 2, answer open, grade asked', /ВОПРОС\s*2/.test(st.h) && st.key.trim().length > 20 && st.grade, st);
    await page.click('#outKey [data-g="part"]'); await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('outDunno').click()); await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('outNext').click()); await page.waitForTimeout(300);
    const out = await ls(page, 'pm.out.opt');
    await s.check('finish: all three grades saved', !!out && JSON.stringify(out.g) === JSON.stringify(['ok', 'part', 'no']), out);
    await s.check('finish: the unfinished-run record is removed', (await page.evaluate(() => localStorage.getItem('pm.outRun.opt'))) === null);
    await page.evaluate(() => document.getElementById('outAgain').click()); await page.waitForTimeout(200);
    st = await outState();
    await s.check('«Пройти ещё раз» starts from question 1, empty field', /ВОПРОС\s*1/.test(st.h) && st.val === '', st);

    // ---------- a run left more than a day ago starts over ----------
    await seed(page, { 'pm.outRun.opt': JSON.stringify({ at: Date.now() - 2 * DAY, k: 2, g: ['ok', 'ok'], d: 'old', seen: 0 }) });
    await ui.ready(page); await toOut();
    st = await outState();
    await s.check('stale run (2 days): starts from question 1', /ВОПРОС\s*1/.test(st.h) && st.val === '', st);
    await s.check('no page errors', !errors.length, errors.slice(0, 3));
  } finally { await browser.close(); }
  return s.result();
}

async function run() {
  ensureDist();
  const a = await suite(phoneUi), b = await suite(desktopUi);
  return { name: 'resume', passed: a.passed + b.passed, failed: a.failed.concat(b.failed), warnings: a.warnings.concat(b.warnings) };
}

module.exports = { run };
