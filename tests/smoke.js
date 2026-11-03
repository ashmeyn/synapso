// Smoke test over ALL topics (desktop 1440x900, reduced motion for speed).
// Every topic is opened through the public command palette (Ctrl+K, type its title, click its row).
// WebGL is switched off here (engine's no-GL fallback) to keep ~75 topics under a few minutes;
// desktop.js covers the real WebGL map. Bulk buttons (reveal, ladder rungs) are clicked via element.click(),
// which runs the same handlers as a user click without Playwright's per-click actionability waits.
'use strict';
const { Suite, launch, openPage, topicsFromBuild, dataFromBuild, ensureDist } = require('./lib');

const nextFrame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function revealAll(page) {
  return page.evaluate(() => {
    let n = 0;
    for (let m = document.getElementById('tMore'); m && !m.hidden && n < 80; m = document.getElementById('tMore')) { m.click(); n++; }
    return n;
  });
}

async function run(opts = {}) {
  ensureDist();
  const s = new Suite('smoke');
  const topics = topicsFromBuild();
  const DATA = dataFromBuild();
  const only = opts.only && opts.only.length ? new Set(opts.only) : null;
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, '#desktop', { noGL: true });
  const t0 = Date.now();
  try {
    await s.check('topics parsed from build', topics.length > 0, topics.length);
    const contentIds = Object.keys(DATA.content);
    const missing = topics.filter(t => !DATA.content[t.id]).map(t => t.id);
    await s.check('every map topic has content', missing.length === 0, missing);
    const orphan = contentIds.filter(id => !topics.some(t => t.id === id));
    if (orphan.length) s.warn('content without a map topic: ' + orphan.join(','));

    await page.waitForSelector('#inStart', { state: 'visible', timeout: 15000 });
    await page.click('#inStart');
    await page.waitForTimeout(300);

    let opened = 0;
    for (const t of topics) {
      if (only && !only.has(t.id)) continue;
      const c = DATA.content[t.id]; if (!c) continue;
      const tag = t.id;
      const errBefore = errors.length;

      // open via palette
      await page.keyboard.press('Escape');
      if (!(await page.isHidden('#palette'))) await page.keyboard.press('Escape');
      await page.keyboard.press('Control+k');
      await page.waitForSelector('#palette:not([hidden])', { timeout: 3000 });
      await page.fill('#palInput', t.full.toLowerCase());
      const btn = `#palList button[data-i="${t.i}"]:not(.gl)`;
      if (!(await s.check(`${tag}: found in palette by title`, (await page.$(btn)) !== null, t.full))) {
        await page.keyboard.press('Escape'); continue;
      }
      await page.click(btn);
      const ok = await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 }).then(() => true, () => false);
      if (!(await s.check(`${tag}: topic window opens`, ok))) continue;
      opened++;

      // «Корни»: shown before the lesson iff it has prereqs (nothing recalled in this fresh run), skipped here
      const pre = (c.lesson && c.lesson.prereqs || []).filter(p => DATA.content[p]);
      const rootsVis = await page.isVisible('#roots');
      await s.check(`${tag}: «Корни» shown iff lesson has prereqs`, rootsVis === pre.length > 0, { rootsVis, pre });
      if (rootsVis) {
        const n = await page.evaluate(() => (document.querySelector('#roots .out-h span').textContent.match(/\/ (\d+)/) || [])[1]);
        await s.check(`${tag}: «Корни» asks every prereq`, +n === pre.length, { n, pre });
        await page.click('#rootsSkip');
      }

      // theory
      await page.click('#tab-theory');
      await revealAll(page);
      const hasDeep = (c.lesson && c.lesson.deeper || []).length > 0;
      const deepVis = await page.isVisible('#toDeep');
      await s.check(`${tag}: "deeper" button present iff lesson has a deeper layer`, deepVis === hasDeep, { deepVis, hasDeep });
      if (deepVis) { await page.click('#toDeep'); await revealAll(page); }
      const th = await page.evaluate(() => ({
        mission: ((document.querySelector('#pane-theory .m-k') || {}).textContent || '').trim(),
        sections: document.querySelectorAll('#pane-theory .tb:not(.mission):not(.deep-sep)').length,
        locked: document.querySelectorAll('#pane-theory .tb.locked').length,
      }));
      const L = c.lesson || {};
      if (L.mission) await s.check(`${tag}: mission rendered`, th.mission.length > 0);
      else s.warn(`${tag}: lesson has no mission`);
      const expSec = (L.base || []).length + (L.deeper || []).length;
      await s.check(`${tag}: >=1 theory section`, th.sections >= 1, th);
      await s.check(`${tag}: all sections rendered`, th.sections === expSec, { rendered: th.sections, expected: expSec });
      await s.check(`${tag}: nothing locked after reveal`, th.locked === 0, th);
      const grows = topics.filter(x => ((DATA.content[x.id] || {}).lesson || {}).prereqs && DATA.content[x.id].lesson.prereqs.includes(t.id)).map(x => String(x.i));
      const gl = await page.evaluate(() => [...document.querySelectorAll('#tGrows button[data-i]')].map(b => b.dataset.i));
      await s.check(`${tag}: «Из этой темы растут» lists reverse prereqs`, gl.join() === grows.join(), { gl, grows });

      // cheat sheet
      await page.click('#tab-cheat');
      const cheat = await page.evaluate(() => (document.getElementById('pane-cheat').textContent || '').trim().length);
      await s.check(`${tag}: cheat sheet not empty`, cheat > 0);

      // practice: 7-step ladder, bank rung, code box overflow
      await page.click('#tab-practice');
      await nextFrame(page);
      const nSteps = await page.evaluate(() => document.querySelectorAll('#pane-practice .rung[data-step]').length);
      await s.check(`${tag}: 7 practice steps`, nSteps === 7 && (c.steps || []).length === 7, { rendered: nSteps, data: (c.steps || []).length });
      const expBank = DATA.bank.filter(b => b.topics.includes(t.id)).length;
      const bankTxt = await page.evaluate(() => { const b = document.querySelector('#pane-practice .bankrung .dot'); return b ? b.textContent.trim() : null; });
      await s.check(`${tag}: bank count matches data`, expBank ? bankTxt === '+' + expBank : bankTxt === null, { rendered: bankTxt, expected: expBank });

      for (let k = 0; k < nSteps; k++) {
        await page.evaluate(k => document.querySelector(`#pane-practice .rung[data-step="${k}"]`).click(), k);
        await nextFrame(page);
        const st = await page.evaluate(k => {
          const on = document.querySelector('#pane-practice .rung.on');
          const tb = document.querySelector('#pane-practice .p-code .term-b');
          const term = tb && tb.closest('.term');
          return {
            on: on ? on.dataset.step : null,
            title: ((document.querySelector('#pane-practice .step-title') || {}).textContent || '').trim(),
            over: tb ? tb.scrollWidth - tb.clientWidth : 0,
            shrunk: !!(term && term.style.getPropertyValue('--code-size')),
            fs: tb ? getComputedStyle(tb).fontSize : null,
          };
        }, k);
        await s.check(`${tag}: step ${k + 1} selectable`, st.on === String(k) && st.title.length > 0, st);
        if (st.over > 2) s.warn(`${tag}: step ${k + 1} code box overflows by ${st.over}px (font ${st.fs}${st.shrunk ? ', engine shrank it' : ', not shrunk'})`);
      }
      if (expBank) {
        await page.evaluate(() => document.querySelector('#pane-practice .bankrung').click());
        await nextFrame(page);
        const bk = await page.evaluate(() => !!document.querySelector('#pane-practice .bankrung.on') && !!document.querySelector('#pane-practice .step-title'));
        await s.check(`${tag}: bank task opens`, bk);
      }

      await s.check(`${tag}: no page errors`, errors.length === errBefore, errors.slice(errBefore));
    }
    await s.check('opened every topic', opened === (only ? only.size : topics.length), { opened, total: topics.length });
    console.log(`  smoke: ${opened} topics in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    await s.check('smoke run crashed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    await s.check('no page errors overall', errors.length === 0, errors.slice(0, 5));
    await browser.close();
  }
  return s.result();
}

module.exports = { run };
if (require.main === module) run({ only: process.argv.slice(2) }).then(r => process.exit(r.failed.length ? 1 : 0));
