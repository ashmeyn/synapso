#!/usr/bin/env node
/* Rubric guard for the autocheck (`check` field of a step or a bank task). The build runs it and stops on any error.

     node scripts/check_rubrics.js                  # verify every rubric in content/
     node scripts/check_rubrics.js --stamp opt urls # after reviewing rubrics against a changed key: write the new `for` stamp

   A rubric is tied to its task by `check.for` — a hash of the task's code and key. When the key (or the skeleton)
   changes, the stamp no longer matches and the build stops until the rubric is reviewed and stamped again.
   The guard uses the page's own engine (engine/check.js), so the build and the browser can never disagree. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), C = require(path.join(ROOT, 'engine', 'check.js'));

const stamp = t => crypto.createHash('sha1').update((t.code || '') + '\n\u0000' + (t.key || '')).digest('hex').slice(0, 10);
const raw = src => C.normalize(C.tokenize(src), true, true);
const squeeze = s => String(s).replace(/<[^>]+>/g, '').replace(/[\s`«»"]/g, '');
const texts = ch => {   /* every text the learner can read */
  const out = [];
  (ch.must || []).forEach((m, i) => { out.push(['must[' + i + '].ask', m.ask], ['must[' + i + '].miss', m.miss]); });
  (ch.not || []).forEach((m, i) => out.push(['not[' + i + '].msg', m.msg]));
  (ch.why || []).forEach((m, i) => out.push(['why[' + i + ']', m]));
  (ch.wrong || []).forEach((m, i) => out.push(['wrong[' + i + '].msg', m.msg]));
  (ch.concepts || []).forEach((m, i) => { out.push(['concepts[' + i + '].ask', m.ask], ['concepts[' + i + '].miss', m.miss]); });
  (ch.false || []).forEach((m, i) => { out.push(['false[' + i + '].ask', m.ask], ['false[' + i + '].msg', m.msg]); });
  return out;
};
const isStr = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isAsk = v => isStr(v, 160) && /\?$/.test(v.trim());

/* → list of error strings for one task ({code, key, check}); `opts.stampOnly` skips nothing, `opts.noStamp` skips the stamp */
function issues(task, opts) {
  opts = opts || {}; const ch = task.check, E = [], err = m => E.push(m);
  if (!ch || typeof ch !== 'object' || Array.isArray(ch)) return ['check must be an object'];
  if (!opts.noStamp) {
    if (ch.for !== stamp(task)) err(ch.for ? `the key or the skeleton changed after the rubric was written (stamp ${ch.for}, now ${stamp(task)}): review the rubric, then run «node scripts/check_rubrics.js --stamp <topic>»` : 'no `for` stamp: run «node scripts/check_rubrics.js --stamp <topic>»');
  }
  if (ch.self) { if (!isStr(ch.self, 300)) err('self must be a short reason'); return E; }
  const kind = C.kindOf(ch), key = C.keyCode(task.key || '');
  if (kind === 'code') {
    const K = raw(key), D = C.keyDelta(task.code, key, true, raw).filter(t => t.d);
    const lits = new Set(C.tokenize((task.code || '') + '\n' + key).filter(t => t.t === 'id').map(t => t.v));
    const acc = ch.accept || [], must = ch.must || [], not = ch.not || [];
    if (!Array.isArray(must) || !must.length) err('must: at least one required sign');
    if (!D.length) err('the key adds nothing to the skeleton — nothing to check');
    must.forEach((m, i) => {
      if (!Array.isArray(m.pat) || !m.pat.length || !m.pat.every(p => isStr(p, 400))) return err(`must[${i}].pat must be a non-empty list of patterns`);
      if (!C.anyPat(K, m.pat, lits)) err(`must[${i}] contradicts the key: the key itself does not have «${m.pat[0]}»`);
      acc.forEach((a, j) => { const v = variant(task, a); if (v != null && !C.anyPat(raw(v), m.pat, lits)) err(`must[${i}] contradicts accept[${j}]: the verified variant does not have «${m.pat[0]}»`); });
      if (!isAsk(m.ask)) err(`must[${i}].ask must be a question (ends with «?», up to 160 characters)`);
      if (!isStr(m.miss, 260)) err(`must[${i}].miss must be a text up to 260 characters`);
    });
    not.forEach((m, i) => {
      if (!Array.isArray(m.pat) || !m.pat.length || !m.pat.every(p => isStr(p, 400))) return err(`not[${i}].pat must be a non-empty list of patterns`);
      if (C.anyPat(D, m.pat, lits)) err(`not[${i}] contradicts the key: the key matches the «mistake» «${m.pat.join(' | ')}»`);
      acc.forEach((a, j) => { if (C.anyPat(raw(C.acceptOf(a).code), m.pat, lits)) err(`not[${i}] contradicts accept[${j}]`); });
      if (!isStr(m.msg, 260)) err(`not[${i}].msg must be a text up to 260 characters`);
    });
    if (!Array.isArray(acc)) err('accept must be a list');
    else { const nh = hunksOf(task).hunks.length; acc.forEach((a0, j) => {
      const a = C.acceptOf(a0);
      if (!isStr(a.code, 4000)) return err(`accept[${j}] must be a code fragment (a string or {code, hunk, before, after})`);
      if (nh > 1 && (typeof a0 === 'string' || !Number.isInteger(a0.hunk))) return err(`accept[${j}]: the key adds ${nh} hunks — say which one the variant replaces: {"code": "…", "hunk": 0…${nh - 1}}`);
      if (a.hunk < 0 || a.hunk >= nh || a.before < 0 || a.after < 0) return err(`accept[${j}]: hunk ${a.hunk} does not exist (the key adds ${nh})`);
      if (C.exactMatch(a.code, { code: task.code, key: task.key }, [])) return err(`accept[${j}] is the key itself — remove it`);
      const v = C.verdict(variant(task, a0), task); if (!v || !(v.v === 'ok' || v.why === 'comments')) err(`accept[${j}] does not fit in place of hunk ${a.hunk} (the engine says ${v && v.v}/${v && v.why})`);
    }); }
    const kv = C.verdict(key, task); if (!kv || !(kv.v === 'ok' || kv.why === 'comments')) err(`the key itself is not accepted (${kv && kv.v}/${kv && kv.why})`);
    /* texts must not hand over the answer: no new line of the key, whole, inside a message */
    const lines = {}; D.forEach(t => (lines[t.line] = lines[t.line] || []).push(t.v));
    const newLines = Object.values(lines).map(ts => ts.join('')).map(squeeze).filter(l => l.length >= 14);
    texts(ch).forEach(([where, txt]) => { const z = squeeze(txt || ''); const hit = newLines.find(l => z.includes(l)); if (hit) err(`${where} gives the answer away: it contains a whole new line of the key («${hit.slice(0, 40)}»)`); });
  } else if (kind === 'predict') {
    const okSeq = o => Array.isArray(o) && o.length > 0 && o.every(x => typeof x === 'string');
    if (!Array.isArray(ch.outs) || !ch.outs.length || !ch.outs.every(okSeq)) return E.concat('outs must be a non-empty list of output sequences (lists of strings)');
    if (ch.why != null && (!Array.isArray(ch.why) || ch.why.length !== ch.outs[0].length || !ch.why.every(x => isStr(x, 260)))) err('why must have one text per line of outs[0]');
    if (ch.needAll != null && typeof ch.needAll !== 'boolean') err('needAll must be true or false');
    ch.outs.forEach((o, i) => { if (ch.needAll && ch.outs.length > 1) return; const v = C.verdict(o.map(x => x === '' ? '' : x).join('\n'), task); if (!v || v.v !== 'ok') err(`outs[${i}] written line by line is not accepted (${v && v.v}/${v && v.why})`); });
    (ch.wrong || []).forEach((w, i) => {
      if (!okSeq(w.out) || !isStr(w.msg, 260)) return err(`wrong[${i}] needs out (list of strings) and msg`);
      const v = C.verdict(w.out.join('\n'), task); if (!v || v.v === 'ok') err(`wrong[${i}] contradicts outs: the «wrong» prediction is accepted as right`);
    });
  } else if (kind === 'oral') {
    const okG = g => Array.isArray(g) && g.length > 0 && g.every(x => Array.isArray(x) && x.length > 0 && x.every(y => isStr(y, 60)));
    if (!Array.isArray(ch.concepts) || ch.concepts.length < 2 || ch.concepts.length > 6) return E.concat('concepts: 2–6 required points');
    ch.concepts.forEach((c, i) => { if (!isStr(c.label, 200)) err(`concepts[${i}].label`); if (!okG(c.groups)) err(`concepts[${i}].groups must be a list of lists of substrings`); if (!isAsk(c.ask)) err(`concepts[${i}].ask must be a question (ends with «?»)`); if (c.miss != null && !isStr(c.miss, 260)) err(`concepts[${i}].miss`); });
    (ch.false || []).forEach((c, i) => { if (!okG(c.groups)) err(`false[${i}].groups`); if (!isAsk(c.ask)) err(`false[${i}].ask must be a question (ends with «?»)`); if (!isStr(c.msg, 260)) err(`false[${i}].msg`); });
    if (!E.length) {   /* the key is a full answer: it must cover every point and state no misconception */
      const v = C.verdict(task.key, task);
      (v.points || []).forEach((p, i) => { if (!p.found) err(`concepts[${i}] contradicts the key: the key itself does not mention «${p.label}» in these words — add word stems to groups`); });
      v.qs.filter(q => q.bad === 'yes').forEach(q => err(`a «false» pattern contradicts the key: the key itself matches it («${q.q}»)`));
    }
  } else err('check has no known shape (must / outs / concepts / self)');
  return E;
}
/* the hunks of new lines in the key: [[firstLine, lastLine], …] (comment-only and blank lines between new lines do not split a hunk) */
function hunksOf(task) {
  const key = C.keyCode(task.key || ''), K = C.keyDelta(task.code, key, true, raw), lines = key.split('\n');
  const dl = [...new Set(K.filter(t => t.d).map(t => t.line))].sort((x, y) => x - y), hunks = [];
  dl.forEach(l => { const h = hunks[hunks.length - 1]; if (h && !lines.slice(h[1] + 1, l).some(x => x.trim() && !/^\s*\/\//.test(x))) h[1] = l; else hunks.push([l, l]); });
  return { lines, hunks };
}
/* the whole key with a verified variant in its place — the text Swift compiles, the same placement the engine uses */
function variant(task, a0) {
  const a = C.acceptOf(a0), { lines, hunks } = hunksOf(task), h = hunks[a.hunk]; if (!h) return null;
  const code = l => lines[l].trim() && !/^\s*\/\//.test(lines[l]);
  let from = h[0], to = h[1];
  for (let n = a.after; n > 0; n--) { do to++; while (to < lines.length - 1 && !code(to)); }
  for (let n = a.before; n > 0; n--) { do from--; while (from > 0 && !code(from)); }
  return lines.slice(0, Math.max(0, from)).concat(a.code.split('\n'), lines.slice(Math.min(lines.length, to + 1))).join('\n');
}

function files() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'content', 'steps')).sort()) if (f.endsWith('.json')) out.push({ file: path.join(ROOT, 'content', 'steps', f), topic: f.replace('.json', ''), ref: (t, s) => t + '/' + s.id });
  for (const f of fs.readdirSync(path.join(ROOT, 'content', 'bank')).sort()) if (f.endsWith('.bank.json')) out.push({ file: path.join(ROOT, 'content', 'bank', f), topic: f.replace('.bank.json', ''), ref: (t, s) => 'bank/' + s.id });
  return out;
}
function verifyAll() {
  const errors = []; let n = 0;
  for (const f of files()) for (const s of JSON.parse(fs.readFileSync(f.file, 'utf8'))) { if (s.check === undefined) continue; n++; issues(s).forEach(m => errors.push(f.ref(f.topic, s) + ': ' + m)); }
  return { n, errors };
}
function stampTopics(topics) {
  let n = 0;
  for (const f of files()) { if (!topics.includes(f.topic)) continue;
    const text = fs.readFileSync(f.file, 'utf8'), data = JSON.parse(text); let ch = 0;
    data.forEach(s => { if (s.check && s.check.for !== stamp(s)) { s.check = Object.assign({ for: stamp(s) }, s.check, { for: stamp(s) }); ch++; } });
    if (ch) { fs.writeFileSync(f.file, JSON.stringify(data, null, 1) + (text.endsWith('\n') ? '\n' : '')); n += ch; } }
  return n;
}

module.exports = { issues, stamp, variant, hunksOf, verifyAll, raw };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--stamp') { if (a.length < 2) { console.error('usage: node scripts/check_rubrics.js --stamp <topic> [<topic> ...]'); process.exit(2); } console.log('stamped rubrics: ' + stampTopics(a.slice(1))); }
  const r = verifyAll();
  if (r.errors.length) { console.error('rubric guard: ' + r.errors.length + ' problem(s) in ' + r.n + ' rubrics'); r.errors.forEach(e => console.error('  ' + e)); process.exit(1); }
  console.log('rubric guard: ' + r.n + ' rubrics ok');
}
