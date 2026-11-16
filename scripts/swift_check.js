#!/usr/bin/env node
/* Real Swift over the rubrics (pilot 15.11). Runs in CI on a macOS runner (.github/workflows/swift.yml), or locally
   wherever `swiftc` exists. For every task that has a `check` rubric:

     code tasks     the key must compile, and so must the key with each `accept` variant in place of its hunk
     predict tasks  the task's program must compile, run, and print exactly one of `check.outs`
     UIKit/SwiftUI  compile only (type-check against the iOS simulator SDK), never run
     oral / self    nothing to compile

   One failure fails the run: a «верно» of the site means «the compiler agrees».

     node scripts/swift_check.js                 # every rubric
     node scripts/swift_check.js opt urls        # some topics
     node scripts/swift_check.js --list          # print the units, compile nothing
     node scripts/swift_check.js --report f.json # also write a machine-readable report

   Build-time hints live in `check.swift` (they never reach the page):
     {"before": "...", "after": "..."}  text put around a key that is a fragment (e.g. a function body)
     {"prelude": "..."}                 declarations the fragment needs (put before everything)
     {"run": false}                     compile only (the program waits for the network, a timer, a crash on purpose…)
     {"skip": "reason"}                 do not compile this task at all — the reason is printed in every run
   Env: SWIFTC=/path/to/swiftc, SWIFT_JOBS=4. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawn, spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), C = require(path.join(ROOT, 'engine', 'check.js')), G = require(path.join(ROOT, 'scripts', 'check_rubrics.js'));
const SWIFTC = process.env.SWIFTC || 'swiftc';
const UI = /^\s*import\s+(SwiftUI|UIKit|MapKit|Combine|CoreData|WebKit)\b/m;

function units(topics) {
  const out = [];
  const add = (topic, ref, s) => {
    const ch = s.check; if (!ch) return; const kind = C.kindOf(ch), hint = ch.swift || {};
    if (hint.skip) { out.push({ topic, ref, name: 'skipped', skip: hint.skip }); return; }
    const wrap = src => (hint.prelude ? hint.prelude + '\n' : '') + (hint.before ? hint.before + '\n' : '') + src + (hint.after ? '\n' + hint.after : '');
    if (kind === 'predict') out.push({ topic, ref, name: 'program', src: wrap(s.code || ''), outs: ch.outs, run: hint.run !== false });
    else if (kind === 'code') {
      out.push({ topic, ref, name: 'key', src: wrap(C.keyCode(s.key)) });
      (ch.accept || []).forEach((a, j) => { const v = G.variant({ code: s.code, key: s.key }, a); if (v != null) out.push({ topic, ref, name: 'accept[' + j + ']', src: wrap(v) }); });
    }
  };
  for (const f of fs.readdirSync(path.join(ROOT, 'content', 'steps')).sort()) { const t = f.replace('.json', ''); if (!f.endsWith('.json') || (topics.length && !topics.includes(t))) continue;
    JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'steps', f), 'utf8')).forEach(s => add(t, t + '/' + s.id, s)); }
  for (const f of fs.readdirSync(path.join(ROOT, 'content', 'bank')).sort()) { const t = f.replace('.bank.json', ''); if (!f.endsWith('.bank.json') || (topics.length && !topics.includes(t))) continue;
    JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'bank', f), 'utf8')).forEach(s => add(t, 'bank/' + s.id, s)); }
  out.forEach(u => { if (u.src != null) { u.ui = UI.test(u.src); if (u.ui) u.run = false; } });
  return out;
}

const sh = (cmd, args, opt) => new Promise(res => { let out = '', err = '', done = false;
  let p; try { p = spawn(cmd, args, opt || {}); } catch (e) { return res({ code: 127, out: '', err: String(e.message) }); }
  const t = setTimeout(() => { if (!done) { try { p.kill('SIGKILL'); } catch (e) {} } }, (opt && opt.timeout) || 120000);
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  p.on('error', e => { done = true; clearTimeout(t); res({ code: 127, out, err: err + e.message }); });
  p.on('close', (code, sig) => { done = true; clearTimeout(t); res({ code: sig ? 124 : code, out, err }); }); });

let SDK = null;
function iosArgs() {
  if (SDK === null) { const r = spawnSync('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'], { encoding: 'utf8' }); SDK = r.status === 0 ? r.stdout.trim() : ''; }
  if (!SDK) return null;
  const arch = os.arch() === 'arm64' ? 'arm64' : 'x86_64';
  return ['-sdk', SDK, '-target', arch + '-apple-ios17.0-simulator'];
}
const sameOut = (got, exp) => { const a = got.replace(/\r/g, '').replace(/\n+$/, '').split('\n'); return a.length === exp.length && a.every((l, i) => l.trimEnd() === exp[i].trimEnd()); };

async function check(u, tmp) {
  if (u.skip) return { state: 'skip', note: u.skip };
  const dir = fs.mkdtempSync(path.join(tmp, 'u-')), file = path.join(dir, 'main.swift'); fs.writeFileSync(file, u.src + '\n');
  const base = ['-swift-version', '5', '-suppress-warnings'];
  if (u.ui) { const ios = iosArgs(); if (!ios) return { state: 'skip', note: 'UIKit/SwiftUI needs a macOS runner with Xcode' };
    const r = await sh(SWIFTC, base.concat(ios, ['-typecheck', file])); return r.code === 0 ? { state: 'ok', how: 'typecheck · iOS SDK' } : { state: 'fail', note: 'does not compile', log: r.err || r.out }; }
  if (!u.run) { const r = await sh(SWIFTC, base.concat(['-typecheck', file])); return r.code === 0 ? { state: 'ok', how: 'typecheck' } : { state: 'fail', note: 'does not compile', log: r.err || r.out }; }
  const bin = path.join(dir, 'prog'), c = await sh(SWIFTC, base.concat(['-o', bin, file]));
  if (c.code !== 0) return { state: 'fail', note: 'does not compile', log: c.err || c.out };
  const r = await sh(bin, [], { timeout: 20000 });
  if (r.code !== 0) return { state: 'fail', note: r.code === 124 ? 'the program did not finish in 20 s (add "swift": {"run": false} if it is meant to wait)' : 'the program exited with code ' + r.code, log: (r.out + r.err).slice(-1500) };
  return u.outs.some(o => sameOut(r.out, o)) ? { state: 'ok', how: 'ran · output matches' }
    : { state: 'fail', note: 'the real output differs from check.outs', log: 'printed:\n' + r.out.replace(/\n+$/, '') + '\nexpected:\n' + u.outs.map(o => o.join('\n')).join('\n— or —\n') };
}

async function main() {
  const argv = process.argv.slice(2), repAt = argv.indexOf('--report'), report = repAt >= 0 ? argv[repAt + 1] : null;
  const topics = argv.filter((a, i) => !a.startsWith('--') && !(repAt >= 0 && i === repAt + 1));
  const us = units(topics);
  if (argv.includes('--list')) { us.forEach(u => console.log(`${u.ref} · ${u.name}${u.skip ? ' · SKIP: ' + u.skip : u.ui ? ' · UI (compile only)' : u.outs ? (u.run ? ' · run' : ' · compile only') : ''}`)); console.log(us.length + ' units'); return 0; }
  const v = spawnSync(SWIFTC, ['--version'], { encoding: 'utf8' });
  if (v.error || v.status !== 0) { console.error('swiftc not found (' + SWIFTC + '): this check runs in CI on macOS, or set SWIFTC=/path/to/swiftc'); return 2; }
  console.log((v.stdout || v.stderr).trim().split('\n')[0]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synapso-swift-')), jobs = Math.max(1, +process.env.SWIFT_JOBS || Math.min(4, os.cpus().length)), res = new Array(us.length); let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (next < us.length) { const i = next++; res[i] = await check(us[i], tmp); } }));
  fs.rmSync(tmp, { recursive: true, force: true });
  const rows = us.map((u, i) => Object.assign({ topic: u.topic, ref: u.ref, name: u.name }, res[i]));
  const fail = rows.filter(r => r.state === 'fail'), skip = rows.filter(r => r.state === 'skip');
  rows.filter(r => r.state === 'ok').forEach(r => console.log(`ok    ${r.ref} · ${r.name} · ${r.how}`));
  skip.forEach(r => console.log(`skip  ${r.ref} · ${r.name} · ${r.note}`));
  fail.forEach(r => console.log(`FAIL  ${r.ref} · ${r.name} · ${r.note}\n${String(r.log || '').trim().split('\n').slice(0, 14).map(l => '        ' + l).join('\n')}`));
  console.log(`\nswift check: ${rows.length - fail.length - skip.length} ok, ${fail.length} failed, ${skip.length} skipped of ${rows.length} units`);
  if (report) fs.writeFileSync(report, JSON.stringify({ swift: (v.stdout || v.stderr).trim().split('\n')[0], rows }, null, 1));
  return fail.length ? 1 : 0;
}
module.exports = { units, sameOut };
if (require.main === module) main().then(c => process.exit(c));
