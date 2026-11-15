// Autocheck engine (engine/check.js) over the research stand: 800 labelled answers to 100 tasks (Node, no browser).
// The stand is the regression net of the engine: a change may not add a false «верно», and may not lose recognised answers.
// Rubrics: pilot topics take them from content/ (the real `check` fields), the other stand topics from research/autocheck/stand/rubrics
// with the items the build guard would reject removed.
'use strict';
const fs = require('fs');
const path = require('path');
const { Suite, ROOT } = require('./lib');
const C = require(path.join(ROOT, 'engine', 'check.js'));
const G = require(path.join(ROOT, 'scripts', 'check_rubrics.js'));
const STAND = path.join(ROOT, 'research', 'autocheck', 'stand');
const PILOT = ['opt', 'state', 'urls', 'weak', 'async'];

// Answers where the judged part (code / printed output) is right and the mistake sits in the prose explanation, which the
// engine does not judge: the label says «bad», the verdict «ok» is the documented limit (REPORT.md, section 3).
const PROSE_ONLY = ['opt#6', 'state#4', 'arc#43', 'async#3', 'async#5'];
// Known false «неверно» (right answers written unusually). The list may only shrink.
const KNOWN_FALSE_NO = ['opt#9', 'urls#57', 'table#2'];
// Floors measured on 15.11 (see docs/history.md); a lower number means the engine lost something.
const FLOOR = { okCode: 0.40, okPredict: 0.60, sameCode: 0.80, flaggedBadCode: 0.85 };

function contentChecks(topic) {
  const map = {};
  for (const s of JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'steps', topic + '.json'), 'utf8'))) if (s.check) map[topic + '.' + s.id] = s.check;
  for (const s of JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'bank', topic + '.bank.json'), 'utf8'))) if (s.check) map[s.id] = s.check;
  return map;
}
function standChecks(topic, tasks) {
  const map = {};
  for (const r of JSON.parse(fs.readFileSync(path.join(STAND, 'rubrics', topic + '.json'), 'utf8'))) {
    const t = tasks.find(x => x.id === r.task), ch = JSON.parse(JSON.stringify(r.check)); if (!t) continue;
    if (C.kindOf(ch) === 'code') {   // what the build guard would refuse is dropped, exactly as an author would have to
      const key = C.keyCode(t.key), K = G.raw(key), D = C.keyDelta(t.code, key, true, G.raw).filter(x => x.d);
      const lits = new Set(C.tokenize((t.code || '') + '\n' + key).filter(x => x.t === 'id').map(x => x.v));
      ch.accept = (ch.accept || []).filter(a => !C.exactMatch(a, t, []));
      ch.must = (ch.must || []).filter(m => C.anyPat(K, m.pat, lits));
      ch.not = (ch.not || []).filter(m => !C.anyPat(D, m.pat, lits) && !ch.accept.some(a => C.anyPat(G.raw(a), m.pat, lits)));
    }
    map[r.task] = ch;
  }
  return map;
}
function load() {
  const rows = [];
  for (const f of fs.readdirSync(path.join(STAND, 'cands')).sort()) {
    const topic = f.replace('.json', ''), tasks = JSON.parse(fs.readFileSync(path.join(STAND, 'tasks', f), 'utf8'));
    const fromContent = PILOT.includes(topic) ? contentChecks(topic) : {};   // until a topic has `check` fields, its stand rubrics are used
    const checks = Object.keys(fromContent).length ? fromContent : standChecks(topic, tasks);
    JSON.parse(fs.readFileSync(path.join(STAND, 'cands', f), 'utf8')).forEach((c, n) => {
      const t = tasks.find(x => x.id === c.task); if (!t) return;
      rows.push({ id: topic + '#' + n, topic, pilot: PILOT.includes(topic), kind: t.kind, cls: c.cls, truth: c.truth, answer: c.answer, task: { code: t.code, key: t.key, check: checks[c.task] } });
    });
  }
  return rows;
}
function judge(rows) { rows.forEach(r => { r.res = C.verdict(r.answer, r.task) || { v: 'none', why: 'norubric', msgs: [], qs: [] }; }); return rows; }
function stats(rows) {
  const pick = (k, f) => rows.filter(r => r.kind === k && (!f || f(r))), share = (a, b) => b.length ? a.length / b.length : 0;
  const out = {};
  for (const k of ['code', 'predict', 'oral']) {
    const ok = pick(k, r => r.truth === 'ok'), bad = pick(k, r => r.truth === 'bad');
    out[k] = { n: ok.length + bad.length, ok: ok.length, bad: bad.length,
      falseOk: bad.filter(r => r.res.v === 'ok').map(r => r.id), falseNo: ok.filter(r => r.res.v === 'no').map(r => r.id),
      okOk: share(ok.filter(r => r.res.v === 'ok'), ok), badNo: share(bad.filter(r => r.res.v === 'no'), bad),
      badCheck: share(bad.filter(r => r.res.v === 'check'), bad), okCheck: share(ok.filter(r => r.res.v === 'check'), ok),
      unsure: share(pick(k, r => r.res.v === 'unsure' || r.res.v === 'none'), pick(k)) };
  }
  return out;
}

async function run() {
  const s = new Suite('check');
  const all = judge(load()), st = stats(all);
  await s.check('stand: 800 answers loaded', all.length === 800, all.length);
  // the rule of the house: no false «верно» beyond the documented prose-only cases
  const fo = st.code.falseOk.concat(st.predict.falseOk, st.oral.falseOk);
  await s.check('no false «верно» outside the prose-only list', fo.every(id => PROSE_ONLY.includes(id)), fo.filter(id => !PROSE_ONLY.includes(id)));
  await s.check('oral answers never get «верно» or «неверно»', all.filter(r => r.kind === 'oral').every(r => r.res.v !== 'ok' && r.res.v !== 'no'));
  const fn = st.code.falseNo.concat(st.predict.falseNo);
  await s.check('no new false «неверно»', fn.every(id => KNOWN_FALSE_NO.includes(id)), fn.filter(id => !KNOWN_FALSE_NO.includes(id)));
  await s.check('code: right answers recognised not below the floor', st.code.okOk >= FLOOR.okCode, st.code.okOk);
  await s.check('predict: right outputs recognised not below the floor', st.predict.okOk >= FLOOR.okPredict, st.predict.okOk);
  const same = all.filter(r => r.kind === 'code' && r.cls === 'same');
  await s.check('code: the key typed differently is recognised', same.filter(r => r.res.v === 'ok').length / same.length >= FLOOR.sameCode, same.filter(r => r.res.v !== 'ok').map(r => r.id + ':' + r.res.why));
  await s.check('code: wrong answers get «неверно» or a question', st.code.badNo + st.code.badCheck >= FLOOR.flaggedBadCode, st.code.badNo + st.code.badCheck);
  // shape of every verdict the page will render
  const shapeOk = r => ['ok', 'no', 'check', 'unsure', 'none'].includes(r.res.v) && Array.isArray(r.res.msgs) && Array.isArray(r.res.qs)
    && (r.res.v !== 'check' || (r.res.qs.length > 0 && r.res.qs.every(q => typeof q.q === 'string' && /\?\s*$/.test(q.q) && (q.bad === 'yes' || q.bad === 'no'))))
    && (r.res.v !== 'no' || r.res.msgs.length > 0);
  await s.check('every verdict has the shape the page renders; «проверь» is always a question', all.every(shapeOk), all.filter(r => !shapeOk(r)).slice(0, 5).map(r => r.id + ':' + r.res.v + '/' + r.res.why));
  // junk in, no crash out
  let crashed = null; const t0 = all[0].task;
  for (const a of [null, undefined, 0, {}, [], '', '   ', '{{{{', '"""', '\\(', 'a'.repeat(20000), '}'.repeat(500)]) { try { C.verdict(a, t0); C.verdict('x', { code: a, key: 'a', check: { must: [] } }); } catch (e) { crashed = String(a).slice(0, 20) + ': ' + e.message; } }
  await s.check('junk answers and junk tasks do not throw', !crashed, crashed);
  await s.check('a task without a rubric gets no verdict', C.verdict('x', { code: '', key: 'x' }) === null && C.verdict('x', { code: '', key: 'x', check: { self: 'free form' } }) === null);
  // traps found while the engine was built: each was a false «верно» once
  const T = (code, key, check) => ({ code, key, check: check || { must: [{ pat: ['x'], ask: '?', miss: 'm' }] } });
  const v = (a, t) => C.verdict(a, t).v;
  await s.check('trap: `self.` is not ignored in capture tasks', v('{ [id = self.id] in print(self.id) }', T('let f = /* закрытие */', 'let f = { [id = self.id] in print(id) }')) !== 'ok');
  await s.check('trap: guard … else needs its return', v('guard let id else { nil }\nreturn id', T('func f(id: Int?) -> Int? {\n    // код\n}', 'func f(id: Int?) -> Int? {\n    guard let id else { return nil }\n    return id\n}')) !== 'ok');
  await s.check('trap: a skeleton line cannot be taken in part', v('var second = nil', T('var second = first\n// убери\nprint(1)', 'var second = first\nsecond = nil\nprint(1)')) !== 'ok');
  await s.check('trap: a variant for one hunk does not excuse the other', v('let a = 2', T('// один\nprint(0)\n// два', 'let a = 1\nprint(0)\nlet b = 1', { accept: ['let a = 2'], must: [{ pat: ['let a'], ask: '?', miss: 'm' }] })) !== 'ok');
  const rb = T('func f(id: Int?) -> String? {\n    // код\n}', 'func f(id: Int?) -> String? {\n    guard let id else { return nil }\n    return "/u/\\(id)"\n}');
  await s.check('a rebinding under another name is the same code', v('guard let userId = id else { return nil }\nreturn "/u/\\(userId)"', rb) === 'ok' && v('guard let id = id else { return nil }\nreturn "/u/\\(id)"', rb) === 'ok');
  await s.check('trap: the optional used instead of the unwrapped name', v('guard let userId = id else { return nil }\nreturn "/u/\\(id)"', rb) !== 'ok');
  const two = T('// один\nprint(0)\n// два', 'let a = 1\nprint(0)\nlet b = 1', { accept: [{ code: 'let a = 2 - 1', hunk: 0 }, { code: 'let b = 2 - 1', hunk: 1 }], must: [{ pat: ['let a'], ask: '?', miss: 'm' }] });
  await s.check('variants of different hunks combine', v('let a = 2 - 1\nlet b = 2 - 1', two) === 'ok' && v('let a = 1\nprint(0)\nlet b = 2 - 1', two) === 'ok');
  await s.check('trap: a variant is bound to its hunk', v('let b = 2 - 1\nlet b = 1', two) !== 'ok' && v('let a = 2 - 1', two) !== 'ok');
  const wrap = T('func f() {\n    work()\n}', 'func f() {\n    guard ready else { return }\n    work()\n}', { accept: [{ code: 'if ready {\n    work()\n}', hunk: 0, after: 1 }], must: [{ pat: ['ready'], ask: '?', miss: 'm' }] });
  await s.check('a variant can swallow the kept line it wraps', v('if ready { work() }', wrap) === 'ok' && v('func f() {\n  if ready {\n    work()\n  }\n}', wrap) === 'ok');
  await s.check('trap: the swallowed line is not accepted twice', v('if ready {\n    work()\n}\nwork()', wrap) !== 'ok');
  await s.check('trap: a retyped header without its closing brace', v('func f() -> Int {\n    return 1', T('func f() -> Int {\n    // код\n}', 'func f() -> Int {\n    return 1\n}')) !== 'ok');
  await s.check('the skeleton keeps its own closing brace: inner braces are new', v('if a {\n    return 1\n}\nreturn 2', T('func f() -> Int {\n    // код\n}', 'func f() -> Int {\n    if a {\n        return 1\n    }\n    return 2\n}')) === 'ok' && v('if a {\n    return 1\nreturn 2', T('func f() -> Int {\n    // код\n}', 'func f() -> Int {\n    if a {\n        return 1\n    }\n    return 2\n}')) !== 'ok');
  await s.check('renamed locals and spacing are forgiven', v('guard let x=id else{return nil}\nreturn x', T('func f(id: Int?) -> Int? {\n    // код\n}', 'func f(id: Int?) -> Int? {\n    guard let value = id else { return nil }\n    return value\n}')) === 'ok');
  if (process.argv.includes('--report')) report(all, st);
  return { name: s.name, passed: s.passed, failed: s.failed, warnings: s.warnings };
}
function report(all, st) {
  const pc = x => (100 * x).toFixed(1) + '%';
  for (const [name, rows] of [['all 10 topics', all], ['pilot (opt, state, urls, weak, async)', all.filter(r => r.pilot)], ['other 5 topics', all.filter(r => !r.pilot)]]) {
    const x = stats(rows); console.log('\n' + name + ' · ' + rows.length + ' answers');
    for (const k of ['code', 'predict', 'oral']) console.log(`  ${k.padEnd(8)} n=${x[k].n} (ok ${x[k].ok}, bad ${x[k].bad}) | false «верно» ${x[k].falseOk.length} [${x[k].falseOk.join(' ')}] | false «неверно» ${x[k].falseNo.length} [${x[k].falseNo.join(' ')}] | ok→верно ${pc(x[k].okOk)} | ok→проверь ${pc(x[k].okCheck)} | bad→неверно ${pc(x[k].badNo)} | bad→проверь ${pc(x[k].badCheck)} | не уверен ${pc(x[k].unsure)}`);
  }
}
module.exports = { run, load, judge, stats };
if (require.main === module) run().then(r => { console.log(`${r.failed.length ? 'FAIL' : 'ok'} ${r.name}: ${r.passed} passed, ${r.failed.length} failed`); process.exit(r.failed.length ? 1 : 0); });
