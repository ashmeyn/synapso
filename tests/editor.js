// Desktop answer field (review 14.11, bug 7): the highlighted copy of a long answer stays inside the field,
// and Esc inside the field does not close the topic (first Esc releases Tab, second leaves the field, third closes).
'use strict';
const { Suite, launch, openPage, ensureDist } = require('./lib');
const { desktopUi, inTopic } = require('./ui');

async function run() {
  ensureDist();
  const s = new Suite('editor');
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, desktopUi.ctx, desktopUi.hash, { noGL: true });
  try {
    await desktopUi.ready(page);
    await desktopUi.open(page, 'opt');
    await page.click('#tab-practice'); await page.waitForTimeout(400);
    await page.click('.rung[data-step="2"]'); await page.waitForTimeout(300);

    // ---------- a 30-line answer scrolled to the end: nothing is painted outside the field ----------
    const text = Array.from({ length: 30 }, (_, k) => 'let value' + k + ' = compute(input: ' + k + ')').join('\n');
    await page.fill('#ans', text);
    await page.evaluate(() => { const ta = document.getElementById('ans'); ta.scrollTop = ta.scrollHeight; ta.dispatchEvent(new Event('scroll')); });
    await page.waitForTimeout(200);
    const g = await page.evaluate(() => {
      const ed = document.getElementById('ed'), hl = document.getElementById('edHl'), cs = getComputedStyle(ed);
      const e = ed.getBoundingClientRect(), h = hl.getBoundingClientRect();
      return { hlShown: !hl.hidden && hl.textContent.length > 100, above: Math.round(e.top - h.top), clipped: cs.overflow !== 'visible' || (cs.clipPath && cs.clipPath !== 'none'),
        corners: getComputedStyle(ed, '::before').content !== 'none' };
    });
    await s.check('precondition: the highlight layer is taller than the field', g.hlShown && g.above > 40, g);
    await s.check('the highlight layer is clipped to the field', g.clipped, g);
    await s.check('the field keeps its corner marks', g.corners, g);
    await page.fill('#ans', ''); await page.waitForTimeout(100);

    // ---------- Esc ----------
    await page.click('#ans'); await page.keyboard.type('let a = 1');
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    await s.check('Esc in the field: the topic stays open', await inTopic(page));
    await s.check('Esc in the field: the text is intact', (await page.inputValue('#ans')) === 'let a = 1');
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    await s.check('second Esc: leaves the field, topic still open', (await inTopic(page)) && !(await page.evaluate(() => document.activeElement && document.activeElement.id === 'ans')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(700);
    await s.check('Esc outside the field closes the topic as before', !(await inTopic(page)));
    await s.check('no page errors', !errors.length, errors.slice(0, 3));
  } finally { await browser.close(); }
  return s.result();
}

module.exports = { run };
