/**
 * Exports the NetWageTax logo: PNGs into brand/ (not published with the site), plus the
 * site's public/apple-touch-icon.png and public/favicon.ico.
 *
 *   node scripts/export-logo.mjs
 *
 * Renders with a local headless Chrome so the wordmark uses the site's real font
 * (Public Sans, shipped only as woff2). The mark comes from public/favicon.svg, the same
 * shapes and flat greens as components/Logo.tsx.
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

// Same color and weight as the header logo (text-ink, font-bold, tracking-tight).
const page = (width, height, body, background = '#fff') => `<!doctype html><html><head><style>
  @font-face { font-family: 'SiteFont'; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; width: ${width}px; height: ${height}px; background: ${background}; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; font-family: 'SiteFont'; }
  .word { letter-spacing: -0.025em; line-height: 1; }
  .name { font-weight: 700; color: #1a1f24; }
  svg { display: block; }
</style></head><body>${body}</body></html>`;

const markAt = (size) => mark.replace('<svg ', `<svg width="${size}" height="${size}" `);

// `dir` is relative to the repo root. Transparent outputs are the favicon sizes.
const outputs = [
  { dir: 'brand/', file: 'logo-square.png', width: 512, height: 512, body: markAt(360) },
  {
    dir: 'brand/',
    file: 'logo-wide.png',
    width: 600,
    height: 150,
    // Header proportions: 32px mark, 10px gap, 18px text, scaled to an 84px mark.
    body: `<div style="display:flex;align-items:center;gap:26px">${markAt(84)}<span class="word name" style="font-size:47px">NetWageTax</span></div>`,
  },
  { dir: 'public/', file: 'apple-touch-icon.png', width: 180, height: 180, body: markAt(120) },
  { dir: null, file: 'favicon-32.png', width: 32, height: 32, body: markAt(32), transparent: true },
  { dir: null, file: 'favicon-48.png', width: 48, height: 48, body: markAt(48), transparent: true },
];

/** Packs PNG images into one .ico (PNG-compressed entries, supported by every current browser). */
function icoFromPngs(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

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

  const favicons = [];
  for (const o of outputs) {
    await send('Emulation.setDeviceMetricsOverride', { width: o.width, height: o.height, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setDefaultBackgroundColorOverride', o.transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
    const htmlPath = join(profile, `${o.file}.html`);
    writeFileSync(htmlPath, page(o.width, o.height, o.body, o.transparent ? 'transparent' : '#fff'));
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
    // Load the font explicitly (the mark-only outputs have no text, so nothing would trigger it).
    const { result } = await send('Runtime.evaluate', {
      expression: `document.fonts.load('700 47px SiteFont').then((s) => s.length > 0 && s.every((f) => f.status === 'loaded'))`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (!result.value) throw new Error('Public Sans failed to load');
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: o.width, height: o.height, scale: 1 },
    });
    const png = Buffer.from(data, 'base64');
    if (!o.dir) {
      favicons.push({ size: o.width, png });
      continue;
    }
    const outDir = new URL(o.dir, root);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(new URL(o.file, outDir), png);
    console.log(`${o.dir}${o.file} (${o.width}×${o.height})`);
  }
  writeFileSync(new URL('public/favicon.ico', root), icoFromPngs(favicons));
  console.log(`public/favicon.ico (${favicons.map((f) => `${f.size}×${f.size}`).join(', ')})`);
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
