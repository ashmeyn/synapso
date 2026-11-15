# research/autocheck

Исследование автопроверки ответов (15.11.2026). В сайт не встроено, сборщик и тесты эту папку не читают.
Отчёт — `REPORT.md`.

```
node research/autocheck/proto/run.js --why          # все прототипы по стенду
node research/autocheck/proto/run.js --proto P2r --list fo   # ложные «верно» рекомендуемой схемы (fn — ложные «неверно»)
node research/autocheck/proto/near.js               # истина по расстоянию до ключа
node research/autocheck/proto/bench.js 6            # время проверки в Chromium, замедление ×6
node research/autocheck/proto/lint_rubrics.js       # противоречия рубрик и ключей
node research/autocheck/proto/build_demo.js         # пересобрать demo.html
```

Прототип 3 (`proto/ast.js`) требует `web-tree-sitter` и `tree-sitter-swift.wasm` (пакет `tree-sitter-wasms`):
поставь их в любую папку, положи wasm рядом как `swift.wasm` и передай путь в `TS_DIR`. Без `TS_DIR` прототипы P3 падают — запускай `run.js --proto P1` / `--proto P2`.
