// Shared UI drivers for the newer suites (robust, strict, …): the engine lives in a closure, so everything goes
// through the page like a user would. Same moves as the drivers inside honest.js, kept here so new suites reuse them.
'use strict';
const { IPHONE, topicsFromBuild } = require('./lib');

const IDX = Object.fromEntries(topicsFromBuild().map(t => [t.id, t]));
const inTopic = page => page.evaluate(() => document.getElementById('main').classList.contains('is-topic'));

const phoneUi = {
  name: 'phone', ctx: IPHONE, hash: '#phone', touch: true,
  async ready(page) { await page.waitForSelector('#plist', { state: 'visible', timeout: 15000 }); },
  async toList(page) { if (await inTopic(page)) { await page.tap('#winClose'); await page.waitForTimeout(300); } },
  async open(page, id) {
    await this.toList(page);
    await page.evaluate(i => { const b = document.querySelector(`#plist .pl-t[data-i="${i}"]`); b.closest('.pl-br').classList.add('open'); b.click(); }, IDX[id].i);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 5000 });
    await page.waitForTimeout(300);
  },
  // phone theory: skip «Корни» if shown, then flip the episode to its finale card (where «Выгрузка» lives)
  async revealTheory(page) {
    if (await page.isVisible('#rootsSkip')) await page.click('#rootsSkip');
    for (let k = 0; k < 40 && await page.isVisible('#epNext'); k++) { await page.tap('#epNext'); await page.waitForTimeout(40); }
  },
};

const desktopUi = {
  name: 'desktop', ctx: { viewport: { width: 1440, height: 900 } }, hash: '#desktop', touch: false,
  async ready(page) { await page.waitForSelector('#inStart', { state: 'visible', timeout: 20000 }); await page.click('#inStart'); await page.waitForTimeout(900); },
  async toList(page) { if (await inTopic(page)) { await page.click('#winClose'); await page.waitForTimeout(500); } },
  async open(page, id) {
    await this.toList(page);
    await page.keyboard.press('Control+k');
    await page.keyboard.type(IDX[id].full.slice(0, 12));
    await page.waitForTimeout(200);
    await page.click(`#palList button[data-i="${IDX[id].i}"]:not(.gl)`);
    await page.waitForFunction(() => document.getElementById('main').classList.contains('is-topic'), null, { timeout: 6000 });
    await page.waitForTimeout(500);
    if (await page.isVisible('#skipType')) await page.click('#skipType');
  },
  async revealTheory(page) {
    if (await page.isVisible('#rootsSkip')) await page.click('#rootsSkip');
    for (let k = 0; k < 40 && await page.isVisible('#tMore'); k++) {
      await page.click('#tMore'); await page.waitForTimeout(40);
      if (await page.isVisible('#skipType')) await page.click('#skipType');
    }
  },
};

// localStorage := map (values are raw strings), then reload
async function seed(page, map) {
  await page.evaluate(m => { localStorage.clear(); for (const [k, v] of Object.entries(m)) localStorage.setItem(k, v); }, map);
  await page.reload();
}
const ls = (page, k) => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return undefined; } }, k);

module.exports = { IDX, phoneUi, desktopUi, inTopic, seed, ls };
