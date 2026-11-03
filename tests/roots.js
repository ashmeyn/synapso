// «Корни» (phone and desktop): before a lesson with prereqs, each prereq not recalled in the last 3 days
// is asked from memory (ref.one, else the first cheat line) → reveal → «вспомнил / нет».
// «нет» puts the prereq into SRS, «пропустить» hides the screen for a day; under the lesson,
// «Из этой темы растут» links the reverse prereqs. New keys: pm.roots.<id>, pm.rootsSkip.<id>.
'use strict';
const { Suite, launch, openPage, IPHONE, rafRate, docOverflow, ensureDist, topicsFromBuild, dataFromBuild } = require('./lib');

const DAY = 86400000;
const TOPICS = topicsFromBuild();
const IDX = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const DATA = dataFromBuild();
const preOf = id => (((DATA.content[id] || {}).lesson || {}).prereqs || []).filter(p => IDX[p]);
// a topic with at least 3 prereqs, all with a ref.one question; and one of its roots that others grow from
const HOST = TOPICS.map(t => t.id).find(id => preOf(id).length >= 3 && preOf(id).every(p => DATA.ref.one[p]));
const ROOTS = preOf(HOST);
const GROWS_FROM = ROOTS[0];

async function seed(page, map) {
  await page.evaluate(m => { localStorage.clear(); for (const [k, v] of Object.entries(m)) localStorage.setItem(k, JSON.stringify(v)); }, map);
  await page.reload();
}
const get = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
const counter = page => page.evaluate(() => { const e = document.querySelector('#roots .out-h span'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });

async function suite(name, ctxOpts, hash, ui) {
  const s = new Suite(name);
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, ctxOpts, hash, { noGL: true });
  const tap = sel => (ctxOpts.hasTouch ? page.tap(sel) : page.click(sel));
  const now = Date.now();
  try {
    await s.check('test data: a topic with >= 3 prereqs', !!HOST, HOST);
    await ui.ready(page);

    // ---------- 1. fresh progress: every root is asked, in order ----------
    await ui.open(page, HOST);
    await s.check('«Корни» shown before the lesson', await page.isVisible('#roots'));
    await s.check('lesson text not shown yet', !(await page.$('#pane-theory .theory')));
    await s.check('counter 1 / N', (await counter(page)) === `КОРНИ · 1 / ${ROOTS.length}`, await counter(page));
    const q0 = await page.textContent('#rootsQ');
    await s.check('question comes from ref.one of the root', q0.trim() === DATA.ref.one[ROOTS[0]].q, { q0, root: ROOTS[0] });
    await s.check('answer hidden until asked', !(await page.$('#rootsKey .out-a')));
    if (ui.shots) await page.screenshot({ path: ui.shots + '-question.png' });
    await tap('#rootsShow');
    const a0 = await page.textContent('#rootsKey .out-a');
    await s.check('answer from ref.one revealed', a0.trim() === DATA.ref.one[ROOTS[0]].a, a0);
    if (ui.shots) await page.screenshot({ path: ui.shots + '-answer.png' });
    if (ui.mobile) {
      const o = await docOverflow(page);
      await s.check('phone: no horizontal overflow on «Корни»', o.sw <= o.cw + 1, o);
    }

    // root 1 recalled: date only, the SRS ladder does not grow
    await tap('#rootsKey [data-g="ok"]');
    const r0 = await get(page, 'pm.roots.' + ROOTS[0]);
    await s.check('«вспомнил» → pm.roots.<id> = ok', r0 && r0.v === 'ok' && Math.abs(r0.at - Date.now()) < 60000, r0);
    await s.check('«вспомнил» does not touch SRS', (await get(page, 'pm.srs.' + ROOTS[0])) === null);

    // root 2 not recalled: into SRS, due tomorrow, written to the error log
    await s.check('counter 2 / N', (await counter(page)) === `КОРНИ · 2 / ${ROOTS.length}`, await counter(page));
    await tap('#rootsShow');
    await tap('#rootsKey [data-g="no"]');
    const r1 = await get(page, 'pm.roots.' + ROOTS[1]), srs1 = await get(page, 'pm.srs.' + ROOTS[1]), err1 = await get(page, 'pm.err.' + ROOTS[1]);
    await s.check('«нет» → pm.roots.<id> = no', r1 && r1.v === 'no', r1);
    await s.check('«нет» → prereq in SRS, due in ~1 day', srs1 && srs1.stage === 0 && Math.abs(srs1.due - (Date.now() + DAY)) < 60000, srs1);
    await s.check('«нет» → error log entry', Array.isArray(err1) && /^Корни:/.test(err1[0].q), err1);

    for (let k = 2; k < ROOTS.length; k++) { await tap('#rootsShow'); await tap('#rootsKey [data-g="ok"]'); }
    const sum = await page.evaluate(() => ({ items: document.querySelectorAll('#roots .roots-sum li').length, no: document.querySelectorAll('#roots .roots-sum li.no').length,
      open: [...document.querySelectorAll('#roots .out-acts [data-i]')].map(b => b.dataset.i) }));
    await s.check('summary lists every root, one «в повтор»', sum.items === ROOTS.length && sum.no === 1, sum);
    await s.check('summary offers to open the missed root', sum.open.join() === String(IDX[ROOTS[1]].i), sum);
    if (ui.shots) await page.screenshot({ path: ui.shots + '-summary.png' });
    if (ui.mobile) await s.check('phone: rAF at rest on «Корни» <= 2/s', (await rafRate(page)) <= 2);
    await tap('#rootsGo');
    await s.check('«к уроку» opens the lesson', !(await page.$('#roots')) && !!(await page.$('#pane-theory .theory.lesson')));

    // the missed root is due once its day has passed (it is not done: the «нет» alone makes it due)
    await page.evaluate(id => { const r = JSON.parse(localStorage.getItem('pm.srs.' + id)); r.due = Date.now() - 1000; localStorage.setItem('pm.srs.' + id, JSON.stringify(r)); }, ROOTS[1]);
    await page.reload(); await ui.ready(page);
    await ui.open(page, ROOTS[1]);
    const crumb = await page.textContent('#tCrumb');
    await s.check('missed root becomes due', /повторить/.test(crumb), crumb);
    await s.check('…and opens on «Выгрузка»', await page.isVisible('#out'));

    // ---------- 2. everything recalled lately → no screen ----------
    await ui.open(page, HOST);
    await s.check('all roots recalled ≤ 3 days ago → no «Корни»', !(await page.isVisible('#roots')) && !!(await page.$('#pane-theory .theory.lesson')));

    // ---------- 3. stale roots are asked again, recent ones are not ----------
    const st = {};
    ROOTS.forEach((p, k) => { st['pm.roots.' + p] = { at: now - (k === 0 ? 4 : 1) * DAY, v: 'ok' }; });
    st['pm.recall.' + ROOTS[1]] = { at: now - 5 * DAY, v: 'ok', pass: now - 5 * DAY };   // older than its root mark: the latest counts
    await seed(page, st); await ui.ready(page);
    await ui.open(page, HOST);
    await s.check('only roots older than 3 days are asked', (await counter(page)) === 'КОРНИ · 1 / 1', await counter(page));
    await s.check('the stale root is the one asked', (await page.textContent('#rootsQ')).trim() === DATA.ref.one[ROOTS[0]].q);
    const seedSt = {}; ROOTS.forEach(p => { seedSt['pm.roots.' + p] = { at: now - 2 * DAY, v: 'ok' }; });
    seedSt['pm.roots.' + ROOTS[0]] = { at: now - 10 * DAY, v: 'ok' }; seedSt['pm.recall.' + ROOTS[0]] = { at: now - 2 * DAY, v: 'part', pass: 0 };
    await seed(page, seedSt); await ui.ready(page);
    await ui.open(page, HOST);
    await s.check('step 7 attempt counts as a recent recall', !(await page.isVisible('#roots')));

    // ---------- 4. «пропустить» hides the screen for a day ----------
    await seed(page, {}); await ui.ready(page);
    await ui.open(page, HOST);
    await tap('#rootsSkip');
    const skip = await get(page, 'pm.rootsSkip.' + HOST);
    await s.check('skip → pm.rootsSkip.<topic> = now', typeof skip === 'number' && Math.abs(skip - Date.now()) < 60000, skip);
    await s.check('skip opens the lesson', !(await page.$('#roots')) && !!(await page.$('#pane-theory .theory.lesson')));
    await s.check('skip records no recall', (await get(page, 'pm.roots.' + ROOTS[0])) === null);
    await ui.open(page, HOST);
    await s.check('skipped → not shown again the same day', !(await page.isVisible('#roots')));
    await seed(page, { ['pm.rootsSkip.' + HOST]: now - 25 * 3600 * 1000 }); await ui.ready(page);
    await ui.open(page, HOST);
    await s.check('skip older than a day → shown again', await page.isVisible('#roots'));

    // ---------- 5. «Из этой темы растут» ----------
    await seed(page, {}); await ui.ready(page);
    const grows = TOPICS.filter(t => preOf(t.id).includes(GROWS_FROM)).map(t => String(t.i));
    await ui.open(page, GROWS_FROM);
    if (await page.isVisible('#rootsSkip')) await tap('#rootsSkip');
    await ui.revealTheory(page);
    const gl = await page.evaluate(() => { const g = document.getElementById('tGrows'); return g ? { txt: g.textContent, i: [...g.querySelectorAll('button[data-i]')].map(b => b.dataset.i) } : null; });
    await s.check('«Из этой темы растут» under the lesson', !!gl && /^Из этой темы растут:/.test(gl.txt), gl);
    await s.check('it links every reverse prereq', !!gl && gl.i.join() === grows.join(), { gl, grows });
    if (ui.shots) { await page.evaluate(() => document.getElementById('tGrows').scrollIntoView({ block: 'center' })); await page.screenshot({ path: ui.shots + '-grows.png' }); }
    await tap(`#tGrows button[data-i="${IDX[HOST].i}"]`);
    await page.waitForTimeout(ui.mobile ? 400 : 1200);
    const tt = ((await page.textContent('#tTitle')) || '').trim();
    await s.check('link opens that topic', tt.length > 0 && IDX[HOST].full.startsWith(tt.slice(0, 12)), { tt, full: IDX[HOST].full });
    await s.check('…starting with its «Корни»', await page.isVisible('#roots'));
    const leaf = TOPICS.find(t => !TOPICS.some(x => preOf(x.id).includes(t.id)) && !preOf(t.id).length);
    if (leaf) {
      await ui.open(page, leaf.id); await ui.revealTheory(page);
      await s.check('no reverse prereqs → no «растут» line', !(await page.$('#tGrows')), leaf.id);
    }

    await s.check('no page errors', errors.length === 0, errors.slice(0, 5));
  } catch (e) { await s.check('no exception', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
  await browser.close();
  return s;
}

const SHOTS = process.env.SHOTS || '';
const phoneUi = {
  mobile: true, shots: SHOTS && SHOTS + '/phone',
  async ready(page) { await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 }); },
  async open(page, id) {
    if (await page.evaluate(() => document.getElementById('main').classList.contains('is-topic'))) { await page.tap('#winClose'); await page.waitForTimeout(300); }
    await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); b.closest('.pl-br').classList.add('open'); b.click(); }, IDX[id].i);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
    await page.waitForTimeout(300);
  },
  async revealTheory(page) { for (let k = 0; k < 40 && await page.isVisible('#tMore'); k++) { await page.tap('#tMore'); await page.waitForTimeout(40); } },
};
const desktopUi = {
  shots: SHOTS && SHOTS + '/desktop',
  async ready(page) { await page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 }); await page.click('#inStart'); await page.waitForTimeout(900); },
  async open(page, id) {
    if (await page.evaluate(() => document.getElementById('main').classList.contains('is-topic'))) { await page.click('#winClose'); await page.waitForTimeout(500); }
    await page.keyboard.press('Control+k');
    await page.keyboard.type(IDX[id].full.slice(0, 12));
    await page.waitForTimeout(200);
    await page.click(`#palList button[data-i="${IDX[id].i}"]:not(.gl)`);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 6000 });
    await page.waitForTimeout(500);
    if (await page.isVisible('#skipType')) await page.click('#skipType');
  },
  async revealTheory(page) { for (let k = 0; k < 40 && await page.isVisible('#tMore'); k++) { await page.click('#tMore'); await page.waitForTimeout(40); if (await page.isVisible('#skipType')) await page.click('#skipType'); } },
};

async function run() {
  ensureDist();
  const a = await suite('roots-phone', IPHONE, '#phone', phoneUi);
  const b = await suite('roots-desktop', { viewport: { width: 1440, height: 900 } }, '#desktop', desktopUi);
  return { name: 'roots', passed: a.passed + b.passed, failed: a.failed.concat(b.failed), warnings: a.warnings.concat(b.warnings) };
}

module.exports = { run };
if (require.main === module) run().then(r => { console.log(r); process.exit(r.failed.length ? 1 : 0); });
