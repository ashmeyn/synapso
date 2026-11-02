"""Synapso build: content/ + engine/template.html -> dist/index.html (one self-contained page).

    python3 scripts/build.py            # build dist/index.html
    python3 scripts/build.py --check X  # also compare the built data with a JSON file X (e.g. data from the lab)

Data shape (what the engine reads from __DATA__):
  content[id]  = base/content.json[id] + lesson (parsed from content/lessons/<id>.md) + steps (content/steps/<id>.json)
  lesson       = {prereqs, mission, scenario, goals, base, deeper, check, answers?}
                 check   = questions (HTML) from the first list of «## Проверь себя»
                 answers = items of the optional «## Ответы к «Проверь себя»» section (same order as check;
                           not part of base; key absent while the lesson has no answers)
  tasks, cases, ref = base/*.json
  bank         = base/bank.json + content/bank/*.bank.json in file-name order (zz-live goes last on purpose)
"""
import glob, html, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)

# Icons: engine/icons/icon.svg is the source; the PNGs are rendered from it (see engine/icons/README.md).
ICON_FILES = ['icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']
ICON_TAGS = ('<link rel="icon" type="image/svg+xml" href="icon.svg">\n'
             '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
             '<link rel="manifest" href="manifest.webmanifest">\n')
MANIFEST = {'name': 'Synapso', 'short_name': 'Synapso', 'lang': 'ru', 'start_url': './', 'scope': './',
            'display': 'standalone', 'background_color': '#050607', 'theme_color': '#050607',
            'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                      {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                      {'src': 'icon.svg', 'sizes': 'any', 'type': 'image/svg+xml'}]}


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'`([^`]+)`', lambda m: '<code>' + m.group(1) + '</code>', s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', s)
    s = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)
    return s


CHECK_H = 'Проверь себя'
ANSWERS_H = 'Ответы к «Проверь себя»'


def parse_md(text, name='?'):
    fm = {}
    if text.startswith('---'):
        _, head, text = text.split('---', 2)
        key = None
        for line in head.strip().splitlines():
            if line.startswith('- ') and key:
                fm.setdefault(key, []).append(inline(line[2:].strip()))
            elif ':' in line:
                key, val = line.split(':', 1); key = key.strip(); val = val.strip()
                if val: fm[key] = inline(val)
    layers = {'base': [], 'deeper': []}; layer = 'base'; sec = None
    check_sec = answers_sec = None
    lines = text.splitlines(); i = 0; para = []

    def flush():
        nonlocal para
        if para and sec is not None:
            sec['body'].append({'t': 'p', 'html': inline(' '.join(para))})
        para = []

    while i < len(lines):
        ln = lines[i]
        if ln.startswith('# '):
            flush(); layer = 'deeper'; sec = None
        elif ln.startswith('## '):
            flush(); h = ln[3:].strip(); sec = {'h': inline(h), 'body': []}
            if h == ANSWERS_H:
                if layer != 'base':
                    raise SystemExit(f'lesson {name}: «## {ANSWERS_H}» must be in the base layer, before # ГЛУБЖЕ')
                if check_sec is None:
                    raise SystemExit(f'lesson {name}: «## {ANSWERS_H}» without a «## {CHECK_H}» section before it')
                answers_sec = sec  # kept out of base: shown only on the «Выгрузка» screen
            else:
                layers[layer].append(sec)
                if h == CHECK_H and layer == 'base': check_sec = sec
        elif ln.startswith('```'):
            flush(); code = []; i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i]); i += 1
            sec['body'].append({'t': 'code', 'code': '\n'.join(code)})
        elif ln.startswith('- '):
            flush(); items = []
            while i < len(lines) and lines[i].startswith('- '):
                items.append(inline(lines[i][2:].strip())); i += 1
            sec['body'].append({'t': 'ul', 'items': items}); continue
        elif ln.startswith('> '):
            flush(); note = []
            while i < len(lines) and lines[i].startswith('> '):
                note.append(lines[i][2:].strip()); i += 1
            sec['body'].append({'t': 'note', 'html': inline(' '.join(note))}); continue
        elif not ln.strip():
            flush()
        else:
            para.append(ln.strip())
        i += 1
    flush()
    out = {'prereqs': [re.sub(r'<[^>]+>', '', x) for x in fm.get('prereqs', [])], 'mission': fm.get('mission', ''),
           'scenario': fm.get('scenario', ''), 'goals': fm.get('goals', []),
           'base': layers['base'], 'deeper': layers['deeper']}
    if check_sec is not None:
        out['check'] = next((b['items'] for b in check_sec['body'] if b['t'] == 'ul'), [])
    if answers_sec is not None:
        answers = [x for b in answers_sec['body'] if b['t'] == 'ul' for x in b['items']]
        if len(answers) != len(out['check']):
            raise SystemExit(f'lesson {name}: «{ANSWERS_H}» has {len(answers)} items, '
                             f'«{CHECK_H}» has {len(out["check"])} questions (must be equal, same order)')
        out['answers'] = answers
    return out


def load(name):
    return json.load(open(P('content', 'base', name + '.json')))


def build_data():
    d = {k: load(k) for k in ('content', 'tasks', 'bank', 'cases', 'ref')}
    for path in sorted(glob.glob(P('content', 'lessons', '*.md'))):
        tid = os.path.basename(path)[:-3]
        if tid not in d['content']:
            raise SystemExit(f'lesson {tid}: no such topic in content/base/content.json (add it there first)')
        d['content'][tid]['lesson'] = parse_md(open(path).read(), tid)
        d['content'][tid].pop('theory', None)
    for sp in sorted(glob.glob(P('content', 'steps', '*.json'))):
        sid = os.path.basename(sp)[:-5]
        if sid in d['content']:
            d['content'][sid]['steps'] = json.load(open(sp))
    have = {b['id'] for b in d['bank']}
    for bp in sorted(glob.glob(P('content', 'bank', '*.bank.json'))):
        for x in json.load(open(bp)):
            assert x['id'] not in have, 'duplicate bank id ' + x['id']
            have.add(x['id'])
            d['bank'].append({'id': x['id'], 'topics': x['topics'], 'type': x['type'], 'title': x['title'],
                              'prompt': x['prompt'], 'code': x['code'], 'key': x['key'],
                              'added': x.get('added', '2026-10-11'), 'mins': x.get('mins', 6)})
    return d


def main():
    d = build_data()
    t = open(P('engine', 'template.html')).read()
    assert t.count('__DATA__') == 1, 'template must contain exactly one __DATA__'
    os.makedirs(P('dist'), exist_ok=True)
    out = t.replace('__DATA__', json.dumps(d, ensure_ascii=False).replace('</', '<\\/'))
    # artifact.html: raw page for the claude.ai lab artifact (the host adds <!doctype>/<html>/<body> itself)
    # index.html: full document for GitHub Pages (without <!doctype> the browser falls back to quirks mode)
    open(P('dist', 'artifact.html'), 'w').write(out)
    open(P('dist', 'index.html'), 'w').write('<!doctype html>\n<html lang="ru">\n<head>\n' + out.replace('<title>', ICON_TAGS + '<title>', 1).replace('<div', '</head>\n<body>\n<div', 1) + '\n</body>\n</html>\n')
    # Pages only: home-screen icon, favicon and manifest next to index.html (the lab artifact has the host's own icon)
    for f in ICON_FILES: shutil.copyfile(P('engine', 'icons', f), P('dist', f))
    with open(P('dist', 'manifest.webmanifest'), 'w') as fh: json.dump(MANIFEST, fh, ensure_ascii=False, indent=1)
    n_lessons = sum(1 for c in d['content'].values() if 'lesson' in c)
    print(f'built dist/index.html · {len(d["content"])} topics · {n_lessons} lessons · {len(d["bank"])} bank tasks · {len(out)//1024} KB')
    if '--check' in sys.argv:
        ref = json.load(open(sys.argv[sys.argv.index('--check') + 1]))
        same = json.loads(json.dumps(d)) == ref
        if not same:
            for k in ref:
                if d.get(k) != ref[k]: print('  differs:', k)
            raise SystemExit('DATA MISMATCH')
        print('data matches', sys.argv[sys.argv.index('--check') + 1])


if __name__ == '__main__':
    main()
