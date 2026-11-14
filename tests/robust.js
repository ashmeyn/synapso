// Robust storage (review 14.11, bugs 1–3), phone and desktop:
// 1. a pm.* key that holds valid JSON of the wrong type (null instead of an object, an object instead of a list)
//    must not blank the page — the engine falls back to the default for that key;
// 2. an import file with such values is merged without them, the app keeps working and survives a reload;
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Suite, launch, openPage, ensureDist } = require('./lib');
const { phoneUi, desktopUi, seed, ls } = require('./ui');

const BAD = [
  ['pm.steps.opt', 'null'], ['pm.steps.opt', '[1,2]'], ['pm.runs', 'null'], ['pm.runs', '{"a":1}'], ['pm.known', 'null'],
  ['pm.legacy', 'null'], ['pm.imported', 'null'], ['pm.skip', 'null'], ['pm.grade.opt', 'null'], ['pm.err.opt', 'null'],
  ['pm.err.opt', '[null]'], ['pm.back', '{"a":null}'], ['pm.back', '[]'], ['pm.srs.opt', '"x"'], ['pm.bank.opt-b1', 'null'],
];

async function suite(ui) {
  const s = new Suite('robust-' + ui.name);
  const browser = await launch();
  const { page, errors } = await openPage(browser, s, ui.ctx, ui.hash, { noGL: true });
  const tap = sel => (ui.touch ? page.tap(sel) : page.click(sel));
  try {
    await ui.ready(page);

    // ---------- 1. wrong-typed values: the app starts, the topic opens, practice and the run work ----------
    for (const [k, v] of BAD) {
      errors.length = 0;
      await seed(page, { [k]: v });
      let ok = true, why = '';
      try {
        await ui.ready(page);
        await ui.open(page, 'opt');
        await tap('#tab-practice'); await page.waitForTimeout(150);
        await tap('#tab-cheat'); await page.waitForTimeout(100);
        await ui.toList(page);
        await page.evaluate(() => document.getElementById('runBtn').click()); await page.waitForTimeout(200);
        ok = await page.evaluate(() => !document.getElementById('run').hidden && document.getElementById('runBody').textContent.trim().length > 0);
        if (!ok) why = 'run did not open';
        await page.evaluate(() => document.getElementById('runClose').click());
      } catch (e) { ok = false; why = String(e.message || e).split('\n')[0]; }
      await s.check(`${k} = ${v}: app works`, ok && !errors.length, { why, errors: errors.slice(0, 2) });
    }

    // ---------- 2. import with wrong-typed values: merged without them, good keys still arrive ----------
    errors.length = 0;
    await seed(page, { 'pm.steps.func': JSON.stringify({ s1: 'ok' }) });
    await ui.ready(page);
    const file = path.join(os.tmpdir(), 'synapso-bad-import-' + ui.name + '.json');
    fs.writeFileSync(file, JSON.stringify({ app: 'put-k-middle', v: 1, at: '2026-11-14', data: {
      'pm.steps.opt': 'null', 'pm.runs': '{"a":1}', 'pm.known': '7', 'pm.back': '{"a":null}', 'pm.err.coll': '"x"',
      'pm.steps.coll': JSON.stringify({ s1: 'ok', s2: 'ok' }) } }));
    await page.setInputFiles('#importFile', file);
    await page.waitForSelector('#impYes', { state: 'attached', timeout: 5000 });
    await page.evaluate(() => document.getElementById('impYes').click());
    await page.waitForTimeout(400);
    const note = await page.evaluate(() => document.getElementById('importNote').textContent);
    await s.check('import: good key merged', JSON.stringify(await ls(page, 'pm.steps.coll')) === JSON.stringify({ s1: 'ok', s2: 'ok' }), note);
    await s.check('import: wrong-typed keys not written', (await page.evaluate(() => ['pm.steps.opt', 'pm.runs', 'pm.known', 'pm.err.coll'].map(k => localStorage.getItem(k)))).every(v => v === null));
    await s.check('import: note says what was skipped', /ПРОПУЩЕНО/.test(note), note);
    await s.check('import: undo button is offered', await page.evaluate(() => !!document.getElementById('impUndo')), note);
    await s.check('import: local progress kept', (await ls(page, 'pm.steps.func') || {}).s1 === 'ok');
    await s.check('import: no page errors', !errors.length, errors.slice(0, 2));
    await page.reload(); await ui.ready(page);
    await ui.open(page, 'coll');
    await s.check('import: app works after reload', !errors.length, errors.slice(0, 2));
    fs.rmSync(file, { force: true });

  } finally { await browser.close(); }
  return s.result();
}

async function run() {
  ensureDist();
  const a = await suite(phoneUi), b = await suite(desktopUi);
  return { name: 'robust', passed: a.passed + b.passed, failed: a.failed.concat(b.failed), warnings: a.warnings.concat(b.warnings) };
}

module.exports = { run };
