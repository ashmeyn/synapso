// Phone practice, end to end: 3 topics x 7 steps in portrait (390x844) and landscape (844x390).
// Per step: answer field usable while typing (own keyboard for code, system keyboard + symbar for s5),
// «Ключ» too early keeps typing mode and says what is missing, the key opens, the self-grade buttons are reachable,
// «Вспомнил» records ok and moves on.
'use strict';
const { Suite, launch, openPage, IPHONE, rectOf, inViewport, topicsFromBuild, dataFromBuild, ensureDist } = require('./lib');

const ORIENT = [
  { tag: 'portrait', ctx: IPHONE, minAns: 150 },
  { tag: 'landscape', ctx: { ...IPHONE, viewport: { width: 844, height: 390 } }, minAns: 100 },
];
const PICK = +(process.env.PICK || 3);

const overlap = (a, b) => a && b && a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;

async function typeSkb(page, text) {
  for (const ch of text) {
    const sel = ch === ' ' ? '#skb button.space' : `#skb button[data-k="${ch}"]`;
    await page.tap(sel);
  }
}

async function run() {
  ensureDist();
  const s = new Suite('practice');
  const list = topicsFromBuild(), data = dataFromBuild();
  // three topics from different branches, each with a full 7-step ladder
  const withSteps = list.filter(t => data.content[t.id] && (data.content[t.id].steps || []).length === 7);
  const picks = [0, Math.floor(withSteps.length / 2), withSteps.length - 1].map(k => withSteps[k]).slice(0, PICK);
  const browser = await launch();
  try {
    for (const o of ORIENT) {
      const { ctx, page, errors } = await openPage(browser, s, o.ctx);
      const VW = o.ctx.viewport.width, VH = o.ctx.viewport.height, T = o.tag;
      try {
        await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 });
        for (const tp of picks) {
          const steps = data.content[tp.id].steps;
          await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); b.closest('.pl-br').classList.add('open'); b.scrollIntoView(); }, tp.i);
          await page.tap(`#plist .pl-t[data-i="${tp.i}"]`);
          await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
          await page.tap('#tab-practice');
          await page.evaluate(() => { const r = document.querySelector('#pane-practice .rung[data-step="0"]'); if (r) r.click(); });
          await page.waitForSelector('#pane-practice:not([hidden]) #ans', { timeout: 5000 });
          await page.waitForTimeout(250);
          if (tp === picks[0]) {
            // at rest the task code must be reachable (landscape used to show a 170px window with no code)
            const code = page.locator('#pane-practice .p-code .term-b');
            await code.scrollIntoViewIfNeeded();
            const cr = await rectOf(page, '#pane-practice .p-code .term-b');
            await s.check(`${T}: task code reachable at rest`, cr && cr.visible && cr.h >= 60 && inViewport({ ...cr, b: Math.min(cr.b, VH) }, VW, VH), cr);
          }
          for (let k = 0; k < steps.length; k++) {
            const st = steps[k], L = `${T} ${tp.id} ${st.id}`;
            const cur = await page.evaluate(() => { const r = document.querySelector('#pane-practice .rung.on'); return r ? +r.dataset.step : -1; });
            await s.check(`${L}: ladder on step`, cur === k, cur);
            await page.locator('#ans').scrollIntoViewIfNeeded();
            await page.tap('#ans');
            await page.waitForTimeout(250);
            const oral = st.id === 's5';
            const lay = await page.evaluate(() => ({ kb: document.body.classList.contains('kb-on'), skb: !!document.querySelector('#skb') && getComputedStyle(document.querySelector('#skb')).display !== 'none' }));
            await s.check(`${L}: typing mode`, lay.kb, lay);
            await s.check(`${L}: ${oral ? 'system keyboard for oral' : 'own keyboard for code'}`, lay.skb === !oral, lay);
            const ans = await rectOf(page, '#ans'), kbd = await rectOf(page, oral ? '#symbar' : '#skb');
            await s.check(`${L}: answer field >= ${o.minAns}px tall`, ans && ans.h >= o.minAns, ans);
            await s.check(`${L}: answer field on screen`, inViewport(ans, VW, VH), ans);
            await s.check(`${L}: keyboard on screen`, inViewport(kbd, VW, VH), kbd);
            await s.check(`${L}: keyboard does not cover the answer`, !overlap(ans, kbd), { ans, kbd });
            const keySel = oral ? '#symbar button[data-s="key"]' : '#skb button[data-k="key"]';
            if (oral) await page.keyboard.type('Это'); else await typeSkb(page, 'let');
            // too early: stay in typing mode, the key button says how much is missing
            await page.tap(keySel);
            await page.waitForTimeout(150);
            const early = await page.evaluate(sel => ({ kb: document.body.classList.contains('kb-on'), txt: (document.querySelector(sel) || {}).textContent || '', open: !!document.getElementById('okBtn') }), keySel);
            await s.check(`${L}: early key keeps typing`, early.kb && !early.open, early);
            await s.check(`${L}: early key says what is missing`, /^ещё \d+/.test(early.txt), early.txt);
            if (oral) await page.keyboard.type(' значение которое может отсутствовать и это видно в типе');
            else await typeSkb(page, ' value = answer');
            const val = await page.inputValue('#ans');
            await s.check(`${L}: typed into the field`, oral ? val.split(/\s+/).length >= 6 : val.replace(/\s/g, '').length >= 12, val);
            await page.waitForTimeout(1700);   // the «ещё N» label returns to «Ключ»
            await page.tap(keySel);
            await page.waitForSelector('#okBtn', { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500);
            const after = await page.evaluate(() => ({ kb: document.body.classList.contains('kb-on'), key: !!document.querySelector('#keyBox .term, #pane-practice .p-code .term[data-v="key"]') }));
            await s.check(`${L}: key shown, typing mode closed`, after.key && !after.kb, after);
            await page.locator('#okBtn').scrollIntoViewIfNeeded();
            for (const b of ['#okBtn', '#partBtn', '#noBtn']) {
              const r = await rectOf(page, b);
              await s.check(`${L}: grade ${b} reachable`, inViewport(r, VW, VH) && r.h >= 36, r);
            }
            if (k === 0) await s.shot(`${T}-${tp.id}-graded`);
            await page.tap('#okBtn');
            await page.waitForTimeout(300);
            const saved = await page.evaluate(([id, sid]) => ({ step: JSON.parse(localStorage.getItem('pm.steps.' + id) || '{}')[sid], grade: JSON.parse(localStorage.getItem('pm.grade.' + id) || '{}')[sid] }), [tp.id, st.id]);
            await s.check(`${L}: «вспомнил» recorded`, saved.step === 'ok' && saved.grade === 'ok', saved);
          }
          const rec = await page.evaluate(id => JSON.parse(localStorage.getItem('pm.recall.' + id) || 'null'), tp.id);
          await s.check(`${T} ${tp.id}: step 7 by memory counted`, !!(rec && rec.pass), rec);
          const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          await s.check(`${T} ${tp.id}: no horizontal overflow`, doc.sw <= doc.cw + 1, doc);
          await page.tap('#winClose');
          await page.waitForTimeout(300);
        }
        await s.check(`${T}: no page errors`, errors.length === 0, errors.slice(0, 5));
      } catch (e) {
        await s.check(`${T}: practice run crashed`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
  return s.result();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed.length ? 1 : 0));
