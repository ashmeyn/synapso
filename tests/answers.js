// Answers to «Проверь себя» and required points on long keys (backlog «Обучение» 4–5), phone and desktop:
// data — every lesson has as many answers as questions, every key longer than 25 lines has 3–5 points;
// UI — opening a long key shows the points above the full code, «Выгрузка» shows the written answer.
'use strict';
const path = require('path');
const { Suite, launch, openPage, IPHONE, ensureDist, topicsFromBuild, dataFromBuild } = require('./lib');

const SHOTS = process.env.SHOTS || '';
const IDX = Object.fromEntries(topicsFromBuild().map(t => [t.id, t]));

async function dataChecks(s) {
  const d = dataFromBuild();
  const noAns = [], badAns = [], noPts = [];
  for (const [id, c] of Object.entries(d.content)) {
    const L = c.lesson; if (!L) continue;
    if (!L.answers) noAns.push(id);
    else if (L.answers.length !== (L.check || []).length) badAns.push(id);
    for (const st of c.steps || []) {
      if (st.key.split('\n').length > 25 && !(st.points && st.points.length >= 3 && st.points.length <= 5)) noPts.push(id + '/' + st.id);
    }
  }
  await s.check('every lesson has answers to «Проверь себя»', !noAns.length, noAns);
  await s.check('answers count = questions count', !badAns.length, badAns);
  await s.check('every key > 25 lines has 3–5 points', !noPts.length, noPts);
}

async function ui(name, ctxOpts, hash, drv) {
  const s = new Suite(name);
  const browser = await launch();
  const { page } = await openPage(browser, s, ctxOpts, hash, { noGL: true });
  const tap = sel => (ctxOpts.hasTouch ? page.tap(sel) : page.click(sel));
  try {
    await drv.ready(page);
    await drv.open(page, 'table');
    await tap('#tab-practice'); await page.waitForTimeout(400);
    await page.click('.rung[data-step="2"]'); await page.waitForTimeout(200);
    await page.click('#dunno'); await page.waitForTimeout(300);
    const k = await page.evaluate(() => {
      const kp = document.querySelector('#keyBox .kpoints'); const term = document.querySelector('.term.key');
      return { n: kp ? kp.querySelectorAll('li').length : 0, code: !!kp && !!kp.querySelector('code'), term: !!term,
        order: kp && term && term.parentElement === kp.parentElement ? !!(kp.compareDocumentPosition(term) & 4) : null };
    });
    await s.check('long key shows required points', k.n >= 3 && k.n <= 5 && k.code, k);
    await s.check('full key stays on screen', k.term, k);
    if (k.order !== null) await s.check('points above the full key', k.order, k);
    if (SHOTS) { await page.evaluate(() => document.getElementById('keyBox').scrollIntoView({ block: 'start' })); await page.screenshot({ path: path.join(SHOTS, name + '-points.png') }); }
    await page.click('.rung[data-step="0"]'); await page.waitForTimeout(200);
    await page.click('#dunno'); await page.waitForTimeout(300);
    await s.check('short key has no points block', !(await page.$('#keyBox .kpoints')));
    await tap('#tab-theory'); await page.waitForTimeout(400);
    await drv.revealTheory(page);
    await tap('#toOut'); await page.waitForTimeout(300);
    await page.click('#outSilent'); await page.waitForTimeout(200);
    const a = await page.evaluate(() => document.getElementById('outKey').innerText);
    await s.check('«Выгрузка» shows the written answer', !/НЕ НАПИСАН/i.test(a) && /numberOfRowsInSection/.test(a), a.slice(0, 160));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '-out.png') });
  } catch (e) { await s.check('no exception', false, String(e && e.stack || e)); }
  await browser.close();
  return s;
}

const phoneUi = {
  async ready(page) { await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 }); },
  async open(page, id) {
    await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); b.closest('.pl-br').classList.add('open'); b.click(); }, IDX[id].i);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
    await page.waitForTimeout(300);
  },
  async revealTheory(page) { if (await page.isVisible('#rootsSkip')) await page.click('#rootsSkip'); for (let k = 0; k < 40 && await page.isVisible('#tMore'); k++) { await page.tap('#tMore'); await page.waitForTimeout(40); } },
};
const desktopUi = {
  async ready(page) { await page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 }); await page.click('#inStart'); await page.waitForTimeout(900); },
  async open(page, id) {
    await page.keyboard.press('Control+k');
    await page.keyboard.type(IDX[id].full.slice(0, 12));
    await page.waitForTimeout(200);
    await page.click(`#palList button[data-i="${IDX[id].i}"]:not(.gl)`);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 6000 });
    await page.waitForTimeout(500);
    if (await page.isVisible('#skipType')) await page.click('#skipType');
  },
  async revealTheory(page) { if (await page.isVisible('#rootsSkip')) await page.click('#rootsSkip'); for (let k = 0; k < 40 && await page.isVisible('#tMore'); k++) { await page.click('#tMore'); await page.waitForTimeout(40); if (await page.isVisible('#skipType')) await page.click('#skipType'); } },
};

async function run() {
  ensureDist();
  const d = new Suite('answers-data'); await dataChecks(d);
  const a = await ui('answers-phone', IPHONE, '#phone', phoneUi);
  const b = await ui('answers-desktop', { viewport: { width: 1440, height: 900 } }, '#desktop', desktopUi);
  return { name: 'answers', passed: d.passed + a.passed + b.passed, failed: [...d.failed, ...a.failed, ...b.failed], warnings: [...d.warnings, ...a.warnings, ...b.warnings] };
}

module.exports = { run };
if (require.main === module) run().then(r => { console.log(r); process.exit(r.failed.length ? 1 : 0); });
