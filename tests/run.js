// Runs all browser suites against dist/index.html and prints a compact summary.
// Usage: node tests/run.js [smoke|phone|desktop ...]   (default: all)
// Env: CHROMIUM_PATH=/path/to/chrome to use a specific Chromium binary.
'use strict';
const fs = require('fs');
const { OUT } = require('./lib');

const SUITES = { phone: './phone', desktop: './desktop', smoke: './smoke' };

(async () => {
  const pick = process.argv.slice(2).filter(a => SUITES[a]);
  const names = pick.length ? pick : Object.keys(SUITES);
  fs.rmSync(OUT, { recursive: true, force: true });
  const results = [];
  const t0 = Date.now();
  for (const n of names) {
    const t = Date.now();
    console.log(`> ${n}`);
    let r;
    try { r = await require(SUITES[n]).run(); }
    catch (e) { r = { name: n, passed: 0, failed: ['suite crashed: ' + (e && e.message || e)], warnings: [] }; }
    r.secs = ((Date.now() - t) / 1000).toFixed(1);
    results.push(r);
  }
  console.log('\n=== SUMMARY ===');
  let failed = 0, passed = 0, warns = 0;
  for (const r of results) {
    failed += r.failed.length; passed += r.passed; warns += r.warnings.length;
    console.log(`${r.failed.length ? 'FAIL' : 'ok  '}  ${r.name.padEnd(8)} ${String(r.passed).padStart(5)} passed  ${String(r.failed.length).padStart(3)} failed  ${String(r.warnings.length).padStart(3)} warnings  ${r.secs}s`);
    r.failed.slice(0, 20).forEach(f => console.log('      x ' + f));
    if (r.failed.length > 20) console.log(`      ... ${r.failed.length - 20} more`);
  }
  console.log(`total: ${passed} passed, ${failed} failed, ${warns} warnings in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (failed) console.log(`screenshots: ${OUT}`);
  process.exit(failed ? 1 : 0);
})();
