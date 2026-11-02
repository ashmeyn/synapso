// Honest status (backlog «Обучение» 1–3), on the phone and on the desktop:
// a topic is not done without step 7 by memory and «Выгрузка»; the key needs a real answer or «не знаю — покажи»;
// an SRS review starts from an empty step-7 field; progress saved by the old rules is still read (and kept done).
'use strict';
const { Suite, launch, openPage, IPHONE, rafRate, ensureDist, topicsFromBuild } = require('./lib');

const DAY = 86400000;

// localStorage snapshot of the old engine: opt with 5 of 7 steps «ok» (old rule: done), coll with «Уже знаю» (pm.known),
// func with 3 steps (in progress), an old step-7 answer and an SRS record due today on opt.
function oldProgress(now) {
  return {
    'pm.steps.opt': JSON.stringify({ s1: 'ok', s2: 'ok', s3: 'ok', s4: 'ok', s7: 'ok' }),
    'pm.ans.opt.s7': JSON.stringify('func greet() -> String { OLD ANSWER }'),
    'pm.doneAt.opt': JSON.stringify(now - 10 * DAY),
    'pm.srs.opt': JSON.stringify({ stage: 1, due: now - 1000, lapses: 0 }),
    'pm.known': JSON.stringify({ coll: now - 5 * DAY }),
    'pm.steps.coll': JSON.stringify({ s7: 'ok' }),
    'pm.steps.func': JSON.stringify({ s1: 'ok', s2: 'ok', s3: 'ok' }),
  };
}

async function seed(page, map) {
  await page.evaluate(m => { localStorage.clear(); for (const [k, v] of Object.entries(m)) localStorage.setItem(k, v); }, map);
  await page.reload();
}

const status = (page, ids) => page.evaluate(ids => {
  const d = JSON.parse(document.getElementById('data').textContent);
  const g = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  return Object.fromEntries(ids.map(id => [id, {
    legacy: !!(g('pm.legacy') || {})[id], recall: g('pm.recall.' + id), out: g('pm.out.' + id), srs: g('pm.srs.' + id),
    // visible label in the phone list / desktop card text is checked separately; here the engine-facing state
    hasLesson: !!(d.content[id] && d.content[id].lesson),
  }]));
}, ids);

async function suite(name, ctxOpts, hash, openTopicUi) {
  const s = new Suite(name);
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, ctxOpts, hash, { noGL: true });
  const now = Date.now();
  const tap = sel => (ctxOpts.hasTouch ? page.tap(sel) : page.click(sel));
  try {
    await openTopicUi.ready(page);

    // ---------- 1. old progress is read and kept ----------
    await seed(page, oldProgress(now));
    await openTopicUi.ready(page);
    const st = await status(page, ['opt', 'coll', 'func']);
    await s.check('old 5-of-7 topic kept as done (pm.legacy)', st.opt.legacy, st.opt);
    await s.check('old «Уже знаю» topic kept as done (pm.legacy)', st.coll.legacy, st.coll);
    await s.check('topic in progress not grandfathered', !st.func.legacy, st.func);
    await s.check('old keys untouched', await page.evaluate(() => localStorage.getItem('pm.steps.opt').includes('"s3":"ok"')
      && localStorage.getItem('pm.known').includes('coll')));
    const labels = await openTopicUi.labels(page, ['opt', 'coll', 'func']);
    await s.check('opt shown as due (old SRS record read)', /ПОВТОР/.test(labels.opt), labels);
    await s.check('func shown in progress', /ПРОЦЕСС|ТЕКУЩАЯ|3\/7|3 ?\/ ?7/.test(labels.func), labels);

    // ---------- 2. blind review: s7 field empty, key closed, old answer only after the key ----------
    await openTopicUi.open(page, 'opt');
    await tap('#tab-practice'); await page.waitForTimeout(400);
    const rv = await page.evaluate(() => ({ val: document.getElementById('ans').value, dis: document.getElementById('showKey').disabled,
      key: document.getElementById('keyBox').textContent.trim(), step: (document.querySelector('.rung.on') || {}).dataset }));
    await s.check('review opens on step 7', rv.step && rv.step.step === '6', rv);
    await s.check('review starts with an empty field', rv.val === '', rv);
    await s.check('review key is closed', rv.dis && rv.key === '', rv);
    await page.fill('#ans', 'func');
    await s.check('key stays closed after a 4-char answer', await page.isDisabled('#showKey'));
    await page.fill('#ans', 'func greet(name: String) -> String { "Hi " + name }');
    await s.check('key opens after a real answer', await page.isEnabled('#showKey'));
    await page.locator('#ans').blur();
    await page.click('#showKey'); await page.waitForTimeout(300);
    await s.check('old answer is not on screen before asking', !(await page.evaluate(() => document.body.innerText.includes('OLD ANSWER'))));
    await page.click('#prevBtn'); await page.waitForTimeout(150);
    await s.check('old answer shown after the key', await page.evaluate(() => document.getElementById('prevBox').innerText.includes('OLD ANSWER')));
    await s.check('3-level grade offered', await page.evaluate(() => ['okBtn', 'partBtn', 'noBtn'].every(id => !!document.getElementById(id))));
    await page.click('#okBtn'); await page.waitForTimeout(300);
    const after = await status(page, ['opt']);
    await s.check('review «вспомнил» advances SRS', after.opt.srs && after.opt.srs.stage === 2 && after.opt.srs.due > now + DAY, after.opt.srs);
    await s.check('review recorded in pm.recall', after.opt.recall && after.opt.recall.v === 'ok' && after.opt.recall.pass > 0, after.opt.recall);
    await s.check('new answer replaces the old one after the review', await page.evaluate(() => JSON.parse(localStorage.getItem('pm.ans.opt.s7')).includes('Hi ')));

    // blind review, then «не знаю — покажи»: the good old answer survives, the blind draft is gone
    await seed(page, oldProgress(now));
    await openTopicUi.ready(page);
    await openTopicUi.open(page, 'opt');
    await tap('#tab-practice'); await page.waitForTimeout(400);
    await page.fill('#ans', 'x');
    await page.locator('#ans').blur();
    await page.click('#dunno'); await page.waitForTimeout(300);
    const kept = await page.evaluate(() => ({ prev: localStorage.getItem('pm.ans.opt.s7'), draft: localStorage.getItem('pm.rans.opt'),
      srs: JSON.parse(localStorage.getItem('pm.srs.opt')), keyBtn: document.getElementById('showKey').hidden }));
    await s.check('failed review keeps the previous answer', /OLD ANSWER/.test(kept.prev || ''), kept);
    await s.check('blind draft cleared once the key is seen', !kept.draft || kept.draft === '""', kept);
    await s.check('«не знаю» on a review resets SRS to tomorrow', kept.srs && kept.srs.stage === 0 && kept.srs.due > now + DAY / 2, kept.srs);
    await s.check('«Показать ключ» hidden once the key is open', kept.keyBtn, kept);

    // ---------- 3. a fresh topic: 7 steps «вспомнил» alone do not make it done ----------
    await seed(page, {});
    await openTopicUi.ready(page);
    await openTopicUi.open(page, 'opt');
    await tap('#tab-practice'); await page.waitForTimeout(400);
    for (let k = 0; k < 7; k++) {
      await page.click(`.rung[data-step="${k}"]`); await page.waitForTimeout(150);
      await page.fill('#ans', 'answer number ' + k + ' with enough text here');
      await page.locator('#ans').blur();
      await page.click('#showKey'); await page.waitForTimeout(200);
      await page.click('#okBtn'); await page.waitForTimeout(200);
    }
    let done = await openTopicUi.isDone(page, 'opt');
    await s.check('all 7 steps without «Выгрузка» → not done', !done);
    const rec = (await status(page, ['opt'])).opt.recall;
    await s.check('step 7 by memory recorded', rec && rec.pass > 0, rec);

    // «не знаю — покажи» on a step: opens the key and records «нет» at once
    await page.click('.rung[data-step="1"]'); await page.waitForTimeout(150);
    await page.click('#dunno'); await page.waitForTimeout(200);
    const dn = await page.evaluate(() => ({ key: document.getElementById('keyBox').textContent.trim().length,
      step: JSON.parse(localStorage.getItem('pm.steps.opt')).s2, grade: JSON.parse(localStorage.getItem('pm.grade.opt')).s2 }));
    await s.check('«не знаю — покажи» opens the key and records «нет»', dn.key > 0 && dn.step === 'no' && dn.grade === 'no', dn);

    // ---------- 4. «Выгрузка» ----------
    await tap('#tab-theory'); await page.waitForTimeout(400);
    await openTopicUi.revealTheory(page);
    await tap('#toOut'); await page.waitForTimeout(300);
    const o1 = await page.evaluate(() => ({ out: !!document.getElementById('out'), lesson: !!document.querySelector('#pane-theory .theory'),
      q: (document.querySelector('.out-q') || {}).textContent || '', dis: document.getElementById('outShow').disabled }));
    await s.check('«Выгрузка» hides the lesson text', o1.out && !o1.lesson, o1);
    await s.check('first «Проверь себя» question shown', o1.q.length > 10, o1);
    await s.check('answer closed until you answer', o1.dis, o1);
    await page.fill('#outAns', 'Функция обещает String а user.name это String? поэтому нужно развернуть');
    await s.check('answer opens after a real answer', await page.isEnabled('#outShow'));
    await page.click('#outShow'); await page.waitForTimeout(150);
    const miss = await page.evaluate(() => document.getElementById('outKey').innerText);
    await s.check('written answer shown (not the cheat-sheet fallback)', !/ОТВЕТ ЕЩЁ НЕ НАПИСАН/i.test(miss) && /String\?/.test(miss), miss.slice(0, 120));
    await page.click('#outKey [data-g="ok"]'); await page.waitForTimeout(150);
    await page.click('#outSilent'); await page.waitForTimeout(150);
    await page.click('#outKey [data-g="ok"]'); await page.waitForTimeout(150);
    await page.click('#outDunno'); await page.waitForTimeout(150);
    await page.click('#outNext'); await page.waitForTimeout(300);
    let o = (await status(page, ['opt'])).opt;
    await s.check('«нет» in «Выгрузка» → not passed, SRS tomorrow', o.out && o.out.v === 'no' && !o.out.pass && o.srs && o.srs.due > now + DAY / 2 && o.srs.due < now + 2 * DAY, o);
    done = await openTopicUi.isDone(page, 'opt');
    await s.check('failed «Выгрузка» → still not done', !done);

    await tap('#outAgain'); await page.waitForTimeout(200);
    for (const g of ['ok', 'part', 'ok']) { await page.click('#outSilent'); await page.waitForTimeout(100); await page.click(`#outKey [data-g="${g}"]`); await page.waitForTimeout(150); }
    o = (await status(page, ['opt'])).opt;
    await s.check('«частично» in «Выгрузка» → not passed', o.out && o.out.v === 'part' && !o.out.pass, o.out);
    await tap('#outAgain'); await page.waitForTimeout(200);
    for (let k = 0; k < 3; k++) { await page.click('#outSilent'); await page.waitForTimeout(100); await page.click('#outKey [data-g="ok"]'); await page.waitForTimeout(150); }
    o = (await status(page, ['opt'])).opt;
    await s.check('«вспомнил» ×3 → «Выгрузка» passed', o.out && o.out.v === 'ok' && o.out.pass > 0, o.out);
    done = await openTopicUi.isDone(page, 'opt');
    await s.check('step 7 by memory + «Выгрузка» → done', done);

    // ---------- 5. «Уже знаю» is no longer enough by itself ----------
    await seed(page, {});
    await openTopicUi.ready(page);
    await openTopicUi.check(page, 'coll');
    await page.waitForTimeout(300);
    const cv = await page.evaluate(() => document.getElementById('ans').value);
    await s.check('«Уже знаю» check starts with an empty step 7', cv === '', cv);
    await page.fill('#ans', 'var list = [1, 2, 3]; list.append(4)');
    await page.locator('#ans').blur();
    await page.click('#showKey'); await page.waitForTimeout(200);
    await page.click('#okBtn'); await page.waitForTimeout(300);
    done = await openTopicUi.isDone(page, 'coll');
    await s.check('«Уже знаю» + step 7 alone → not done yet', !done);
    await s.check('check result points to «Выгрузка»', await page.isVisible('#chkOut'));

    if (ctxOpts.hasTouch) {
      await tap('#chkOut'); await page.waitForTimeout(300);
      const r = await rafRate(page, 1500);
      await s.check('phone «Выгрузка»: rAF at rest <= 2/s', r <= 2, r + '/s');
    }
    await s.check('no page errors', errors.length === 0, errors.slice(0, 5));
  } catch (e) {
    await s.check(name + ' run crashed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  return s;
}

// --- UI drivers: the engine lives in a closure, so everything goes through the page like a user would ---
const IDX = Object.fromEntries(topicsFromBuild().map(t => [t.id, t]));
const phoneUi = {
  async ready(page) { await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 }); },
  async toList(page) {
    if (await page.evaluate(() => document.getElementById('main').classList.contains('is-topic'))) { await page.tap('#winClose'); await page.waitForTimeout(300); }
  },
  async labels(page, ids) {
    await this.toList(page);
    return page.evaluate(m => Object.fromEntries(Object.entries(m).map(([id, i]) => {
      const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); return [id, b ? b.querySelector('.pl-st').textContent : ''];
    })), Object.fromEntries(ids.map(id => [id, IDX[id].i])));
  },
  async open(page, id) {
    await this.toList(page);
    await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); b.closest('.pl-br').classList.add('open'); b.click(); }, IDX[id].i);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
    await page.waitForTimeout(300);
  },
  async revealTheory(page) { for (let k = 0; k < 40 && await page.isVisible('#tMore'); k++) { await page.tap('#tMore'); await page.waitForTimeout(40); } },
  async isDone(page, id) {
    // the list is re-rendered on every progress change even while hidden behind the topic
    const r = await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); return !!b && b.classList.contains('st-done'); }, IDX[id].i);
    return r;
  },
  async check(page, id) { await this.open(page, id); await page.click('#tNav [data-check]'); await page.waitForTimeout(400); },
};

const desktopUi = {
  async ready(page) { await page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 }); await page.click('#inStart'); await page.waitForTimeout(900); },
  async labels(page, ids) {
    const out = {};
    for (const id of ids) { await this.open(page, id); out[id] = await page.evaluate(() => document.getElementById('pMeta').textContent); }
    return out;
  },
  async open(page, id) {
    if (await page.evaluate(() => document.getElementById('main').classList.contains('is-topic'))) { await page.click('#winClose'); await page.waitForTimeout(500); }
    await page.keyboard.press('Control+k');
    await page.keyboard.type(IDX[id].full.slice(0, 12));
    await page.waitForTimeout(200);
    await page.click(`#palList button[data-i="${IDX[id].i}"]:not(.gl)`);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 6000 });
    await page.waitForTimeout(500);
    if (await page.isVisible('#skipType')) await page.click('#skipType');
  },
  async revealTheory(page) { for (let k = 0; k < 40 && await page.isVisible('#tMore'); k++) { await page.click('#tMore'); await page.waitForTimeout(40); if (await page.isVisible('#skipType')) await page.click('#skipType'); } },
  async isDone(page, id) { return page.evaluate(() => /ОСВОЕНО/.test(document.getElementById('pMeta').textContent)); },
  async check(page, id) { await this.open(page, id); await page.click('#tNav [data-check]'); await page.waitForTimeout(500); },
};

async function run() {
  ensureDist();
  const a = await suite('honest-phone', IPHONE, '#phone', phoneUi);
  const b = await suite('honest-desktop', { viewport: { width: 1440, height: 900 } }, '#desktop', desktopUi);
  const r = { name: 'honest', passed: a.passed + b.passed, failed: a.failed.concat(b.failed), warnings: a.warnings.concat(b.warnings) };
  return r;
}

module.exports = { run };
if (require.main === module) run().then(r => { console.log(r); process.exit(r.failed.length ? 1 : 0); });
