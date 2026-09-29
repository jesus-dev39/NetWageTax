/**
 * Exports the NetWageTax logo as PNGs into brand/ (not published with the site).
 *
 *   node scripts/export-logo.mjs
 *
 * Renders with a local headless Chrome so the wordmark uses the site's real font
 * (Public Sans, shipped only as woff2) and Tailwind's exact oklch colors.
 * The mark comes from public/favicon.svg, the same shapes as components/Logo.tsx.
 * Set CHROME_PATH if Chrome isn't in the default Windows location.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url);
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mark = readFileSync(new URL('public/favicon.svg', root), 'utf8');
const font = readFileSync(
  new URL('node_modules/@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2', root),
).toString('base64');

// Same colors and weights as the header logo (text-slate-900 / text-emerald-600, tracking-tight).
const page = (width, height, body) => `<!doctype html><html><head><style>
  @font-face { font-family: 'SiteFont'; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; width: ${width}px; height: ${height}px; background: #fff; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; font-family: 'SiteFont'; }
  .word { letter-spacing: -0.025em; line-height: 1; }
  .net { font-weight: 800; color: oklch(20.8% 0.042 265.755); }
  .tax { font-weight: 700; color: oklch(59.6% 0.145 163.225); }
  svg { display: block; }
</style></head><body>${body}</body></html>`;

const markAt = (size) => mark.replace('<svg ', `<svg width="${size}" height="${size}" `);

const outputs = [
  { file: 'logo-square.png', width: 512, height: 512, body: markAt(360) },
  {
    file: 'logo-wide.png',
    width: 600,
    height: 150,
    // Header proportions: 32px mark, 10px gap, 18px text, scaled to an 84px mark.
    body: `<div style="display:flex;align-items:center;gap:26px">${markAt(84)}<span class="word" style="font-size:47px"><span class="net">NetWage</span><span class="tax">Tax</span></span></div>`,
  },
];

const profile = mkdtempSync(join(tmpdir(), 'nwt-logo-'));
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], {
  stdio: 'ignore',
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let ws;
  for (let i = 0; i < 80 && !ws; i++) {
    try {
      const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
      if (target) ws = new WebSocket(target.webSocketDebuggerUrl);
    } catch {}
    if (!ws) await sleep(250);
  }
  if (!ws) throw new Error(`Chrome did not start (${chromePath})`);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });

  const outDir = new URL('brand/', root);
  mkdirSync(outDir, { recursive: true });
  for (const o of outputs) {
    await send('Emulation.setDeviceMetricsOverride', { width: o.width, height: o.height, deviceScaleFactor: 1, mobile: false });
    const htmlPath = join(profile, `${o.file}.html`);
    writeFileSync(htmlPath, page(o.width, o.height, o.body));
    const url = pathToFileURL(htmlPath).href;
    await send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) {
      const { result } = await send('Runtime.evaluate', {
        expression: `location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`,
        returnByValue: true,
      });
      if (result.value) break;
      await sleep(100);
    }
    // Load both weights explicitly (the square mark has no text, so nothing would trigger it).
    const { result } = await send('Runtime.evaluate', {
      expression: `Promise.all([document.fonts.load('800 47px SiteFont'), document.fonts.load('700 47px SiteFont')])
        .then((sets) => sets.every((s) => s.length > 0 && s.every((f) => f.status === 'loaded')))`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (!result.value) throw new Error('Public Sans failed to load');
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: o.width, height: o.height, scale: 1 },
    });
    writeFileSync(new URL(o.file, outDir), Buffer.from(data, 'base64'));
    console.log(`brand/${o.file} (${o.width}×${o.height})`);
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
