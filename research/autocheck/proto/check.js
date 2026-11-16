/* Synapso autocheck prototype (research only, not wired into the site).
   Plain ES2017, no dependencies, works in the browser and in node.
   Verdicts: "ok" | "no" | "unsure". Every verdict carries `why` (stage) and `msgs` (mentor notes). */
(function (root) {
  "use strict";

  /* ---------- Swift tokenizer: ids, numbers, strings (one token, interpolation kept verbatim), operators ---------- */
  const OPS3 = ["...", "..<", "===", "!==", "&&=", "||="], OPS2 = ["->", "==", "!=", "<=", ">=", "&&", "||", "??", "+=", "-=", "*=", "/=", "?."];
  function tokenize(src) {
    const out = []; let i = 0, line = 0; const n = src.length;
    src = src.replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'");
    while (i < n) {
      const c = src[i];
      if (c === "\n") { line++; i++; continue; }
      if (c === " " || c === "\t" || c === "\r") { i++; continue; }
      if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; for (let k = i; k < end; k++) if (src[k] === "\n") line++; i = end; continue; }
      if (c === '"') {
        let j = i + 1, depth = 0;
        if (src.startsWith('"""', i)) { const e = src.indexOf('"""', i + 3); j = e < 0 ? n : e + 3; }
        else { while (j < n) { const d = src[j];
            if (d === "\\" && src[j + 1] === "(") { depth++; j += 2; continue; }
            if (d === "\\") { j += 2; continue; }
            if (depth && d === "(") depth++; else if (depth && d === ")") depth--;
            else if (!depth && (d === '"' || d === "\n")) { if (d === '"') j++; break; }
            j++; } }
        const raw = src.slice(i, j);
        if (raw.indexOf("\\(") < 0 || raw.startsWith('"""')) out.push({ t: "str", v: raw.replace(/\s+/g, " "), line });
        else {   /* interpolation: "a \(x) b" → str, \(, tokens of x, ), str — so renaming and patterns see inside */
          let a = 0, k = 0;
          while (k < raw.length) {
            if (raw[k] === "\\" && raw[k + 1] === "(") {
              let dd = 1, e = k + 2; while (e < raw.length && dd) { if (raw[e] === "(") dd++; else if (raw[e] === ")") dd--; e++; }
              out.push({ t: "str", v: raw.slice(a, k), line }, { t: "op", v: "\\(", line });
              tokenize(raw.slice(k + 2, e - 1)).forEach(t => out.push({ t: t.t, v: t.v, line }));
              out.push({ t: "op", v: ")", line }); a = k = e;
            } else if (raw[k] === "\\") k += 2; else k++;
          }
          out.push({ t: "str", v: raw.slice(a), line });
        }
        for (let k = i; k < j; k++) if (src[k] === "\n") line++; i = j; continue;
      }
      if (/[A-Za-z_$@#\u0400-\u04FF]/.test(c)) { let j = i + 1; while (j < n && /[A-Za-z0-9_\u0400-\u04FF]/.test(src[j])) j++; out.push({ t: "id", v: src.slice(i, j), line }); i = j; continue; }
      if (/[0-9]/.test(c)) { let j = i + 1; while (j < n && /[0-9_.xA-Fa-f]/.test(src[j]) && !(src[j] === "." && !/[0-9]/.test(src[j + 1] || ""))) j++; out.push({ t: "num", v: src.slice(i, j).replace(/_/g, ""), line }); i = j; continue; }
      const o3 = OPS3.find(o => src.startsWith(o, i)); if (o3) { out.push({ t: "op", v: o3, line }); i += 3; continue; }
      const o2 = OPS2.find(o => src.startsWith(o, i)); if (o2) { out.push({ t: "op", v: o2 === "?." ? "?" : o2, line }); if (o2 === "?.") out.push({ t: "op", v: ".", line }); i += 2; continue; }
      out.push({ t: "op", v: c, line }); i++;
    }
    return out;
  }

  /* ---------- normalisation: things that never change meaning ---------- */
  function normalize(toks, keepSelf, keepReturn) {
    const o = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i], p = o[o.length - 1], nx = toks[i + 1];
      if (t.v === ";") continue;
      /* a block that starts with `return expr` is that expression: { return x } ≡ { x } (not the bare `return` of an early exit) */
      if (!keepReturn && t.v === "return" && p && (p.v === "{" || p.v === "in") && nx && nx.v !== "}" && !(p.v === "{" && o[o.length - 2] && o[o.length - 2].v === "else")) continue;   /* guard … else { return x } keeps its return */
      if (!keepSelf && t.v === "self" && nx && nx.v === "." && !(p && (p.v === "." || p.v === "weak" || p.v === "unowned" || p.v === "["))) { i++; continue; }   /* self.x → x */
      if (t.v === "," && nx && (nx.v === ")" || nx.v === "]")) continue;                                    /* trailing comma */
      /* `let x = x` in a condition → shorthand `let x` */
      if ((t.v === "let" || t.v === "var") && nx && nx.t === "id" && toks[i + 2] && toks[i + 2].v === "=" && toks[i + 3] && toks[i + 3].v === nx.v
          && toks[i + 4] && [",", "else", "{"].includes(toks[i + 4].v)) { o.push(t, nx); i += 3; continue; }
      o.push(t);
    }
    return o;
  }
  const toks = (src, keepSelf) => normalize(tokenize(src), keepSelf), toksDefault = toks;
  const str = ts => ts.map(t => t.v).join(" ");

  /* prose lines (Cyrillic outside strings/comments) are the learner's explanation, not code */
  function codePart(text) {
    return text.split("\n").filter(l => { const bare = l.replace(/#"(.*?)"#/g, '""').replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/, ""); return !/[\u0400-\u04FF]/.test(bare); }).join("\n");
  }
  function keyCode(key) { return key.split("\n\n")[0]; }

  /* ---------- line diff skeleton → key: which key lines are new (the part the learner has to produce) ---------- */
  function lineSigs(src, keepSelf, tk) { const ts = (tk || toks)(src, keepSelf), by = {}; ts.forEach(t => (by[t.line] = by[t.line] || []).push(t)); return Object.keys(by).map(Number).sort((a, b) => a - b).map(l => ({ line: l, sig: str(by[l]), ts: by[l] })); }
  function lcsKeep(a, b) {   /* marks b items that are in the LCS with a */
    const n = a.length, m = b.length, d = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) d[i][j] = a[i] === b[j] ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
    const keep = new Array(m).fill(false); let i = 0, j = 0;
    while (i < n && j < m) { if (a[i] === b[j]) { keep[j] = true; i++; j++; } else if (d[i + 1][j] >= d[i][j + 1]) i++; else j++; }
    return keep;
  }
  /* key tokens with .d = true for tokens of new/changed lines */
  function keyDelta(code, key, keepSelf, tk) {
    const A = lineSigs(code || "", keepSelf, tk), B = lineSigs(key, keepSelf, tk), keep = lcsKeep(A.map(x => x.sig), B.map(x => x.sig)), out = [];
    B.forEach((l, k) => l.ts.forEach(t => out.push({ t: t.t, v: t.v, line: t.line, d: !keep[k] })));
    return out;
  }

  /* ---------- alpha-renaming of locals declared in the answer and unknown to the skeleton ---------- */
  function declared(ts) {
    const names = [];
    const add = t => { if (t && t.t === "id" && !/^[@#$]/.test(t.v) && t.v !== "_" && !names.includes(t.v)) names.push(t.v); };
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if ((t.v === "let" || t.v === "var") && ts[i + 1]) { if (ts[i + 1].v === "(") { for (let j = i + 2; j < ts.length && ts[j].v !== ")"; j++) add(ts[j]); } else add(ts[i + 1]); }
      if (t.v === "for" && ts[i + 1]) add(ts[i + 1]);
      if (t.v === "in" && ts[i - 1]) {   /* closure params: { a, b in  /  { [weak x] a in */
        let j = i - 1, ok = true; const tmp = [];
        while (j >= 0 && ts[j].v !== "{" && ts[j].v !== "]") { if (ts[j].t === "id") tmp.push(ts[j]); else if (ts[j].v !== ",") { ok = false; break; } j--; }
        if (ok && j >= 0 && tmp.length && !(ts[j].v === "{" && ts[j - 1] && ts[j - 1].v === "for")) tmp.reverse().forEach(add);
      }
    }
    return names;
  }
  function alpha(ts, skelIds) {
    const names = declared(ts).filter(n => !skelIds.has(n)); if (!names.length) return ts;
    const map = {}; names.forEach((n, k) => map[n] = "§" + (k + 1));
    return ts.map((t, i) => {
      if (t.t !== "id" || !map[t.v]) return t;
      const p = ts[i - 1], nx = ts[i + 1];
      if (p && p.v === "." ) return t;
      if (nx && nx.v === ":" && p && (p.v === "(" || p.v === ",") && !(ts[i - 2] && ["let", "var"].includes(ts[i - 2].v))) return t;   /* argument label */
      return Object.assign({}, t, { v: map[t.v] });
    });
  }

  /* S equals K with some non-delta (skeleton) tokens dropped: every delta token must be present, nothing foreign */
  function coversKey(S, K) {
    if (!K.some(t => t.d)) return false;
    /* group K into runs: a delta token is mandatory; a skeleton line is taken whole or skipped whole */
    const runs = []; K.forEach(t => { const l = runs[runs.length - 1]; if (l && l.d === !!t.d && (t.d || l.line === t.line)) l.ts.push(t); else runs.push({ d: !!t.d, line: t.line, ts: [t] }); });
    const skelLines = runs.filter(r => !r.d).length;
    let cur = new Map([[0, 0]]);   /* position in S → max skeleton lines taken */
    for (const r of runs) {
      const nx = new Map(), put = (j, c) => { if (!nx.has(j) || nx.get(j) < c) nx.set(j, c); };
      cur.forEach((c, j) => {
        let k = 0; while (k < r.ts.length && j + k < S.length && S[j + k].v === r.ts[k].v) k++;
        if (k === r.ts.length) put(j + k, c + (r.d ? 0 : 1));
        if (!r.d) put(j, c);
      });
      cur = nx; if (!cur.size) return false;
    }
    if (!cur.has(S.length)) return false;
    const taken = cur.get(S.length);   /* a nearly full retype with a skeleton line missing is not "the key" */
    return !(skelLines >= 4 && taken < skelLines && taken >= 0.8 * skelLines);
  }
  /* alpha-rename the key by its delta declarations, then the answer by its own */
  function alphaKey(K, skelIds) { const dnames = declared(K.filter(t => t.d)); const r = alpha(K, new Set([...skelIds].filter(x => !dnames.includes(x)))); return r.map((t, i) => Object.assign({}, t, { d: K[i].d })); }

  /* the key puts part of the answer into comments (e.g. "// 2: second и захват") — tokens cannot verify that */
  function commentAnswer(task) {
    const cm = src => (src || "").split("\n").map(l => { const m = l.replace(/"(?:\\.|[^"\\])*"/g, '""').match(/\/\/\s*(.*)$/); return m ? m[1].trim() : ""; }).filter(Boolean);
    const sk = new Set(cm(task.code)); return cm(keyCode(task.key)).some(c => !sk.has(c));
  }
  function exactMatch(ans, task, accept, tk) {
    const toks = tk || toksDefault;
    const keepSelf = /\bself\b/.test((task.code || "") + keyCode(task.key));   /* capture topics: self. is meaningful */
    const skelIds = new Set(toks(task.code || "").filter(t => t.t === "id").map(t => t.v));
    const S0 = toks(codePart(ans), keepSelf); if (!S0.length) return false;
    const S = alpha(S0, skelIds);
    const keys = [keyDelta(task.code, keyCode(task.key), keepSelf, tk)];
    (accept || []).forEach(a => {
      const K = keys[0], first = K.findIndex(t => t.d), last = K.length - 1 - K.slice().reverse().findIndex(t => t.d);
      const hunks = K.reduce((n, t, i) => n + (t.d && !(K[i - 1] && K[i - 1].d) ? 1 : 0), 0);
      const A = toks(a, keepSelf).map(t => Object.assign({}, t, { d: true, line: 1e6 + t.line }));
      if (hunks === 1) keys.push(K.slice(0, first).concat(A, K.slice(last + 1)));
      keys.push(A);
    });
    return keys.some(K => coversKey(S0, K) || coversKey(S, alphaKey(K, skelIds)));
  }

  /* ---------- token patterns: `$a` one identifier (consistent), `...` any balanced run ---------- */
  const OPEN = { "(": ")", "[": "]", "{": "}" }, CLOSE = new Set([")", "]", "}"]);
  /* `$note` stays literal when `note` is a name of the task itself (SwiftUI bindings); `$0`, `$1` are always literal */
  function compilePat(p, keepSelf, lits) { return normalize(tokenize(p.replace(/…/g, "...")), keepSelf, true).map(t => t.v === "..." ? { any: 1 } : (t.t === "id" && t.v[0] === "$" && !/^\$\d/.test(t.v) && !(lits && lits.has(t.v.slice(1)))) ? { v: t.v, bind: 1 } : { v: t.v }); }
  function matchAt(P, pi, S, si, env, budget) {
    if (budget.n-- <= 0) return false;
    if (pi === P.length) return true;
    const p = P[pi];
    if (p.any) {
      let depth = 0;
      for (let k = si; k <= S.length; k++) {
        if (depth === 0 && matchAt(P, pi + 1, S, k, env, budget)) return true;
        if (k === S.length) break;
        const v = S[k].v; if (OPEN[v]) depth++; else if (CLOSE.has(v)) { depth--; if (depth < 0) return false; }
      }
      return false;
    }
    if (si >= S.length) return false;
    const s = S[si];
    if (p.bind) { if (s.t !== "id") return false; if (env[p.v] && env[p.v] !== s.v) return false; const had = env[p.v]; env[p.v] = s.v; if (matchAt(P, pi + 1, S, si + 1, env, budget)) return true; if (!had) delete env[p.v]; return false; }
    return s.v === p.v && matchAt(P, pi + 1, S, si + 1, env, budget);
  }
  function hasPat(S0, pat, lits) { const hasSelf = /\bself\b/.test(pat), P = compilePat(pat, hasSelf, lits), S = hasSelf ? S0 : normalize(S0, false, true); if (!P.length) return false; for (let i = 0; i < S.length; i++) if (matchAt(P, 0, S, i, {}, { n: 20000 })) return true; return false; }
  const anyPat = (S, pats, lits) => (pats || []).some(p => hasPat(S, p, lits));

  function balanced(ts) { const st = []; for (const t of ts) { if (OPEN[t.v]) st.push(OPEN[t.v]); else if (CLOSE.has(t.v)) { if (st.pop() !== t.v) return false; } } return st.length === 0; }

  /* ---------- token edit distance to the key delta (for the "almost the key" pointer) ---------- */
  function editOps(a, b) {
    const n = a.length, m = b.length; if (n * m > 250000) return null;
    const d = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = 0; i <= n; i++) d[i][0] = i; for (let j = 0; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].v === b[j - 1].v ? 0 : 1));
    const ops = []; let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1].v === b[j - 1].v && d[i][j] === d[i - 1][j - 1]) { i--; j--; }
      else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) { ops.push({ op: "sub", mine: a[i - 1].v, key: b[j - 1].v, line: a[i - 1].line }); i--; j--; }
      else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push({ op: "extra", mine: a[i - 1].v, line: a[i - 1].line }); i--; }
      else { ops.push({ op: "missing", key: b[j - 1].v, line: a[Math.max(0, i - 1)] ? a[Math.max(0, i - 1)].line : 0 }); j--; }
    }
    return ops.reverse();
  }
  /* distance between the learner's own lines (skeleton lines removed) and the key delta */
  function nearKey(ans, task) {
    const skel = new Set(lineSigs(task.code || "").map(l => l.sig));
    const mine = []; lineSigs(codePart(ans)).forEach(l => { if (!skel.has(l.sig)) l.ts.forEach(t => mine.push(t)); });
    const K = keyDelta(task.code, keyCode(task.key)).filter(t => t.d);
    const ops = editOps(mine, K); return ops ? { ops, n: K.length, mine: mine.length } : null;
  }

  /* ---------- P1 baseline: normalised answer equals the key (full or new part) ---------- */
  function p1(ans, task) {
    const S = str(toks(codePart(ans))), K = keyDelta(task.code, keyCode(task.key));
    return { v: S && (S === str(K) || S === str(K.filter(t => t.d))) ? "ok" : "no", why: "p1" };
  }

  /* ---------- P2: exact/accept → not → must → verdict ---------- */
  function checkCode(ans, task, check, opt) {
    opt = opt || {}; check = check || {};
    const code = codePart(ans), S = normalize(tokenize(code), true, true);
    if (!S.length) return { v: "no", why: "empty", msgs: ["В ответе нет кода."] };
    if (exactMatch(ans, task, opt.noAccept ? [] : check.accept, opt.tk)) return commentAnswer(task)
      ? { v: "unsure", why: "comments", msgs: ["Код совпал с ключом. Подписи в комментариях сверь сам."] } : { v: "ok", why: "exact", msgs: [] };
    const skel = new Set(lineSigs(task.code || "").map(l => l.sig));
    const own = []; lineSigs(code, true, src => normalize(tokenize(src), true, true)).forEach(l => { if (!skel.has(str(normalize(l.ts)))) l.ts.forEach(t => own.push(t)); });
    const lits = new Set(tokenize((task.code || "") + "\n" + keyCode(task.key)).filter(t => t.t === "id").map(t => t.v));
    const bad = (check.not || []).filter(r => anyPat(own, r.pat, lits));
    if (bad.length) return { v: "no", why: "not", msgs: bad.map(r => r.msg) };
    const must = check.must || [], miss = must.filter(r => !anyPat(S, r.pat, lits));
    if (miss.length) return { v: opt.missUnsure ? "unsure" : "no", why: "miss", msgs: miss.map(r => r.miss), found: must.length - miss.length, of: must.length };
    if (must.length >= 2 && check.complete && !opt.neverRubricOk) return { v: "ok", why: "rubric", msgs: [] };
    return { v: "unsure", why: must.length ? "signs" : "norubric", msgs: [] };
  }

  /* ---------- predict the output ----------
     The answer is free text: lines, or one line with commas, often followed by an explanation. The first N items must
     start with the N expected values, in order. A mismatch on a short, value-like item is "no"; on prose it is "unsure". */
  const normOut = s => s.toLowerCase().replace(/ё/g, "е").replace(/[“”«»"'`]/g, "").replace(/^\s*(\d+[.)]|[-–•*])(\s+|$)/, "")
    .replace(/^(вывод|ответ|напечатает|будет|сначала|потом|затем|и потом|и|дальше|в конце)[:,]?\s+/, "").replace(/\s+/g, " ").trim().replace(/[.;,:!]+$/, "");
  const EMPTY = /^\(?(пуст(ая|о|ой)?( строк[аи])?|ничего|empty)\)?$/;
  function splitTop(line) {   /* split on , ; → / and sentence ends outside brackets */
    const out = []; let depth = 0, cur = "";
    for (let i = 0; i < line.length; i++) { const c = line[i];
      if ("([{".includes(c)) depth++; else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
      const sep = !depth && (c === "," || c === ";" || c === "→" || (c === "/" && line[i - 1] === " ") || (c === "." && line[i + 1] === " ") || (c === "-" && line[i + 1] === ">"));
      if (sep) { out.push(cur); cur = ""; if (c === "-") i++; } else cur += c; }
    out.push(cur); return out.map(x => x.trim());
  }
  function outItems(ans, n, keepEmpty) {
    let lines = ans.replace(/\s+$/, "").split("\n").map(l => l.trim());
    if (!keepEmpty) lines = lines.filter(Boolean);
    if (lines.filter(Boolean).length >= n) return lines;
    return [].concat(...lines.filter(Boolean).map(splitTop)).filter(x => x !== "");
  }
  const proseLike = s => (s.match(/[Ѐ-ӿ]{2,}/g) || []).length >= 4;
  function matchItem(item, exp) {
    const a = normOut(item), e = normOut(exp);
    if (e === "") return a === "" || EMPTY.test(a);
    if (a === e) return true;
    const strip = a.replace(/^[a-zа-я_][\wа-я.]*\s*[:=—-]\s*/, "");   /* "recipients: [...]" */
    if (strip === e) return true;
    for (const x of [a, strip]) if (x.startsWith(e) && /^[\s(.—–-]/.test(x.slice(e.length)) && !/^\s*[\d\wЀ-ӿ"\[]/.test(x.slice(e.length).replace(/^\s*[(.—–-]/, "x") === x.slice(e.length) ? x.slice(e.length) : "")) return true;
    return false;
  }
  function matchSeq(ans, exp) {   /* → {ok} | {k, item, valueLike} */
    const items = outItems(ans, exp.length, exp.includes(""));
    for (let k = 0; k < exp.length; k++) if (items[k] == null || !matchItem(items[k], exp[k])) return { k, item: items[k], items };
    return { ok: true, items };
  }
  function checkPredict(ans, task, check) {
    if (!check || check.self || !check.outs) return { v: "unsure", why: "self", msgs: [] };
    if (!ans.trim()) return { v: "no", why: "empty", msgs: ["Ответа нет."] };
    const res = check.outs.map(o => matchSeq(ans, o)), hit = res.findIndex(r => r.ok);
    if (check.needAll && check.outs.length > 1) {
      const flat = normOut(ans.replace(/\n/g, " ; ")), all = check.outs.every(o => flat.includes(o.map(normOut).join(", ")) || flat.includes(o.map(normOut).join(" ")));
      return all ? { v: "ok", why: "outs", msgs: [] } : { v: hit >= 0 ? "no" : "unsure", why: "needAll", msgs: ["Задание просит назвать все допустимые порядки — их " + check.outs.length + "."] };
    }
    if (hit >= 0) {
      const o = check.outs[hit], rest = res[hit].items.slice(o.length).filter(Boolean);
      /* an extra short value right after the expected ones means a different number of printed lines */
      if (rest.length && !proseLike(rest.join(" ")) && rest.every(x => normOut(x).length <= 14) && !check.outs.some(p => p.length > o.length)) return { v: "unsure", why: "extra", msgs: ["После " + o.length + " строк вывода у тебя есть ещё что-то — проверь, что это пояснение, а не лишняя строка."] };
      return { v: "ok", why: "outs", msgs: [] };
    }
    for (const w of (check.wrong || [])) if (w.out && matchSeq(ans, w.out).ok) return { v: "no", why: "wrong", msgs: [w.msg] };
    const r = res[0], o = check.outs[0];
    if (r.item == null) return proseLike(ans) ? { v: "unsure", why: "prose", msgs: [] } : { v: "no", why: "short", msgs: ["Строк вывода должно быть " + o.length + ", у тебя меньше."] };
    const lined = ans.trim().split("\n").filter(l => l.trim()).length >= o.filter(Boolean).length;   /* one value per line: the format the field asks for */
    if (!lined || proseLike(r.item) || normOut(r.item).length > Math.max(24, 2 * o[r.k].length + 8)) return { v: "unsure", why: "prose", msgs: ["Не смог разобрать ответ: запиши вывод по одной строке."] };
    const msgs = ["Строка " + (r.k + 1) + ": у тебя «" + r.item + "», а будет «" + (o[r.k] || "пустая строка") + "»."];
    if (check.why && check.why[r.k]) msgs.push(check.why[r.k]);
    return { v: "no", why: "line", msgs };
  }

  /* ---------- oral: concept coverage (never an automatic "ok" in the recommended scheme) ---------- */
  function checkOral(ans, task, check) {
    if (!check || !check.concepts) return { v: "unsure", why: "self", msgs: [] };
    const a = ans.toLowerCase().replace(/ё/g, "е"), has = g => g.some(s => a.includes(s.toLowerCase().replace(/ё/g, "е")));
    const fl = (check.false || []).filter(f => f.groups.every(has));
    const miss = check.concepts.filter(c => !c.groups.every(has));
    if (fl.length) return { v: "no", why: "false", msgs: fl.map(f => f.msg), found: check.concepts.length - miss.length, of: check.concepts.length };
    if (miss.length) return { v: "no", why: "miss", msgs: miss.map(c => c.miss || c.label), found: check.concepts.length - miss.length, of: check.concepts.length };
    return { v: "ok", why: "concepts", msgs: [], found: check.concepts.length, of: check.concepts.length };
  }

  /* build-time guard: drop rubric items that contradict the key (a `must` the key lacks, a `not` the key or an accept has) */
  function sanitize(task, ch) {
    if (!ch || task.kind !== "code") return { check: ch, dropped: 0 };
    const raw = src => normalize(tokenize(src), true, true), key = keyCode(task.key), K = raw(key), lits = new Set(tokenize((task.code || "") + "\n" + key).filter(t => t.t === "id").map(t => t.v));
    const D = keyDelta(task.code, key, true, raw).filter(t => t.d), acc = (ch.accept || []).map(raw);
    const must = (ch.must || []).filter(m => anyPat(K, m.pat, lits)), not = (ch.not || []).filter(m => !anyPat(D, m.pat, lits) && !acc.some(a => anyPat(a, m.pat, lits)));
    return { check: Object.assign({}, ch, { must, not }), dropped: (ch.must || []).length - must.length + (ch.not || []).length - not.length };
  }

  /* ---------- recommended cascade: four verdicts ----------
     ok     — equals the key or a verified variant (the only way to "ok" for code); the expected output, line by line
     no     — a known mistake was recognised (rubric `not`, a known wrong output, a wrong output line)
     check  — the site cannot decide but has a pointed question: a missing required sign, or one token away from the key
     unsure — nothing to say: compare with the key yourself */
  function verdict(ans, task, rubric) {
    if (task.kind === "oral") { const r = checkOral(ans, task, rubric); return r.why === "self" ? r : { v: r.why === "false" ? "check" : r.why === "miss" ? "check" : "unsure", why: "oral-" + r.why, msgs: r.msgs, found: r.found, of: r.of }; }
    if (task.kind === "predict") return checkPredict(ans, task, rubric);
    const r = checkCode(ans, task, rubric, { neverRubricOk: true });
    if (r.v === "ok" || r.why === "not" || r.why === "empty" || r.why === "comments") return r;
    const nk = nearKey(ans, task);
    if (nk && nk.ops.length === 1) { const o = nk.ops[0];
      return { v: "check", why: "near", msgs: ["Почти как в ключе, отличие в одном месте (строка " + (o.line + 1) + "): " + (o.op === "sub" ? "у тебя «" + o.mine + "», в ключе «" + o.key + "»" : o.op === "extra" ? "лишнее «" + o.mine + "»" : "нет «" + o.key + "»") + ". Это меняет смысл?"] }; }
    if (r.why === "miss") return { v: "check", why: "miss", msgs: r.msgs, found: r.found, of: r.of };
    return r;
  }

  function check(ans, task, rubric, opt) {
    if (task.kind === "predict") return checkPredict(ans, task, rubric);
    if (task.kind === "oral") return checkOral(ans, task, rubric);
    return checkCode(ans, task, rubric, opt);
  }

  const api = { verdict, sanitize, commentAnswer, tokenize, normalize, toks, str, codePart, keyCode, keyDelta, exactMatch, hasPat, anyPat, balanced, nearKey, p1, checkCode, checkPredict, checkOral, check, lineSigs };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SynCheck = api;
})(typeof self !== "undefined" ? self : this);
