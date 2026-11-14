// Content lint (review 14.11, item 5): scripts/lint_content.py and its hook in scripts/build.py.
// No browser: a copy of content/ + engine/app.js + scripts/ in a temp dir, one injected violation per rule —
// the lint must name the rule and the build must stop; the untouched copy must pass.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Suite, ROOT } = require('./lib');

function copyTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapso-lint-'));
  for (const d of ['content', 'scripts']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  fs.cpSync(path.join(ROOT, 'engine'), path.join(dir, 'engine'), { recursive: true });
  return dir;
}
const py = (dir, script, ...args) => spawnSync('python3', [path.join(dir, 'scripts', script), ...args], { encoding: 'utf8' });
const edit = (dir, rel, fn) => { const f = path.join(dir, rel); fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8'))); };
const editJson = (dir, rel, fn) => edit(dir, rel, t => { const j = JSON.parse(t); fn(j); return JSON.stringify(j, null, 1); });

// [rule expected in the output, file to break, how]
const CASES = [
  ['L-LEN', d => edit(d, 'content/lessons/coll.md', t => t.replace('```swift\n', '```swift\nlet veryLongName = "' + 'x'.repeat(70) + '"\n'))],
  ['L-BLANK', d => edit(d, 'content/lessons/coll.md', t => t.replace('```swift\n', '```swift\nlet a = 1\n\nlet b = 2\n'))],
  ['L-MISSION', d => edit(d, 'content/lessons/coll.md', t => t.replace(/ОПЕРАЦИЯ \d+/, 'ОПЕРАЦИЯ 99'))],
  ['L-MISSION', d => edit(d, 'content/lessons/coll.md', t => t.replace(/(mission: ОПЕРАЦИЯ \d+ · )(.+)/, (m, a, b) => a + b.toLowerCase()))],
  ['L-PREREQ', d => edit(d, 'content/lessons/coll.md', t => t.replace(/\n---\n/, '\nprereqs:\n- nosuchtopic\n---\n'))],
  ['L-PREREQ', d => edit(d, 'content/lessons/coll.md', t => t.replace(/\n---\n/, '\nprereqs: []\n---\n'))],
  ['L-HEAD', d => edit(d, 'content/lessons/coll.md', t => t.replace(/\nscenario:.*\n/, '\n'))],
  ['S-COUNT', d => editJson(d, 'content/steps/coll.json', j => { j.pop(); })],
  ['S-LEN', d => editJson(d, 'content/steps/coll.json', j => { j[1].key = 'let total = ' + '1 + '.repeat(30) + '1\n' + j[1].key; })],
  ['S-BLANK', d => editJson(d, 'content/steps/coll.json', j => { j[0].code = 'let a = [1, 2]\n\nprint(a.count)'; })],
  ['B-TYPE', d => editJson(d, 'content/bank/coll.bank.json', j => { j[0].type = 'Угадай'; })],
  ['B-TOPIC', d => editJson(d, 'content/bank/coll.bank.json', j => { j[0].topics = ['nosuchtopic']; })],
  ['B-LEN', d => editJson(d, 'content/bank/coll.bank.json', j => { j[0].code = 'let total = ' + '1 + '.repeat(30) + '1'; })],
  ['B-BLANK', d => editJson(d, 'content/bank/coll.bank.json', j => { j[0].code = 'let a = 1\n\nprint(a)'; })],
  ['R-CHEAT', d => editJson(d, 'content/base/ref.json', j => { delete j.cheat.coll; })],
];

async function run() {
  const s = new Suite('lint');
  const clean = copyTree();
  try {
    let r = py(clean, 'lint_content.py', '--root', clean);
    await s.check('the repository content passes the lint', r.status === 0, (r.stdout + r.stderr).slice(-600));
    await s.check('known debt is reported, not hidden', /\d+ known/.test(r.stdout), r.stdout.slice(-200));
    r = py(clean, 'build.py');
    await s.check('the build passes on clean content', r.status === 0 && /built dist/.test(r.stdout), (r.stdout + r.stderr).slice(-400));
    for (const [rule, breakIt] of CASES) {
      const dir = copyTree();
      try {
        breakIt(dir);
        const l = py(dir, 'lint_content.py', '--root', dir);
        await s.check(`${rule}: lint reports the violation`, l.status === 1 && l.stdout.includes('[' + rule + ']'), l.stdout.slice(-400));
        const b = py(dir, 'build.py');
        await s.check(`${rule}: the build stops`, b.status !== 0 && !fs.existsSync(path.join(dir, 'dist', 'index.html')), (b.stdout + b.stderr).slice(-300));
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
    // prose task texts in `code` (oral steps) are not code: long lines are fine there
    const dir = copyTree();
    try {
      editJson(dir, 'content/steps/coll.json', j => { j[4].code = 'Объясни своими словами, как на собеседовании, почему словарь не хранит порядок элементов и что из этого следует для экрана со списком.\n\nПотом назови два случая, когда порядок всё же нужен.'; });
      const l = py(dir, 'lint_content.py', '--root', dir);
      await s.check('prose in a `code` field is not linted as code', l.status === 0, l.stdout.slice(-300));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  } finally { fs.rmSync(clean, { recursive: true, force: true }); }
  return s.result();
}

module.exports = { run };
