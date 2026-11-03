// Errors come back + mixed training (phone, plus a desktop sanity pass):
// a step graded «нет» returns to the daily run on day 1 and day 3 after the miss and leaves after two «вспомнил» in a row;
// the journal in «Шпаргалка» says when it returns; the mixed training interleaves topics and hides the topic until the answer.
'use strict';
const { Suite, launch, openPage, IPHONE, rafRate, ensureDist, topicsFromBuild } = require('./lib');

const DAY = 86400000;
const IDX = Object.fromEntries(topicsFromBuild().map(t => [t.id, t]));
const T0 = new Date(2026, 10, 3, 15, 0, 0).getTime();              // day 0, 15:00 local
const midnight = (ts, n) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };

async function at(page, ts, map) {
  await page.clock.setFixedTime(ts);
  if (map) await page.evaluate(m => { localStorage.clear(); for (const [k, v] of Object.entries(m)) localStorage.setItem(k, v); }, map);
  await page.reload();
  await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 });
}
const back = page => page.evaluate(() => JSON.parse(localStorage.getItem('pm.back') || '{}'));
async function openTopic(page, id, tab) {
  await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); b.closest('.pl-br').classList.add('open'); b.click(); }, IDX[id].i);
  await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
  await page.waitForTimeout(300);
  if (tab) { await page.tap('#tab-' + tab); await page.waitForTimeout(300); }
}
async function closeTopic(page) {
  if (await page.evaluate(() => document.getElementById('main').classList.contains('is-topic'))) { await page.tap('#winClose'); await page.waitForTimeout(300); }
}
// all card kinds of today's run (answers nothing, closes the run)
async function runKinds(page) {
  await page.tap('#runBtn'); await page.waitForTimeout(250);
  const k = await page.evaluate(() => document.querySelector('#runBody .run-kind').textContent);
  return k;
}
async function closeRun(page) { if (await page.isVisible('#run')) { await page.tap('#runClose'); await page.waitForTimeout(150); } }
const journal = async page => { await openTopic(page, 'opt', 'cheat');
  const t = await page.evaluate(() => [...document.querySelectorAll('#pane-cheat .errs .eb')].map(e => e.textContent));
  await closeTopic(page); return t; };

async function phone() {
  const s = new Suite('back-phone');
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, IPHONE, '#phone', { noGL: true });
  try {
    await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 });

    // ---------- streak lives in the list header ----------
    const sk = await page.evaluate(() => { const e = document.getElementById('streak'); const r = e.getBoundingClientRect();
      return { inHead: !!e.closest('#plist .pl-top'), vis: r.width > 0 && r.height > 0, txt: e.textContent }; });
    await s.check('streak is in the topic list header', sk.inHead && sk.vis && /СЕРИЯ/.test(sk.txt), sk);
    await s.check('mix button next to the run', await page.evaluate(() => !!document.querySelector('#plActs #mixBtn')));

    // ---------- day 0: step 2 of opt graded «нет» ----------
    await at(page, T0, {});
    await openTopic(page, 'opt', 'practice');
    await page.click('.rung[data-step="1"]'); await page.waitForTimeout(150);
    await page.click('#dunno'); await page.waitForTimeout(250);
    let b = (await back(page))['s:opt:s2'];
    await s.check('«нет» on a step creates a return (pm.back)', b && b.ok === 0 && b.next === midnight(T0, 1), b);
    await s.check('pm.err keeps its old format', await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('pm.err.opt')); return Array.isArray(l) && l[0] && 'at' in l[0] && 'q' in l[0] && 'note' in l[0]; }));
    await closeTopic(page);
    let j = await journal(page);
    await s.check('journal: returns tomorrow', j.some(x => /ВЕРНЁТСЯ ЗАВТРА/.test(x)), j);
    let k = await runKinds(page);
    await s.check('day 0: not in the run yet', !/ОШИБКА ВОЗВРАЩАЕТСЯ/.test(k), k); await closeRun(page);

    // ---------- day 1: comes back, «помню» → day 3 ----------
    await at(page, T0 + DAY);
    k = await runKinds(page);
    await s.check('day 1: error is the first run card', /ОШИБКА ВОЗВРАЩАЕТСЯ · ДЕНЬ 1/.test(k), k);
    await s.check('day 1: phone rAF at rest with the run open = 0', (await rafRate(page, 1500)) === 0);
    await page.tap('#runShow'); await page.waitForTimeout(150);
    await s.check('answer shows the key', await page.evaluate(() => document.querySelector('#runBody .run-ans').textContent.trim().length > 5));
    await page.tap('#runYes'); await page.waitForTimeout(150); await closeRun(page);
    b = (await back(page))['s:opt:s2'];
    await s.check('day 1 «помню» → next return on day 3', b && b.ok === 1 && b.next === midnight(T0, 3) && !b.done, b);
    j = await journal(page);
    await s.check('journal: returns in 2 days', j.some(x => /ЧЕРЕЗ 2 ДНЯ · 1 \/ 2/.test(x)), j);

    // ---------- day 2: not due ----------
    await at(page, T0 + 2 * DAY);
    k = await runKinds(page);
    await s.check('day 2: not in the run', !/ОШИБКА ВОЗВРАЩАЕТСЯ/.test(k), k); await closeRun(page);

    // ---------- day 3: comes back, second «помню» closes it ----------
    await at(page, T0 + 3 * DAY);
    k = await runKinds(page);
    await s.check('day 3: error is back', /ОШИБКА ВОЗВРАЩАЕТСЯ · ДЕНЬ 3/.test(k), k);
    await page.tap('#runShow'); await page.waitForTimeout(150); await page.tap('#runYes'); await page.waitForTimeout(150); await closeRun(page);
    b = (await back(page))['s:opt:s2'];
    await s.check('two «помню» in a row → closed', b && b.done > 0, b);
    await at(page, T0 + 4 * DAY);
    k = await runKinds(page);
    await s.check('day 4: gone from the run', !/ОШИБКА ВОЗВРАЩАЕТСЯ/.test(k), k); await closeRun(page);
    j = await journal(page);
    await s.check('journal: closed', j.some(x => /ЗАКРЫТА/.test(x)), j);

    // ---------- a miss on the return resets it: day 1 «не вспомнил» → back on day 2 ----------
    await at(page, T0, {});
    await openTopic(page, 'opt', 'practice');
    await page.click('.rung[data-step="2"]'); await page.waitForTimeout(150);
    await page.click('#dunno'); await page.waitForTimeout(250); await closeTopic(page);
    await at(page, T0 + DAY);
    k = await runKinds(page);
    await s.check('reset case: back on day 1', /ОШИБКА ВОЗВРАЩАЕТСЯ/.test(k), k);
    await page.tap('#runShow'); await page.waitForTimeout(150); await page.tap('#runNo'); await page.waitForTimeout(150); await closeRun(page);
    b = (await back(page))['s:opt:s3'];
    await s.check('«не вспомнил» on the return → tomorrow again, count reset', b && b.ok === 0 && b.next === midnight(T0, 2), b);

    // ---------- a bank task «нет» comes back too ----------
    await at(page, T0, {});
    await openTopic(page, 'opt', 'practice');
    if (await page.isVisible('#bankRung')) {
      await page.click('#bankRung'); await page.waitForTimeout(200);
      await page.click('#dunno'); await page.waitForTimeout(250);
      const keys = Object.keys(await back(page));
      await s.check('«нет» on a bank task creates a return', keys.some(x => /^b:opt:/.test(x)), keys);
    }
    await closeTopic(page);

    // ---------- mixed training ----------
    const ids = ['opt', 'coll', 'func', 'enum'];
    const seed = {};
    ids.forEach(id => { seed['pm.steps.' + id] = JSON.stringify({ s1: 'ok', s2: 'ok', s3: 'ok', s4: 'ok', s7: 'ok' }); });   // old rules: done → grandfathered
    seed['pm.srs.enum'] = JSON.stringify({ stage: 1, due: T0 - 1000, lapses: 0 });                                               // due today
    await at(page, T0, seed);
    await page.tap('#mixBtn'); await page.waitForTimeout(250);
    const n = await page.evaluate(() => +document.getElementById('runStep').textContent.split('/')[1]);
    await s.check('training has 5–10 cards', n >= 5 && n <= 10, n);
    const seen = [];
    for (let c = 0; c < n; c++) {
      const hid = await page.evaluate(() => document.getElementById('runTopic').textContent);
      await s.check(`card ${c + 1}: topic hidden before the answer`, /СКРЫТА/.test(hid), hid);
      await page.tap('#runShow'); await page.waitForTimeout(100);
      seen.push(await page.evaluate(() => document.getElementById('runTopic').textContent));
      await page.tap(c === 1 ? '#runNo' : '#runYes'); await page.waitForTimeout(100);
    }
    const titles = seen.map(x => x.split(' · ').slice(1).join(' · '));
    await s.check('training mixes topics (≥3 different)', new Set(titles).size >= 3, titles);
    await s.check('no two cards in a row from one topic', titles.every((x, i) => i === 0 || x !== titles[i - 1]), titles);
    const dueTitle = await page.evaluate(i => document.querySelector(`#plist .pl-t[data-i="${i}"] .pl-tt`).firstChild.textContent, IDX.enum.i);
    await s.check('SRS-due topic comes first', titles[0] === dueTitle, { first: titles[0], due: dueTitle });
    await s.check('training finish screen', await page.evaluate(() => /ТРЕНИРОВКА ЗАВЕРШЕНА/.test(document.getElementById('runBody').textContent)));
    await s.check('training «не вспомнил» → error returns tomorrow', Object.values(await back(page)).some(e => e.next === midnight(T0, 1) && !e.done));
    await s.check('training does not count as a run day', await page.evaluate(() => !(JSON.parse(localStorage.getItem('pm.runs') || '[]')).length));
    await closeRun(page);

    // not enough topics → explains instead of a one-topic «mix»
    await at(page, T0, {});
    await page.tap('#mixBtn'); await page.waitForTimeout(200);
    await s.check('training with no topics explains itself', await page.evaluate(() => /ДВЕ ТЕМЫ/.test(document.getElementById('runBody').textContent)));
    await closeRun(page);

    await s.check('no page errors', errors.length === 0, errors);
  } catch (e) { await s.check('suite ran without exceptions', false, String(e && e.stack || e)); }
  await browser.close();
  return s;
}

async function desktop() {
  const s = new Suite('back-desktop');
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, { viewport: { width: 1440, height: 900 } }, '#desktop', { noGL: true });
  try {
    await page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 }); await page.click('#inStart'); await page.waitForTimeout(900);
    const r = await page.evaluate(() => { const m = document.getElementById('mixBtn').getBoundingClientRect(), u = document.getElementById('runBtn').getBoundingClientRect();
      return { vis: m.width > 0 && m.height > 0, sameRow: Math.abs(m.top - u.top) < 4, streakInNav: !!document.getElementById('streak').closest('.nav') }; });
    await s.check('desktop: mix button next to the run', r.vis && r.sameRow, r);
    await s.check('desktop: streak stays in the side panel', r.streakInNav, r);
    await page.click('#mixBtn'); await page.waitForTimeout(250);
    await s.check('desktop: training opens', await page.isVisible('#run') && /MIX/.test(await page.textContent('#runTitle')));
    await page.click('#runClose');
    await s.check('desktop: no page errors', errors.length === 0, errors);
  } catch (e) { await s.check('suite ran without exceptions', false, String(e && e.stack || e)); }
  await browser.close();
  return s;
}

async function run() {
  ensureDist();
  const a = await phone(), b = await desktop();
  return { name: 'back', passed: a.passed + b.passed, failed: a.failed.concat(b.failed), warnings: a.warnings.concat(b.warnings) };
}
module.exports = { run };
if (require.main === module) run().then(r => { console.log(r); process.exit(r.failed.length ? 1 : 0); });
