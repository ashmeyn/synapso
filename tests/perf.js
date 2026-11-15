// Desktop render budget (backlog «Разбор 14.11», item 14): with a topic or practice open, or the tab hidden, the page
// runs no requestAnimationFrame callbacks and does not render the 3D scene; on the map the loop does not force layout.
// Counters, not CPU %: WebGL is software here (SwiftShader), so timings are inflated; counts are exact.
//   node tests/perf.js --report   prints the numbers for every state and asserts nothing (used for before/after).
'use strict';
const { Suite, launch, openPage, ensureDist, IPHONE } = require('./lib');
const { desktopUi, phoneUi } = require('./ui');

// window.__scene counts 3D scene renders (bloom composer, or the bare renderer when bloom is unavailable).
const SCENE_INIT = `window.__scene = 0;
(function hook(){ const T = window.THREE; if (!T || !T.WebGLRenderer) { setTimeout(hook, 0); return; }
  if (T.EffectComposer) { const r = T.EffectComposer.prototype.render; T.EffectComposer.prototype.render = function () { window.__scene++; return r.apply(this, arguments); }; }
})();`;

async function sample(page, cdp, ms) {
  const read = async () => {
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const c = await page.evaluate(() => ({ raf: window.__raf, scene: window.__scene }));
    return { ...m, ...c };
  };
  const a = await read();
  await page.waitForTimeout(ms);
  const b = await read();
  const s = ms / 1000, d = k => b[k] - a[k];
  return {
    raf: +(d('raf') / s).toFixed(1),                 // rAF callbacks per second
    scene: +(d('scene') / s).toFixed(1),             // 3D scene renders per second
    layouts: +(d('LayoutCount') / s).toFixed(1),     // layouts per second (forced ones included)
    styles: +(d('RecalcStyleCount') / s).toFixed(1),
    perFrame: d('scene') ? +(d('LayoutCount') / d('scene')).toFixed(2) : 0,   // layouts per rendered scene frame
    script: Math.round(d('ScriptDuration') * 1000 / s),   // ms of JS per second
    task: Math.round(d('TaskDuration') * 1000 / s),       // ms of main thread per second
  };
}

async function hide(page, hidden) {
  await page.evaluate(h => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

async function measure(browser, s, hash = '') {
  const { ctx, page, errors } = await openPage(browser, s, desktopUi.ctx, hash);
  await ctx.addInitScript(SCENE_INIT); await page.reload();
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const out = {};
  await desktopUi.ready(page);
  await page.mouse.move(110, 500);                       // parked over the left panel: nothing hovered on the map
  await page.waitForTimeout(3500);                       // intro assembly settles
  out.map = await sample(page, cdp, 3000);
  const mk = await page.evaluate(() => { const r = document.getElementById('marker').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(mk.x - 3, mk.y - 3); await page.mouse.move(mk.x, mk.y); await page.waitForTimeout(600);
  out.mapHover = await sample(page, cdp, 3000);          // a node is hovered: branch labels are laid out every frame
  await desktopUi.open(page, 'opt');
  await page.mouse.move(700, 500);                       // over the topic window, as when reading
  await page.waitForTimeout(3000);                       // window opens, minimap folds, typewriter was skipped
  out.theory = await sample(page, cdp, 3000);
  await page.click('#tab-practice'); await page.mouse.move(700, 500); await page.waitForTimeout(2500);
  out.practice = await sample(page, cdp, 3000);
  await hide(page, true); await page.waitForTimeout(300);
  out.hiddenTopic = await sample(page, cdp, 2000);
  await hide(page, false); await page.waitForTimeout(2500);
  out.practiceBack = await sample(page, cdp, 2000);      // visible again: still at rest
  await page.locator('#tab-practice').focus(); await page.keyboard.press('Escape'); await page.mouse.move(110, 500); await page.waitForTimeout(2500);
  out.mapAgain = await sample(page, cdp, 2000);          // back on the map: the loop is running again
  out.mini = await page.evaluate(() => { const b = document.getElementById('brain'); return b.classList.contains('mini'); });
  await hide(page, true); await page.waitForTimeout(300);
  out.hiddenMap = await sample(page, cdp, 2000);
  await hide(page, false); await page.waitForTimeout(600);
  out.mapShown = await sample(page, cdp, 1500);
  out.errors = errors.slice(0, 5);
  await ctx.close();
  return out;
}

async function run() {
  ensureDist();
  const s = new Suite('perf');
  const browser = await launch();
  try {
    const m = await measure(browser, s);
    const rest = (k, label) => s.check(`${label}: 0 rAF and 0 scene renders at rest`, m[k].raf === 0 && m[k].scene === 0, m[k]);
    await rest('theory', 'topic (theory)');
    await rest('practice', 'practice');
    await rest('hiddenTopic', 'hidden tab (topic)');
    await rest('practiceBack', 'practice after the tab is shown again');
    await rest('hiddenMap', 'hidden tab (map)');
    await s.check('map: the scene is rendered', m.map.scene > 1 && m.map.raf > 1, m.map);
    await s.check('map: one rAF chain per frame (rAF ≈ scene frames)', m.map.raf <= m.map.scene * 1.5 + 2, m.map);
    await s.check('map: no forced layout in the loop (≤ 1.2 layouts per frame)', m.map.perFrame <= 1.2, m.map);
    await s.check('map with a hovered node: ≤ 1.5 layouts per frame', m.mapHover.perFrame <= 1.5, m.mapHover);
    await s.check('back on the map the loop runs again', m.mapAgain.scene > 1, m.mapAgain);
    await s.check('map shown again after a hidden tab: the loop runs', m.mapShown.scene > 1, m.mapShown);
    await s.check('no page errors', m.errors.length === 0, m.errors);

    // the minimap in a topic is a still picture, but it must be a picture: the canvas is not blank after the loop stops
    {
      const { ctx, page } = await openPage(browser, s, desktopUi.ctx);
      await desktopUi.ready(page); await desktopUi.open(page, 'opt'); await page.waitForTimeout(3000);
      const shot = await page.locator('#brain').screenshot();
      await s.check('topic: the minimap still shows the brain (screenshot is not empty)', shot.length > 1500, { bytes: shot.length });
      // moving to the next topic wakes the scene for a moment (the minimap refocuses), then it rests again
      const before = await page.evaluate(() => window.__raf);
      await page.click('#tNav .tn-b.nx').catch(() => {});
      await page.waitForTimeout(400);
      const woke = (await page.evaluate(() => window.__raf)) - before;
      await s.check('topic: an action wakes the loop', woke > 0, woke);
      await ctx.close();
    }

    // phone stays as it was: nothing runs at rest
    {
      const { ctx, page } = await openPage(browser, s, IPHONE, '#phone');
      await phoneUi.ready(page); await page.waitForTimeout(1200);
      const a = await page.evaluate(() => window.__raf); await page.waitForTimeout(1500);
      const b = await page.evaluate(() => window.__raf);
      await s.check('phone list: 0 rAF at rest', b - a === 0, b - a);
      await phoneUi.open(page, 'opt'); await page.waitForTimeout(1500);
      const c = await page.evaluate(() => window.__raf); await page.waitForTimeout(1500);
      const d = await page.evaluate(() => window.__raf);
      await s.check('phone topic: 0 rAF at rest', d - c === 0, d - c);
      await ctx.close();
    }
  } catch (e) {
    await s.check('perf run crashed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  return s.result();
}

async function report() {
  ensureDist();
  const s = new Suite('perf');
  const browser = await launch();
  const hash = process.argv.find(a => a[0] === '#') || '';
  const m = await measure(browser, s, hash);
  await browser.close();
  const row = (k, label) => { const v = m[k]; console.log(`${label.padEnd(22)} rAF ${String(v.raf).padStart(6)}/s · scene ${String(v.scene).padStart(5)}/s · layouts ${String(v.layouts).padStart(6)}/s (${v.perFrame}/frame) · style ${String(v.styles).padStart(6)}/s · JS ${String(v.script).padStart(4)} ms/s · main thread ${String(v.task).padStart(4)} ms/s`); };
  row('map', 'map, idle'); row('mapHover', 'map, node hovered'); row('theory', 'topic: theory'); row('practice', 'topic: practice');
  row('hiddenTopic', 'hidden tab (topic)'); row('practiceBack', 'shown again'); row('mapAgain', 'back on the map'); row('hiddenMap', 'hidden tab (map)');
  if (m.errors.length) console.log('page errors:', m.errors);
}

module.exports = { run };
if (require.main === module) {
  if (process.argv.includes('--report')) report().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
  else run().then(r => process.exit(r.failed.length ? 1 : 0));
}
