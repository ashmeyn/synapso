"""Pull the engine and data out of a saved copy of the published lab artifact.

    python3 scripts/split_lab.py saved-artifact.html  OUT_DIR

Writes OUT_DIR/template.html (with __DATA__) and OUT_DIR/data.json.
Use it when the engine was changed directly in the claude.ai artifact and the change must come back into the repo:
diff OUT_DIR/template.html against the assembled template (`scripts/build.py --template-out assembled.html`;
engine/template.html itself is only markup with __INLINE:<path>__ markers), carry the change into engine/styles.css,
engine/app.js or the markup, and compare data with `scripts/build.py --check OUT_DIR/data.json`.
A saved artifact page is wrapped by the host (<!doctype ...><body>); the wrapper is removed here.
"""
import os, re, sys

src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
if '<body>\n' in s[:4000]:
    s = s[s.index('<body>\n') + len('<body>\n'):]
s = re.sub(r'\s*</body></html>\s*$', '\n', s)
m = re.search(r'(<script type="application/json" id="data">)(.*?)(</script>)', s, flags=re.S)
if not m:
    raise SystemExit('no <script id="data"> block found')
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'data.json'), 'w').write(m.group(2).replace('<\\/', '</'))
open(os.path.join(out, 'template.html'), 'w').write(s[:m.start(2)] + '__DATA__' + s[m.end(2):])
print('template.html + data.json ->', out)
