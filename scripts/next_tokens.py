"""NEXT design: generate engine/theme-next.gen.css from engine/styles.css.

The classic stylesheet sets font sizes, text colours, shadows and endless animations in ~1000 rules. The NEXT design
(html.next, off by default) does not rewrite those rules: for every rule that sets one of these properties this script
emits one override under html.next that maps the value to a token. The tokens themselves and everything written by
hand live in engine/theme-next.css, which is inlined after the generated file and therefore wins.

    python3 scripts/next_tokens.py          # rewrite engine/theme-next.gen.css
    python3 scripts/next_tokens.py --check  # exit 1 if the file is out of date (scripts/build.py runs this)

What is mapped:
  font-size   px literals and var(--fs-*)  -> --t-label / --t-ui / --t-read / --t-h2 / --t-title
  color       grey literals under 4.5:1 on the page background -> var(--dim) (NEXT redefines --dim to pass 4.5:1)
  box-shadow, text-shadow   cyan glow -> none; dark drop shadow -> var(--t-shadow)
  animation   ... infinite -> none
Not mapped: the intro screen (its own violet look), code sizes (--fs-code, --code-size, --ed-size), em sizes.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'engine', 'styles.css')
OUT = os.path.join(ROOT, 'engine', 'theme-next.gen.css')
BG = (5, 6, 7)                      # --bg
SKIP_SEL = re.compile(r'#intro|\.in-|#boot|\.xcur')   # intro screen, boot log, custom cursor keep the classic look


def rules(css):
    """Yield (media, selector, body) for every style rule; one level of @media nesting, @keyframes skipped."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    i, n, media = 0, len(css), None
    while i < n:
        j = css.find('{', i)
        if j < 0: break
        head = css[i:j].strip()
        if media is not None and '}' in css[i:j]:           # the @media block closed before this rule
            k = css.find('}', i); media = None; i = k + 1; continue
        if head.startswith('@media'):
            media = head; i = j + 1; continue
        if head.startswith('@'):                            # @keyframes etc.: skip the whole block
            depth, k = 1, j + 1
            while depth and k < n:
                depth += (css[k] == '{') - (css[k] == '}'); k += 1
            i = k; continue
        k = css.find('}', j)
        yield media, ' '.join(head.split()), css[j + 1:k]
        i = k + 1


def decls(body):
    out = []
    for d in re.split(r';(?![^(]*\))', body):
        if ':' in d:
            p, v = d.split(':', 1); out.append((p.strip(), v.strip()))
    return out


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def contrast(fg, bg=BG):
    a, b = lum(fg), lum(bg)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


def parse_color(v):
    v = v.replace('!important', '').strip()
    m = re.fullmatch(r'#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})', v)
    if m:
        h = m.group(1)
        if len(h) == 3: h = ''.join(ch * 2 for ch in h)
        return tuple(int(h[k:k + 2], 16) for k in (0, 2, 4))
    m = re.fullmatch(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)', v)
    if m:
        a = float(m.group(4)) if m.group(4) else 1.0
        return tuple(round(int(m.group(k)) * a + BG[k - 1] * (1 - a)) for k in (1, 2, 3))
    return None


def size_token(px):
    if px <= 0: return None
    return '--t-label' if px <= 12.5 else '--t-ui' if px <= 14.5 else '--t-read' if px <= 18 else '--t-h2' if px <= 24 else '--t-title'


VAR_TOKEN = {'--fs-label': '--t-label', '--fs-ui': '--t-ui', '--fs-read': '--t-read', '--fs-title': '--t-title'}


def override(prop, val):
    imp = ' !important' if '!important' in val else ''
    v = val.replace('!important', '').strip()
    if prop == 'font-size':
        m = re.fullmatch(r'([\d.]+)px', v)
        if m:
            t = size_token(float(m.group(1)))
            return f'font-size:var({t}){imp}' if t else None
        m = re.fullmatch(r'var\((--fs-[a-z]+)\)', v)
        if m and m.group(1) in VAR_TOKEN: return f'font-size:var({VAR_TOKEN[m.group(1)]}){imp}'
        return None
    if prop == 'color':
        c = parse_color(v)
        if c is None: return None
        grey = max(c) - min(c) <= 40
        if grey and contrast(c) < 4.5: return f'color:var(--dim){imp}'
        return None
    if prop in ('box-shadow', 'text-shadow'):
        if v == 'none' or v.startswith('inset'): return None
        if '45,226,230' in v.replace(' ', '') or 'var(--cyan)' in v: return f'{prop}:none{imp}'
        if prop == 'box-shadow' and 'rgba(0,0,0' in v.replace(' ', ''): return f'box-shadow:var(--t-shadow){imp}'
        return None
    if prop == 'animation' and 'infinite' in v: return f'animation:none{imp}'
    return None


def scope(sel):
    """Prefix every selector of the list with html.next (merging with a leading html… compound)."""
    out = []
    for s in re.split(r',(?![^(]*\))', sel):
        s = s.strip()
        if s.startswith('html'):
            m = re.match(r'html([^\s>+~]*)(.*)', s, flags=re.S)
            out.append('html.next' + m.group(1) + m.group(2))
        elif s.startswith(':root'):
            out.append('html.next' + s[5:])
        else:
            out.append('html.next ' + s)
    return ','.join(out)


def generate():
    css = open(SRC, encoding='utf-8').read()
    lines, stats, cur = [], {}, object()
    for media, sel, body in rules(css):
        if SKIP_SEL.search(sel): continue
        ov = []
        for p, v in decls(body):
            o = override(p, v)
            if o:
                ov.append(o); stats[p] = stats.get(p, 0) + 1
        if not ov: continue
        if media != cur:
            if cur is not object and isinstance(cur, str): lines.append('}')
            if media: lines.append(media + '{')
            cur = media
        lines.append(('  ' if media else '') + scope(sel) + '{' + ';'.join(ov) + '}')
    if isinstance(cur, str): lines.append('}')
    head = ('/* GENERATED by scripts/next_tokens.py from engine/styles.css — do not edit by hand.\n'
            '   One override per classic rule: font sizes -> type tokens, low-contrast greys -> var(--dim),\n'
            '   glow shadows -> none, drop shadows -> var(--t-shadow), endless animations -> none.\n'
            '   Tokens and hand-written rules: engine/theme-next.css (inlined after this file). */\n')
    return head + '\n'.join(lines) + '\n', stats


def main():
    text, stats = generate()
    if '--check' in sys.argv:
        old = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if old != text:
            raise SystemExit('engine/theme-next.gen.css is out of date: run python3 scripts/next_tokens.py')
        return
    open(OUT, 'w', encoding='utf-8').write(text)
    print('theme-next.gen.css · ' + ' · '.join(f'{k} {v}' for k, v in sorted(stats.items())))


if __name__ == '__main__':
    main()
