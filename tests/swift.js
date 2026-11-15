// scripts/swift_check.js (pilot 15.11) with a fake compiler: no Swift is needed to test what the script decides.
// The real compile runs in CI on macOS (.github/workflows/swift.yml). The fake `swiftc` fails on the text COMPILE_ERROR,
// fails on NEEDS_WRAP without WRAPPED, and builds a «program» that prints every `// PRINT: …` line of its source.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Suite, ROOT } = require('./lib');

const FAKE = `#!/usr/bin/env node
const fs = require('fs'), a = process.argv.slice(2);
if (a.includes('--version')) { console.log('fake swiftc 0.0'); process.exit(0); }
const file = a[a.length - 1], src = fs.readFileSync(file, 'utf8');
if (src.includes('COMPILE_ERROR') || (src.includes('NEEDS_WRAP') && !src.includes('WRAPPED'))) { console.error(file + ':1:1: error: fake compile error'); process.exit(1); }
const o = a.indexOf('-o');
if (o >= 0) { const lines = src.split('\\n').filter(l => l.includes('// PRINT: ')).map(l => l.split('// PRINT: ')[1]);
  fs.writeFileSync(a[o + 1], '#!/bin/sh\\n' + lines.map(l => "printf '%s\\\\n' '" + l + "'").join('\\n') + '\\n'); fs.chmodSync(a[o + 1], 0o755); }
`;
const STEPS = () => [
  { id: 's1', title: 'Предскажи', prompt: 'Что напечатает?', code: 'print(1) // PRINT: 1\nprint("два") // PRINT: два', key: '1\nдва',
    check: { outs: [['1', 'два']], why: ['a', 'b'] } },
  { id: 's2', title: 'Допиши', prompt: 'Допиши', code: 'func f() -> Int {\n    // код\n}', key: 'func f() -> Int {\n    return 1\n}\n\nПояснение.',
    check: { accept: ['let one = 1\nreturn one'], must: [{ pat: ['return'], ask: 'Есть ли возврат?', miss: 'm' }] } },
  { id: 's3', title: 'Устно', prompt: 'Объясни', code: 'Почему?', key: 'Потому что так.', check: { concepts: [{ label: 'a', groups: [['потому']], ask: 'Сказал?' }, { label: 'b', groups: [['так']], ask: 'Сказал?' }] } },
  { id: 's4', title: 'Свободно', prompt: 'x', code: 'x', key: 'y', check: { self: 'свободная форма' } },
];
function tree(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapso-swift-'));
  for (const d of ['scripts', 'engine']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  fs.mkdirSync(path.join(dir, 'content', 'steps'), { recursive: true }); fs.mkdirSync(path.join(dir, 'content', 'bank'), { recursive: true });
  const steps = STEPS(); if (mutate) mutate(steps);
  fs.writeFileSync(path.join(dir, 'content', 'steps', 'demo.json'), JSON.stringify(steps));
  fs.writeFileSync(path.join(dir, 'content', 'bank', 'demo.bank.json'), '[]');
  const fake = path.join(dir, 'fake-swiftc'); fs.writeFileSync(fake, FAKE); fs.chmodSync(fake, 0o755);
  return { dir, fake };
}
function sw(t, args, env) { return spawnSync('node', [path.join(t.dir, 'scripts', 'swift_check.js'), ...(args || [])], { encoding: 'utf8', env: Object.assign({}, process.env, { SWIFTC: t.fake }, env || {}) }); }
async function scenario(s, name, mutate, test) { const t = tree(mutate); try { await test(sw(t), t); } finally { fs.rmSync(t.dir, { recursive: true, force: true }); } }

async function run() {
  const s = new Suite('swift');
  await scenario(s, 'clean', null, async (r, t) => {
    const o = r.stdout + r.stderr;
    await s.check('clean fixture: exit 0', r.status === 0, o.slice(-500));
    await s.check('the key, the variant and the program are separate units', /demo\/s2 · key/.test(o) && /demo\/s2 · accept\[0\]/.test(o) && /demo\/s1 · program · ran · output matches/.test(o), o);
    await s.check('oral and free-form tasks are not compiled', !/demo\/s3|demo\/s4/.test(o), o);
    await s.check('summary counts the units', /swift check: 3 ok, 0 failed, 0 skipped of 3 units/.test(o), o.slice(-200));
    const rep = path.join(t.dir, 'rep.json'); const r2 = sw(t, ['--report', rep, 'demo']);
    let j = null; try { j = JSON.parse(fs.readFileSync(rep, 'utf8')); } catch (e) {}
    await s.check('--report writes a machine-readable report', r2.status === 0 && j && j.rows.length === 3 && j.rows.every(x => x.state === 'ok'), j);
    await s.check('a topic filter that matches nothing compiles nothing', /of 0 units/.test(sw(t, ['nosuch']).stdout));
    await s.check('--list prints the units without a compiler', sw(t, ['--list'], { SWIFTC: '/nonexistent' }).stdout.includes('3 units'));
    const r3 = sw(t, [], { SWIFTC: '/nonexistent/swiftc' });
    await s.check('no compiler: a clear message and exit 2, never a silent pass', r3.status === 2 && /swiftc not found/.test(r3.stderr), r3.stderr);
  });
  await scenario(s, 'key', st => { st[1].key = st[1].key.replace('return 1', 'return COMPILE_ERROR'); }, async r => {
    await s.check('a key that does not compile fails the run', r.status === 1 && /FAIL\s+demo\/s2 · key · does not compile/.test(r.stdout), r.stdout.slice(-400));
    await s.check('the compiler message is shown', /fake compile error/.test(r.stdout));
  });
  await scenario(s, 'accept', st => { st[1].check.accept = ['return COMPILE_ERROR']; }, async r => {
    await s.check('a verified variant that does not compile fails the run', r.status === 1 && /FAIL\s+demo\/s2 · accept\[0\]/.test(r.stdout) && /ok\s+demo\/s2 · key/.test(r.stdout), r.stdout.slice(-400));
  });
  await scenario(s, 'variant in place', st => { st[1].code = 'func f() -> Int {\n    // код\n}\nlet NEEDS_WRAP = 0'; st[1].key = 'func f() -> Int {\n    return 1\n}\nlet NEEDS_WRAP = 0'; st[1].check.accept = ['let WRAPPED = 1\nreturn WRAPPED']; st[1].check.swift = { prelude: '// WRAPPED' }; }, async r => {
    await s.check('a variant is compiled in its place inside the key, with the prelude', r.status === 0, r.stdout.slice(-400));
  });
  await scenario(s, 'fragment', st => { st[1].key = 'let NEEDS_WRAP = 1\n\nПояснение.'; st[1].code = '// код'; st[1].check = { must: st[1].check.must }; }, async r => {
    await s.check('a fragment key without hints fails', r.status === 1, r.stdout.slice(-300));
  });
  await scenario(s, 'fragment wrapped', st => { st[1].key = 'let NEEDS_WRAP = 1\n\nПояснение.'; st[1].code = '// код'; st[1].check = { must: st[1].check.must, swift: { before: 'func WRAPPED() {', after: '}' } }; }, async r => {
    await s.check('check.swift before/after wrap a fragment key', r.status === 0, r.stdout.slice(-300));
  });
  await scenario(s, 'output', st => { st[0].check.outs = [['1', 'три']]; }, async r => {
    await s.check('a program that prints something else fails the run', r.status === 1 && /the real output differs from check\.outs/.test(r.stdout) && /printed:/.test(r.stdout), r.stdout.slice(-400));
  });
  await scenario(s, 'any order', st => { st[0].check.outs = [['два', '1'], ['1', 'два']]; }, async r => {
    await s.check('any of the allowed outputs passes', r.status === 0, r.stdout.slice(-300));
  });
  await scenario(s, 'run:false', st => { st[0].check.outs = [['нет']]; st[0].check.swift = { run: false }; }, async r => {
    await s.check('"run": false compiles without running', r.status === 0 && /demo\/s1 · program · typecheck/.test(r.stdout), r.stdout.slice(-300));
  });
  await scenario(s, 'skip', st => { st[1].key = st[1].key.replace('return 1', 'return COMPILE_ERROR'); st[1].check.swift = { skip: 'нужен сервер' }; }, async r => {
    await s.check('a skipped task is reported with its reason in every run', r.status === 0 && /skip\s+demo\/s2 · skipped · нужен сервер/.test(r.stdout) && /1 skipped/.test(r.stdout), r.stdout.slice(-300));
  });
  await scenario(s, 'ui', st => { st[0].code = 'import SwiftUI\n' + st[0].code; st[0].check.outs = [['не запускается']]; }, async r => {
    await s.check('UIKit/SwiftUI is never run', !/demo\/s1 · program · ran/.test(r.stdout) && r.status === 0, r.stdout.slice(-300));
  });
  // the real content: every pilot task with code or output is a unit; the hints never reach the page
  const U = require(path.join(ROOT, 'scripts', 'swift_check.js')).units([]);
  await s.check('pilot: every code and predict rubric becomes at least one unit', new Set(U.map(u => u.ref)).size >= 40, new Set(U.map(u => u.ref)).size);
  await s.check('sameOut ignores a trailing newline only', (() => { const { sameOut } = require(path.join(ROOT, 'scripts', 'swift_check.js')); return sameOut('a\nb\n', ['a', 'b']) && sameOut('a\n\nb\n', ['a', '', 'b']) && !sameOut('a\nb\nc\n', ['a', 'b']) && !sameOut('b\na\n', ['a', 'b']); })());
  return { name: s.name, passed: s.passed, failed: s.failed, warnings: s.warnings };
}
module.exports = { run };
if (require.main === module) run().then(r => { console.log(`${r.failed.length ? 'FAIL' : 'ok'} ${r.name}: ${r.passed} passed, ${r.failed.length} failed`); process.exit(r.failed.length ? 1 : 0); });
