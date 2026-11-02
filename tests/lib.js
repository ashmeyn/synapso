// Shared helpers for the Synapso browser tests (Playwright + Chromium).
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'index.html');
const OUT = path.join(__dirname, 'output');
const URL = 'file://' + DIST;

const IPHONE = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

// Counts every requestAnimationFrame callback the page runs (window.__raf).
const RAF_INIT = `(() => { const o = window.requestAnimationFrame.bind(window); window.__raf = 0;
  window.requestAnimationFrame = cb => o(t => { window.__raf++; cb(t); }); })();`;

function ensureDist() {
  if (!fs.existsSync(DIST)) throw new Error('dist/index.html not found - run `npm run build` first');
}

async function launch() {
  const opts = { args: ['--allow-file-access-from-files', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}

// A small test-case recorder: check() records pass/fail, warn() records warnings, nothing throws.
class Suite {
  constructor(name) { this.name = name; this.passed = 0; this.failed = []; this.warnings = []; this.shots = 0; this.page = null; }
  async check(label, ok, detail) {
    if (ok) { this.passed++; return true; }
    const msg = label + (detail !== undefined ? ' -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '');
    this.failed.push(msg);
    console.log(`  FAIL [${this.name}] ${msg}`);
    await this.shot(label);
    return false;
  }
  warn(msg) { this.warnings.push(msg); console.log(`  warn [${this.name}] ${msg}`); }
  async shot(label) {
    if (!this.page || this.shots >= 15) return;
    try {
      fs.mkdirSync(OUT, { recursive: true });
      const f = `${this.name}-${String(++this.shots).padStart(2, '0')}-${label.replace(/[^\w-]+/g, '_').slice(0, 60)}.png`;
      await this.page.screenshot({ path: path.join(OUT, f) });
    } catch (e) { /* page may be gone */ }
  }
  result() { return { name: this.name, passed: this.passed, failed: this.failed, warnings: this.warnings }; }
}

// New context + page with font blocking, rAF counter and error capture.
// opts.noGL: make canvas.getContext('webgl*') return null so the engine takes its no-WebGL path (much faster under SwiftShader).
async function openPage(browser, suite, ctxOpts, hash = '', opts = {}) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(RAF_INIT);
  if (opts.noGL) await ctx.addInitScript(() => {
    const g = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/i.test(type) ? null : g.call(this, type, ...a); };
  });
  await ctx.route(/fonts\.g(oogleapis|static)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  suite.page = page;
  await page.goto(URL + hash);
  return { ctx, page, errors };
}

async function rafRate(page, ms = 2000) {
  await page.waitForTimeout(800);
  const a = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(ms);
  const b = await page.evaluate(() => window.__raf);
  return +((b - a) / (ms / 1000)).toFixed(1);
}

// Document-level horizontal overflow (page can be scrolled sideways).
function docOverflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return { sw: Math.max(de.scrollWidth, document.body.scrollWidth), cw: de.clientWidth };
  });
}

function rectOf(page, sel) {
  return page.evaluate(s => {
    const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height,
      visible: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && !e.hidden };
  }, sel);
}

const inViewport = (r, vw, vh) => !!r && r.visible && r.x >= -1 && r.y >= -1 && r.r <= vw + 1 && r.b <= vh + 1;

// Topic list in engine order, parsed from the BRANCHES table in the built page:
// index in this array == data-i used by the palette / openTopic.
function topicsFromBuild() {
  const html = fs.readFileSync(DIST, 'utf8');
  const start = html.indexOf('const BRANCHES = [');
  const end = html.indexOf('const CROSS', start);
  if (start < 0 || end < 0) throw new Error('BRANCHES table not found in dist/index.html');
  const re = /\["([a-z0-9_]+)","([^"]+)","[A-Z]",\d+\]/g;
  const list = []; let m;
  const src = html.slice(start, end);
  while ((m = re.exec(src))) list.push({ i: list.length, id: m[1], full: m[2] });
  return list;
}

function dataFromBuild() {
  const html = fs.readFileSync(DIST, 'utf8');
  const a = html.indexOf('<script type="application/json" id="data">');
  const s = html.indexOf('>', a) + 1, e = html.indexOf('</script>', s);
  return JSON.parse(html.slice(s, e));
}

module.exports = { ROOT, DIST, OUT, URL, IPHONE, Suite, launch, openPage, rafRate, docOverflow, rectOf, inViewport,
  topicsFromBuild, dataFromBuild, ensureDist };
