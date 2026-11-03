// Stages and fog (backlog p.9): a topic is "in fog" while any lesson prereq is not «освоено».
// Desktop: stage strip over the map, the card's main button leads to the missing prereq, «открыть всё равно» is quiet.
// Phone: stage headers in the topic list, fog rows expand on tap (prereqs + «открыть всё равно»), rAF at rest stays 0.
'use strict';
const { Suite, launch, openPage, IPHONE, rafRate, docOverflow, ensureDist, topicsFromBuild } = require('./lib');

const T = topicsFromBuild();
const idx = id => T.findIndex(t => t.id === id);
let NAMES = {}; // engine titles, read from the phone list (data-i -> title)
const title = id => NAMES[idx(id)];

// urls and proto «освоено» (old-rule credit): realtime still needs async (41), which sits later on the map
const SEEDED = { 'pm.honest': JSON.stringify({ v: 1, at: 1 }), 'pm.legacy': JSON.stringify({ urls: 1, proto: 1 }) };

async function seed(page, map) {
  await page.evaluate(m => { localStorage.clear(); for (const [k, v] of Object.entries(m)) localStorage.setItem(k, v); }, map);
  await page.reload();
}

const press = (page, sel) => page.evaluate(q => document.querySelector(q).click(), sel); // the card follows its node, so it is never "stable"

async function desktop(s, browser) {
  const { page, errors } = await openPage(browser, s, { viewport: { width: 1440, height: 900 } });
  await page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 });
  await page.click('#inStart'); await page.waitForTimeout(1500);

  const st = await page.evaluate(() => [...document.querySelectorAll('#stages .stg')].map(e => ({ on: e.classList.contains('on'), t: e.textContent })));
  await s.check('desktop: 4 stages in the strip', st.length === 4, st);
  await s.check('desktop: stage 1 is current on fresh progress', st[0] && st[0].on && !st.slice(1).some(x => x.on), st);
  await s.check('desktop: later stages report fog', st[1] && /В ТУМАНЕ/.test(st[1].t), st[1]);
  const vis = await page.evaluate(() => { const r = document.getElementById('stages').getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.right <= innerWidth; });
  await s.check('desktop: stage strip visible within the window', vis);

  // walk the card from opt to state (stage 2): prereqs coll, func, flow not done -> fog
  await press(page, '#track button[data-go="0"]'); await page.waitForTimeout(300);
  for (let k = 0; k < idx('state'); k++) { await press(page, '#cNext'); await page.waitForTimeout(60); }
  const card = async () => page.evaluate(() => ({ title: document.getElementById('pTitle').textContent, cta: document.getElementById('cta').textContent,
    anyway: !document.getElementById('cAnyway').hidden, know: !document.getElementById('cKnow').hidden, meta: document.getElementById('pMeta').textContent }));
  let c = await card();
  await s.check('desktop: card reaches state', c.title === title('state'), c);
  await s.check('desktop: fog card says «В ТУМАНЕ» and what comes first', /В ТУМАНЕ/.test(c.meta) && /СНАЧАЛА/.test(c.meta), c.meta);
  await s.check('desktop: main button leads to the missing prereq', c.cta.startsWith('СНАЧАЛА: ') && c.cta.includes(title('coll')), c.cta);
  await s.check('desktop: quiet «открыть всё равно» instead of «Уже знаю»', c.anyway && !c.know, c);
  await press(page, '#cta'); await page.waitForTimeout(400);
  c = await card();
  await s.check('desktop: main button selects the prereq', c.title === title('coll') && !c.anyway, c);
  await s.check('desktop: open topic is not in fog', !/В ТУМАНЕ/.test(c.meta), c.meta);
  for (let k = idx('coll'); k < idx('state'); k++) { await press(page, '#cNext'); await page.waitForTimeout(60); }
  await press(page, '#cAnyway');
  await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
  const tt = ((await page.textContent('#tTitle')) || '').trim();
  await s.check('desktop: «открыть всё равно» opens the fog topic', title('state').startsWith(tt.slice(0, 10)), tt);
  await s.check('desktop: no page errors', errors.length === 0, errors);
  await page.context().close();
}

async function phone(s, browser) {
  const { page, errors } = await openPage(browser, s, IPHONE);
  await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 });
  NAMES = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#plist .pl-t')].map(b => [b.dataset.i, b.querySelector('.pl-tt').firstChild.textContent])));
  const stg = await page.evaluate(() => [...document.querySelectorAll('#plist .pl-stg')].map(e => ({ on: e.classList.contains('on'), t: e.textContent })));
  await s.check('phone: 4 stage headers in the list', stg.length === 4, stg);
  await s.check('phone: stage 1 is current', stg[0] && stg[0].on, stg);

  const row = i => `#plist .pl-t[data-i="${i}"]`;
  await page.tap('#plist .pl-bh[data-b="1"]'); await page.waitForTimeout(150);
  const r = await page.evaluate(sel => { const b = document.querySelector(sel); return b && { cls: b.className, st: b.querySelector('.pl-st').textContent, need: (b.querySelector('.pl-need') || {}).textContent || '' }; }, row(idx('state')));
  await s.check('phone: state row is in fog', r && /st-fog/.test(r.cls) && r.st === 'В ТУМАНЕ', r);
  await s.check('phone: fog row names the missing prereqs', r && r.need.includes(title('coll')), r);
  const open0 = await page.evaluate(() => document.getElementById('main').classList.contains('is-topic'));
  await page.tap(row(idx('state'))); await page.waitForTimeout(200);
  const ask = await page.evaluate(sel => { const b = document.querySelector(sel), li = b.parentNode;
    return { ask: li.classList.contains('ask'), go: li.querySelectorAll('.pl-go').length, any: !!li.querySelector('.pl-any'), topic: document.getElementById('main').classList.contains('is-topic') }; }, row(idx('state')));
  await s.check('phone: tap on a fog row expands it instead of opening', !open0 && ask.ask && !ask.topic && ask.go === 3 && ask.any, ask);
  const o = await docOverflow(page);
  await s.check('phone: no horizontal overflow with an expanded fog row', o.sw <= o.cw + 1, o);
  const raf = await rafRate(page);
  await s.check('phone: rAF at rest stays ~0 with fog', raf <= 2, raf + '/s');

  await page.tap(`${row(idx('state'))} ~ .pl-ask .pl-go`);
  await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
  let tt = ((await page.textContent('#tTitle')) || '').trim();
  await s.check('phone: prereq button opens the prereq', title('coll').startsWith(tt.slice(0, 10)), tt);
  await page.tap('#winClose'); await page.waitForTimeout(400);
  if (!(await page.isVisible(row(idx('state'))))) { await page.tap('#plist .pl-bh[data-b="1"]'); await page.waitForTimeout(150); }
  await page.tap(row(idx('state'))); await page.waitForTimeout(150);
  await page.tap(`${row(idx('state'))} ~ .pl-ask .pl-any`);
  await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
  tt = ((await page.textContent('#tTitle')) || '').trim();
  await s.check('phone: «открыть всё равно» opens the fog topic', title('state').startsWith(tt.slice(0, 10)), tt);

  // realtime (28) needs async (41): with urls + proto done, only async is missing
  await seed(page, SEEDED);
  await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 });
  await page.evaluate(() => { const h = document.querySelector('#plist .pl-bh[data-b="2"]'); if (h.getAttribute('aria-expanded') !== 'true') h.click(); });
  await page.waitForTimeout(150);
  const rt = await page.evaluate(sel => { const b = document.querySelector(sel); return { cls: b.className, need: (b.querySelector('.pl-need') || {}).textContent || '' }; }, row(idx('realtime')));
  await s.check('phone: realtime in fog until async is «освоено»', /st-fog/.test(rt.cls) && rt.need.includes(title('async')), rt);
  await s.check('phone: done prereqs are not listed as missing', !rt.need.includes(title('urls')) && !rt.need.includes(title('proto')), rt.need);
  const urls = await page.evaluate(sel => document.querySelector(sel).className, row(idx('urls')));
  await s.check('phone: «освоено» topic is not in fog', !/st-fog/.test(urls), urls);
  await s.check('phone: no page errors', errors.length === 0, errors);
  await page.context().close();
}

async function run() {
  ensureDist();
  const s = new Suite('fog');
  const browser = await launch();
  try { await phone(s, browser); } catch (e) { await s.check('phone fog flow ran', false, String(e && e.message || e)); }
  try { await desktop(s, browser); } catch (e) { await s.check('desktop fog flow ran', false, String(e && e.message || e)); }
  await browser.close();
  return s.result();
}

module.exports = { run };
if (require.main === module) run().then(r => { console.log(r); process.exit(r.failed.length ? 1 : 0); });
