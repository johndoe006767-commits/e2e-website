// Extracts the manager's Order-to-Cash process map into dist/data/maps/o2c.json for the site's journey.
// It runs the page's own renderer (makeTowerMap, sankeyLite) headlessly, so every box, diamond, pill and
// arrow keeps the exact geometry the manager's page draws. The site only re-skins and re-arranges it.
//
//   node scripts/o2c-map/extract.mjs            write dist/data/maps/o2c.json
//   node scripts/o2c-map/extract.mjs --check    verify the counts against the source and exit 1 on a mismatch
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, resolve, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const website = resolve(here, '..', '..');
const SRC = resolve(website, '..', '..', 'D2P_O2C_Process_Map_v15_AI_suggested (1).html');
const OUT = resolve(website, 'dist', 'data', 'maps', 'o2c.json');
const check = process.argv.includes('--check');

const html = readFileSync(SRC, 'utf8');
const lines = html.split('\n');
const lineOf = needle => lines.findIndex(l => l.includes(needle));

// ---- 1. the data (AISMAP holds both pages: asis is byte-identical to SOCMAP.asis, tobe is the AI page)
const aisLine = lineOf('window.AISMAP=');
const aisText = lines[aisLine].slice(lines[aisLine].indexOf('window.AISMAP=') + 'window.AISMAP='.length);
const AISMAP = JSON.parse(aisText.slice(0, aisText.lastIndexOf('}') + 1));

// ---- 2. the renderer source, exposed for inspection
const start = lineOf('function makeTowerMap(KEY,DATA,E){');
let end = start; while (!lines[end].startsWith('return {render,setFilter')) end++;
end++; // closing "}" of makeTowerMap
let rendererSrc = lines.slice(start, end + 1).join('\n');
rendererSrc = rendererSrc.replace('return {render,setFilter', 'return {__nodes:()=>nodes,__dims:()=>({svgW,svgH}),render,setFilter');
const sankeyStart = lineOf('function sankeyLite(k){');
let sankeyEnd = sankeyStart; while (!lines[sankeyEnd].startsWith('function painTable(')) sankeyEnd++;
const sankeySrc = lines.slice(sankeyStart, sankeyEnd).join('\n');
const helpersSrc = [lineOf('const esc=s=>'), lineOf('const pc=p=>{const k=')].map(i => lines[i]).join('\n');

// ---- 3. a minimal DOM: the renderer only writes innerHTML / attributes and looks up a few elements
function fakeEl() {
  const el = {innerHTML: '', attrs: {}, style: {}, hidden: false, textContent: '', dataset: {},
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    querySelectorAll() { return []; }, querySelector() { return fakeEl(); }, addEventListener() {},
    classList: {add() {}, remove() {}, toggle() {}}, getBoundingClientRect() { return {left: 0, top: 0, width: 1200, height: 800}; },
    clientWidth: 1200};
  return el;
}
function run(mode) {
  const els = {};
  const get = sel => (els[sel] ||= fakeEl());
  const ctx = {document: {querySelector: get, getElementById: id => get('#' + id), querySelectorAll: () => []},
    window: {}, console, Math, String, Object, Array, Set, Map, JSON, Number, RegExp};
  vm.createContext(ctx);
  ctx.DATA = structuredClone(AISMAP);
  vm.runInContext(helpersSrc + '\n' + rendererSrc + '\nvar ENG=makeTowerMap("AIS",DATA,{svg:"#svg",scroll:"#scroll",det:"#det",leg:"#leg"});', ctx);
  vm.runInContext(`ENG.render(${JSON.stringify(mode)},"all")`, ctx);
  const nodes = vm.runInContext('ENG.__nodes()', ctx), dims = vm.runInContext('ENG.__dims()', ctx);
  return {svg: get('#svg').innerHTML, nodes, dims, data: ctx.DATA[mode]};
}
function runSankey() {
  const els = {};
  const get = id => (els[id] ||= fakeEl());
  const ctx = {document: {getElementById: get}, console, Math, String, Object, Array, Set, Map, JSON, Number, RegExp};
  vm.createContext(ctx);
  ctx.TOWERS = {SOC: {data: structuredClone(AISMAP), accent: '#0c8b86'}};
  vm.runInContext(helpersSrc + '\n' + sankeySrc + '\nsankeyLite("SOC");', ctx);
  const svg = get('sk-SOC');
  return {svg: svg.innerHTML, viewBox: svg.attrs.viewBox};
}

// ---- 4. turn one rendered page into phase-local geometry
const PAD = 24, FH = 46, H = 74;
const num = s => Math.round(parseFloat(s) * 10) / 10;
const shiftPath = (d, dx, dy) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${num(+x - dx)},${num(+y - dy)}`);
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

function extractPage(mode) {
  const {svg, nodes, data} = run(mode);
  const frames = data.frames.map((f, fi) => ({fi, id: f.id, top: f._box.top, bot: f._box.bot}));
  const frameAt = y => frames.find(f => y >= f.top - 2 && y <= f.bot + 2);
  // end pills (inside small <g><title> groups) before the groups are stripped
  const endPills = [];
  for (const m of svg.matchAll(/<g><title>([^<]*)<\/title><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="26" rx="13" fill="(#fff4e0|#fdecec)"[^>]*\/>(<text[\s\S]*?<\/text>)<\/g>/g)) {
    const text = decode([...m[6].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(t => t[1]).join(' '));
    endPills.push({x: +m[2], y: +m[3], w: +m[4], h: 26, kind: m[5] === '#fff4e0' ? 'hold' : 'reject', text, title: decode(m[1])});
  }
  // links and free labels live outside the node groups
  const flat = svg.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<g\b[^>]*>[\s\S]*?<\/g>/g, '');
  const links = [];
  for (const m of flat.matchAll(/<path\b[^>]*\/>/g)) {
    const tag = m[0], d = attr(tag, 'd'), cls = attr(tag, 'class'), stroke = attr(tag, 'stroke');
    if (!d) continue;
    const ai = stroke === '#0070c0';
    if (cls !== 'fl' && !ai) continue;
    links.push({d, dashed: !!attr(tag, 'stroke-dasharray'), arrow: !!attr(tag, 'marker-end'), ai});
  }
  const labels = [];
  for (const m of flat.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const tag = '<text' + m[1] + '>', fill = attr(tag, 'fill');
    if (fill !== '#5b2a7a') continue; // Yes / No / loop labels; row and strip labels are rebuilt from the data
    const text = decode([...m[2].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(t => t[1]).join(' '));
    labels.push({x: +attr(tag, 'x'), y: +attr(tag, 'y'), text, anchor: attr(tag, 'text-anchor') || 'middle'});
  }
  // nodes
  const out = frames.map(f => ({...pickFrame(data.frames[f.fi]), fi: f.fi, h: Math.round(f.bot - f.top), nodes: [], links: [], labels: [], endPills: [], rows: [], strips: [], w: 0}));
  const put = (y, fn) => { const f = frameAt(y); if (f) fn(out[f.fi], f); };
  const TPIS = new Set(); for (const page of [AISMAP.asis, AISMAP.tobe]) page.frames.forEach(f => (f.tpi || []).forEach(t => (t.steps || []).forEach(r => TPIS.add(f.id + '|' + r))));
  for (const n of Object.values(nodes)) {
    if (n.kind === 'fork') continue;
    put(n.y, (o, f) => {
      const base = {id: n.id, x: num(n.x - PAD), y: num(n.y - f.top), w: n.w, h: n.h};
      if (n.kind === 'in') o.nodes.push({...base, kind: 'in', lab: n.lab, txt: n.txt, proc: n.P.id});
      else if (n.kind === 'out') o.nodes.push({...base, kind: 'out', doc: n.doc, note: n.P.outnote || '', proc: n.P.id});
      else if (n.kind === 'dec') o.nodes.push({...base, kind: 'dec', fork: !!n.fork, gate: !!n.gate, dec: n.dec, proc: n.P.id, flow: n.P.name});
      else if (n.kind === 'opp') o.nodes.push({...base, kind: 'opp', opp: n.opp, proc: n.P.id, flow: n.P.name, pp: [...new Set(n.P.steps.flatMap(s => s.pp || []))]});
      else if (n.kind === 'fopp') o.nodes.push({...base, y: base.y + 20, kind: 'fopp', opp: n.opp, pp: n.f.pp || []}); // the page shifts phase-level opportunities down 20 px
      else if (n.kind === 'ch' || n.kind === 'tpi') o.nodes.push({...base, kind: n.kind, c: n.c});
      else o.nodes.push({...base, kind: 'step', s: n.s, proc: n.P.id, flow: n.P.name, fixOf: n.fixOf || null, branch: !!n.br, tpi: !!(n.s.ci || TPIS.has(n.id))});
    });
  }
  // row labels: one per flow, 4 px above the input pills band
  for (const n of Object.values(nodes)) if (n.kind === 'in') put(n.y, (o, f) => o.rows.push({proc: n.P.id, name: n.P.name, owner: n.P.owner, x: 60, y: num(n.y - f.top - 24 - 4), lab: n.P.steps.find(s => s.fork)?.lab || null}));
  for (const n of Object.values(nodes)) if (n.kind === 'fork' && n.fk.lab) put(n.rowY, (o, f) => o.labels.push({x: num(n.dx + 17 - PAD), y: num(n.rowY - f.top - 6), text: n.fk.lab, anchor: 'middle', muted: true}));
  // strips: label baseline 8 px above the first card's top
  for (const o of out) for (const kind of ['ch', 'tpi']) { const first = o.nodes.find(n => n.kind === kind); if (first) o.strips.push({kind, x: 60, y: first.y - 8, label: kind === 'ch' ? 'Pain points (register)' : 'TPI / CI initiatives (register)'}); }
  for (const l of links) { const y = +l.d.match(/M-?[\d.]+,(-?[\d.]+)/)[1]; put(y, (o, f) => o.links.push({...l, d: shiftPath(l.d, PAD, f.top)})); }
  for (const l of labels) put(l.y, (o, f) => o.labels.push({...l, x: num(l.x - PAD), y: num(l.y - f.top)}));
  for (const e of endPills) put(e.y, (o, f) => o.endPills.push({...e, x: num(e.x - PAD), y: num(e.y - f.top)}));
  // panel width = rightmost content + padding; upstream / downstream pill strips
  for (const o of out) {
    const f = frames[o.fi];
    let right = 0;
    for (const n of o.nodes) right = Math.max(right, n.x + n.w);
    for (const e of o.endPills) right = Math.max(right, e.x + e.w);
    const pills = (list, x0) => { let px = x0; return list.map(u => { const label = (u.c ? 'AI: ' : '') + u.p, w = label.length * 6.2 + 16, p = {x: px, w: Math.round(w), label, p: u.p, what: u.w, src: u.src, ai: !!u.c}; px += w + 6; return p; }); };
    o.up = pills(o.up, 60 + 8 + 66); o.upY = FH + 4;
    o.down = pills(o.down, 60 + 8 + 78); o.downY = Math.round(f.bot - f.top - 46);
    for (const p of [...o.up, ...o.down]) right = Math.max(right, p.x + p.w);
    o.w = Math.round(right + PAD);
    delete o.fi;
  }
  return out;
}
function pickFrame(f) {
  return {id: f.id, name: f.name, owner: f.owner, win: f.win, pp: f.pp || [], ctl: f.ctl || [], up: f.up || [], down: f.down || []};
}

// ---- 5. AI stations (ports of aiOpps / aiPainRows on the AI page)
function aiSteps(d) { const r = []; d.frames.forEach(f => f.procs.forEach(P => P.steps.forEach(s => { if (s.gate) { if (s.fix) r.push({f, P, s: s.fix}); return; } if (s.fork) { s.branches.forEach(b => r.push({f, P, s: b.step})); return; } r.push({f, P, s}); }))); return r; }
function aiPainRows(d) {
  const fx = d.fixes || {}, m = new Map();
  aiSteps(d).forEach(({f, P, s}) => (s.pp || []).forEach(p => { if (!m.has(p)) m.set(p, {p, where: [], area: f.name}); m.get(p).where.push(`${P.name} · step ${s.n}`); }));
  d.frames.forEach(f => (f.pp || []).forEach(p => { if (!m.has(p)) m.set(p, {p, where: [f.name + ' (phase level)'], area: f.name}); }));
  return [...m.values()].map(r => ({...r, fix: fx[r.p] || null, review: (d.review || {})[r.p] || {feas: 'Under Review', comment: ''}}));
}
function aiOpps(d) { const r = []; d.frames.forEach(f => { if (f.opp) r.push({...f.opp, where: f.name, lvl: 'Phase'}); f.procs.forEach(P => { if (P.opp) r.push({...P.opp, where: `${f.name} · ${P.name}`, lvl: 'Flow'}); }); }); return r; }
const statusClass = s => /implemented|completed|live/i.test(s) && !/wip|development|progress/i.test(s) ? 'done' : /wip|development|go-live|progress/i.test(s) ? 'wip' : /ai-suggested/i.test(s) ? 'ai' : /future/i.test(s) ? 'fut' : '';

// ---- 6. handoffs: the page's own diagram, recoloured by classes for the site skin
function handoffs() {
  const {svg, viewBox} = runSankey();
  const bands = [...svg.matchAll(/<path class="lk" d="([^"]+)" stroke="([^"]+)" stroke-width="([\d.]+)" data-i="(\d+)"[^>]*><title>([^<]*)<\/title><\/path>/g)]
    .map(m => ({d: m[1], color: m[2], width: +m[3], title: decode(m[5])}));
  const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="(\d+)" fill="([^"]+)"[^>]*\/>/g)]
    .map(m => ({x: +m[1], y: +m[2], w: +m[3], h: +m[4], fill: m[6], mid: m[6] === '#0c8b86'}));
  const texts = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" font-size="([\d.]+)"(?: font-weight="(\d+)")? fill="([^"]+)"(?: fill-opacity="[^"]+")? text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g)]
    .map(m => ({x: +m[1], y: +m[2], size: +m[3], weight: m[4] ? +m[4] : 400, onMid: m[5] === '#fff', muted: m[5] === 'var(--muted)', anchor: m[6], text: decode(m[7])}));
  const [, , W, Hh] = viewBox.split(' ').map(Number);
  return {w: W, h: Hh, bands, rects, texts};
}

// ---- 7. assemble, count, write / check
const pages = {asis: extractPage('asis'), tobe: extractPage('tobe')};
const tobe = AISMAP.tobe;
const ai = {opps: aiOpps(tobe), pain: aiPainRows(tobe), tpis: tobe.tpis.map(r => ({project: r[0], opportunity: r[1], status: r[2], statusClass: statusClass(r[2]), pain: r[3]}))};
const count = (mode, pred) => pages[mode].reduce((n, f) => n + f.nodes.filter(pred).length, 0);
const counts = {
  boxes: count('asis', n => n.kind === 'step'), diamonds: count('asis', n => n.kind === 'dec'), endPills: pages.asis.reduce((n, f) => n + f.endPills.length, 0),
  outputs: count('asis', n => n.kind === 'out'), triggers: count('asis', n => n.kind === 'in'),
  handoffs: pages.asis.reduce((n, f) => n + f.up.length + f.down.length, 0),
  challenges: {asis: count('asis', n => n.kind === 'ch'), tobe: count('tobe', n => n.kind === 'ch')},
  tpiCards: {asis: count('asis', n => n.kind === 'tpi'), tobe: count('tobe', n => n.kind === 'tpi')},
  changed: count('tobe', n => n.kind === 'step' && n.s.ch && n.s.ch !== 'same'),
  opps: count('tobe', n => n.kind === 'opp' || n.kind === 'fopp'),
  fixes: Object.keys(tobe.fixes).length, tpis: tobe.tpis.length, review: Object.keys(tobe.review).length,
  mix: Object.fromEntries(['asis', 'tobe'].map(m => [m, ['man', 'hyb', 'auto'].map(t => count(m, n => n.kind === 'step' && n.s.ty === t))])),
};
const expected = {boxes: 37, diamonds: 17, endPills: 4, outputs: 9, triggers: 10, handoffs: 29, challenges: {asis: 14, tobe: 13}, tpiCards: {asis: 8, tobe: 9},
  changed: 29, opps: 14, fixes: 19, tpis: 29, review: 19, mix: {asis: [17, 10, 10], tobe: [4, 14, 19]}};
const ids = m => pages[m].flatMap(f => f.nodes.filter(n => !['opp', 'fopp', 'ch', 'tpi'].includes(n.kind)).map(n => n.id)).sort().join();
const problems = [];
const cmp = (a, b, path) => { if (typeof b === 'object') { for (const k in b) cmp(a?.[k], b[k], path + '.' + k); } else if (a !== b) problems.push(`${path}: got ${a}, expected ${b}`); };
cmp(counts, expected, 'counts');
if (ids('asis') !== ids('tobe')) problems.push('node ids differ between As-Is and AI suggested');
const heights = m => pages[m].map(f => f.h).join('/');
if (heights('asis') !== '794/766/552/660/606/982') problems.push('As-Is panel heights ' + heights('asis'));
if (heights('tobe') !== '850/822/552/716/434/1038') problems.push('AI panel heights ' + heights('tobe'));

if (check) {
  console.log(problems.length ? problems.join('\n') : `OK ${JSON.stringify(counts)}`);
  process.exit(problems.length ? 1 : 0);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
const json = {
  schema: 1,
  provenance: {source: basename(SRC), sha256: createHash('sha256').update(html).digest('hex'), bytes: Buffer.byteLength(html), dataLine: aisLine + 1,
    extracted: new Date().toISOString().slice(0, 10),
    note: 'O2C process register v3, Oct 2026. AI suggested = Claude recommendations, hypotheses to validate with the O2C teams.'},
  title: {asis: AISMAP.asis.title, tobe: tobe.title}, note: {asis: AISMAP.asis.asisnote, tobe: tobe.asisnote},
  pages, handoffs: handoffs(), ai, counts,
};
mkdirSync(dirname(OUT), {recursive: true});
writeFileSync(OUT, JSON.stringify(json));
console.log(`wrote ${OUT} (${Math.round(Buffer.byteLength(JSON.stringify(json)) / 1024)} KB)`, JSON.stringify(counts));
