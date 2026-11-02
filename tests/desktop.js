// Desktop 1440x900 with WebGL: intro -> map, Ctrl+K search, all tabs, practice key flow, Escape back.
'use strict';
const { Suite, launch, openPage, rafRate, docOverflow, ensureDist } = require('./lib');

async function run() {
  ensureDist();
  const s = new Suite('desktop');
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, { viewport: { width: 1440, height: 900 } });
  const modeIs = () => page.evaluate(() => ({
    intro: document.querySelector('.app').classList.contains('intro-on'),
    topic: document.getElementById('main').classList.contains('is-topic'),
  }));
  try {
    await page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 });
    await s.check('html.phone not set', !(await page.evaluate(() => document.documentElement.classList.contains('phone'))));
    await s.check('starts on intro', (await modeIs()).intro);
    await page.click('#inStart');
    await page.waitForTimeout(1500);
    const m = await modeIs();
    await s.check('#inStart leads to the map', !m.intro && !m.topic, m);
    const gl = await page.evaluate(() => {
      const c = document.getElementById('c'); if (!c) return { canvas: false };
      const r = c.getBoundingClientRect();
      const ctx = c.getContext('webgl2') || c.getContext('webgl');
      return { canvas: true, w: Math.round(r.width), h: Math.round(r.height), webgl: !!ctx && !ctx.isContextLost() };
    });
    await s.check('WebGL map canvas present', gl.canvas && gl.webgl && gl.w > 300 && gl.h > 300, gl);
    const raf = await rafRate(page, 1500);
    await s.check('map is animating (rAF running)', raf > 1, raf + '/s');
    const o = await docOverflow(page);
    await s.check('no horizontal page overflow on map', o.sw <= o.cw + 1, o);

    // Ctrl+K search
    await page.keyboard.press('Control+k');
    await s.check('Ctrl+K opens the palette', await page.isVisible('#palInput'));
    await page.keyboard.type('Optional');
    await page.waitForTimeout(200);
    const row = page.locator('#palList button:not(.gl)').first();
    await s.check('palette finds "Optional"', (await row.count()) > 0);
    await row.click();
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 6000 });
    const title = ((await page.textContent('#tTitle')) || '').trim();
    await s.check('topic window opened for Optional', /optional/i.test(title), title);

    for (const n of ['theory', 'cheat', 'practice', 'tasks']) {
      await page.click('#tab-' + n);
      await page.waitForTimeout(500);
      const ok = await page.evaluate(n => document.getElementById('tab-' + n).getAttribute('aria-selected') === 'true'
        && !document.getElementById('pane-' + n).hidden, n);
      await s.check(`tab ${n} switches`, ok);
      const txt = await page.evaluate(n => document.getElementById('pane-' + n).textContent.trim().length, n);
      await s.check(`pane ${n} has content`, txt > 0);
    }

    // theory typewriter can be skipped
    await page.click('#tab-theory');
    await page.waitForTimeout(450);
    if (await page.isVisible('#skipType')) { await page.click('#skipType'); await s.check('#skipType hides after skip', await page.isHidden('#skipType')); }

    // practice: answer -> show key
    await page.click('#tab-practice');
    await page.waitForTimeout(500);
    if (await page.isVisible('#ans')) {
      await s.check('key is locked before answering', await page.isDisabled('#showKey'));
      await page.fill('#ans', 'let x: Int? = nil');
      await page.waitForTimeout(150);
      await s.check('key unlocks after answering', await page.isEnabled('#showKey'));
      await page.click('#showKey');
      await page.waitForTimeout(600);
      const key = await page.evaluate(() => (document.getElementById('keyBox').textContent || '').trim().length);
      await s.check('key is shown', key > 0, key);
    } else s.warn('practice answer box not visible - key flow skipped');

    // Escape back to the map
    await page.locator('#tab-practice').focus();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const back = await modeIs();
    await s.check('Escape returns to the map', !back.topic && !back.intro, back);

    await s.check('no page errors', errors.length === 0, errors.slice(0, 5));
  } catch (e) {
    await s.check('desktop run crashed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  return s.result();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed.length ? 1 : 0));
