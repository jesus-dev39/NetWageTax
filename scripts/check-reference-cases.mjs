// Los cuatro casos de referencia de docs/MAINTENANCE.md (sección 2.4), comprobados en una web
// real: abre cada calculadora en un Chrome sin ventana, rellena los campos como lo haría una
// persona y lee la cifra del resultado.
//
// Uso:  npm run check:ref                        (netwagetax.com)
//       npm run check:ref -- http://localhost:4321  (otra dirección, p. ej. `npx astro preview`)
// Si Chrome no está en su ruta habitual, indica dónde con la variable CHROME_PATH.
// Solo usa Node (WebSocket y fetch incluidos desde Node 22) y Chrome: no hace falta instalar nada.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = (process.argv[2] ?? 'https://netwagetax.com').replace(/\/$/, '');
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = chromeCandidates.find((p) => existsSync(p));
if (!chrome) {
  console.error('No encuentro Chrome. Indica su ruta con la variable CHROME_PATH.');
  process.exit(2);
}

// [nombre, ruta, cifra esperada, pasos]. Cada paso: ['val', selector, valor] escribe en un campo;
// ['check', selector] marca una casilla o una opción si no lo está.
const cases = [
  ['1. Portada', '/', '$2,092.60', []],
  ['2. Propinas con Georgia', '/tools/obbba-tax-calculator/?state=GA', '$960', [
    ['val', '#magi', '52000'], ['val', '#tips-amount', '8000'], ['check', '#tips-occupation'], ['check', '#has-ssn']]],
  ['3. Mayores de 65', '/tools/senior-deduction-calculator/', '$1,320', [
    ['check', 'input[name="senior-filing-status"][value="mfj"]'], ['check', 'input[name="senior-taxpayer-65"][value="yes"]'],
    ['check', 'input[name="senior-spouse-65"][value="yes"]'], ['val', '#senior-magi', '200000']]],
  ['4. Intereses del coche', '/tools/car-loan-interest-deduction-calculator/', '$720', [
    ['check', 'input[name="car-filing-status"][value="single"]'], ['val', '#car-interest', '8000'], ['val', '#car-magi', '125000']]],
];

// La portada muestra "Take-home per paycheck"; las calculadoras, "Federal income tax saved".
const RESULT_LABEL = { '/': 'Take-home per paycheck' };

const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'check-ref-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanUp() {
  try { proc.kill(); } catch {}
  // Chrome tarda un momento en soltar los archivos del perfil temporal.
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} }, 1000);
}

let page;
for (let i = 0; i < 50 && !page; i++) {
  try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!page) await sleep(200);
}
if (!page) {
  console.error('Chrome no ha arrancado.');
  cleanUp();
  process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

// Se ejecuta dentro de la página: espera a que React monte la calculadora, rellena los campos
// (con el setter nativo, para que React vea el cambio) y devuelve la cifra que sigue a la etiqueta.
const fill = (steps, label) => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Las calculadoras son islas client:load: Astro quita el atributo ssr al hidratarlas.
  for (let i = 0; i < 100 && document.querySelector('astro-island[client="load"][ssr]'); i++) await sleep(100);
  await sleep(500);
  const setVal = (el, v) => {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  for (const [kind, sel, v] of ${JSON.stringify(steps)}) {
    const el = document.querySelector(sel);
    if (!el) return 'no existe el campo ' + sel;
    if (kind === 'val') setVal(el, v);
    else if (kind === 'check' && !el.checked) el.click();
    await sleep(150);
  }
  await sleep(800);
  const text = document.body.innerText.replace(/\\s+/g, ' ');
  const label = ${JSON.stringify(label)};
  const at = text.toLowerCase().indexOf(label.toLowerCase());
  if (at < 0) return 'no aparece "' + label + '"';
  const m = text.slice(at + label.length).match(/\\$[0-9,]+(?:\\.[0-9]{2})?/);
  return m ? m[0] : 'sin cifra tras "' + label + '"';
})()`;

console.log(`Casos de referencia en ${origin}\n`);
const failures = [];
await send('Page.enable');
for (const [name, path, expected, steps] of cases) {
  await send('Page.navigate', { url: origin + path });
  await sleep(2500);
  const got = await evaluate(fill(steps, RESULT_LABEL[path] ?? 'Federal income tax saved'));
  if (got === expected) console.log(`  ok: ${name}: ${got}`);
  else {
    console.log(`  MAL: ${name}: ${got} (se esperaba ${expected})`);
    failures.push(`${name}: ${got} (se esperaba ${expected})`);
  }
}
ws.close();
cleanUp();

if (failures.length) {
  console.log(`\nHA FALLADO (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('\nTODO OK');
}
