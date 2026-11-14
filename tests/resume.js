// Nothing is lost half-way (review 14.11, bugs 4 and 6), phone and desktop:
// «Выгрузка» keeps its position, grades and the unfinished draft over a reload and over «← К уроку» (pm.outRun.<id>);
// the browser «Back» button closes the topic instead of leaving the site, a reload inside a topic returns to it.
'use strict';
const { Suite, launch, openPage, ensureDist } = require('./lib');
const { phoneUi, desktopUi, seed, ls, inTopic } = require('./ui');

const DAY = 86400000;
const A1 = 'Потому что тип строки опциональный и компилятор требует развернуть значение';
const A2 = 'черновик второго ответа: экран покажет пустую строку вместо гостя';

async function suite(ui) {
  const s = new Suite('resume-' + ui.name);
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, ui.ctx, ui.hash, { noGL: true, route: true });
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
    await page.reload();   // the reload returns straight into the unfinished «Выгрузка»
    await page.waitForSelector('#out', { timeout: 8000 }); await page.waitForTimeout(300);
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
    await page.reload();   // the reload returns straight into the unfinished «Выгрузка»
    await page.waitForSelector('#out', { timeout: 8000 }); await page.waitForTimeout(300);
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
    await ui.toList(page); await page.waitForTimeout(300);
    await seed(page, { 'pm.outRun.opt': JSON.stringify({ at: Date.now() - 2 * DAY, k: 2, g: ['ok', 'ok'], d: 'old', seen: 0 }) });
    await ui.ready(page); await toOut();
    st = await outState();
    await s.check('stale run (2 days): starts from question 1', /ВОПРОС\s*1/.test(st.h) && st.val === '', st);

    // ---------- browser «Back» closes the topic, reload returns into it ----------
    await ui.toList(page); await page.waitForTimeout(300);   // a reload inside a topic would return into it
    await seed(page, {}); await ui.ready(page);
    const url0 = page.url(), h0 = await page.evaluate(() => history.length);
    await ui.open(page, 'coll');
    await s.check('an open topic is a history entry', (await page.evaluate(() => (history.state || {}).syn)) === 'topic');
    await page.goBack(); await page.waitForTimeout(500);
    await s.check('Back: still on the site', page.url() === url0, page.url());
    await s.check('Back: the topic is closed', !(await inTopic(page)));
    if (ui.touch) await s.check('Back: the topic list is visible', await page.isVisible('#plist'));
    await ui.open(page, 'coll');
    await ui.open(page, 'func');   // closes coll with the app's own button, then opens func
    await s.check('open / close / open does not pile up entries', (await page.evaluate(() => history.length)) <= h0 + 1, h0);
    await tap('#tab-practice'); await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    const at = await page.evaluate(() => ({ topic: document.getElementById('main').classList.contains('is-topic'), crumb: document.getElementById('tCrumb').textContent + ' ' + document.getElementById('main').textContent.slice(0, 600),
      tab: document.getElementById('tab-practice').getAttribute('aria-selected'), intro: !!document.querySelector('.intro-on') }));
    await s.check('reload inside a topic: back in the topic', at.topic && !at.intro, at);
    await s.check('reload inside a topic: same topic and tab', /inout/i.test(at.crumb) && at.tab === 'true', at);
    await page.goBack(); await page.waitForTimeout(500);
    await s.check('Back after reload: on the site, topic closed', page.url() === url0 && !(await inTopic(page)), page.url());
    await s.check('fresh visit after closing does not reopen the topic', await (async () => { await page.goto(url0); await page.waitForTimeout(600); return !(await inTopic(page)); })());
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
