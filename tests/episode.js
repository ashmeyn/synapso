// «Эпизод» (phone only): the lesson is a stack of cards, one ## section per screen.
// Swipe (real touch scroll gesture via CDP) and buttons move between cards, dots show progress,
// ГЛУБЖЕ is a separate bonus episode, the last card leads into «Выгрузка».
// No horizontal page overflow on any card of any lesson, rAF at rest stays at 0.
'use strict';
const { Suite, launch, openPage, IPHONE, rafRate, docOverflow, ensureDist, topicsFromBuild, dataFromBuild } = require('./lib');

const T = topicsFromBuild(), IDX = Object.fromEntries(T.map(t => [t.id, t]));
const DATA = dataFromBuild();

async function openTopic(page, id) {
  if (await page.evaluate(() => document.getElementById('main').classList.contains('is-topic'))) { await page.tap('#winClose'); await page.waitForTimeout(250); }
  await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); b.closest('.pl-br').classList.add('open'); b.click(); }, IDX[id].i);
  await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
  await page.waitForTimeout(250);
}
const epState = page => page.evaluate(() => {
  const ep = document.getElementById('ep'), tr = document.getElementById('epTrack');
  if (!ep) return null;
  const dots = [...document.querySelectorAll('#epDots button')];
  const w = tr.clientWidth;
  return { bonus: ep.classList.contains('bonus'), cards: tr.children.length, dots: dots.length,
    on: dots.findIndex(d => d.classList.contains('on')), past: dots.filter(d => d.classList.contains('past')).length,
    n: document.getElementById('epN').textContent, k: w ? Math.round(tr.scrollLeft / w) : -1,
    snap: Math.abs(tr.scrollLeft - Math.round(tr.scrollLeft / Math.max(1, w)) * w) < 2,
    next: !document.getElementById('epNext').hidden, prevDis: document.getElementById('epPrev').disabled,
    toOut: !!document.querySelector('#epTrack > .ep-card:last-child #toOut') };
});
// a real touch drag on the track (touchStart → moves → touchEnd): the browser's own scroll-snap decides where it lands
// sel: what to put the finger on inside the current card (default: its heading, away from code blocks)
async function swipe(page, cdp, dx, sel = 'h3, .m-k') {
  const r = await page.evaluate(sel => { const tr = document.getElementById('epTrack'), w = tr.clientWidth, c = tr.children[Math.round(tr.scrollLeft / w)];
    const b = (c.querySelector(sel) || c).getBoundingClientRect(); return { x: tr.getBoundingClientRect().left + w / 2, y: b.top + Math.min(b.height / 2, 12) }; }, sel);
  const x0 = Math.round(r.x - dx / 2), y = Math.round(r.y);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(x0 + dx * k / 10), y }] }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
}

async function run() {
  ensureDist();
  const s = new Suite('episode');
  const browser = await launch();
  const { ctx, page, errors } = await openPage(browser, s, IPHONE, '#phone');
  const cdp = await ctx.newCDPSession(page);
  const VW = IPHONE.viewport.width;
  try {
    await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 });
    const L = DATA.content.opt.lesson, nBase = (L.mission ? 1 : 0) + L.base.length + 1;
    await openTopic(page, 'opt');
    let e = await epState(page);
    await s.check('theory on the phone is an episode', !!e && !(await page.$('#tMore')), e);
    await s.check('one card per ## section + mission + finale', e.cards === nBase && e.dots === nBase, { e, nBase });
    await s.check('starts on card 1, dot 1 lit', e.on === 0 && e.k === 0 && e.n === '01 / ' + String(nBase).padStart(2, '0') && e.prevDis, e);
    const geo = await page.evaluate(() => { const tr = document.getElementById('epTrack'), c = tr.children[0].getBoundingClientRect(), t = tr.getBoundingClientRect();
      return { cw: c.width, tw: t.width, l: c.left, tl: t.left, body: getComputedStyle(document.getElementById('winBody')).overflowY }; });
    await s.check('a card fills the track (one section per screen)', Math.abs(geo.cw - geo.tw) < 1 && Math.abs(geo.l - geo.tl) < 1, geo);
    await s.check('window body does not scroll under the episode', geo.body === 'hidden', geo);
    const snap = await page.evaluate(() => getComputedStyle(document.getElementById('epTrack')).scrollSnapType);
    await s.check('track uses CSS scroll-snap', /x/.test(snap) && /mandatory/.test(snap), snap);
    const r0 = await rafRate(page, 1500);
    await s.check('episode at rest: rAF = 0', r0 === 0, r0 + '/s');

    // buttons
    await page.tap('#epNext'); await page.waitForTimeout(200);
    e = await epState(page);
    await s.check('ДАЛЬШЕ → card 2', e.on === 1 && e.k === 1 && e.past === 1 && !e.prevDis && e.snap, e);
    await page.tap('#epPrev'); await page.waitForTimeout(200);
    e = await epState(page);
    await s.check('◂ → back to card 1', e.on === 0 && e.k === 0, e);

    // swipe
    await swipe(page, cdp, -260);
    e = await epState(page);
    await s.check('swipe left → next card', e.k === 1 && e.on === 1 && e.snap, e);
    await swipe(page, cdp, -260);
    e = await epState(page);
    await s.check('swipe again → card 3', e.k === 2 && e.on === 2, e);
    await swipe(page, cdp, 260);
    e = await epState(page);
    await s.check('swipe right → back one card', e.k === 1 && e.on === 1, e);
    // a swipe on a wide code block scrolls the code, not the card
    const codeCard = await page.evaluate(() => [...document.getElementById('epTrack').children].findIndex(c => [...c.querySelectorAll('.lcode')].some(p => p.scrollWidth > p.clientWidth + 4)));
    if (codeCard >= 0) {
      await page.tap(`#epDots button[data-k="${codeCard}"]`); await page.waitForTimeout(200);
      await page.evaluate(k => { const p = [...document.getElementById('epTrack').children[k].querySelectorAll('.lcode')].find(p => p.scrollWidth > p.clientWidth + 4); p.id = 'wideCode'; p.scrollIntoView({ block: 'center', inline: 'nearest' }); }, codeCard);
      await swipe(page, cdp, -200, '#wideCode');
      e = await epState(page);
      const cs = await page.evaluate(() => document.getElementById('wideCode').scrollLeft);
      await s.check('swipe on wide code scrolls the code, card stays', e.k === codeCard && cs > 20, { e, codeScroll: cs, codeCard });
      await page.tap('#epDots button[data-k="1"]'); await page.waitForTimeout(200);
    } else s.warn('opt has no wide code block to swipe');
    const r1 = await rafRate(page, 1500);
    await s.check('after a swipe: rAF = 0', r1 === 0, r1 + '/s');

    // dots jump
    await page.tap(`#epDots button[data-k="${nBase - 2}"]`); await page.waitForTimeout(200);
    e = await epState(page);
    await s.check('tap a dot → that card', e.k === nBase - 2 && e.on === nBase - 2, e);
    await s.check('label before the finale reads ФИНАЛ', /ФИНАЛ/.test(await page.textContent('#epNext')));

    // position survives a tab switch
    await page.tap('#tab-practice'); await page.waitForTimeout(250);
    await page.tap('#tab-theory'); await page.waitForTimeout(350);
    e = await epState(page);
    await s.check('tab switch keeps the card', e.k === nBase - 2 && e.on === nBase - 2, e);

    // finale → «Выгрузка» → back
    await page.tap('#epNext'); await page.waitForTimeout(200);
    e = await epState(page);
    await s.check('finale: no ДАЛЬШЕ, «Выгрузка» button on the card', e.k === nBase - 1 && !e.next && e.toOut, e);
    await s.check('finale offers the bonus', await page.isVisible('#toDeep'));
    await page.tap('#toOut'); await page.waitForTimeout(300);
    await s.check('«Выгрузка» opens from the finale', await page.isVisible('#out') && await page.isVisible('#outAns'));
    await page.tap('#outBack'); await page.waitForTimeout(350);
    e = await epState(page);
    await s.check('«← К УРОКУ» returns to the finale', !!e && e.k === nBase - 1, e);

    // bonus episode
    await page.tap('#toDeep'); await page.waitForTimeout(300);
    e = await epState(page);
    const nDeep = L.deeper.length + 1;
    await s.check('ГЛУБЖЕ is a separate bonus episode', e.bonus && e.cards === nDeep && e.k === 0 && !e.prevDis, { e, nDeep });
    const bonusTxt = await page.textContent('#epTrack > .ep-card');
    await s.check('bonus starts with the first deeper section', bonusTxt.includes(L.deeper[0].h.replace(/<[^>]+>/g, '').slice(0, 10)), bonusTxt.slice(0, 80));
    await page.tap('#epPrev'); await page.waitForTimeout(300);
    e = await epState(page);
    await s.check('◂ on bonus card 1 → base finale', !e.bonus && e.k === nBase - 1, e);
    await page.tap('#toDeep'); await page.waitForTimeout(300);
    await page.tap(`#epDots button[data-k="${nDeep - 1}"]`); await page.waitForTimeout(200);
    e = await epState(page);
    await s.check('bonus finale also leads into «Выгрузка»', e.bonus && e.toOut && await page.isVisible('#epBase'), e);
    await page.tap('#epBase'); await page.waitForTimeout(300);
    e = await epState(page);
    await s.check('← К ОСНОВНОМУ ЭПИЗОДУ → base finale', !e.bonus && e.k === nBase - 1, e);

    // every lesson: card count, no card wider than the screen, no page overflow
    const bad = [], over = [];
    for (const t of T) {
      const c = DATA.content[t.id]; if (!c || !c.lesson) continue;
      await openTopic(page, t.id);
      const exp = (c.lesson.mission ? 1 : 0) + c.lesson.base.length + 1;
      const m = await page.evaluate(() => {
        const tr = document.getElementById('epTrack'); if (!tr) return null;
        const de = document.documentElement, cards = [...tr.children];
        // anything outside a code block that sticks out of its card (code scrolls inside its own box)
        const wide = cards.map((x, k) => { const cr = x.getBoundingClientRect();
          return [k, [...x.querySelectorAll('*')].filter(e => !e.closest('.lcode') || e.matches('.lcode')).reduce((m, e) => Math.max(m, e.getBoundingClientRect().right - cr.right), 0)]; }).filter(x => x[1] > 1);
        return { n: cards.length, wide,
          codeOut: [...tr.querySelectorAll('.lcode')].filter(p => p.getBoundingClientRect().width > tr.clientWidth + 1).length,
          doc: Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth };
      });
      if (!m || m.n !== exp) bad.push({ id: t.id, got: m && m.n, exp });
      else if (m.wide.length || m.codeOut || m.doc > 1) over.push({ id: t.id, ...m });
    }
    await s.check('every lesson is an episode with the right card count', !bad.length, bad.slice(0, 5));
    await s.check('no card / code block wider than the screen, no page h-scroll', !over.length, over.slice(0, 5));
    const o = await docOverflow(page);
    await s.check('document width = viewport', o.sw <= VW + 1, o);

    await s.check('no page errors', errors.length === 0, errors.slice(0, 5));
  } catch (err) {
    await s.check('episode run crashed', false, String(err && err.stack || err).split('\n').slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  // desktop is untouched: the theory is still the reveal-by-block column
  const d = new Suite('episode-desktop');
  const b2 = await launch();
  try {
    const { page } = await openPage(b2, d, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, '#desktop', { noGL: true });
    await page.waitForSelector('#inStart', { state: 'visible', timeout: 15000 });
    await page.click('#inStart'); await page.waitForTimeout(400);
    await page.keyboard.press('Control+k'); await page.keyboard.type(IDX.opt.full.slice(0, 12)); await page.waitForTimeout(200);
    await page.click(`#palList button[data-i="${IDX.opt.i}"]:not(.gl)`);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 6000 });
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ ep: !!document.getElementById('ep'), more: !!document.getElementById('tMore'), theory: !!document.querySelector('#pane-theory > .theory.lesson') }));
    await d.check('desktop: no episode, theory column with ДАЛЬШЕ', !st.ep && st.more && st.theory, st);
  } catch (err) { await d.check('desktop run crashed', false, String(err && err.message || err)); }
  finally { await b2.close(); }
  const a = s.result(), b = d.result();
  return { name: 'episode', passed: a.passed + b.passed, failed: a.failed.concat(b.failed), warnings: a.warnings.concat(b.warnings) };
}

module.exports = { run };
if (require.main === module) run().then(r => { console.log(r); process.exit(r.failed.length ? 1 : 0); });
