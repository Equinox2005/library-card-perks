// Loads the unpacked extension into a throwaway headless Chrome, picks a
// library on the settings page, and checks the corner card on stand-in
// pages for nytimes.com, LinkedIn Learning and Consumer Reports. Nothing
// reaches the real sites.
//
//   npm run e2e
//   npm run e2e -- --screenshots docs    also writes the README screenshots
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, launchChrome, sleep, waitFor } from './cdp.js';
import { PAGES } from './pages.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const screenshotDir = args.includes('--screenshots') ? args[args.indexOf('--screenshots') + 1] : null;
const data = JSON.parse(readFileSync(join(root, 'data/libraries.json'), 'utf8'));
const clp = data.libraries.find((l) => l.id === 'clp');

const chromePath = findChrome();
if (!chromePath) {
  console.error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.');
  process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), 'library-card-perks-e2e-'));
const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? `\n     ${detail}` : ''}`);
};

const chrome = await launchChrome({ chromePath, profileDir: join(workDir, 'profile'), width: 1100, height: 760 });
const problems = [];

async function attach(url) {
  const { targetId } = await chrome.send('Target.createTarget', { url });
  const { sessionId } = await chrome.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => chrome.send(method, params, sessionId);
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  chrome.events.on('Runtime.exceptionThrown', (p, s) => s === sessionId && problems.push(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text));
  chrome.events.on('Fetch.requestPaused', async ({ requestId, request }, s) => {
    if (s !== sessionId) return;
    const { host, pathname } = new URL(request.url);
    const body = PAGES[`${host}${pathname}`];
    await send('Fetch.fulfillRequest', {
      requestId,
      responseCode: body ? 200 : 404,
      responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
      body: Buffer.from(body ?? '').toString('base64'),
    });
  });
  await send('Fetch.enable', { patterns: ['nytimes.com', 'linkedin.com', 'consumerreports.org'].map((d) => ({ urlPattern: `https://www.${d}/*` })) });
  await send('Runtime.enable');
  await send('Page.enable');
  const open = async (target) => {
    await send('Page.navigate', { url: target });
    await waitFor(async () => (await evaluate('document.readyState')) === 'complete', { label: target });
  };
  return { send, evaluate, open };
}

const card = (evaluate, expr) => evaluate(`(() => { const root = document.getElementById('library-card-perks')?.shadowRoot; return root ? ${expr} : null; })()`);
const cardLines = (evaluate) => card(evaluate, `[...root.querySelectorAll('li')].map((li) => li.querySelector('.name').firstChild.textContent + ' -> ' + li.querySelector('a').href)`);

try {
  const { id: extensionId } = await chrome.send('Extensions.loadUnpacked', { path: root });
  check('extension loads unpacked', Boolean(extensionId));
  const settings = `chrome-extension://${extensionId}/src/options/options.html`;
  const tab = await attach('about:blank');

  // Before a library is picked, nothing shows.
  await tab.open('https://www.nytimes.com/2026/11/04/business/electricity-prices.html');
  await sleep(1500);
  check('no card before a library is picked', (await cardLines(tab.evaluate)) === null);

  // Pick Carnegie Library of Pittsburgh on the settings page.
  await tab.open(settings);
  await waitFor(async () => (await tab.evaluate(`document.querySelectorAll('#list input').length`)) >= 10, { label: 'library list' });
  await tab.evaluate(`(() => { const f = document.getElementById('filter'); f.value = 'pittsburgh'; f.dispatchEvent(new Event('input')); })()`);
  const listed = await tab.evaluate(`[...document.querySelectorAll('#list label span:nth-of-type(1)')].map((s) => s.textContent)`);
  check('settings search finds the library', JSON.stringify(listed) === '["Carnegie Library of Pittsburgh"]', JSON.stringify(listed));
  await tab.evaluate(`document.querySelector('#list input').click()`);
  const saved = await waitFor(async () => tab.evaluate(`document.getElementById('status').textContent`), { label: 'saved' }).catch(() => null);
  check('picking it saves it', saved === 'Saved: Carnegie Library of Pittsburgh.', saved);
  if (screenshotDir) {
    await tab.evaluate(`(() => { const f = document.getElementById('filter'); f.value = ''; f.dispatchEvent(new Event('input')); document.getElementById('status').textContent = ''; })()`);
    const clip = await tab.evaluate(`(() => { const r = document.body.getBoundingClientRect(); return { x: r.x, y: 0, width: r.width, height: 560, scale: 1 }; })()`);
    const { data: png } = await tab.send('Page.captureScreenshot', { format: 'png', clip });
    writeFileSync(join(root, screenshotDir, 'settings.png'), Buffer.from(png, 'base64'));
  }

  // nytimes.com: the card lists the NYT and PressReader with the library's links.
  await tab.open('https://www.nytimes.com/2026/11/04/business/electricity-prices.html');
  const nyt = await waitFor(async () => cardLines(tab.evaluate), { label: 'card on nytimes.com', timeout: 8000 }).catch(() => null);
  const expected = ['nyt', 'pressreader'].filter((k) => clp.resources[k]).map((k) => `${clp.resources[k].label} -> ${clp.resources[k].url}`);
  check('nytimes.com: the library’s own NYT link', JSON.stringify(nyt) === JSON.stringify(expected), `${JSON.stringify(nyt)} vs ${JSON.stringify(expected)}`);
  check('card names the library', (await card(tab.evaluate, `root.querySelector('p').textContent`)) === 'Free with your Carnegie Library of Pittsburgh card:');
  if (screenshotDir) {
    const { data: png } = await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1100, height: 760, scale: 0.8 } });
    writeFileSync(join(root, screenshotDir, 'nytimes.png'), Buffer.from(png, 'base64'));
  }

  // Once a day per site.
  await tab.open('https://www.nytimes.com/2026/11/04/business/electricity-prices.html');
  await sleep(1500);
  check('the card shows once a day per site', (await cardLines(tab.evaluate)) === null);

  // LinkedIn Learning, then turning the card off for that site.
  await tab.open('https://www.linkedin.com/learning/excel-essential-training');
  const li = await waitFor(async () => cardLines(tab.evaluate), { label: 'card on LinkedIn', timeout: 8000 }).catch(() => null);
  check('LinkedIn Learning: course site gets the library link', li?.[0] === `${clp.resources.linkedin.label} -> ${clp.resources.linkedin.url}`, JSON.stringify(li));
  await card(tab.evaluate, `root.querySelector('.mute').click()`);
  await sleep(300);
  check('"Don\'t show on this site" closes the card', (await cardLines(tab.evaluate)) === null);

  // The popup lists everything the card gets you. It also has the
  // extension's storage, used here to forget today's "already shown".
  const popup = await attach(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await waitFor(async () => popup.evaluate(`typeof chrome.storage?.local?.remove === 'function'`), { label: 'popup storage' });
  await popup.evaluate(`chrome.storage.local.remove('shown')`);
  await tab.open('https://www.linkedin.com/learning/excel-essential-training');
  await sleep(1500);
  check('a muted site stays quiet on later visits', (await cardLines(tab.evaluate)) === null);
  const muted = await popup.evaluate(`chrome.storage.sync.get('hiddenSites').then((r) => r.hiddenSites)`);
  check('the muted site is remembered', JSON.stringify(muted) === '["linkedin.com"]', JSON.stringify(muted));
  const count = await waitFor(async () => popup.evaluate(`document.querySelectorAll('#all li').length`), { label: 'popup list' }).catch(() => 0);
  check('popup lists every service the library has', count === Object.keys(clp.resources).length, `${count} vs ${Object.keys(clp.resources).length}`);
  check('popup names the library', (await popup.evaluate(`document.getElementById('libname').textContent`)) === 'Carnegie Library of Pittsburgh');
  if (screenshotDir) {
    await popup.evaluate(`document.body.style.margin = '0'`);
    const clip = await popup.evaluate(`(() => { const r = document.body.getBoundingClientRect(); return { x: 0, y: 0, width: r.width, height: r.height, scale: 1 }; })()`);
    const { data: png } = await popup.send('Page.captureScreenshot', { format: 'png', clip });
    writeFileSync(join(root, screenshotDir, 'popup.png'), Buffer.from(png, 'base64'));
  }

  // A library typed in by hand.
  await tab.open(settings);
  await waitFor(async () => tab.evaluate(`Boolean(document.getElementById('custom-nyt'))`), { label: 'custom form' });
  await tab.evaluate(`(() => {
    document.getElementById('custom-box').open = true;
    document.getElementById('custom-name').value = 'Mt. Lebanon Public Library';
    document.getElementById('custom-cr').value = 'https://mtlebanon.example/consumer-reports';
    document.querySelector('#custom button').click();
  })()`);
  const customSaved = await waitFor(async () => {
    const text = await tab.evaluate(`document.getElementById('status').textContent`);
    return /Mt\. Lebanon/.test(text) ? text : null;
  }, { label: 'custom saved' }).catch(() => null);
  check('a library typed in by hand saves', customSaved === 'Saved: Mt. Lebanon Public Library, 1 services.', customSaved);
  await tab.open('https://www.consumerreports.org/appliances/refrigerators/best-refrigerators');
  const cr = await waitFor(async () => cardLines(tab.evaluate), { label: 'card on Consumer Reports', timeout: 8000 }).catch(() => null);
  check('Consumer Reports: the typed-in link is used', cr?.[0] === 'Consumer Reports -> https://mtlebanon.example/consumer-reports', JSON.stringify(cr));

  check('no page errors', problems.length === 0, problems.join('\n     '));
} catch (error) {
  check('run finished', false, error.stack);
} finally {
  await chrome.close();
  rmSync(workDir, { recursive: true, force: true });
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
