// Web fonts must not block the page (review 14.11, item 10): with the Google Fonts stylesheet hanging forever
// the topic list (phone) and the intro (desktop) still appear; a stylesheet that arrives late is applied.
'use strict';
const { Suite, launch, URL, IPHONE, ensureDist } = require('./lib');

async function open(browser, ctxOpts, hash, onCss) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route(/fonts\.gstatic\.com/, r => r.abort());
  await ctx.route(/fonts\.googleapis\.com/, onCss);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.goto(URL + hash, { waitUntil: 'commit' }).catch(() => {});
  return { ctx, page, errors };
}

async function run() {
  ensureDist();
  const s = new Suite('fonts');
  const browser = await launch();
  try {
    for (const [name, ctxOpts, hash, sel] of [['phone', IPHONE, '#phone', '#plist'], ['desktop', { viewport: { width: 1440, height: 900 } }, '#desktop', '#inStart']]) {
      // 1. the stylesheet never answers
      let { ctx, page, errors } = await open(browser, ctxOpts, hash, () => { /* hang: never fulfil */ });
      s.page = page;
      const t0 = Date.now();
      const shown = await page.waitForSelector(sel, { state: 'visible', timeout: 6000 }).then(() => true, () => false);
      await s.check(`${name}: page is usable while the font stylesheet hangs`, shown, { ms: Date.now() - t0 });
      await s.check(`${name}: no page errors with hanging fonts`, !errors.length, errors.slice(0, 2));
      await ctx.close();
      // 2. the stylesheet arrives 1.2 s late: it is switched on
      ({ ctx, page, errors } = await open(browser, ctxOpts, hash, r => setTimeout(() => r.fulfill({ status: 200, contentType: 'text/css', body: ':root{--late-fonts:1}' }).catch(() => {}), 1200)));
      s.page = page;
      await page.waitForSelector(sel, { state: 'visible', timeout: 6000 }).catch(() => {});
      const early = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--late-fonts').trim());
      await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--late-fonts').trim() === '1', null, { timeout: 5000 }).catch(() => {});
      const late = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--late-fonts').trim());
      await s.check(`${name}: a late font stylesheet is applied`, late === '1', { early, late });
      await s.check(`${name}: fonts are requested with display=swap`, await page.evaluate(() => { const l = document.querySelector('link[href*="fonts.googleapis.com/css2"]'); return !!l && /display=swap/.test(l.href); }));
      await ctx.close();
    }
  } finally { await browser.close(); }
  return s.result();
}

module.exports = { run };
