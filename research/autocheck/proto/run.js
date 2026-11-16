/* Runs the prototypes over the stand. node proto/run.js [--list fo|fn|unsure] [--topic id] [--kind code] */
const fs = require("fs"), path = require("path"), C = require("./check.js");
const S = path.join(__dirname, "..", "stand"), arg = k => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1] || true; };
const DEV = ["opt", "state", "codable", "arc", "queues"], TEST = ["hof", "urls", "weak", "async", "table"];
const rows = []; let dropped = 0;
for (const t of DEV.concat(TEST)) {
  const tasks = JSON.parse(fs.readFileSync(path.join(S, "tasks", t + ".json")));
  const cf = path.join(S, "cands", t + ".json"), rf = path.join(S, "rubrics", t + ".json");
  if (!fs.existsSync(cf)) continue;
  const rub = {}; if (fs.existsSync(rf)) JSON.parse(fs.readFileSync(rf)).forEach(r => rub[r.task] = r.check);
  const fix = path.join(S, "labels-fix.json"), fixes = fs.existsSync(fix) ? JSON.parse(fs.readFileSync(fix)) : {};
  JSON.parse(fs.readFileSync(cf)).forEach((c, n) => { const task = tasks.find(x => x.id === c.task); if (!task) return;
    const id = t + "#" + n, truth = fixes[id] ? fixes[id].truth : c.truth; if (truth === "drop") return;
    if (rub[c.task] && !rub[c.task]._s) { const z = C.sanitize(task, rub[c.task]); rub[c.task] = Object.assign(z.check, { _s: 1 }); dropped += z.dropped; }
    rows.push({ id, topic: t, split: DEV.includes(t) ? "dev" : "test", task, rubric: rub[c.task], c, truth }); });
}
const PROTOS = {
  "P1 key-eq": r => r.task.kind === "code" ? C.p1(r.c.answer, r.task) : r.task.kind === "predict" ? { v: C.normOutEq ? "no" : (r.c.answer.trim().split("\n\n")[0].trim() === r.task.key.split("\n\n")[0].trim() ? "ok" : "no") } : { v: "unsure" },
  "P2a exact+alpha (no rubric)": r => r.task.kind === "code" ? C.checkCode(r.c.answer, r.task, {}, {}) : { v: "unsure" },
  "P2b rubric strict (rubric-ok off)": r => C.check(r.c.answer, r.task, r.rubric, { neverRubricOk: true }),
  "P2c rubric full": r => C.check(r.c.answer, r.task, r.rubric, {}),
  "P2r recommended cascade (ok / no / check / unsure)": r => C.verdict(r.c.answer, r.task, r.rubric),
  "P2d rubric full, miss→unsure": r => C.check(r.c.answer, r.task, r.rubric, { missUnsure: true }),
};
if (process.env.TS_DIR) Object.assign(PROTOS, require("./ast.js").protos(C));
const only = arg("--proto"), list = arg("--list"), topic = arg("--topic"), kind = arg("--kind");
console.log("rubric items dropped by the build-time guard:", dropped);
(async () => {
  for (const [name, fn] of Object.entries(PROTOS)) {
    if (only && !name.startsWith(only)) continue;
    const res = []; for (const r of rows) res.push(Object.assign({ r }, await fn(r)));
    console.log("\n== " + name);
    for (const k of ["code", "predict", "oral"]) for (const sp of ["dev", "test", "all"]) {
      const x = res.filter(z => z.r.task.kind === k && (sp === "all" || z.r.split === sp)); if (!x.length) continue;
      const bad = x.filter(z => z.r.truth === "bad"), ok = x.filter(z => z.r.truth === "ok"), pc = (a, b) => b ? (100 * a / b).toFixed(1).padStart(5) + "%" : "   - ";
      const fo = bad.filter(z => z.v === "ok").length, fn_ = ok.filter(z => z.v === "no").length;
      console.log(`${k.padEnd(8)}${sp.padEnd(5)} n=${String(x.length).padStart(3)} | falseOK ${pc(fo, bad.length)} (${fo}/${bad.length}) | falseNO ${pc(fn_, ok.length)} (${fn_}/${ok.length}) | ok→ok ${pc(ok.filter(z => z.v === "ok").length, ok.length)} | bad→no ${pc(bad.filter(z => z.v === "no").length, bad.length)} | unsure ${pc(x.filter(z => z.v === "unsure").length, x.length)}` + (x.some(z => z.v === "check") ? ` | check: ok ${pc(ok.filter(z => z.v === "check").length, ok.length)}, bad ${pc(bad.filter(z => z.v === "check").length, bad.length)}` : ""));
    }
    if (arg("--why")) for (const k of ["code", "predict", "oral"]) for (const sp of ["dev", "test"]) { const m = {}; res.filter(z => z.r.task.kind === k && z.r.split === sp).forEach(z => { const key = z.v + "/" + (z.why || ""); m[key] = m[key] || { ok: 0, bad: 0 }; m[key][z.r.truth]++; });
      console.log("  " + k + " " + sp + ": " + Object.entries(m).map(([key, c]) => `${key} ok=${c.ok} bad=${c.bad}`).join(" · ")); }
    if (list) res.filter(z => (!topic || z.r.topic === topic) && (!kind || z.r.task.kind === kind) && (list === "fo" ? z.r.truth === "bad" && z.v === "ok" : list === "fn" ? z.r.truth === "ok" && z.v === "no" : list === "unsure" ? z.v === "unsure" && z.r.truth === "ok" : false))
      .forEach(z => console.log(`--- ${z.r.id} ${z.r.c.task} [${z.r.c.cls}/${z.r.truth}] → ${z.v}/${z.why} :: ${z.r.c.note}\n${z.r.c.answer}\n   msgs: ${(z.msgs || []).join(" | ").slice(0, 300)}`));
  }
})();
