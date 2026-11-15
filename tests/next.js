// NEXT design (review 14.11, items 12–13): html.next is off by default and lives next to the classic look.
//   1. off by default; #next / #classic / the settings button switch it; the choice survives a reload
//   2. without html.next the page is pixel-identical with and without the NEXT stylesheets
//   3. in html.next: text contrast ≥ 4.5:1, font sizes from the scale, touch targets ≥ 44px, no endless animations,
//      safe-area padding on every side, wide tables scroll inside themselves
//   node tests/next.js --contrast   prints the contrast table of the key texts
'use strict';
const { Suite, launch, openPage, ensureDist, docOverflow, IPHONE } = require('./lib');
const { desktopUi, phoneUi } = require('./ui');

const ANSWER = 'let name: String? = nil\nif let name {\n    print(name)\n} else {\n    print("no name")\n}';
const setTheme = (page, v) => page.evaluate(v => { v ? localStorage.setItem('syn.theme', v) : localStorage.removeItem('syn.theme'); }, v);
// a topic «в тумане» opens through «открыть всё равно»
async function openAny(page, id) {
  const { IDX } = require('./ui');
  await phoneUi.toList(page);
  await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); b.closest('.pl-br').classList.add('open'); b.click();
    const a = b.parentNode.querySelector('.pl-any'); if (a && !document.getElementById('main').classList.contains('is-topic')) a.click(); }, IDX[id].i);
  await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
  await page.waitForTimeout(300);
}
const isNext = page => page.evaluate(() => document.documentElement.classList.contains('next'));

// Runs in the page: every visible element that carries its own text, with its colour against the real background.
function auditText() {
  const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return [0, 0, 0, 0]; const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3]));
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const vw = innerWidth, vh = innerHeight, out = [];
  const SKIP = '#overlay .blabel, #overlay .hlabel, #overlay .tlab, #overlay .nlabel, #brain.mini *, #intro *, .xcur *, [aria-hidden="true"]';
  for (const el of document.querySelectorAll('body *')) {
    if (el.matches(SKIP) || el.closest('[aria-hidden="true"]')) continue;
    let own = ''; for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.trim(); const ph = (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && !el.value ? el.placeholder : '';
    if (!own && !ph) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const top = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + Math.min(r.width / 2, 6))), Math.min(vh - 1, Math.max(0, r.top + r.height / 2)));
    if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;       // covered by something else
    let fg = parse(ph ? getComputedStyle(el, '::placeholder').color : cs.color); if (fg[3] === 0) continue;
    let op = 1; const chain = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = getComputedStyle(e); op *= +c.opacity; const b = parse(c.backgroundColor); if (b[3] > 0) chain.push(b); if (b[3] === 1) break; }
    if (op < 0.05) continue;
    let bg = [5, 6, 7]; for (let i = chain.length - 1; i >= 0; i--) bg = over(chain[i], bg);
    const col = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    out.push({ sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
      text: (own || ph).slice(0, 28), ratio: +ratio(col, bg).toFixed(2), fs: +parseFloat(cs.fontSize).toFixed(2), disabled: !!el.disabled, ph: !!ph,
      code: !!el.closest('.term, .ed, pre, code, .lcode, .skb, .symbar') });
  }
  return out;
}

// Touch targets: visible buttons and links smaller than 44px in either direction.
function auditTargets() {
  const vw = innerWidth, vh = innerHeight, out = [];
  for (const el of document.querySelectorAll('button, a[href], [role=tab], summary, input[type=range]')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    if (el.closest('[hidden]') || cs.pointerEvents === 'none') continue;
    out.push({ sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
      row: !!el.closest('.ep-dots, .skb, .symbar, .ladder'), w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 16) });
  }
  return out;
}

// The screens every audit walks: list/map, lesson, practice before the key, practice after the key.
async function screens(page, ui, topic, visit) {
  await ui.ready(page); await page.waitForTimeout(ui === desktopUi ? 2500 : 400);
  if (ui === desktopUi) await page.mouse.move(110, 500);
  await visit('list');
  await ui.open(page, topic);
  if (await page.isVisible('#rootsSkip')) await page.click('#rootsSkip');
  if (ui === desktopUi) await page.mouse.move(700, 500);
  await page.waitForTimeout(900);
  await visit('lesson');
  await page.click('#tab-practice'); await page.waitForTimeout(900);
  if (ui === desktopUi && await page.isVisible('#skipType')) await page.click('#skipType');
  await page.waitForTimeout(300);
  await visit('practice');
  await page.evaluate(a => { const t = document.getElementById('ans'); t.value = a; t.dispatchEvent(new Event('input', { bubbles: true })); }, ANSWER);
  await page.evaluate(() => document.getElementById('showKey').click());
  await page.waitForTimeout(1500);
  if (ui === desktopUi && await page.isVisible('#skipType')) await page.click('#skipType');
  await page.waitForTimeout(300);
  await visit('key');
}

const SCALE = { phone: [12, 14, 16, 20, 28], desktop: [12, 13, 15, 20, 30] };

async function run() {
  ensureDist();
  const s = new Suite('next');
  const browser = await launch();
  try {
    // ---- 1. switch ----
    {
      const { ctx, page } = await openPage(browser, s, IPHONE, '#phone');
      await phoneUi.ready(page);
      await s.check('off by default', !(await isNext(page)));
      await s.check('settings: «ДИЗАЙН: КЛАССИКА» button exists', /КЛАССИКА/.test((await page.textContent('#themeBtn')) || ''));
      await page.evaluate(() => document.getElementById('themeBtn').click());
      await s.check('settings button turns NEXT on', await isNext(page));
      await s.check('choice is stored in syn.theme, not in pm.*', (await page.evaluate(() => localStorage.getItem('syn.theme'))) === 'next'
        && !(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('pm.') && /theme|next/.test(k)))));
      await page.reload(); await phoneUi.ready(page);
      await s.check('NEXT survives a reload', await isNext(page));
      await page.evaluate(() => document.getElementById('themeBtn').click());
      await s.check('settings button turns NEXT off', !(await isNext(page)));
      await ctx.close();
      for (const [hash, want] of [['#next', true], ['#classic', false]]) {
        const o = await openPage(browser, s, { viewport: { width: 1440, height: 900 } }, hash);
        await o.page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 });
        await s.check(`${hash} in the address → NEXT ${want ? 'on' : 'off'}`, (await isNext(o.page)) === want);
        if (want) { await o.page.goto('about:blank'); await o.page.goto(require('./lib').URL); await o.page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 });
          await s.check('#next is remembered for the next visit', await isNext(o.page)); }
        await o.ctx.close();
      }
    }

    // ---- 2. classic is untouched: same pixels with and without the NEXT stylesheets ----
    for (const ui of [phoneUi, desktopUi]) {
      const shots = {};
      for (const strip of [false, true]) {
        const { ctx, page } = await openPage(browser, s, { ...ui.ctx, reducedMotion: 'reduce' }, ui.hash, { noGL: true });
        if (strip) await page.evaluate(() => document.getElementById('themeNext').remove());
        await page.addStyleTag({ content: 'canvas,#brain,.xcur,.caret{visibility:hidden!important}' });   // the backdrop is random on every load
        await ui.ready(page); await ui.open(page, 'opt');
        if (await page.isVisible('#rootsSkip')) await page.click('#rootsSkip');
        await page.mouse.move(700, 500).catch(() => {});
        await page.waitForTimeout(900);
        const a = await page.screenshot();
        await page.click('#tab-practice'); await page.waitForTimeout(1200);
        const b = await page.screenshot();
        await page.evaluate(a => { const t = document.getElementById('ans'); t.value = a; t.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('showKey').click(); }, ANSWER);
        await page.waitForTimeout(1800);
        const c = await page.screenshot();
        shots[strip] = [a, b, c];
        await ctx.close();
      }
      ['lesson', 'practice', 'practice after the key'].forEach((n, i) => s.check(`classic ${ui.name}: ${n} is pixel-identical without the NEXT stylesheets`, shots[false][i].equals(shots[true][i])));
      await new Promise(r => setTimeout(r, 0));
    }

    // ---- 3. NEXT audits ----
    for (const ui of [phoneUi, desktopUi]) {
      const { ctx, page, errors } = await openPage(browser, s, ui.ctx, ui.hash);
      await setTheme(page, 'next'); await page.reload();
      await s.check(`${ui.name}: NEXT is on`, await isNext(page));
      const low = [], sizes = new Set(), small = [], anim = [];
      await screens(page, ui, 'opt', async name => {
        const t = await page.evaluate(auditText);
        t.filter(x => x.ratio < 4.5).forEach(x => low.push(`${name}: ${x.sel} «${x.text}» ${x.ratio}`));
        t.filter(x => !x.code && x.fs > 0).forEach(x => sizes.add(x.fs));
        // width: ladder circles, episode dots and keyboard keys share one row of a 390 screen and are measured by height only
        if (ui === phoneUi) (await page.evaluate(auditTargets)).filter(x => x.h < 44 || (x.w < 44 && !x.row)).forEach(x => small.push(`${name}: ${x.sel} «${x.text}» ${x.w}×${x.h}`));
        if (name !== 'list' || ui === phoneUi) (await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity)
          .map(a => a.animationName + ' @ ' + (a.effect.target ? a.effect.target.className : '?')))).forEach(x => anim.push(name + ': ' + x));
        const o = await docOverflow(page);
        await s.check(`${ui.name} ${name}: no horizontal page overflow`, o.sw <= o.cw + 1, o);
      });
      await s.check(`${ui.name}: every text ≥ 4.5:1`, low.length === 0, [...new Set(low)].slice(0, 12));
      const off = [...sizes].filter(v => !SCALE[ui.name].some(t => Math.abs(t - v) < 0.6));
      await s.check(`${ui.name}: font sizes come from the scale ${SCALE[ui.name].join('/')}`, off.length === 0, { off, all: [...sizes].sort((a, b) => a - b) });
      if (ui === phoneUi) {
        const bad = [...new Set(small)];
        await s.check('phone: touch targets ≥ 44px', bad.length === 0, bad.slice(0, 12));
      }
      await s.check(`${ui.name}: no endless animations`, anim.length === 0, [...new Set(anim)].slice(0, 6));
      await s.check(`${ui.name}: no page errors`, errors.length === 0, errors.slice(0, 5));
      await ctx.close();
    }

    // ---- phone: «Эпизод» dots, run close button, own keyboard ----
    {
      const { ctx, page } = await openPage(browser, s, IPHONE, '#phone');
      await setTheme(page, 'next'); await page.reload(); await phoneUi.ready(page);
      await phoneUi.open(page, 'opt'); if (await page.isVisible('#rootsSkip')) await page.click('#rootsSkip');
      const dots = await page.evaluate(() => [...document.querySelectorAll('.ep-dots button')].map(b => Math.round(b.getBoundingClientRect().height)));
      await s.check('phone: «Эпизод» dots are 44px high', dots.length > 0 && dots.every(h => h >= 44), dots);
      const nav = await page.evaluate(() => [...document.querySelectorAll('.navlist button, #navMore')].map(b => Math.round(b.getBoundingClientRect().height)));
      await s.check('phone: top navigation is 44px high', nav.every(h => h >= 44), nav);
      await page.click('#tab-practice'); await page.waitForTimeout(600);
      const rungs = await page.evaluate(() => [...document.querySelectorAll('#pane-practice .rung')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
      await s.check('phone: ladder circles are 44px high and ≥ 42 wide', rungs.every(r => r[1] >= 44 && r[0] >= 42), rungs);
      await page.tap('#ans'); await page.waitForTimeout(700);
      const keys = await page.evaluate(() => [...document.querySelectorAll('#skb .skb-row button')].map(b => Math.round(b.getBoundingClientRect().height)).filter(h => h > 0));
      if (keys.length) await s.check('phone: own keyboard keys are 44px high', keys.every(h => h >= 44), [...new Set(keys)]);
      else s.warn('own keyboard not shown — key height not checked');
      const fits = await page.evaluate(() => { const k = document.getElementById('skb'); if (!k) return true; const r = k.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
      await s.check('phone: the taller keyboard still fits the screen', fits);
      await ctx.close();
    }

    // ---- wide «Сравнение» tables (assoc, bsearch) scroll inside themselves ----
    {
      const { ctx, page } = await openPage(browser, s, IPHONE, '#phone');
      await setTheme(page, 'next'); await page.reload(); await phoneUi.ready(page);
      for (const id of ['assoc', 'bsearch']) {
        await openAny(page, id); await page.click('#tab-cheat'); await page.waitForTimeout(500);
        const t = await page.evaluate(() => [...document.querySelectorAll('#pane-cheat .ch-cmp')].map(e => { const r = e.getBoundingClientRect(); return { right: Math.round(r.right), scroll: e.scrollWidth > e.clientWidth + 1, ox: getComputedStyle(e).overflowX }; }));
        await s.check(`${id}: «Сравнение» stays inside the screen and scrolls sideways`, t.length > 0 && t.every(x => x.right <= 391 && x.ox === 'auto'), t);
        const o = await docOverflow(page);
        await s.check(`${id}: cheat sheet does not widen the page`, o.sw <= o.cw + 1, o);
      }
      await ctx.close();
    }

    // ---- safe area: landscape phone with a 47px notch on both sides ----
    {
      const { ctx, page } = await openPage(browser, s, { ...IPHONE, viewport: { width: 844, height: 390 } }, '#phone');
      await setTheme(page, 'next'); await page.reload();
      let ok = true;
      try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, right: 47, bottom: 21 } }); } catch (e) { ok = false; }
      if (ok) {
        await phoneUi.ready(page);
        const pad = sel => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e); return [parseFloat(c.paddingLeft), parseFloat(c.paddingRight)]; }, sel);
        const a = await pad('.nav'), b = await pad('#plist');
        await s.check('landscape: navigation and list keep clear of the notch (≥ 47px each side)', a && b && a[0] >= 47 && a[1] >= 47 && b[0] >= 47 && b[1] >= 47, { nav: a, list: b });
        await phoneUi.open(page, 'opt');
        const c = await pad('#topic');
        await s.check('landscape: topic keeps clear of the notch', c && c[0] >= 47 && c[1] >= 47, c);
      } else s.warn('safe-area emulation is not available in this Chromium — insets not checked');
      await ctx.close();
    }
  } catch (e) {
    await s.check('next run crashed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  return s.result();
}

// Contrast table of the key texts, classic vs NEXT (for the PR description).
async function contrastTable() {
  ensureDist();
  const s = new Suite('next'); const browser = await launch();
  const KEYS = [['Неактивная вкладка', '#tab-cheat'], ['«Не знаю — покажи»', '#dunno'], ['Подсказка под полем', '.ed-keys, #keySnd'], ['Закрытая кнопка ключа', '#showKey'],
    ['Подпись «Ключ откроется…»', '#gate'], ['Номер строки кода', '.p-code .ln i'], ['Placeholder поля ответа', '#ans'], ['Подпись «ТВОЙ ОТВЕТ»', '.answer label'], ['Текст условия', '.prompt'], ['Код задачи', '.p-code .ln code']];
  const rows = {};
  for (const theme of ['classic', 'next']) for (const ui of [phoneUi, desktopUi]) {
    const { ctx, page } = await openPage(browser, s, ui.ctx, ui.hash);
    await setTheme(page, theme); await page.reload(); await ui.ready(page); await ui.open(page, 'opt');
    if (await page.isVisible('#rootsSkip')) await page.click('#rootsSkip');
    await page.click('#tab-practice'); await page.waitForTimeout(1200);
    if (ui === desktopUi && await page.isVisible('#skipType')) await page.click('#skipType');
    await page.waitForTimeout(300);
    const all = await page.evaluate(auditText);
    const one = await page.evaluate(KEYS => KEYS.map(([n, sel]) => { const e = document.querySelector(sel); return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') : null; }), KEYS);
    for (let i = 0; i < KEYS.length; i++) {
      const sel = KEYS[i][1].split(',')[0].trim();
      const hit = await page.evaluate(({ sel, list }) => { const e = [...document.querySelectorAll(sel)].find(x => x.getBoundingClientRect().width > 0); if (!e) return null;
        const key = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
        const ph = e.tagName === 'TEXTAREA'; return list.find(x => x.sel === key && (!ph || x.ph)) || null; }, { sel, list: all });
      (rows[KEYS[i][0]] = rows[KEYS[i][0]] || {})[theme + '-' + ui.name] = hit ? hit.ratio : '—';
    }
    void one; await ctx.close();
  }
  await browser.close();
  console.log('| Текст | Классика, телефон | Классика, десктоп | NEXT, телефон | NEXT, десктоп |\n|---|---|---|---|---|');
  for (const [n, r] of Object.entries(rows)) console.log(`| ${n} | ${r['classic-phone']} | ${r['classic-desktop']} | ${r['next-phone']} | ${r['next-desktop']} |`);
}

module.exports = { run, auditText, auditTargets };
if (require.main === module) {
  if (process.argv.includes('--contrast')) contrastTable().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
  else run().then(r => process.exit(r.failed.length ? 1 : 0));
}
