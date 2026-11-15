/* Build-time sanity of rubrics (what scripts/build.py would enforce): every `must` matches the key and every `accept`;
   no `not` matches the key, an `accept` or the skeleton; `outs[0]` agrees with the key's first block; patterns compile. */
const fs = require("fs"), path = require("path"), C = require("./check.js"), S = path.join(__dirname, "../stand");
let n = 0, issues = [], cnt = { must: 0, not: 0, accept: 0, tasks: 0 };
for (const f of fs.readdirSync(path.join(S, "rubrics"))) { const tasks = JSON.parse(fs.readFileSync(path.join(S, "tasks", f)));
  for (const r of JSON.parse(fs.readFileSync(path.join(S, "rubrics", f)))) { const task = tasks.find(x => x.id === r.task), ch = r.check; if (!task || task.kind !== "code") continue; cnt.tasks++;
    const key = C.keyCode(task.key), lits = new Set(C.tokenize((task.code || "") + "\n" + key).filter(t => t.t === "id").map(t => t.v));
    const raw = src => C.normalize(C.tokenize(src), true, true), K = raw(key), D = C.keyDelta(task.code, key, true, raw).filter(t => t.d), sk = raw(task.code || "");
    (ch.must || []).forEach((m, i) => { cnt.must++; if (!C.anyPat(K, m.pat, lits)) issues.push(`${r.task} must[${i}] does not match the key: ${m.pat[0]}`);
      (ch.accept || []).forEach((a, j) => { if (!C.anyPat(raw(a), m.pat, lits) && !C.anyPat(K, m.pat, lits)) issues.push(`${r.task} must[${i}] fails accept[${j}]`); }); });
    (ch.not || []).forEach((m, i) => { cnt.not++; if (C.anyPat(D, m.pat, lits)) issues.push(`${r.task} not[${i}] matches the key: ${m.pat.join(" | ")}`);
      else if (C.anyPat(sk, m.pat, lits)) issues.push(`${r.task} not[${i}] matches the skeleton (harmless: skeleton lines are skipped, but fragile): ${m.pat.join(" | ")}`);
      (ch.accept || []).forEach((a, j) => { if (C.anyPat(raw(a), m.pat, lits)) issues.push(`${r.task} not[${i}] matches accept[${j}]`); }); });
    (ch.accept || []).forEach(() => cnt.accept++);
  } }
console.log(JSON.stringify(cnt)); console.log(issues.length + " issues"); issues.forEach(x => console.log("  " + x.slice(0, 200)));
