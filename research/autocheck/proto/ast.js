/* P3: tree-sitter-swift (wasm) — syntax gate + AST-normalised token stream (drops redundant parentheses and a lone return).
   Needs web-tree-sitter + tree-sitter-swift.wasm (research machine only): TS_DIR env or the default scratch path. */
const path = require("path"), DIR = process.env.TS_DIR || "";
let parser = null;
async function init() { if (parser) return parser; const TS = require(path.join(DIR, "node_modules/web-tree-sitter/tree-sitter.cjs")); const P = TS.Parser || TS; await P.init();
  const L = await (TS.Language || P.Language).load(path.join(DIR, "swift.wasm")); parser = new P(); parser.setLanguage(L); return parser; }
function leaves(node, out, C) {
  if (node.type === "comment" || node.type === "multiline_comment") return;
  if (node.childCount === 0) { if (node.text) C.tokenize(node.text).forEach(t => out.push({ t: t.t, v: t.v, line: node.startPosition.row })); return; }
  if (node.type === "line_string_literal" || node.type === "multi_line_string_literal" || node.type === "raw_string_literal") { C.tokenize(node.text).forEach(t => out.push({ t: t.t, v: t.v, line: node.startPosition.row })); return; }
  /* (expr) with a single value → expr */
  if (node.type === "tuple_expression" && node.namedChildCount === 1 && node.childCount === 3) { leaves(node.namedChild(0), out, C); return; }
  /* { return expr } as the only statement → { expr } */
  if (node.type === "statements" && node.namedChildCount === 1 && node.namedChild(0).type === "control_transfer_statement" && node.namedChild(0).child(0) && node.namedChild(0).child(0).text === "return" && node.namedChild(0).childCount === 2) { leaves(node.namedChild(0).child(1), out, C); return; }
  for (let i = 0; i < node.childCount; i++) leaves(node.child(i), out, C);
}
exports.init = init;
exports.protos = C => {
  const tk = (src, keepSelf) => { const out = []; leaves(parser.parse(src).rootNode, out, C); return C.normalize(out, keepSelf); };
  return {
    "P3a AST-normalised exact (no rubric)": async r => { await init(); return r.task.kind === "code" ? C.checkCode(r.c.answer, r.task, {}, { tk }) : { v: "unsure" }; },
    "P3b rubric full + AST exact": async r => { await init(); return r.task.kind === "code" ? C.checkCode(r.c.answer, r.task, r.rubric, { tk }) : C.check(r.c.answer, r.task, r.rubric, {}); },
    "P3c syntax gate alone (hasError → no)": async r => { await init(); if (r.task.kind !== "code") return { v: "unsure" }; return { v: parser.parse(C.codePart(r.c.answer)).rootNode.hasError ? "no" : "unsure" }; },
  };
};
if (require.main === module) (async () => {   /* how often the grammar rejects the site's own keys */
  const fs = require("fs"), C = require("./check.js"); await init(); let n = 0, bad = 0, ms = 0;
  for (const f of fs.readdirSync(path.join(__dirname, "../../../content/steps"))) for (const s of JSON.parse(fs.readFileSync(path.join(__dirname, "../../../content/steps", f)))) {
    if (s.id === "s1" || s.id === "s5") continue; const k = C.keyCode(s.key); n++; const t0 = performance.now(); if (parser.parse(k).rootNode.hasError) bad++; ms += performance.now() - t0; }
  console.log("keys of code steps (s2,s3,s4,s6,s7 × 80):", n, "| tree-sitter reports a syntax error in", bad, "(" + (100 * bad / n).toFixed(1) + "%) | avg parse", (ms / n).toFixed(2), "ms");
})();
