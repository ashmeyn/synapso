"""Synapso content lint: the format rules of CLAUDE.md / docs/content-format.md that the build did not check.

    python3 scripts/lint_content.py            # lint this repository
    python3 scripts/lint_content.py --root D   # lint another checkout (used by tests/lint.js)
    python3 scripts/lint_content.py --write-baseline   # accept today's violations as known debt

scripts/build.py runs it before building. A violation listed in scripts/lint_baseline.json is known debt: it is
counted and reported in one line, but does not stop the build (fixing old content is a separate, agreed task).
Any violation that is NOT in the baseline stops the build — new content must be clean.

Rules (id · what):
  L-MISSION  mission = «ОПЕРАЦИЯ N · ЗАГОЛОВОК», N = position of the topic in BRANCHES (engine/app.js), title upper-case
  L-HEAD     scenario and goals are present
  L-PREREQ   every prereq is a known topic id
  L-LEN      a line of a ``` code block in a lesson is longer than 80 characters
  L-BLANK    an empty line inside a ``` code block of a lesson or at its end
  S-COUNT    a steps file has exactly 7 steps with ids s1…s7 and the fields id, title, prompt, code, key
  S-LEN      a code line in a step's `code` or `key` is longer than 80 characters
  S-BLANK    an empty line inside a step's `code` (when the field is code, not a prose task)
  B-TYPE     a bank task type is one of the five official ones
  B-TOPIC    a bank task points to a known topic
  B-LEN      a code line in a bank task's `code` or `key` is longer than 80 characters
  B-BLANK    an empty line inside a bank task's `code`
  R-CHEAT    every topic with a lesson has a cheat sheet in content/base/ref.json

«Code line» = a line without Russian prose: fewer than 10 Cyrillic letters outside comments and string literals
(the same idea as proseCode() in the engine). Prose lines wrap in the browser, code lines do not.
"""
import glob, json, os, re, sys

MAX = 80
BANK_TYPES = {'Предскажи вывод', 'Допиши', 'Найди ошибку', 'Перепиши', 'Устно'}
STEP_IDS = ['s%d' % i for i in range(1, 8)]
STEP_FIELDS = ('id', 'title', 'prompt', 'code', 'key')
CYR = re.compile('[а-яё]', re.I)


def cyr_count(line):
    bare = re.sub(r'"[^"]*"', '', re.sub(r'//.*$', '', line))
    return len(CYR.findall(bare))


def is_code_line(line):
    return cyr_count(line) < 10


def is_prose_block(text):
    """Half or more of the non-empty lines are Russian prose -> the field is a task text, not code."""
    ls = [l for l in text.split('\n') if l.strip()]
    return bool(ls) and sum(1 for l in ls if not is_code_line(l)) >= len(ls) / 2


def branches(root):
    src = open(os.path.join(root, 'engine', 'app.js'), encoding='utf-8').read()
    a = src.index('const BRANCHES = ['); b = src.index('const CROSS', a)
    return re.findall(r'\["([a-z0-9_]+)","[^"]+","[A-Z]",\d+\]', src[a:b])


def lint(root):
    """Returns a list of (key, message). key = «RULE where» is stable, so it can live in the baseline."""
    out = []
    add = lambda rule, where, msg: out.append(('%s %s' % (rule, where), msg))
    P = lambda *a: os.path.join(root, *a)
    order = branches(root)
    pos = {tid: i + 1 for i, tid in enumerate(order)}
    content = json.load(open(P('content', 'base', 'content.json'), encoding='utf-8'))
    ref = json.load(open(P('content', 'base', 'ref.json'), encoding='utf-8'))
    known = set(content)

    # ---- lessons ----
    for path in sorted(glob.glob(P('content', 'lessons', '*.md'))):
        tid = os.path.basename(path)[:-3]
        lines = open(path, encoding='utf-8').read().split('\n')
        fm = {}; key = None; body_at = 0
        if lines and lines[0].strip() == '---':
            for i in range(1, len(lines)):
                ln = lines[i]
                if ln.strip() == '---': body_at = i + 1; break
                if ln.startswith('- ') and key: fm.setdefault(key, []).append(ln[2:].strip())
                elif ':' in ln:
                    key, val = ln.split(':', 1); key = key.strip()
                    if val.strip(): fm[key] = val.strip()
        m = re.match(r'^ОПЕРАЦИЯ (\d+) · (.+)$', str(fm.get('mission', '')))
        if not m: add('L-MISSION', tid, 'mission must be «ОПЕРАЦИЯ N · ЗАГОЛОВОК»: %r' % fm.get('mission'))
        else:
            if tid in pos and int(m.group(1)) != pos[tid]:
                add('L-MISSION', tid, 'mission says ОПЕРАЦИЯ %s, the topic is number %d on the map (BRANCHES)' % (m.group(1), pos[tid]))
            if m.group(2) != m.group(2).upper(): add('L-MISSION', tid, 'mission title must be upper-case: %s' % m.group(2))
        if tid not in pos: add('L-MISSION', tid, 'topic is not in BRANCHES (engine/app.js)')
        if not fm.get('scenario'): add('L-HEAD', tid + ' scenario', 'scenario is missing')
        if not isinstance(fm.get('goals'), list) or not fm['goals']: add('L-HEAD', tid + ' goals', 'goals are missing')
        pre = fm.get('prereqs', [])
        if not isinstance(pre, list): add('L-PREREQ', tid, 'prereqs must be a list of «- id» lines (or no prereqs line at all): %r' % pre)
        else:
            for x in pre:
                if x not in known: add('L-PREREQ', '%s -> %s' % (tid, x), 'unknown prereq %r' % x)
        in_code = False; block = 0; start = 0
        for i in range(body_at, len(lines)):
            ln = lines[i]
            if ln.startswith('```'):
                if in_code and i - 1 > start and not lines[i - 1].strip():
                    add('L-BLANK', '%s block %d end' % (tid, block), '%s.md:%d empty line at the end of a code block' % (tid, i))
                in_code = not in_code
                if in_code: block += 1; start = i
                continue
            if not in_code: continue
            if not ln.strip():
                if i + 1 < len(lines) and not lines[i + 1].startswith('```'):
                    add('L-BLANK', '%s block %d line %d' % (tid, block, i - start), '%s.md:%d empty line inside a code block' % (tid, i + 1))
            elif len(ln) > MAX:
                add('L-LEN', '%s block %d line %d' % (tid, block, i - start), '%s.md:%d code line is %d characters (max %d)' % (tid, i + 1, len(ln), MAX))
        if tid not in ref.get('cheat', {}) or not ref['cheat'][tid]: add('R-CHEAT', tid, 'no cheat sheet in content/base/ref.json')

    def code_field(rule_len, rule_blank, where, name, text, blank):
        if not isinstance(text, str) or not text: return
        prose = is_prose_block(text)
        ls = text.split('\n')
        for i, ln in enumerate(ls):
            if len(ln) > MAX and is_code_line(ln) and not prose:
                add(rule_len, '%s %s line %d' % (where, name, i + 1), '%s %s line %d is %d characters (max %d)' % (where, name, i + 1, len(ln), MAX))
            if blank and not prose and not ln.strip():
                add(rule_blank, '%s %s line %d' % (where, name, i + 1), '%s %s line %d is empty (no empty lines in code)' % (where, name, i + 1))

    # ---- steps ----
    for path in sorted(glob.glob(P('content', 'steps', '*.json'))):
        tid = os.path.basename(path)[:-5]
        steps = json.load(open(path, encoding='utf-8'))
        ids = [s.get('id') for s in steps] if isinstance(steps, list) else None
        if ids != STEP_IDS: add('S-COUNT', tid, 'steps must be exactly s1…s7 in order, got %r' % (ids,)); continue
        for s in steps:
            miss = [f for f in STEP_FIELDS if not isinstance(s.get(f), str) or (f != 'code' and not s[f].strip())]
            if miss: add('S-COUNT', '%s/%s fields' % (tid, s['id']), 'missing or empty fields: %s' % ', '.join(miss))
            code_field('S-LEN', 'S-BLANK', '%s/%s' % (tid, s['id']), 'code', s.get('code'), True)
            code_field('S-LEN', 'S-BLANK', '%s/%s' % (tid, s['id']), 'key', s.get('key'), False)

    # ---- bank ----
    tasks = [('base/bank.json', x) for x in json.load(open(P('content', 'base', 'bank.json'), encoding='utf-8'))]
    for path in sorted(glob.glob(P('content', 'bank', '*.bank.json'))):
        tasks += [(os.path.basename(path), x) for x in json.load(open(path, encoding='utf-8'))]
    for fname, x in tasks:
        bid = x.get('id', '?')
        if x.get('type') not in BANK_TYPES: add('B-TYPE', bid, '%s: type %r is not one of the five official types' % (fname, x.get('type')))
        for t in x.get('topics') or ['']:
            if t not in known: add('B-TOPIC', '%s -> %s' % (bid, t), '%s: unknown topic %r' % (fname, t))
        code_field('B-LEN', 'B-BLANK', bid, 'code', x.get('code'), True)
        code_field('B-LEN', 'B-BLANK', bid, 'key', x.get('key'), False)
    return out


def run(root, write_baseline=False, quiet=False):
    """Prints the report; returns the number of NEW violations (not in the baseline)."""
    found = lint(root)
    bpath = os.path.join(root, 'scripts', 'lint_baseline.json')
    if write_baseline:
        json.dump({'note': 'Known format debt accepted on the date of the last --write-baseline. Remove an entry when it is fixed; never add by hand to hide a new violation.',
                   'known': sorted(k for k, _ in found)}, open(bpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('lint: baseline written, %d known violations' % len(found)); return 0
    known = set(json.load(open(bpath, encoding='utf-8')).get('known', [])) if os.path.isfile(bpath) else set()
    new = [(k, m) for k, m in found if k not in known]
    old = [k for k, _ in found if k in known]
    gone = sorted(known - {k for k, _ in found})
    for k, m in new: print('lint: [%s] %s' % (k.split(' ')[0], m))
    if not quiet or new:
        print('lint: %d new, %d known (scripts/lint_baseline.json)%s' % (len(new), len(old), ', %d baseline entries are fixed and can be removed' % len(gone) if gone else ''))
    return len(new)


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if '--root' in sys.argv: root = os.path.abspath(sys.argv[sys.argv.index('--root') + 1])
    n = run(root, write_baseline='--write-baseline' in sys.argv)
    sys.exit(1 if n else 0)
