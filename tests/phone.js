// Phone mode: iPhone-sized touch context (390x844). No intro, topic list instead of the 3D map,
// no WebGL, no rAF loops at rest, nothing wider than the screen.
'use strict';
const { Suite, launch, openPage, IPHONE, rafRate, docOverflow, rectOf, inViewport, ensureDist } = require('./lib');

const MAX_RAF = 2; // rAF callbacks per second allowed at rest

async function run() {
  ensureDist();
  const s = new Suite('phone');
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, IPHONE);
  const VW = IPHONE.viewport.width, VH = IPHONE.viewport.height;
  const noHScroll = async where => {
    const o = await docOverflow(page);
    await s.check(`${where}: no horizontal page overflow`, o.sw <= o.cw + 1, o);
  };
  const quiet = async where => {
    const r = await rafRate(page);
    await s.check(`${where}: rAF at rest <= ${MAX_RAF}/s`, r <= MAX_RAF, r + '/s');
  };
  try {
    await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 });
    const st = await page.evaluate(() => ({
      phone: document.documentElement.classList.contains('phone'),
      introVisible: (() => { const e = document.getElementById('intro'); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; })(),
      webgl: !!document.querySelector('canvas') && (() => { const c = document.getElementById('c'); return !!(c && c.width > 300 && c.getBoundingClientRect().width > 0); })(),
      rows: document.querySelectorAll('#plist .pl-t').length,
    }));
    await s.check('html.phone is set', st.phone, st);
    await s.check('intro is skipped', !st.introVisible, st);
    await s.check('3D map canvas not shown', !st.webgl, st);
    await s.check('topic list has rows', st.rows > 0, st);
    await noHScroll('list');
    await quiet('list');

    // open a topic from the list
    const row = page.locator('#plist .pl-br.open .pl-t').first();
    const title = ((await row.locator('.pl-tt').textContent()) || '').trim();
    await row.tap();
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
    const tTitle = ((await page.textContent('#tTitle')) || '').trim();
    await s.check('tapped topic opens', tTitle.length > 0 && title.startsWith(tTitle.slice(0, 12)), { row: title, window: tTitle });

    for (const n of ['theory', 'cheat', 'practice', 'tasks']) {
      const r = await rectOf(page, '#tab-' + n);
      await s.check(`tab ${n} visible within viewport`, inViewport(r, VW, VH), r);
    }

    // theory: reveal a few blocks
    for (let k = 0; k < 3; k++) if (await page.isVisible('#tMore')) { await page.tap('#tMore'); await page.waitForTimeout(150); }
    const shown = await page.evaluate(() => document.querySelectorAll('#pane-theory .tb:not(.locked)').length);
    await s.check('theory reveals blocks on tap', shown >= 2, shown);
    await noHScroll('theory');
    await quiet('theory');

    for (const n of ['cheat', 'practice']) {
      await page.tap('#tab-' + n);
      await page.waitForTimeout(300);
      await s.check(`${n} pane shown`, await page.isVisible('#pane-' + n));
      await noHScroll(n);
      await quiet(n);
    }
    await page.tap('#tab-tasks'); await page.waitForTimeout(300);
    await noHScroll('tasks');
    await page.tap('#tab-theory'); await page.waitForTimeout(200);

    // back to the list
    await page.tap('#winClose');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({ list: !!document.getElementById('plist') && !document.getElementById('plist').hidden && document.getElementById('plist').getBoundingClientRect().height > 0,
      topic: document.getElementById('main').classList.contains('is-topic') }));
    await s.check('close returns to the list', back.list && !back.topic, back);
    await quiet('list after back');

    // run modal
    await page.tap('#runBtn');
    await page.waitForSelector('#run:not([hidden])', { timeout: 3000 });
    await page.waitForTimeout(300);
    const rw = await rectOf(page, '#run .run-w');
    await s.check('run modal within viewport', inViewport(rw, VW, VH), rw);
    await noHScroll('run modal');
    await page.tap('#runClose');
    await page.waitForTimeout(300);
    await s.check('run modal closes', await page.isHidden('#run'));

    // a topic with every step passed still opens (it lands on the bank instead of a step)
    await page.evaluate(() => {
      const d = JSON.parse(document.getElementById('data').textContent);
      for (const [id, c] of Object.entries(d.content)) if (c.steps && c.steps.length)
        localStorage.setItem('pm.steps.' + id, JSON.stringify(Object.fromEntries(c.steps.map(x => [x.id, 'ok']))));
    });
    await page.reload();
    await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 });
    await page.locator('#plist .pl-br.open .pl-t').first().tap();
    const doneOpen = await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 }).then(() => true, () => false);
    await s.check('topic with all steps passed opens', doneOpen, errors.slice(0, 3));

    await s.check('no page errors', errors.length === 0, errors.slice(0, 5));
  } catch (e) {
    await s.check('phone run crashed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  return s.result();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed.length ? 1 : 0));
