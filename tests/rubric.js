// Rubric guard (pilot 15.11): scripts/check_rubrics.js and its hook in scripts/build.py. No browser.
// A copy of content/ + engine/ + scripts/ in a temp dir, one injected contradiction per rule: the guard must name it and
// the build must stop. A key changed without the rubric being stamped again stops the build too.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Suite, ROOT } = require('./lib');

function copyTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapso-rubric-'));
  for (const d of ['content', 'scripts', 'engine']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  return dir;
}
const run1 = (cmd, dir, script, ...args) => spawnSync(cmd, [path.join(dir, 'scripts', script), ...args], { encoding: 'utf8' });
const editJson = (dir, rel, fn) => { const f = path.join(dir, rel); const j = JSON.parse(fs.readFileSync(f, 'utf8')); fn(j); fs.writeFileSync(f, JSON.stringify(j, null, 1)); };
const step = (j, id) => j.find(x => x.id === id);

// [name, text expected in the guard output, how to break a copy]
const CASES = [
  ['the key changed, the rubric was not reviewed', 'changed after the rubric was written', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').key = step(j, 's3').key.replace('/users/', '/people/'); })],
  ['the skeleton changed, the rubric was not reviewed', 'changed after the rubric was written', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').code += '\n// ещё одна подсказка'; })],
  ['a rubric without a stamp', 'no `for` stamp', d => editJson(d, 'content/steps/opt.json', j => { delete step(j, 's3').check.for; })],
  ['a required sign the key does not have', 'contradicts the key', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').check.must[0].pat = ['if let id { ... }']; })],
  ['a «mistake» pattern that matches the key', 'contradicts the key', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').check.not[0].pat = ['guard let id']; })],
  ['a verified variant that is the key itself', 'is the key itself', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').check.accept = ['guard let id else { return nil }\nreturn "/users/\\(id)"']; })],
  ['a «mistake» pattern that matches a verified variant', 'contradicts accept', d => editJson(d, 'content/steps/opt.json', j => { const c = step(j, 's2').check; c.not.push({ pat: [c.accept[0].split('\n')[0]], msg: 'так нельзя' }); })],
  ['a rubric with no required signs', 'at least one required sign', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').check.must = []; })],
  ['a «wrong» output that equals the expected one', 'contradicts outs', d => editJson(d, 'content/steps/opt.json', j => { const c = step(j, 's1').check; c.wrong[0].out = c.outs[0].slice(); })],
  ['one explanation per output line', 'one text per line', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's1').check.why.pop(); })],
  ['an oral point the key itself does not make', 'contradicts the key', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's5').check.concepts[0].groups = [['такогословавключенет']]; })],
  // wording (pilot, item 3): «проверь» is a question, and no text hands over the answer before the key is seen
  ['a «проверь» text that is a statement, not a question', 'must be a question', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').check.must[0].ask = 'Ты забыл ранний выход.'; })],
  ['an oral point without a question', 'must be a question', d => editJson(d, 'content/steps/opt.json', j => { delete step(j, 's5').check.concepts[0].ask; })],
  ['a misconception without a clarifying question', 'must be a question', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's5').check.false[0].ask = 'Это неверно'; })],
  ['a mentor note that contains a whole new line of the key', 'gives the answer away', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').check.not[0].msg = 'Нужно так: `guard let id else { return nil }` — и всё.'; })],
  ['a question that contains a whole new line of the key', 'gives the answer away', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').check.must[0].ask = 'Есть ли у тебя return "/users/\\(id)"?'; })],
  ['a «почему» text that contains the fix of a bank task', 'gives the answer away', d => editJson(d, 'content/bank/urls.bank.json', j => { const t = j.find(x => x.id === 'urls-b2'); t.check.must[0].miss = 'Добавь guard chapter.id == selectedID else { return } перед присвоением.'; })],
  ['a mentor note longer than the limit', 'up to 260 characters', d => editJson(d, 'content/steps/opt.json', j => { step(j, 's3').check.not[0].msg = 'очень '.repeat(60); })],
  ['a rubric of an unknown shape', 'no known shape', d => editJson(d, 'content/bank/opt.bank.json', j => { j.find(x => x.check).check = { for: 'x', hello: 1 }; })],
  ['a bank task: the key changed, the rubric was not reviewed', 'changed after the rubric was written', d => editJson(d, 'content/bank/urls.bank.json', j => { const t = j.find(x => x.check); t.key = t.key.replace('200', '201'); })],
];

async function run() {
  const s = new Suite('rubric');
  const clean = copyTree();
  try {
    let r = run1('node', clean, 'check_rubrics.js');
    await s.check('the repository rubrics pass the guard', r.status === 0 && /rubrics ok/.test(r.stdout), (r.stdout + r.stderr).slice(-600));
    await s.check('the pilot has rubrics: 5 topics × 10 tasks', /: 50 rubrics ok/.test(r.stdout), r.stdout);
    for (const [name, expect, breakIt] of CASES) {
      const dir = copyTree();
      try {
        breakIt(dir);
        const g = run1('node', dir, 'check_rubrics.js');
        await s.check(`${name}: the guard reports it`, g.status === 1 && (g.stdout + g.stderr).includes(expect), (g.stdout + g.stderr).slice(-400));
        const b = run1('python3', dir, 'build.py');
        await s.check(`${name}: the build stops`, b.status !== 0 && !fs.existsSync(path.join(dir, 'dist', 'index.html')) && (b.stdout + b.stderr).includes('rubric guard failed'), (b.stdout + b.stderr).slice(-300));
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
    // the way out after a deliberate key change: review, then stamp — and only the named topic is touched
    const dir = copyTree();
    try {
      editJson(dir, 'content/steps/opt.json', j => { step(j, 's5').key += ' Это проверяют отдельно.'; });
      await s.check('a changed key stops the guard', run1('node', dir, 'check_rubrics.js').status === 1);
      const before = fs.readFileSync(path.join(dir, 'content/steps/urls.json'), 'utf8');
      r = run1('node', dir, 'check_rubrics.js', '--stamp', 'opt');
      await s.check('--stamp <topic> accepts the reviewed rubric', r.status === 0 && /stamped rubrics: 1/.test(r.stdout), (r.stdout + r.stderr).slice(-300));
      await s.check('--stamp leaves other topics alone', fs.readFileSync(path.join(dir, 'content/steps/urls.json'), 'utf8') === before);
      r = run1('python3', dir, 'build.py');
      await s.check('the build passes after the stamp', r.status === 0 && /built dist/.test(r.stdout), (r.stdout + r.stderr).slice(-300));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    // what reaches the page: the rubric without its build-time stamp; topics outside the pilot have none
    r = run1('python3', clean, 'build.py');
    const html = fs.readFileSync(path.join(clean, 'dist', 'index.html'), 'utf8');
    const m = html.match(/<script[^>]*id="data"[^>]*>([\s\S]*?)<\/script>/);
    let data = null; try { data = JSON.parse(m[1]); } catch (e) {}
    await s.check('the page data parses', !!data, m ? 'bad JSON' : 'DATA not found');
    if (data) {
      const st = data.content.opt.steps, bank = data.bank.filter(b => b.check);
      await s.check('pilot steps carry the rubric into the page', st.every(x => x.check) && data.content.weak.steps.every(x => x.check));
      await s.check('the build-time stamp stays out of the page', st.every(x => !('for' in x.check)) && bank.every(b => !('for' in b.check)));
      await s.check('pilot bank tasks carry the rubric', bank.length === 15, bank.length);
      await s.check('topics outside the pilot have no rubric', data.content.coll.steps.every(x => !x.check));
    }
  } finally { fs.rmSync(clean, { recursive: true, force: true }); }
  return { name: s.name, passed: s.passed, failed: s.failed, warnings: s.warnings };
}
module.exports = { run };
if (require.main === module) run().then(r => { console.log(`${r.failed.length ? 'FAIL' : 'ok'} ${r.name}: ${r.passed} passed, ${r.failed.length} failed`); process.exit(r.failed.length ? 1 : 0); });
