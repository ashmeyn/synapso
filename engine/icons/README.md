# Иконки сайта

`icon.svg` — исходник: созвездие синапсов, монохром + циан `#2DE2E6` на фоне `#050607`. PNG рисуются из него:

```
node scripts/render_icons.js
```

`apple-touch-icon.png` (180) — «На экран „Домой“» на iPhone, `icon-192.png` / `icon-512.png` — manifest, `icon.svg` — вкладка браузера. Сборщик кладёт их рядом с `dist/index.html` и прописывает ссылки только в index.html (GitHub Pages); в лаборатории иконку задаёт хост.
