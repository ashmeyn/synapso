/* One-off: copies the stand rubrics of the pilot topics into content/ as `check` fields (items the guard rejects are dropped). */
const fs = require("fs"), path = require("path"), ROOT = path.resolve(__dirname, "../../.."), C = require(path.join(ROOT, "engine/check.js")), G = require(path.join(ROOT, "scripts/check_rubrics.js"));
const PILOT = ["opt", "state", "urls", "weak", "async"]; let dropped = [], n = 0;
for (const t of PILOT) {
  const rub = {}; JSON.parse(fs.readFileSync(path.join(__dirname, "../stand/rubrics", t + ".json"))).forEach(r => rub[r.task] = r.check);
  for (const [file, idOf] of [[path.join(ROOT, "content/steps", t + ".json"), s => t + "." + s.id], [path.join(ROOT, "content/bank", t + ".bank.json"), s => s.id]]) {
    const text = fs.readFileSync(file, "utf8"), data = JSON.parse(text);
    for (const s of data) { const ch = rub[idOf(s)]; if (!ch) continue; const c = JSON.parse(JSON.stringify(ch)); delete c.complete;
      if (C.kindOf(c) === "code") { const task = { code: s.code, key: s.key };
        const K = G.raw(C.keyCode(s.key)), D = C.keyDelta(s.code, C.keyCode(s.key), true, G.raw).filter(x => x.d), lits = new Set(C.tokenize((s.code || "") + "\n" + C.keyCode(s.key)).filter(x => x.t === "id").map(x => x.v));
        c.accept = (c.accept || []).filter((a, j) => { task.check = { must: [], accept: [a] }; const v = C.verdict(a, task), dup = C.exactMatch(a, task, []); if (dup || v.v !== "ok") dropped.push(idOf(s) + " accept[" + j + "] " + (dup ? "dup" : v.why)); return !dup && v.v === "ok"; });
        c.must = (c.must || []).filter((m, j) => { const ok = C.anyPat(K, m.pat, lits); if (!ok) dropped.push(idOf(s) + " must[" + j + "] not in key: " + m.pat[0]); return ok; });
        c.not = (c.not || []).filter((m, j) => { const ok = !C.anyPat(D, m.pat, lits) && !c.accept.some(a => C.anyPat(G.raw(a), m.pat, lits)); if (!ok) dropped.push(idOf(s) + " not[" + j + "] " + m.pat[0]); return ok; });
        if (!c.accept.length) delete c.accept; }
      s.check = c; n++; }
    fs.writeFileSync(file, JSON.stringify(data, null, 1) + (text.endsWith("\n") ? "\n" : "")); }
}
console.log("rubrics imported:", n, "· dropped items:", dropped.length); dropped.forEach(x => console.log("  " + x.slice(0, 150)));
