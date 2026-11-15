/* Times every stand check in headless Chromium with CPU throttling (a rough stand-in for a phone). node proto/bench.js [rate] */
const fs = require("fs"), path = require("path"), { chromium } = require("playwright"), S = path.join(__dirname, "../stand");
(async () => {
  const rate = +(process.argv[2] || 6), items = [];
  for (const f of fs.readdirSync(path.join(S, "cands"))) { const tasks = JSON.parse(fs.readFileSync(path.join(S, "tasks", f))), rf = path.join(S, "rubrics", f), rub = {};
    if (fs.existsSync(rf)) JSON.parse(fs.readFileSync(rf)).forEach(r => rub[r.task] = r.check);
    for (const c of JSON.parse(fs.readFileSync(path.join(S, "cands", f)))) items.push({ a: c.answer, t: tasks.find(x => x.id === c.task), r: rub[c.task] }); }
  const b = await chromium.launch(), p = await b.newPage(), cdp = await p.context().newCDPSession(p);
  await p.setContent("<html><body></body></html>");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const src = fs.readFileSync(path.join(__dirname, "check.js"), "utf8");
  const load = await p.evaluate(s => { const t0 = performance.now(); (0, eval)(s); return performance.now() - t0; }, src);
  const times = await p.evaluate(items => items.map(i => { const t0 = performance.now(); self.SynCheck.check(i.a, i.t, i.r, { neverRubricOk: true }); return performance.now() - t0; }), items);
  times.sort((x, y) => x - y); const q = f => times[Math.floor(f * (times.length - 1))].toFixed(2);
  console.log(`CPU throttle ×${rate}: engine parse+init ${load.toFixed(1)} ms · ${times.length} checks: median ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${q(1)} ms`);
  await b.close();
})();
