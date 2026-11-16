/* For code answers that did not match exactly: how far (token edits) are they from the key's new part, and what is the truth? */
const fs = require("fs"), path = require("path"), C = require("./check.js"), S = path.join(__dirname, "../stand");
const buckets = {};
for (const f of fs.readdirSync(path.join(S, "cands"))) { const t = f.replace(".json", ""), tasks = JSON.parse(fs.readFileSync(path.join(S, "tasks", f)));
  for (const c of JSON.parse(fs.readFileSync(path.join(S, "cands", f)))) { const task = tasks.find(x => x.id === c.task); if (task.kind !== "code") continue;
    if (C.exactMatch(c.answer, task, [])) continue; const nk = C.nearKey(c.answer, task); if (!nk) continue;
    const d = nk.ops.length, b = d <= 1 ? "1" : d <= 3 ? "2-3" : d <= 6 ? "4-6" : d <= 12 ? "7-12" : "13+"; buckets[b] = buckets[b] || { ok: 0, bad: 0 }; buckets[b][c.truth]++; } }
for (const b of ["1", "2-3", "4-6", "7-12", "13+"]) if (buckets[b]) console.log(`token edits ${b.padEnd(5)}: bad ${buckets[b].bad}, ok ${buckets[b].ok} → P(bad) ${(100 * buckets[b].bad / (buckets[b].bad + buckets[b].ok)).toFixed(0)}%`);
