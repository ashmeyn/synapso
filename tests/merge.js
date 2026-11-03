// Progress merge: unit tests for mergeProgress() (Node, no browser) + import-by-merge and gist sync in the page.
// The function is taken from engine/template.html between /* merge:begin */ and /* merge:end */.
'use strict';
const fs = require('fs');
const path = require('path');
const { Suite, launch, openPage, ensureDist, ROOT } = require('./lib');

function loadMerge() {
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'template.html'), 'utf8');
  const a = src.indexOf('/* merge:begin'), b = src.indexOf('/* merge:end */');
  if (a < 0 || b < 0) throw new Error('merge block not found in engine/template.html');
  return new Function(src.slice(a, b) + '\nreturn mergeProgress;')();
}

const J = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, JSON.stringify(v)]));
const P = (m, k) => JSON.parse(m[k]);
const DAY = 86400000, T0 = Date.UTC(2026, 10, 1);

async function unit(s) {
  const merge = loadMerge();
  // steps: ok never rolls back to no, union of steps from both sides
  let r = merge(J({ 'pm.steps.opt': { s1: 'ok', s2: 'no', s3: 'no' } }), J({ 'pm.steps.opt': { s1: 'no', s2: 'ok', s4: 'ok' } }));
  const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  await s.check('steps: best mark per step, union', same(P(r.map, 'pm.steps.opt'), { s1: 'ok', s2: 'ok', s3: 'no', s4: 'ok' }), r.map);
  r = merge(J({ 'pm.grade.opt': { s1: 'part', s2: 'ok' } }), J({ 'pm.grade.opt': { s1: 'ok', s2: 'no', s3: 'part' } }));
  await s.check('grades: ok > part > no', same(P(r.map, 'pm.grade.opt'), { s1: 'ok', s2: 'ok', s3: 'part' }), r.map);
  // symmetric: same result whichever side is local
  const A = J({ 'pm.steps.x': { s1: 'ok', s2: 'no' } }), B = J({ 'pm.steps.x': { s1: 'no', s2: 'ok' } });
  await s.check('steps: merge is symmetric', merge(A, B).map['pm.steps.x'] === merge(B, A).map['pm.steps.x']);
  // SRS: later due date wins as a whole record
  r = merge(J({ 'pm.srs.opt': { stage: 3, due: T0 + 7 * DAY, lapses: 0 } }), J({ 'pm.srs.opt': { stage: 0, due: T0 + 9 * DAY, lapses: 2 } }));
  await s.check('srs: later due wins', P(r.map, 'pm.srs.opt').due === T0 + 9 * DAY && P(r.map, 'pm.srs.opt').lapses === 2, r.map);
  r = merge(J({ 'pm.srs.opt': { stage: 4, due: T0 + 30 * DAY, lapses: 0 } }), J({ 'pm.srs.opt': { stage: 1, due: T0 + DAY, lapses: 0 } }));
  await s.check('srs: earlier incoming due ignored', P(r.map, 'pm.srs.opt').stage === 4 && r.changed === 0, r);
  // recall / Выгрузка: a pass from either device is kept, the newest attempt describes the state
  r = merge(J({ 'pm.recall.opt': { at: T0 + 5, v: 'no', pass: 0 } }), J({ 'pm.recall.opt': { at: T0 + 1, v: 'ok', pass: T0 + 1 } }));
  const rc = P(r.map, 'pm.recall.opt');
  await s.check('recall: pass kept from the other device', rc.pass === T0 + 1 && rc.v === 'no' && rc.at === T0 + 5, rc);
  r = merge(J({ 'pm.out.opt': { at: T0 + 9, g: ['ok', 'ok'], v: 'ok', pass: T0 + 9 } }), J({ 'pm.out.opt': { at: T0 + 2, g: ['ok', 'ok'], v: 'ok', pass: T0 + 2 } }));
  await s.check('out: earliest pass', P(r.map, 'pm.out.opt').pass === T0 + 2, r.map);
  // doneAt: earliest; known/legacy: union with earliest time; skip dropped when known later
  r = merge(J({ 'pm.doneAt.opt': T0 + 50, 'pm.known': { a: T0 + 5 }, 'pm.legacy': { a: T0 }, 'pm.skip': { b: T0 } }),
    J({ 'pm.doneAt.opt': T0 + 10, 'pm.known': { a: T0 + 9, b: T0 + 3 }, 'pm.legacy': { c: T0 }, 'pm.skip': { d: T0 } }));
  await s.check('doneAt: earliest', P(r.map, 'pm.doneAt.opt') === T0 + 10, r.map);
  await s.check('known: union, earliest', JSON.stringify(P(r.map, 'pm.known')) === JSON.stringify({ a: T0 + 5, b: T0 + 3 }), r.map['pm.known']);
  await s.check('legacy: union', Object.keys(P(r.map, 'pm.legacy')).sort().join() === 'a,c', r.map['pm.legacy']);
  await s.check('skip: confirmed topic no longer skipped', JSON.stringify(P(r.map, 'pm.skip')) === JSON.stringify({ d: T0 }), r.map['pm.skip']);
  // imported: done > prog
  r = merge(J({ 'pm.imported': { a: 'prog', b: 'done' } }), J({ 'pm.imported': { a: 'done', c: 'prog' } }));
  await s.check('imported: done wins', JSON.stringify(P(r.map, 'pm.imported')) === JSON.stringify({ a: 'done', b: 'done', c: 'prog' }), r.map);
  // runs: union of days, sorted
  r = merge(J({ 'pm.runs': ['2026-10-30', '2026-11-01'] }), J({ 'pm.runs': ['2026-10-31', '2026-11-01'] }));
  await s.check('runs: union of days', P(r.map, 'pm.runs').join() === '2026-10-30,2026-10-31,2026-11-01', r.map);
  // bank stats: max of counters (both files carry the same history), error log: union without duplicates
  r = merge(J({ 'pm.bank.q1': { ok: 2, no: 1, last: T0 } }), J({ 'pm.bank.q1': { ok: 1, no: 3, last: T0 + 1 } }));
  await s.check('bank: max counters', JSON.stringify(P(r.map, 'pm.bank.q1')) === JSON.stringify({ ok: 2, no: 3, last: T0 + 1 }), r.map);
  // «Корни»: the latest recall of a root wins, the latest skip wins
  r = merge(J({ 'pm.roots.opt': { at: T0, v: 'no' }, 'pm.rootsSkip.coll': T0 }), J({ 'pm.roots.opt': { at: T0 + 5, v: 'ok' }, 'pm.rootsSkip.coll': T0 + 9 }));
  await s.check('roots: latest recall and skip win', P(r.map, 'pm.roots.opt').v === 'ok' && P(r.map, 'pm.rootsSkip.coll') === T0 + 9, r.map);
  r = merge(J({ 'pm.roots.opt': { at: T0 + 5, v: 'ok' } }), J({ 'pm.roots.opt': { at: T0, v: 'no' } }));
  await s.check('roots: older recall ignored', r.changed === 0, r);
  // errors that come back (pm.back): union; same miss -> the side that closed it more; newer miss reopens
  r = merge(J({ 'pm.back': { 'q:opt:1': { at: T0, ok: 1, next: T0 + 3 * DAY }, 'q:opt:2': { at: T0 + 2, ok: 0 } } }),
    J({ 'pm.back': { 'q:opt:1': { at: T0, ok: 2, done: T0 + 4 * DAY }, 'q:opt:3': { at: T0 + 1, ok: 0 } } }));
  const bk = P(r.map, 'pm.back');
  await s.check('back: union of entries, more progress on the same miss', Object.keys(bk).sort().join() === 'q:opt:1,q:opt:2,q:opt:3' && bk['q:opt:1'].done === T0 + 4 * DAY, bk);
  r = merge(J({ 'pm.back': { 'q:opt:1': { at: T0, ok: 2, done: T0 + 4 * DAY } } }), J({ 'pm.back': { 'q:opt:1': { at: T0 + 5 * DAY, ok: 0 } } }));
  await s.check('back: a newer miss reopens the entry', !P(r.map, 'pm.back')['q:opt:1'].done, r.map);
  const e1 = { at: T0 + 1, q: 'a', note: '' }, e2 = { at: T0 + 2, q: 'b', note: '' }, e3 = { at: T0 + 3, q: 'c', note: '' };
  r = merge(J({ 'pm.err.opt': [e2, e1] }), J({ 'pm.err.opt': [e3, e1] }));
  await s.check('errors: union, newest first, no duplicates', P(r.map, 'pm.err.opt').map(x => x.q).join() === 'c,b,a', r.map);
  // drafts: local text wins, empty local takes the other
  r = merge(J({ 'pm.ans.opt.s1': 'мой', 'pm.ans.opt.s2': '', 'pm.outAns.opt': ['x', ''] }), J({ 'pm.ans.opt.s1': 'чужой', 'pm.ans.opt.s2': 'там', 'pm.outAns.opt': ['y', 'z', 'w'] }));
  await s.check('drafts: local first, fill empty', P(r.map, 'pm.ans.opt.s1') === 'мой' && P(r.map, 'pm.ans.opt.s2') === 'там' && P(r.map, 'pm.outAns.opt').join() === 'x,z,w', r.map);
  // keys only on one side are kept; broken incoming values ignored; identical input changes nothing
  r = merge(J({ 'pm.steps.a': { s1: 'ok' } }), { 'pm.steps.b': '{"s1":"ok"}', 'pm.steps.c': '{broken' });
  await s.check('one-sided keys kept, broken ignored', r.map['pm.steps.a'] && r.map['pm.steps.b'] && !('pm.steps.c' in r.map) && r.changed === 1, r);
  const eq = J({ 'pm.steps.a': { s1: 'ok' }, 'pm.srs.a': { stage: 1, due: T0, lapses: 0 }, 'pm.runs': ['2026-11-01'] });
  r = merge(eq, eq);
  await s.check('identical progress: nothing changes', r.changed === 0, r.changed);
  // the whole thing is idempotent: merging the result again changes nothing
  const L = J({ 'pm.steps.a': { s1: 'ok', s2: 'no' }, 'pm.srs.a': { stage: 2, due: T0 + 3 * DAY }, 'pm.known': { a: T0 }, 'pm.skip': { a: T0 - 1 } });
  const R = J({ 'pm.steps.a': { s2: 'ok' }, 'pm.srs.a': { stage: 0, due: T0 + 5 * DAY }, 'pm.recall.a': { at: T0, v: 'ok', pass: T0 } });
  const m1 = merge(L, R).map;
  await s.check('idempotent', merge(m1, R).changed === 0 && merge(m1, L).changed === 0);
}

// In the page: import a file merges (desktop, no WebGL) and the gist sync merges both ways (mocked GitHub API).
async function inPage(s, browser) {
  const { ctx, page, errors } = await openPage(browser, s, { viewport: { width: 1440, height: 900 } }, '#desktop', { noGL: true });
  const dom = sel => page.$eval(sel, b => b.click());   // the no-WebGL notice may cover the bottom of the nav
  try {
    await page.waitForFunction(() => !!document.getElementById('importFile'), null, { timeout: 15000 });
    await page.evaluate(() => {
      localStorage.setItem('pm.steps.opt', JSON.stringify({ s1: 'ok', s2: 'no' }));
      localStorage.setItem('pm.srs.opt', JSON.stringify({ stage: 2, due: Date.now() + 3 * 86400000, lapses: 0 }));
      localStorage.setItem('pm.steps.coll', JSON.stringify({ s1: 'ok' }));
      localStorage.setItem('pm.font', JSON.stringify('mine'));
    });
    await page.reload();
    await page.waitForFunction(() => !!document.getElementById('importFile'), null, { timeout: 15000 });
    const file = { app: 'put-k-middle', v: 1, at: new Date().toISOString(), data: {
      'pm.steps.opt': JSON.stringify({ s1: 'no', s2: 'ok', s3: 'ok' }),
      'pm.srs.opt': JSON.stringify({ stage: 0, due: Date.now() + 9 * 86400000, lapses: 1 }),
      'pm.steps.func': JSON.stringify({ s1: 'ok' }),
      'pm.font': JSON.stringify('theirs') } };
    await page.evaluate(() => { document.getElementById('settings').open = true; });
    await page.setInputFiles('#importFile', { name: 'synapso.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
    await page.waitForSelector('#impYes', { timeout: 3000 });
    const note = await page.textContent('#importNote');
    await s.check('import offers a merge, not a replace', /ОБЪЕДИН/.test(note) && !/ЗАМЕН/.test(note), note);
    await dom('#impYes');
    await page.waitForTimeout(200);
    const got = await page.evaluate(() => ({ opt: JSON.parse(localStorage.getItem('pm.steps.opt')), srs: JSON.parse(localStorage.getItem('pm.srs.opt')),
      coll: localStorage.getItem('pm.steps.coll'), func: localStorage.getItem('pm.steps.func'), font: JSON.parse(localStorage.getItem('pm.font')) }));
    await s.check('import: steps merged (ok kept, new ok added)', got.opt.s1 === 'ok' && got.opt.s2 === 'ok' && got.opt.s3 === 'ok', got.opt);
    await s.check('import: later SRS due taken', got.srs.lapses === 1, got.srs);
    await s.check('import: local-only topic kept', !!got.coll, got);
    await s.check('import: file-only topic added', !!got.func, got);
    await s.check('import: device settings untouched', got.font === 'mine', got.font);
    await dom('#impUndo');
    const undone = await page.evaluate(() => ({ opt: JSON.parse(localStorage.getItem('pm.steps.opt')), func: localStorage.getItem('pm.steps.func') }));
    await s.check('import: undo restores the state before', undone.opt.s2 === 'no' && !undone.opt.s3 && undone.func === null, undone);
    await page.evaluate(() => localStorage.setItem('pm.gist', JSON.stringify({ token: 'ghp_secret', id: 'g0' })));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), dom('#exportBtn')]);
    const exp = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')).data;
    await s.check('export never contains the gist token or device keys', !('pm.gist' in exp) && !('pm.font' in exp) && !JSON.stringify(exp).includes('ghp_secret'), Object.keys(exp));
    await page.evaluate(() => localStorage.removeItem('pm.gist'));
    await page.reload();
    await page.waitForFunction(() => !!document.getElementById('importFile'), null, { timeout: 15000 });
    await page.evaluate(() => { document.getElementById('settings').open = true; });

    // ---- gist sync against a mocked api.github.com ----
    let remote = { 'pm.steps.opt': JSON.stringify({ s4: 'ok' }), 'pm.steps.dead': JSON.stringify({ s1: 'ok' }) };
    const calls = [];
    await ctx.route('https://api.github.com/**', async route => {
      const req = route.request(), u = new URL(req.url()), m = req.method();
      calls.push(m + ' ' + u.pathname);
      if (req.headers()['authorization'] !== 'Bearer ghp_test') return route.fulfill({ status: 401, body: '{}' });
      const gist = id => ({ id, description: 'Synapso progress', files: { 'synapso-progress.json': { filename: 'synapso-progress.json', truncated: false,
        content: JSON.stringify({ app: 'put-k-middle', v: 1, at: new Date().toISOString(), data: remote }) } } });
      if (m === 'GET' && u.pathname === '/gists') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'other', files: { 'x.md': {} } }, { id: 'g1', files: { 'synapso-progress.json': {} } }]) });
      if (m === 'GET' && u.pathname === '/gists/g1') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gist('g1')) });
      if (m === 'PATCH' && u.pathname === '/gists/g1') { const b = JSON.parse(req.postData()); remote = JSON.parse(b.files['synapso-progress.json'].content).data; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gist('g1')) }); }
      return route.fulfill({ status: 404, body: '{}' });
    });
    await dom('#gistBtn');
    await page.fill('#gistToken', 'ghp_test');
    await dom('#gistSave');
    await page.waitForFunction(() => /СИНХРОНИЗИРОВАНО/.test(document.getElementById('importNote').textContent), null, { timeout: 5000 }).catch(() => {});
    const after = await page.evaluate(() => ({ note: document.getElementById('importNote').textContent, opt: JSON.parse(localStorage.getItem('pm.steps.opt') || '{}'),
      dead: localStorage.getItem('pm.steps.dead'), gist: JSON.parse(localStorage.getItem('pm.gist') || 'null') }));
    await s.check('gist: sync reports success', /СИНХРОНИЗИРОВАНО/.test(after.note), after.note);
    await s.check('gist: found the existing gist by file name', after.gist && after.gist.id === 'g1', after.gist);
    await s.check('gist: remote progress merged in', after.opt.s4 === 'ok' && after.opt.s1 === 'ok' && !!after.dead, after);
    await s.check('gist: merged progress written back', JSON.parse(remote['pm.steps.opt'] || '{}').s1 === 'ok' && !!remote['pm.steps.coll'], Object.keys(remote));
    await s.check('gist: token never uploaded', !Object.keys(remote).some(k => k === 'pm.gist') && !JSON.stringify(remote).includes('ghp_test'));
    await s.check('gist: GET then PATCH', calls.includes('GET /gists/g1') && calls.includes('PATCH /gists/g1'), calls);
    // wrong token: clear message, nothing changed
    // second sync: nothing new on either side
    await dom('#gistBtn');
    await page.waitForFunction(() => /НОВОГО/.test(document.getElementById('importNote').textContent), null, { timeout: 5000 }).catch(() => {});
    await s.check('gist: repeated sync finds nothing new', /НОВОГО С ДРУГИХ УСТРОЙСТВ НЕТ/.test(await page.textContent('#importNote')), await page.textContent('#importNote'));
    // wrong token: clear message, nothing changed
    await dom('#gistOff');
    await s.check('gist: disconnect removes the token', await page.evaluate(() => localStorage.getItem('pm.gist') === null));
    const before = await page.evaluate(() => localStorage.getItem('pm.steps.opt'));
    await dom('#gistBtn');
    await page.fill('#gistToken', 'bad');
    await dom('#gistSave');
    await page.waitForFunction(() => /ТОКЕН НЕ ПОДОШЁЛ/.test(document.getElementById('importNote').textContent), null, { timeout: 5000 }).catch(() => {});
    const bad = await page.evaluate(() => ({ note: document.getElementById('importNote').textContent, opt: localStorage.getItem('pm.steps.opt') }));
    await s.check('gist: bad token reported, progress untouched', /ТОКЕН/.test(bad.note) && bad.opt === before, bad);
    await s.check('no page errors', errors.length === 0, errors.slice(0, 5));
  } finally { await ctx.close(); }
}

async function run() {
  const s = new Suite('merge');
  try { await unit(s); } catch (e) { await s.check('unit crashed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
  ensureDist();
  const browser = await launch();
  try { await inPage(s, browser); } catch (e) { await s.check('page part crashed', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
  finally { await browser.close(); }
  return s.result();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed.length ? 1 : 0));
