// Renders engine/icons/icon.svg to the PNGs the site needs: node scripts/render_icons.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const dir = path.resolve(__dirname, '..', 'engine', 'icons'); const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
(async () => { const b = await chromium.launch();
  for (const [name, s] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
    await p.screenshot({ path: path.join(dir, name), omitBackground: false }); await p.close(); }
  await b.close(); })();
