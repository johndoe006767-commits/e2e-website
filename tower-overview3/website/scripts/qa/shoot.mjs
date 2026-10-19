// Headless-Chrome QA for tower-overview3: screenshots, draw calls, frame times, layout overlaps.
// No npm packages: Node 22+ (built-in WebSocket) and a local Chrome or Edge.
// Usage: node scripts/qa/shoot.mjs --out qa-out/baseline [--sizes 1440x900,390x844m] [--states assembled,separated,detail:0,flow:0]
//        [--motion] (default emulates prefers-reduced-motion for repeatable frames) [--query still=lungs] [--chrome <path>]
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync, readFileSync, existsSync, rmSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const website = resolve(here, '..', '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const flag = name => process.argv.includes(`--${name}`);
const out = resolve(website, arg('out', 'qa-out/run'));
const sizes = arg('sizes', '1920x1080,1440x900,1280x720,1024x768,768x1024m,390x844m').split(',');
const states = arg('states', 'assembled,separated,detail:0,detail:4,detail:7,flow:4').split(',');
const query = arg('query', '');
const chromePath = arg('chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync));
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, {recursive: true});

// 1. Static server (scripts/serve.py picks a free port and prints the URL).
const server = spawn('python', [join(website, 'scripts', 'serve.py'), '--no-browser'], {stdio: ['ignore', 'pipe', 'pipe']});
const base = await new Promise((ok, fail) => {
  let text = '';
  server.stdout.on('data', d => { text += d; const m = text.match(/http:\/\/127\.0\.0\.1:\d+\//); if (m) ok(m[0]); });
  server.on('exit', c => fail(new Error(`serve.py exited ${c}`)));
  setTimeout(() => fail(new Error('serve.py did not start')), 15000);
});

// 2. Chrome with a throwaway profile.
const profile = join(tmpdir(), `tower-qa-${process.pid}`);
const chrome = spawn(chromePath, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--enable-gpu', '--ignore-gpu-blocklist',
  '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--window-size=1440,900', 'about:blank'], {stdio: 'ignore'});
let port;
for (let i = 0; i < 150 && !port; i++) {
  try { port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch {}
  if (!port) await sleep(200);
}
if (!port) throw new Error('Chrome did not report a DevTools port');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, {once: true}));
let nextId = 0; const pending = new Map(); const problems = [];
ws.addEventListener('message', ({data}) => {
  const m = JSON.parse(data);
  if (m.id && pending.has(m.id)) { const {ok, fail} = pending.get(m.id); pending.delete(m.id); m.error ? fail(new Error(m.error.message)) : ok(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push(`console.${m.params.type} ` + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !m.params.response.url.endsWith('favicon.ico')) problems.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
});
const call = (method, params = {}) => new Promise((ok, fail) => { const id = ++nextId; pending.set(id, {ok, fail}); ws.send(JSON.stringify({id, method, params})); });
const js = async expr => { const r = await call('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const shot = async name => { const r = await call('Page.captureScreenshot', {format: 'png'}); const file = join(out, `${name}.png`); writeFileSync(file, Buffer.from(r.data, 'base64')); return file; };
for (const d of ['Page', 'Runtime', 'Network']) await call(`${d}.enable`);

// Counts WebGL draw calls per animation frame and frame-to-frame times, without touching the site's code.
await call('Page.addScriptToEvaluateOnNewDocument', {source: `(() => {
  const qa = window.__qa = {draws: 0, perFrame: [], times: [], last: 0, gpu: null};
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) if (C) for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    const f = C.prototype[n]; if (f) C.prototype[n] = function (...a) { if (this.canvas && this.canvas.id === 'scene') qa.draws++; return f.apply(this, a); };
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { if (qa.last) { qa.times.push(t - qa.last); qa.perFrame.push(qa.draws); if (qa.times.length > 600) { qa.times.shift(); qa.perFrame.shift(); } } qa.last = t; qa.draws = 0; cb(t); });
})();`});
await call('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: flag('motion') ? 'no-preference' : 'reduce'}]});

const METRICS = `(() => { const q = window.__qa; const t = q.times.slice(-120).sort((a, b) => a - b), d = q.perFrame.slice(-120).sort((a, b) => a - b);
  const pct = (a, p) => a.length ? Math.round(a[Math.min(a.length - 1, Math.floor(a.length * p))] * 10) / 10 : null;
  if (!q.gpu) { const gl = document.createElement('canvas').getContext('webgl2'); const x = gl && gl.getExtension('WEBGL_debug_renderer_info'); q.gpu = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown'; q.pointMax = gl ? gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] : null; }
  return {drawsMedian: pct(d, .5), drawsMax: d.at(-1) ?? null, frameP50: pct(t, .5), frameP95: pct(t, .95), gpu: q.gpu, pointMax: q.pointMax}; })()`;
const LAYOUT = `(() => { const R = el => { const r = el.getBoundingClientRect(); return {x: r.left, y: r.top, r: r.right, b: r.bottom}; };
  const vis = el => el && !el.hidden && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const items = {}; const hud = document.getElementById('tower-telemetry-hud'); if (vis(hud)) items.hud = R(hud);
  for (const [k, s] of [['title', '.detail-title'], ['reset', '.rotate-tools'], ['back', '#back']]) { const e = document.querySelector(s); if (vis(e)) items[k] = R(e); }
  [...document.querySelectorAll('#process-neurons .process-node')].filter(vis).forEach((n, i) => items['card' + i] = R(n));
  const keys = Object.keys(items), overlaps = [], off = [];
  for (const k of keys) { const a = items[k]; if (a.x < -1 || a.y < -1 || a.r > innerWidth + 1 || a.b > innerHeight + 1) off.push(k); }
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = items[keys[i]], b = items[keys[j]];
    if (Math.min(a.r, b.r) - Math.max(a.x, b.x) > 1 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 1) overlaps.push(keys[i] + '/' + keys[j]); }
  return {mode: items.hud ? (items.hud.x > innerWidth / 2 ? 'columns' : 'rows') : null, overlaps, off, cards: keys.filter(k => k.startsWith('card')).length}; })()`;

const report = {base, query, reducedMotion: !flag('motion'), runs: []};
for (const size of sizes) {
  const mobile = size.endsWith('m'); const [W, H] = size.replace('m', '').split('x').map(Number);
  await call('Emulation.setDeviceMetricsOverride', {width: W, height: H, deviceScaleFactor: mobile ? 2 : 1, mobile});
  await call('Page.navigate', {url: base + (query ? `?${query}` : '')});
  const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 240000 && !ready) { await sleep(1000); ready = await js(`!!document.querySelector('#loading')?.hidden`).catch(() => false); }
  const run = {size, ready, states: {}};
  report.runs.push(run);
  if (!ready) { run.loadMessage = await js(`document.querySelector('#load-message')?.textContent`).catch(() => null); continue; }
  for (const state of states) {
    const [kind, arg1] = state.split(':');
    if (kind === 'separated') await js(`(() => { const a = document.querySelector('#assembly'); a.value = '1000'; a.dispatchEvent(new Event('input', {bubbles: true})); })()`);
    if (kind === 'assembled') await js(`(() => { const a = document.querySelector('#assembly'); a.value = '0'; a.dispatchEvent(new Event('input', {bubbles: true})); })()`);
    if (kind === 'detail' || kind === 'flow') await js(`document.querySelectorAll('#labels .label')[${Number(arg1)}]?.click()`);
    await sleep(kind === 'detail' || kind === 'flow' ? 3500 : 2500);
    if (kind === 'flow') { await js(`document.querySelector('#process-neurons .process-plus')?.click()`); await sleep(3500); }
    const entry = {metrics: await js(METRICS)};
    if (kind === 'detail') entry.layout = await js(LAYOUT);
    if (kind === 'flow') entry.flow = await js(`(() => { const s = document.querySelector('#process-section'); const c = document.querySelector('#flow-brain canvas'); return {shown: !!s && !s.hidden, organCanvas: !!c && c.width > 0}; })()`);
    entry.file = await shot(`${size}-${state.replace(':', '-')}`);
    run.states[state] = entry;
    if (kind === 'flow') { await js(`document.querySelector('#flow-back')?.click()`); await sleep(1500); }
    if (kind === 'detail' || kind === 'flow') { await js(`document.querySelector('#back')?.click()`); await sleep(1500); }
  }
}
report.problems = [...new Set(problems)];
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, (k, v) => k === 'file' ? undefined : v));
ws.close(); chrome.kill(); server.kill();
await sleep(500); try { rmSync(profile, {recursive: true, force: true}); } catch {}
process.exit(0);
