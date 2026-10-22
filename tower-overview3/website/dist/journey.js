// Order-to-Cash journey: the manager's O2C process map, below the zoomed-in intestines, travelled sideways as you scroll.
// Geometry and content come from data/maps/o2c.json (scripts/o2c-map/extract.mjs runs the manager's own renderer),
// so every box, diamond, pill and arrow sits exactly where the original puts it; this module re-skins and re-arranges it.
import {createFlowModel} from './flow-models.js?v=20261023-o2c10';
import {towerColors} from './organs.js?v=20261023-o2c10';
import {paintNebula, paintDust, createFx} from './galaxy.js?v=20261023-o2c10';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const MIN_SCALE = 0.85;    // each station is scaled to fit the screen height, never below this (taller ones get a vertical "dip") and never above 1
const EYEBROW = 34;        // room above each station for its "Phase 01 of 06" label
const GAIN = 1.4;          // px of horizontal travel per px of scroll
const GAP = 64;            // track px between stations
const TYNM = {man: 'Manual', hyb: 'Semi-automated', auto: 'Automated'};
const SHORT = {'SOC-01': 'Sales orders', 'SOC-02': 'Order blocks', 'SOC-03': 'Billing', 'SOC-04': 'Collections', 'SOC-05': 'Cash application', 'SOC-06': 'Cash & Banking',
  handoffs: 'Handoffs', 'ai-opps': 'AI opps', 'ai-pain': 'Pain register', 'ai-tpis': 'TPIs'};

// Partner colours: towers in their own site colour, everyone else platinum.
const TOWER_OF = {O2C: 'intestines', R2R: 'lungs', TAX: 'spleen', Tax: 'spleen', P2P: 'stomach', CAPEX: 'liver', Controlling: 'kidneys'};
function partyTower(p) { const s = String(p); if (/^FP&A Op/i.test(s)) return 'pancreas'; if (/^FP&A/i.test(s)) return 'brain'; return TOWER_OF[s.split(/[ -]/)[0]] || null; }
function partyVars(p) { const t = partyTower(p); return t ? `--pc:${towerColors[t].base};--pt:${towerColors[t].cardText}` : ''; }
const partyHex = p => { const t = partyTower(p); return t ? towerColors[t].base : '#8EA29E'; };
// pill widths from the real text (the original's 6.2px-per-character estimate truncates short names like DMT or HR)
const measureCtx = document.createElement('canvas').getContext('2d');
const pillW = s => { measureCtx.font = '600 9.6px Inter, Arial, sans-serif'; return Math.max(34, Math.ceil(measureCtx.measureText(String(s)).width) + 20); };

export function createJourney({maps}) {
  // A reload mid-journey must not drop the visitor back into it once the O2C view opens and the page grows.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const section = $('#journey'), viewport = $('.jr-viewport', section), track = $('.jr-track', section), spacer = $('.jr-spacer', section);
  const rail = $('.jr-rail', section), progress = $('.jr-progress', section), drawer = $('.jr-drawer', section), status = $('.jr-status', section);
  const loading = $('.jr-loading', section), stars = $('.jr-stars', section), bg = $('.jr-bg', section), meter = $('.jr-meter', section), legend = $('#jr-legend'), legendBtn = $('.jr-legend-btn', section);
  let data = null, loadPromise = null, built = false, active = false, mode = 'asis', filter = 'all';
  let lit = null, s = 1, vw = 1, vh = 1, availH = 1, travel = 0, pathLen = 0, keys = [{tx: 0, ty: 0, d: 0}], tx = 0, ty = 0, frameReq = 0;
  let stations = [], items = new Map(), phaseEls = new Map(), selected = null, bookend = null, readyResolve;
  const readyPromise = new Promise(r => { readyResolve = r; });
  let cue = null, skipTravel = false, fx = null, skyPainted = false;

  // ---------- loading and building ----------
  function load(url) {
    loadPromise ||= fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); })
      .then(json => { if (json.schema !== 1 || !json.pages?.asis || !json.pages?.tobe) throw new Error('Unexpected process-map data'); return json; });
    return loadPromise;
  }
  function build() {
    track.innerHTML = '<svg class="jr-tube" aria-hidden="true"><path class="tube-glow"/><path class="tube"/><path class="sweep"/></svg>';
    stations = [];
    stations.push(station('start', 'bookend', bookendStart(), {w: 640, h: 0}));
    data.pages.asis.forEach((f, i) => stations.push(phaseStation(f.id, i)));
    stations.push(station('handoffs', 'handoffs', handoffsStation(), {w: 1200, h: 0, eyebrow: 'After the map · who hands what to whom'}));
    stations.push(station('ai-opps', 'ai', aiOppsStation(), {w: 1010, h: 0, ai: true, eyebrow: 'AI suggested · 1 of 3'}));
    stations.push(station('ai-pain', 'ai', aiPainStation(), {w: 2000, h: 0, ai: true, eyebrow: 'AI suggested · 2 of 3'}));
    stations.push(station('ai-tpis', 'ai', aiTpiStation(), {w: 2060, h: 0, ai: true, eyebrow: 'AI suggested · 3 of 3'}));
    stations.push(station('end', 'bookend', bookendEnd(), {w: 560, h: 0}));
    for (const st of stations) track.append(st.el);
    // measured stations (handoffs and AI tables) take their natural height
    for (const st of stations) if (!st.h) { st.el.style.setProperty('--w', st.w + 'px'); st.h = Math.ceil(st.el.scrollHeight); }
    progress.innerHTML = stations.filter(st => SHORT[st.id]).map(st => `<li${st.ai ? ' data-ai' : ''}><button type="button" data-go="${st.id}" class="${st.ai ? 'ai' : ''}">${esc(SHORT[st.id])}</button></li>`).join('');
    legend.innerHTML = legendHtml();
    built = true;
    applyMode(false);
    if (!bookend) mountBookend();
    setTimeout(paintSky, 1200); // after the organ's zoom animation; scrolling starts it sooner
    readyResolve();
  }
  function station(id, kind, el, {w, h, ai = false, eyebrow = ''}) {
    el.classList.add('jr-station'); el.dataset.station = id; el.tabIndex = -1; if (ai) el.dataset.ai = '';
    if (eyebrow) el.insertAdjacentHTML('afterbegin', `<p class="jr-eyebrow" aria-hidden="true">${esc(eyebrow)}</p>`);
    return {id, kind, el, w, h, ai, x: 0, y: 0, k: 1, sw: w, sh: h};
  }

  // ---------- phase panels ----------
  function phaseStation(id, index) {
    const fa = data.pages.asis.find(f => f.id === id), ft = data.pages.tobe.find(f => f.id === id);
    const el = document.createElement('section');
    el.className = 'jr-phase'; el.setAttribute('aria-label', `Phase ${index + 1}: ${fa.name}`);
    el.style.setProperty('--pd', index * 140 + 'ms'); // healing spreads phase by phase, left to right
    el.innerHTML = `<div class="jr-head"><i class="n">${index + 1}</i><h3>${esc(fa.name)}</h3><small>${esc(fa.owner)} · ${esc(fa.win)}</small>
      <button class="hd hd-pp" type="button" data-hd="pp" aria-label="Phase pain points">!</button><button class="hd hd-c" type="button" data-hd="ctl" aria-label="Phase controls">C</button></div>`;
    // link layers, one per mode
    for (const m of ['asis', 'tobe']) el.insertAdjacentHTML('beforeend', linkLayer(m === 'asis' ? fa : ft, m));
    // upstream strip (same in both modes), downstream strip (moves with the AI rows)
    el.insertAdjacentHTML('beforeend', strip('Upstream', fa.up, fa.upY, 'up'));
    el.insertAdjacentHTML('beforeend', strip('Downstream', fa.down, fa.downY, 'down'));
    // row labels
    for (const r of fa.rows) el.insertAdjacentHTML('beforeend', `<p class="jr-label jr-rowlab" style="left:${r.x}px;top:${r.y - 13}px">${esc(r.name)}<small>${esc(r.proc)} · ${esc(r.owner)}</small></p>`);
    // keyed items: nodes of both modes
    const ids = new Map();
    for (const [m, f] of [['asis', fa], ['tobe', ft]]) for (const n of f.nodes) { if (!ids.has(n.id)) ids.set(n.id, {}); ids.get(n.id)[m] = n; }
    const sorted = [...ids.entries()].sort((a, b) => { const A = a[1].asis || a[1].tobe, B = b[1].asis || b[1].tobe; return Math.round(A.y / 60) - Math.round(B.y / 60) || A.x - B.x; });
    for (const [nid, by] of sorted) {
      const any = by.asis || by.tobe, it = makeItem(any, fa, index);
      it.by = by; it.frame = {asis: fa, tobe: ft}; it.phase = id;
      items.set(nid, it); el.append(it.el);
    }
    phaseEls.set(id, {el, fa, ft});
    const st = station(id, 'phase', el, {w: fa.w, h: fa.h, eyebrow: `Phase ${String(index + 1).padStart(2, '0')} of ${String(data.pages.asis.length).padStart(2, '0')}`});
    st.dims = {asis: {w: fa.w, h: fa.h}, tobe: {w: ft.w, h: ft.h}};
    st.index = index;
    return st;
  }
  function strip(label, pills, y, kind) {
    return `<div class="jr-strip jr-strip-${kind}" style="position:absolute;left:0;top:${y}px;width:100%;height:17px;transition:top .7s var(--ease-out)">
      <p class="jr-label" style="left:60px;top:2px">${label}</p>
      ${(() => { let left = pills[0]?.x ?? 0; return pills.map(p => { const w = pillW(p.label), html = `<span class="pill${p.ai ? ' ai' : ''}" style="left:${left}px;top:0;width:${w}px;${partyVars(p.p)}" title="${esc(`${p.p}: ${p.what} (${p.src})`)}">${esc(p.label)}</span>`; left += w + 6; return html; }).join(''); })()}</div>`;
  }
  function linkLayer(f, m) {
    const label = l => {
      const w = l.text.length * 5.4 + 8, chip = /^(Yes|No)$/.test(l.text) || l.muted ? '' : `<rect class="chip" x="${l.anchor === 'end' ? l.x - w + 4 : l.x - 4}" y="${l.y - 10}" width="${w}" height="13" rx="3"/>`;
      return `${chip}<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}"${l.muted ? ' class="muted"' : ''}>${esc(l.text)}</text>`;
    };
    const strips = f.strips.map(st => `<text x="${st.x}" y="${st.y}" class="strip ${st.kind}" style="font-size:10.5px;font-weight:700;fill:${st.kind === 'ch' ? '#9E1218' : '#13643a'}">${esc(st.label)}</text>`).join('');
    return `<svg class="jr-links${m === mode ? '' : ' off'}" data-mode="${m}" width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}" aria-hidden="true">
      ${f.links.map(l => `<path d="${l.d}" class="${l.ai ? 'ai' : l.dashed ? 'dash' : ''}"${l.arrow ? ` marker-end="url(#${l.ai ? 'jr-arrow-ai' : 'jr-arrow'})"` : ''}/>`).join('')}
      ${f.links.filter(l => !l.ai && !l.dashed && /^M[\d.]+,([\d.]+) L[\d.]+,\1$/.test(l.d)).map(l => `<path d="${l.d}" class="flow"/>`).join('')}
      ${f.endPills.map(e => `<g><title>${esc(e.title)}</title><rect x="${e.x}" y="${e.y}" width="${e.w}" height="26" rx="13" class="end-${e.kind}" style="fill:${e.kind === 'hold' ? 'rgba(212,122,6,.1)' : 'rgba(218,27,37,.08)'};stroke:${e.kind === 'hold' ? 'var(--jr-hyb)' : 'var(--jr-man)'};stroke-width:1.5"/><text x="${e.x + e.w / 2}" y="${e.y + 17}" text-anchor="middle" style="font-size:9.6px;font-weight:700;fill:${e.kind === 'hold' ? '#7A4600' : '#9E1218'}">${esc(e.text)}</text></g>`).join('')}
      ${f.labels.map(label).join('')}${strips}</svg>`;
  }

  // ---------- items ----------
  function makeItem(n, f, phaseIndex) {
    const wrap = document.createElement(n.kind === 'step' ? 'div' : (['dec', 'ch', 'tpi', 'opp', 'fopp'].includes(n.kind) ? 'button' : 'div'));
    wrap.className = 'jr-it';
    const it = {el: wrap, kind: n.kind, id: n.id, phaseIndex};
    if (n.kind === 'step') {
      wrap.classList.add('stepw');
      const pills = (n.s.in || []).slice(0, 2).map((x, i, a) => pillHtml(x, i, a, -21, 'From')).join('') + more(n.s.in, -21, 'From') +
        (n.s.out || []).slice(0, 2).map((x, i, a) => pillHtml(x, i, a, 74 + 7, 'To')).join('') + more(n.s.out, 81, 'To');
      wrap.innerHTML = `${pills}<button type="button" class="nd" data-id="${esc(n.id)}" style="position:absolute;inset:0"><i class="num"></i><span class="ttl"></span><span class="sys"></span><i class="mk mk-pp" aria-hidden="true" hidden>!</i><i class="mk mk-ok" aria-hidden="true" hidden>✔</i><i class="mk mk-ai" aria-hidden="true" hidden>AI</i></button>`;
      it.btn = wrap.querySelector('.nd');
    } else {
      wrap.type = 'button';
      const cls = {in: 'trig', out: 'out', dec: 'dec', ch: 'card card-ch', tpi: 'card card-tpi', opp: 'opp', fopp: 'opp fopp'}[n.kind];
      wrap.className += ' ' + cls;
      if (n.kind === 'dec' && n.fork) wrap.classList.add('fork');
      it.btn = ['in', 'out'].includes(n.kind) ? null : wrap;
      if (it.btn) wrap.dataset.id = n.id;
      if (['in', 'out'].includes(n.kind)) wrap.removeAttribute('type');
    }
    return it;
  }
  function pillHtml(x, i, all, top, dir) {
    let left = 2; for (let k = 0; k < i; k++) left += pillW(all[k][0]) + 4;
    const w = pillW(x[0]), stemTop = top < 0 ? -4 : 74, stemH = top < 0 ? 4 : 7;
    return `<span class="pill" style="left:${left}px;top:${top}px;width:${w}px;${partyVars(x[0])}" title="${esc(`${dir} ${x[0]}: ${x[1]}`)}">${esc(x[0])}</span><span class="pill-stem" style="left:${left + w / 2}px;top:${stemTop}px;height:${stemH}px;${partyVars(x[0])}"></span>`;
  }
  function more(list, top, dir) {
    if (!list || list.length <= 2) return '';
    let left = 2; for (let k = 0; k < 2; k++) left += pillW(list[k][0]) + 4;
    return `<span class="pill" style="left:${left}px;top:${top}px;width:30px" title="${esc(list.slice(2).map(x => `${dir} ${x[0]}: ${x[1]}`).join(' | '))}">+${list.length - 2}</span>`;
  }
  function paint(it, m) {
    const n = it.by[m];
    const el = it.el;
    if (!n) { el.classList.add('off'); el.inert = true; el.setAttribute('aria-hidden', 'true'); return; }
    el.classList.remove('off'); el.inert = false; el.removeAttribute('aria-hidden');
    el.style.setProperty('--x', n.x + 'px'); el.style.setProperty('--y', n.y + 'px');
    el.style.setProperty('--w', n.w + 'px'); el.style.setProperty('--h', n.h + 'px');
    const stW = (m === 'asis' ? it.frame.asis : it.frame.tobe).w;
    el.style.setProperty('--d', Math.round(it.phaseIndex * 140 + (n.x / stW) * 260) + 'ms');
    if (n.kind === 'step') {
      const s = n.s, ch = s.ch || 'same', b = it.btn;
      const aiOn = m === 'tobe' && ch !== 'same', pp = s.pp?.length > 0;
      // condition classes for the skin: a pain point is "inflamed" until an AI change addresses it ("healed")
      b.className = `nd ty-${s.ty}${pp ? ' has-pp' : ''}${n.tpi ? ' has-tpi' : ''}${ch === 'new' ? ' new' : ''}${aiOn ? ' ai-on' : ''}${aiOn && pp ? ' healed' : ''}${selected === n.id ? ' sel' : ''}`;
      b.querySelector('.num').textContent = s.n;
      b.querySelector('.ttl').textContent = s.t;
      b.querySelector('.sys').textContent = s.sys;
      b.querySelector('.mk-ok').hidden = !(aiOn && pp);
      b.querySelector('.mk-pp').hidden = !(pp && !aiOn);
      const ai = b.querySelector('.mk-ai'); ai.hidden = !aiOn; ai.textContent = ch === 'new' ? 'NEW' : 'AI';
      b.querySelector('.ttl').style.paddingRight = aiOn ? '24px' : '0';
      b.title = `${s.t} - ${TYNM[s.ty]} - ${s.sys}`;
      b.setAttribute('aria-label', `${s.n}. ${s.t}. ${TYNM[s.ty]}. ${s.sys}${pp ? '. Pain point' : ''}${aiOn ? '. AI suggested change' : ''}`);
    } else if (n.kind === 'in') {
      el.innerHTML = `<b>${esc(n.lab)}</b><span>${esc(n.txt)}</span>`; el.title = `${n.lab}: ${n.txt}`;
    } else if (n.kind === 'out') {
      el.innerHTML = `<b>Output</b><span>${esc(n.doc)}</span>`; el.title = `Output: ${n.doc}${n.note ? ' - ' + n.note : ''}`;
    } else if (n.kind === 'dec') {
      const q = n.dec;
      el.innerHTML = `<i class="dia" aria-hidden="true"></i><span class="q">${esc(q.q)}</span>${n.fork ? '' : `<span class="yes" aria-hidden="true">${q.swap ? 'No' : 'Yes'}</span>`}`;
      el.setAttribute('aria-label', `Decision: ${q.q}. Yes: ${q.yes}. No: ${q.no}`);
      el.title = `${q.q} Yes: ${q.yes}. No: ${q.no}`;
      el.classList.toggle('sel', selected === n.id);
    } else if (n.kind === 'ch' || n.kind === 'tpi') {
      const c = n.c, head = n.kind === 'ch' ? '[CHALLENGE]' : `[SOLUTION] ${c.st || 'TPI'}`;
      el.classList.toggle('wip', n.kind === 'tpi' && /progress|wip/i.test(c.st || ''));
      el.innerHTML = `<span class="hd2"><span>${esc(head)}</span>${c.ref ? `<em>${esc(c.ref)}</em>` : ''}</span><span class="tx">${esc(c.t)}</span>`;
      el.setAttribute('aria-label', `${head}: ${c.t}`);
      el.classList.toggle('sel', selected === n.id);
    } else if (n.kind === 'opp' || n.kind === 'fopp') {
      const o = n.opp, f = (m === 'asis' ? it.frame.asis : it.frame.tobe);
      el.innerHTML = `<span class="hd2"><span>${n.kind === 'fopp' ? `AI Opportunity - ${esc(f.name)}` : 'AI Opportunity'}</span><span class="tag ${esc(o.ty)}">${esc(o.ty)}</span></span><span class="tx">${esc(o.t)}</span>`;
      el.setAttribute('aria-label', `AI opportunity (${o.ty}): ${o.t}`);
    }
  }

  // ---------- bookends, handoffs, AI stations ----------
  function bookendStart() {
    const el = document.createElement('section');
    el.className = 'jr-bookend jr-start';
    el.innerHTML = `<div class="organ" aria-hidden="true"></div><div class="copy"><p class="kicker">Order to Cash · process map</p><h2>Follow an order<br>all the way to cash</h2>
      <p>Six phases, from the customer's order and the distributor's EDI file to cash in the bank. Click any step, decision or card for the detail.</p>
      <div class="stats"></div><p class="jr-begin" aria-hidden="true">Keep scrolling <i>→</i></p></div>`;
    return el;
  }
  function bookendEnd() {
    const el = document.createElement('section');
    el.className = 'jr-bookend jr-end';
    el.innerHTML = `<svg width="260" height="160" viewBox="0 0 260 160" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<path d="M0,${60 + i * 9} C90,${60 + i * 9} 130,${20 + i * 26} 250,${16 + i * 30}" fill="none" stroke="var(--jr-gold)" stroke-opacity="${.9 - i * .12}" stroke-width="${2.6 - i * .3}" stroke-linecap="round"/>`).join('')}</svg>
      <p class="kicker">The end of the line</p><h2>Cash in the bank</h2><p>Payments are applied, bank statements posted and reconciled in BlackLine for the month-end close (R2R).</p>
      <p><button type="button" class="jr-totop">Back to the organ</button></p>`;
    return el;
  }
  function mountBookend() {
    const host = $('.jr-start .organ', track);
    if (!host || bookend) return;
    try { bookend = createFlowModel(host, 'intestines', null, {zoom: 1.55}); } catch (err) { console.warn('journey bookend', err); }
  }
  function handoffsStation() {
    const h = data.handoffs, el = document.createElement('section');
    el.className = 'jr-card jr-handoffs';
    const dirOf = d => (d.startsWith('M304') ? 'in' : 'out');
    const bands = h.bands.map((b, i) => {
      const m = b.title.match(/^(.*?) → (.*?): (.*)$/) || [], dir = dirOf(b.d), party = dir === 'in' ? m[1] : m[2];
      const colour = partyTower(party) ? partyHex(party) : dir === 'in' ? '#D0006F' : '#68D2DF';
      return `<path class="jr-band" d="${b.d}" stroke="${colour}" stroke-width="${b.width}" tabindex="0" role="button" data-band="${i}" aria-label="${esc(b.title)}"><title>${esc(b.title)}</title></path>`;
    }).join('');
    const label = (r) => h.texts.find(t => !t.onMid && !t.muted && Math.abs(t.y - (r.y + r.h / 2)) < 1.5 && (r.x < 400 ? t.anchor === 'end' : t.anchor === 'start'));
    const rects = h.rects.map(r => r.mid
      ? `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6" fill="url(#jr-gold-grad)" stroke="rgba(240,171,0,.9)"/>`
      : `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="2" fill="${partyHex(label(r)?.text || '')}"/>`).join('');
    const texts = h.texts.map(t => `<text x="${t.x}" y="${t.y}" font-size="${t.size}" font-weight="${t.weight}" text-anchor="${t.anchor}" dominant-baseline="middle" fill="${t.onMid ? '#2b2200' : t.muted ? 'var(--jr-muted)' : 'var(--jr-ink)'}">${esc(t.text)}</text>`).join('');
    el.innerHTML = `<h3>Handoffs</h3><p>Who hands what in, and where each flow sends it. One band is one handoff, built from the flows on the map; click a band for the detail.</p>
      <svg viewBox="0 0 ${h.w} ${h.h}" width="${h.w}" height="${h.h}"><defs><linearGradient id="jr-gold-grad" x1="0" x2="1"><stop offset="0" stop-color="#F7C95A"/><stop offset="1" stop-color="#FBE3A6"/></linearGradient></defs><g>${bands}</g>${rects}${texts}</svg>`;
    return el;
  }
  function aiOppsStation() {
    const el = document.createElement('section');
    el.className = 'jr-card jr-ai-card';
    el.innerHTML = `<h3>AI opportunities<span class="cnt">${data.ai.opps.length}</span></h3><p>Blue nodes on the map · Claude recommendations and TPI-register patterns · hypotheses to validate with the O2C teams</p>
      <div class="oppgrid" style="height:600px">${data.ai.opps.map((o, i) => `<button type="button" class="opp" data-aiopp="${i}"><span class="hd2"><span>${esc(o.lvl)} level</span><span class="tag ${esc(o.ty)}">${esc(o.ty)}</span></span><span class="tx">${esc(o.t)}</span><span class="wh">${esc(o.where)}</span></button>`).join('')}</div>`;
    return el;
  }
  function aiPainStation() {
    const el = document.createElement('section');
    el.className = 'jr-card jr-ai-card';
    const rows = data.ai.pain.map((r, i) => {
      const feas = r.review?.feas || 'Under Review', cls = /not|reject|drop/i.test(feas) ? '' : /feasible|approved|agreed/i.test(feas) ? 'done' : /future/i.test(feas) ? 'fut' : 'ur';
      return `<tr><td style="color:var(--jr-muted)">${i + 1}</td><td><b>${esc(r.area)}</b><small>${esc(r.where[0])}${r.where.length > 1 ? ` +${r.where.length - 1}` : ''}</small></td><td><span class="pp-dot"></span>${esc(r.p)}</td><td${r.fix ? '' : ' style="color:var(--jr-muted);font-style:italic"'}>${esc(r.fix || 'To explore with the team')}</td><td><span class="badge ${cls}">${esc(feas)}</span></td><td style="color:var(--jr-muted);font-style:italic">${esc(r.review?.comment || '—')}</td></tr>`;
    }).join('');
    el.innerHTML = `<h3>Pain point resolution register<span class="cnt">${data.ai.pain.length}</span></h3><p>All documented pain points · AI suggestion to resolve · feasibility to be confirmed with the LT</p>
      <table class="jr-table"><thead><tr><th style="width:3%">#</th><th style="width:15%">Phase · where</th><th style="width:24%">Pain point</th><th>AI suggestion to resolve</th><th style="width:9%">Feasibility</th><th style="width:10%">LT comments</th></tr></thead><tbody>${rows}</tbody></table>`;
    return el;
  }
  function aiTpiStation() {
    const el = document.createElement('section');
    el.className = 'jr-card jr-ai-card';
    const t = data.ai.tpis, half = Math.ceil(t.length / 2);
    const table = list => `<table class="jr-table"><thead><tr><th style="width:26%">TPI project</th><th>Opportunity</th><th style="width:15%">Status</th><th style="width:26%">Pain point addressed</th></tr></thead><tbody>${list.map(r => {
      const proj = r.project.replace(/\s*\(TPI [^)]*\)/, ''), code = (r.project.match(/\((TPI [^)]*)\)/) || [])[1];
      return `<tr><td><b>${esc(proj)}</b>${code ? `<small>${esc(code)}</small>` : ''}</td><td>${esc(r.opportunity)}</td><td><span class="badge ${r.statusClass}">${esc(r.status)}</span></td><td><span class="pp-dot"></span>${esc(r.pain)}</td></tr>`;
    }).join('')}</tbody></table>`;
    el.innerHTML = `<h3>Related TPIs<span class="cnt">${t.length}</span></h3><p>Register CI / TPI column and the TPI register Jun–Aug 2026 · items that touch the O2C flows</p>
      <div class="tpicols">${table(t.slice(0, half))}${table(t.slice(half))}</div>`;
    return el;
  }
  function statsHtml() {
    const c = data.counts, [man, hyb, auto] = c.mix[mode];
    return mode === 'asis'
      ? `<span><b>${c.boxes}</b>steps</span><span><b>${c.diamonds}</b>decisions</span><span><b>${c.handoffs}</b>handoffs</span><span class="m"><b>${man}</b>manual</span><span class="h"><b>${hyb}</b>semi-automated</span><span class="a"><b>${auto}</b>automated</span>`
      : `<span class="ai"><b>${c.changed}</b>steps changed</span><span class="ai"><b>${c.opps}</b>AI opportunities</span><span><b>${c.fixes}</b>pain-point fixes</span><span class="m"><b>${man}</b>manual</span><span class="h"><b>${hyb}</b>semi-automated</span><span class="a"><b>${auto}</b>automated</span>`;
  }
  function legendHtml() {
    const box = c => `<i style="width:18px;height:11px;border:1px solid rgba(63,68,68,.2);border-left:4px solid ${c};border-radius:3px"></i>`;
    return `<span>${box('var(--jr-man)')}Manual</span><span>${box('var(--jr-hyb)')}Semi-automated</span><span>${box('var(--jr-auto)')}Automated</span>
      <span><i style="width:14px;height:14px;border-radius:50%;background:var(--jr-pain);color:#fff;font-size:9px;font-weight:700;display:grid;place-items:center;font-style:normal">!</i>Pain point</span>
      <span><i style="width:12px;height:12px;transform:rotate(45deg);border:1.5px solid var(--jr-purple);background:#f1ecf4"></i>Decision</span>
      <span><i style="width:22px;height:2px;background:var(--jr-line)"></i>Flow · dashed = loop back</span>
      <span><i style="width:24px;height:12px;border-radius:3px;background:var(--jr-mul)"></i>Trigger</span>
      <span><i style="width:18px;height:13px;background:#fff8e2;border:1.4px solid var(--jr-gold)"></i>Output</span>
      <span><i style="width:24px;height:12px;border-radius:3px;border:1.4px solid var(--jr-pain);background:#fdecec"></i>[CHALLENGE] pain point</span>
      <span><i style="width:24px;height:12px;border-radius:3px;border:1.4px solid var(--jr-tpi);background:#e6f4ec"></i>[SOLUTION] TPI / CI</span>
      <span><i style="width:26px;height:13px;border-radius:4px;background:var(--jr-ai)"></i>AI suggested change</span>
      <span><i style="width:24px;height:12px;border-radius:3px;border:1.4px solid var(--jr-ai);background:#e8f1fb"></i>AI opportunity</span>
      <span><i style="width:14px;height:14px;border-radius:50%;background:var(--jr-tpi);color:#fff;font-size:9px;display:grid;place-items:center;font-style:normal">✔</i>Change addresses a pain point</span>
      <span><span class="pill" style="position:static;display:inline-block;width:auto">Partner</span>Pills: input from / output to, in the partner's tower colour</span>`;
  }

  // ---------- mode, layout and the camera path ----------
  function applyMode(animate) {
    section.dataset.mode = mode;
    for (const it of items.values()) paint(it, mode);
    for (const {el, fa, ft} of phaseEls.values()) {
      el.querySelectorAll('.jr-links').forEach(svg => svg.classList.toggle('off', svg.dataset.mode !== mode));
      const f = mode === 'asis' ? fa : ft;
      el.querySelector('.jr-strip-down').style.top = f.downY + 'px';
      el.querySelector('.hd-pp').hidden = !f.pp.length; el.querySelector('.hd-c').hidden = !f.ctl.length;
    }
    for (const st of stations) {
      if (st.dims) { st.w = st.dims[mode].w; st.h = st.dims[mode].h; }
      if (st.ai) { const on = mode === 'tobe'; st.el.classList.toggle('jr-off', !on); st.el.inert = !on; }
    }
    progress.querySelectorAll('li[data-ai]').forEach(li => { li.hidden = mode !== 'tobe'; });
    section.querySelectorAll('.jr-mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const stats = $('.jr-start .stats', track); if (stats) stats.innerHTML = statsHtml();
    status.textContent = mode === 'tobe' ? `AI suggested map: ${data.counts.changed} steps changed, ${data.counts.opps} AI opportunities. Blue = hypothesis to validate with the O2C teams.` : 'As-Is map, as documented with the O2C teams (register Oct 2026).';
    if (animate && !reduced.matches) {
      section.dataset.healing = '';
      clearTimeout(applyMode.t); applyMode.t = setTimeout(() => delete section.dataset.healing, 2400);
    }
    measure();
  }
  function measure() {
    if (!built) return;
    vw = viewport.clientWidth; vh = viewport.clientHeight;
    const railH = rail.offsetHeight, foot = 56, pad = 24;
    availH = vh - railH - foot - pad;
    const inner = availH - EYEBROW;
    let x = 0, trackH = availH;
    const visible = stations.filter(st => !st.ai || mode === 'tobe');
    for (const st of stations) {
      if (st.ai && mode !== 'tobe') { st.el.style.setProperty('--x', x + 'px'); continue; }
      // every station fits the screen height on its own (never enlarged), so short phases stay at full size
      st.k = clamp(inner / st.h, MIN_SCALE, 1); st.sw = st.w * st.k; st.sh = st.h * st.k;
      st.x = x; st.y = EYEBROW; // top-aligned, so every eyebrow sits on one line
      st.el.style.setProperty('--x', x + 'px'); st.el.style.setProperty('--w', st.w + 'px'); st.el.style.setProperty('--h', st.h + 'px'); st.el.style.setProperty('--k', st.k);
      st.el.style.top = st.y + 'px';
      trackH = Math.max(trackH, st.y + st.sh);
      x += st.sw + GAP;
    }
    const trackW = x - GAP;
    track.style.width = trackW + 'px'; track.style.height = trackH + 'px';
    // gold tube between stations
    let d = '';
    const midY = st => st.id === 'end' ? st.y + ((st.el.querySelector('svg')?.offsetTop ?? 0) + 78) * st.k : st.y + st.sh / 2; // the end card's tube joins its gold strands
    visible.forEach((st, i) => { const nx = visible[i + 1]; if (!nx) return; const y1 = midY(st), y2 = midY(nx), x1 = st.x + st.sw, x2 = nx.x; d += `M${x1},${y1} C${x1 + GAP * .6},${y1} ${x2 - GAP * .6},${y2} ${x2},${y2} `; });
    const tube = $('.jr-tube', track); tube.setAttribute('width', trackW); tube.setAttribute('height', trackH);
    tube.querySelector('.tube').setAttribute('d', d); tube.querySelector('.tube-glow').setAttribute('d', d);
    const sweep = tube.querySelector('.sweep'); sweep.setAttribute('d', d); sweep.setAttribute('pathLength', '1000'); // the healing light runs along the tube
    // camera path: travel right; stations taller than the screen get a dip down and back up when centred
    travel = Math.max(0, trackW - (vw - 2 * pad));
    const pts = [{tx: 0, ty: 0}];
    for (const st of visible) {
      const over = st.y + st.sh - availH;
      if (over <= 4) continue;
      // wider than the screen: dip at its left and at its right end, so both bottom corners come into view
      const dips = st.sw > vw - 2 * pad ? [st.x - pad, st.x + st.sw - vw + pad] : [st.x + st.sw / 2 - vw / 2 + pad];
      for (const c0 of dips) { const c = clamp(Math.max(c0, pts.at(-1).tx), 0, travel); pts.push({tx: c, ty: 0}, {tx: c, ty: over + 8}, {tx: c, ty: 0}); }
    }
    pts.push({tx: travel, ty: 0});
    keys = []; let acc = 0;
    pts.forEach((p, i) => { if (i) acc += Math.hypot(p.tx - pts[i - 1].tx, p.ty - pts[i - 1].ty); keys.push({...p, d: acc}); });
    pathLen = acc;
    section.style.setProperty('--jr-spacer-h', `${vh + pathLen / GAIN}px`);
    schedule();
  }
  function at(dist) {
    for (let i = 1; i < keys.length; i++) if (dist <= keys[i].d || i === keys.length - 1) {
      const a = keys[i - 1], b = keys[i], t = b.d > a.d ? clamp((dist - a.d) / (b.d - a.d), 0, 1) : 1;
      return {tx: a.tx + (b.tx - a.tx) * t, ty: a.ty + (b.ty - a.ty) * t};
    }
    return {tx: 0, ty: 0};
  }
  // distance along the camera path to the point nearest (px, py); the first match wins, so (x, 0) lands before a dip
  function distFor(px, py = 0) {
    let best = Infinity, out = 0;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i], dx = b.tx - a.tx, dy = b.ty - a.ty, l2 = dx * dx + dy * dy;
      const t = l2 ? clamp(((px - a.tx) * dx + (py - a.ty) * dy) / l2, 0, 1) : 0, ex = a.tx + dx * t - px, ey = a.ty + dy * t - py, e2 = ex * ex + ey * ey;
      if (e2 < best - 1e-6) { best = e2; out = a.d + (b.d - a.d) * t; }
    }
    return out;
  }
  const sectionTop = () => section.getBoundingClientRect().top + scrollY;
  const range = () => Math.max(1, spacer.offsetHeight - vh);
  const topFor = dist => sectionTop() + (pathLen ? dist / pathLen : 0) * range();
  function update() {
    frameReq = 0;
    if (!active || !built) return;
    const p = clamp((scrollY - sectionTop()) / range(), 0, 1);
    ({tx, ty} = at(p * pathLen));
    track.style.transform = `translate3d(${-tx}px,${-ty}px,0)`;
    stars.style.transform = `translate3d(${-((tx * .06) % 1024)}px,${-ty * .06}px,0)`; // one 1024px dust tile of overhang covers the wrap
    fx?.update(tx, ty, vw, vh);
    if (!skyPainted && scrollY > 8) paintSky();
    bg.style.transform = `translate3d(${-tx * .025}px,0,0)`;
    meter.style.transform = `scaleX(${p})`;
    // current station = the one under the screen centre; the others dim a little
    const cx = tx + vw / 2 - 24;
    // in focus = the station with the largest share of itself on screen; ties go to the one nearer the centre
    let here = null, best = -1, bestOff = Infinity;
    for (const st of stations) {
      if (st.ai && mode !== 'tobe') continue;
      const share = Math.max(0, Math.min(st.x + st.sw, tx + vw) - Math.max(st.x, tx)) / Math.min(st.sw, vw), off = Math.abs(st.x + st.sw / 2 - (tx + vw / 2));
      if (share > best + .02 || (Math.abs(share - best) <= .02 && off < bestOff)) { best = share; bestOff = off; here = st; }
    }
    const shown = stations.filter(st => !st.ai || mode === 'tobe');
    if (tx >= travel - 2) here = shown.at(-1); else if (tx <= 2) here = shown[0]; // the start and the finale own the ends of the ride
    const cur = here?.kind === 'bookend' ? null : here;
    if (here !== lit) {
      lit?.el.classList.remove('is-cur'); here?.el.classList.add('is-cur'); lit = here;
      const b = cur && progress.querySelector(`[data-go="${cur.id}"]`);
      if (b) { const l = b.offsetLeft - progress.offsetLeft; if (l < progress.scrollLeft || l + b.offsetWidth > progress.scrollLeft + progress.clientWidth) progress.scrollLeft = l - 24; }
    }
    progress.querySelectorAll('button').forEach(b => {
      const st = stations.find(x => x.id === b.dataset.go);
      b.toggleAttribute('aria-current', st === cur); if (st === cur) b.setAttribute('aria-current', 'step');
      b.classList.toggle('done', st.x + st.sw / 2 < cx && st !== cur);
    });
    if (cue) cue.hidden = !active || scrollY > vh * .5;
    if (selected) placeDrawer();
  }
  const schedule = () => { if (!frameReq) frameReq = requestAnimationFrame(update); };
  // focus: move keyboard focus to the station too (rail chevrons and the cue, when used from the keyboard)
  function go(target, {instant = false, focus = false} = {}) {
    if (!built) return;
    closeDrawer({restore: false});
    let dist, st = null;
    if (typeof target === 'number') { dist = clamp(target, 0, 1) * pathLen; if (target <= 0) st = stations[0]; }
    else { st = stations.find(x => x.id === target); if (!st) return; dist = distFor(clamp(st.x - 40, 0, travel)); }
    scrollTo({top: topFor(dist), behavior: instant || reduced.matches ? 'instant' : 'smooth'});
    if (focus && st) { skipTravel = true; st.el.focus({preventScroll: true}); skipTravel = false; }
  }
  // back to the organ view: scroll up and hand keyboard focus back to the organ's own Back button
  function toOrgan() {
    closeDrawer({restore: false});
    scrollTo({top: 0, behavior: reduced.matches ? 'instant' : 'smooth'});
    document.querySelector('#back')?.focus({preventScroll: true});
  }
  // Escape, in order: close the detail card, close the legend, leave the journey. False when there is nothing to do here.
  function back() {
    if (!active) return false;
    if (!drawer.hidden) { closeDrawer(); return true; }
    if (!legend.hidden) { legend.hidden = true; legendBtn.setAttribute('aria-expanded', 'false'); legendBtn.focus(); return true; }
    if (built && scrollY > sectionTop() - vh * .5) { toOrgan(); return true; }
    return false;
  }

  // ---------- drawer ----------
  function lookup(id) { const it = items.get(id); return it && it.by[mode] ? {it, n: it.by[mode], f: mode === 'asis' ? it.frame.asis : it.frame.tobe} : null; }
  function activate(id, from) {
    const hit = lookup(id); if (!hit) return;
    selected = id;
    for (const it of items.values()) { const n = it.by[mode]; if (!n) continue; it.btn?.classList.toggle('sel', it.id === id); }
    const {n, f} = hit;
    if (n.kind === 'ch' || n.kind === 'tpi') for (const sid of (n.c.steps || []).map(x => `${f.id}|${x}`)) items.get(sid)?.btn?.classList.add('sel');
    drawer.innerHTML = `<button type="button" class="x" aria-label="Close">✕</button>${drawerHtml(n, f)}`;
    drawer.hidden = false; drawer.dataset.for = id; drawer.returnTo = from || items.get(id)?.btn;
    placeDrawer();
    drawer.querySelector('h3')?.focus({preventScroll: true});
  }
  function openList(title, crumb, list, cls, from) {
    selected = '__list'; drawer.innerHTML = `<button type="button" class="x" aria-label="Close">✕</button><div class="crumb">${esc(crumb)}</div><h3 tabindex="-1">${esc(title)}</h3><div class="${cls}">${list.map(esc).join('<br>')}</div>`;
    drawer.hidden = false; drawer.dataset.for = ''; drawer.returnTo = from; placeDrawer(); drawer.querySelector('h3').focus({preventScroll: true});
  }
  // restore: false when the card closes because of something else (travel, mode switch, leaving): focus must not jump into the map
  function closeDrawer({restore = true} = {}) {
    if (drawer.hidden) return;
    const hadFocus = drawer.contains(document.activeElement);
    drawer.hidden = true; const back = drawer.returnTo; selected = null;
    for (const it of items.values()) it.btn?.classList.remove('sel');
    section.querySelectorAll('.jr-band.sel').forEach(p => p.classList.remove('sel'));
    if (restore) back?.focus?.({preventScroll: true});
    else if (hadFocus) { skipTravel = true; (lit?.el || legendBtn).focus({preventScroll: true}); skipTravel = false; }
  }
  function placeDrawer() {
    if (drawer.hidden) return;
    const el = drawer.dataset.for ? items.get(drawer.dataset.for)?.btn || items.get(drawer.dataset.for)?.el : drawer.returnTo;
    const r = el?.getBoundingClientRect?.() || {left: vw / 2, right: vw / 2, top: vh / 3, bottom: vh / 3};
    if (el && (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh)) return closeDrawer({restore: false}); // its anchor has travelled off screen
    const box = viewport.getBoundingClientRect(), w = drawer.offsetWidth, hgt = drawer.offsetHeight, top0 = rail.offsetHeight + 12;
    let left = r.right - box.left + 14; if (left + w > vw - 12) left = r.left - box.left - w - 14; left = clamp(left, 12, vw - w - 12);
    drawer.style.left = left + 'px'; drawer.style.top = clamp(r.top - box.top, top0, vh - hgt - 52) + 'px';
  }
  const row = (t, v, cls = '') => v ? `<div><dt>${t}</dt><dd class="${cls}">${v}</dd></div>` : '';
  function drawerHtml(n, f) {
    const flow = n.flow ? ` / ${esc(n.flow)}` : '';
    if (n.kind === 'opp' || n.kind === 'fopp') {
      const o = n.opp, pp = [...new Set(n.pp || [])];
      return `<div class="crumb">${esc(f.name)}${flow}</div><h3 tabindex="-1" style="color:var(--jr-ai)">AI Opportunity: ${esc(o.t)}</h3><dl>${row('Type', `<b>${esc(o.ty)}</b>`)}${row('How it would work and tools', esc(o.d), 'opl')}${pp.length ? row('<span style="color:var(--jr-pain)">Pain points it addresses</span>', pp.map(esc).join('<br>'), 'ppl') : ''}${row('Source', `Process Register v3, row ${esc(o.rid)} (hypothesis - needs SME validation)`)}</dl>`;
    }
    if (n.kind === 'ch' || n.kind === 'tpi') {
      const c = n.c, names = (c.steps || []).map(x => lookup(`${f.id}|${x}`)).filter(Boolean).map(h => `<b>${esc(h.n.flow)}</b> · ${esc(h.n.s.n)}. ${esc(h.n.s.t)}`).join('<br>');
      return `<div class="crumb">${esc(f.name)}</div><h3 tabindex="-1" style="color:${n.kind === 'ch' ? '#9E1218' : '#13643a'}">${n.kind === 'ch' ? '[CHALLENGE] Pain point' : `[SOLUTION] ${esc(c.st || 'TPI')}`}</h3><p>${esc(c.t)}</p><dl>${row(n.kind === 'ch' ? 'Where it hits (highlighted on the map)' : 'Steps it addresses (highlighted on the map)', names)}${row('Reference', esc(c.ref))}${row('Source', `O2C process register v3, row O2C-01.02 (${n.kind === 'ch' ? 'pain points' : 'CI / TPI'} column)`)}</dl>`;
    }
    if (n.kind === 'dec') {
      const q = n.dec;
      return `<div class="crumb">${esc(f.name)}${flow}</div><h3 tabindex="-1" style="color:var(--jr-purple)">Decision: ${esc(q.q)}</h3>${q.d ? `<p>${esc(q.d)}</p>` : ''}<dl>${row('Example', q.ex ? `<i>${esc(q.ex)}</i>` : '')}${row('Checked by', esc(q.o))}${row('System', esc(q.sys))}${row('If yes', esc(q.yes))}${row('If no', esc(q.no))}${q.pp?.length ? row('<span style="color:var(--jr-pain)">Pain point when the answer is no</span>', q.pp.map(esc).join('<br>'), 'ppl') : ''}${row('Source', esc(q.src))}</dl>`;
    }
    const s = n.s, ownc = o => String(o || '').split(/\s\/\s|,\s*/).map(x => `<span class="own" style="${partyVars(x)}"><i></i>${esc(x)}</span>`).join('');
    let h = `<div class="crumb">${esc(f.name)}${flow} (${esc(n.proc)})</div><h3 tabindex="-1">${esc(s.n)}. ${esc(s.t)}</h3><p>${esc(s.d)}</p><dl>`;
    h += row('Who', ownc(s.o)) + row('System', esc(s.sys)) + row('Activity type', `<b style="color:var(--jr-${s.ty})">${TYNM[s.ty]}</b>${s.was ? ` <small>(as-is: ${TYNM[s.was]})</small>` : ''}`);
    if (s.in?.length) h += row('Input from', s.in.map(x => `<b>${esc(x[0])}</b>: ${esc(x[1])}`).join('<br>'));
    if (s.out?.length) h += row('Output to', s.out.map(x => `<b>${esc(x[0])}</b>: ${esc(x[1])}`).join('<br>'));
    if (s.ctl) h += row('Control', esc(s.ctl));
    if (s.pp?.length) h += row('<span style="color:var(--jr-pain)">Pain points</span>', s.pp.map(esc).join('<br>'), 'ppl');
    if (s.ci) h += row('Existing CI / TPI', esc(s.ci));
    if (mode === 'tobe' && s.ch && s.ch !== 'same') h += row('<span style="color:var(--jr-ai)">AI suggestion (hypothesis, to validate)</span>', `<b>${esc(s.rec || '')}</b><br>Tools: ${esc(s.tools || '')}<br><small>Basis: ${esc(s.opp || '')}</small>`, 'opl');
    h += row('Source', esc(s.src)) + '</dl>';
    if (mode === 'tobe' && (!s.ch || s.ch === 'same')) h += '<p class="none">No change proposed for this step.</p>';
    return h;
  }
  function bandDetail(i, el) {
    const b = data.handoffs.bands[i], m = b.title.match(/^(.*?) → (.*?): (.*)$/) || [null, b.title, '', ''];
    section.querySelectorAll('.jr-band').forEach(p => p.classList.toggle('sel', p === el));
    selected = '__band'; drawer.innerHTML = `<button type="button" class="x" aria-label="Close">✕</button><div class="crumb">Handoffs</div><h3 tabindex="-1">${esc(m[1])} → ${esc(m[2])}</h3><p>${esc(m[3])}</p><dl>${row('Source', 'As documented by O2C')}</dl>`;
    drawer.hidden = false; drawer.dataset.for = ''; drawer.returnTo = el; placeDrawer(); drawer.querySelector('h3').focus({preventScroll: true});
  }
  function aiOppDetail(i, el) {
    const o = data.ai.opps[i];
    selected = '__opp'; drawer.innerHTML = `<button type="button" class="x" aria-label="Close">✕</button><div class="crumb">${esc(o.lvl)} level · ${esc(o.where)}</div><h3 tabindex="-1" style="color:var(--jr-ai)">${esc(o.t)}</h3><dl>${row('Type', `<b>${esc(o.ty)}</b>`)}${row('How it would work and tools', esc(o.d), 'opl')}${row('Source', `Process Register v3, row ${esc(o.rid)} (hypothesis - needs SME validation)`)}</dl>`;
    drawer.hidden = false; drawer.dataset.for = ''; drawer.returnTo = el; placeDrawer(); drawer.querySelector('h3').focus({preventScroll: true});
  }

  // ---------- events ----------
  section.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('.jr-drawer .x')) return closeDrawer();
    if (t.closest('.jr-drawer')) return;
    const goBtn = t.closest('[data-go]'); if (goBtn) return go(goBtn.dataset.go, {focus: e.detail === 0});
    const modeBtn = t.closest('.jr-mode button'); if (modeBtn) return setMode(modeBtn.dataset.mode);
    const fBtn = t.closest('.jr-filters button'); if (fBtn) return setFilter(fBtn.dataset.f);
    if (t.closest('.jr-legend-btn')) { legend.hidden = !legend.hidden; legendBtn.setAttribute('aria-expanded', String(!legend.hidden)); return; }
    if (t.closest('#journey-back') || t.closest('.jr-totop')) return toOrgan();
    if (t.closest('.jr-loading button')) { loadPromise = null; return open(currentOrgan, true); }
    const hd = t.closest('.hd');
    if (hd) { const ph = phaseEls.get(hd.closest('.jr-phase').dataset.station); const f = mode === 'asis' ? ph.fa : ph.ft; return hd.dataset.hd === 'pp' ? openList('Pain points', f.name, f.pp, 'ppl', hd) : openList('Controls', f.name, f.ctl, '', hd); }
    const band = t.closest('.jr-band'); if (band) return bandDetail(+band.dataset.band, band);
    const aiopp = t.closest('[data-aiopp]'); if (aiopp) return aiOppDetail(+aiopp.dataset.aiopp, aiopp);
    const node = t.closest('[data-id]'); if (node && items.has(node.dataset.id)) return activate(node.dataset.id, node);
    if (!drawer.hidden && !t.closest('.jr-rail')) closeDrawer();
  });
  section.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); if (!back()) toOrgan(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('jr-band')) { e.preventDefault(); bandDetail(+e.target.dataset.band, e.target); }
  });
  // keep keyboard focus on screen: travel (sideways, and down into a dip) to the focused node. Mouse focus never moves the map.
  track.addEventListener('focusin', e => {
    if (!built || skipTravel || e.target.classList?.contains('jr-station') || !e.target.matches?.(':focus-visible')) return;
    const r = e.target.getBoundingClientRect(), top0 = rail.offsetHeight + 8, bottom = vh - 60;
    const okX = r.left >= vw * .12 && r.right <= vw * .88, okY = r.top >= top0 && r.bottom <= bottom;
    if (okX && okY) return;
    const wantTx = okX ? tx : clamp(tx + (r.left - vw * .3), 0, travel);
    const wantTy = okY ? ty : Math.max(0, ty + (r.bottom > bottom ? r.bottom - bottom + 16 : r.top - top0 - 16));
    scrollTo({top: topFor(distFor(wantTx, wantTy)), behavior: 'instant'});
  });
  addEventListener('scroll', schedule, {passive: true});
  // keep the place on resize, but only when the visitor is actually in the journey (else the organ view would be scrolled away)
  new ResizeObserver(() => {
    if (!active || !built) return;
    const inside = scrollY >= sectionTop() - 1, p = clamp((scrollY - sectionTop()) / range(), 0, 1);
    measure(); if (inside) scrollTo({top: sectionTop() + p * range(), behavior: 'instant'});
  }).observe(viewport);
  document.fonts?.ready.then(() => { if (built) measure(); });

  // The galaxy (galaxy.js) is painted once, after the map is on screen: the unwell sky first, the healed one when the browser is idle.
  // Until then the CSS gradient underneath stands in.
  function paintSky() {
    if (skyPainted) return; skyPainted = true;
    fx = createFx($('.jr-fx', section));
    const idle = cb => (window.requestIdleCallback ? requestIdleCallback(cb, {timeout: 1500}) : setTimeout(cb, 300));
    const sky = window.__journeySky = {};
    const add = async mood => { const t0 = performance.now(), c = await paintNebula(mood); c.className = `neb ${mood}`; bg.append(c); requestAnimationFrame(() => c.classList.add('ready')); sky[mood] = Math.round(performance.now() - t0); };
    {
      const t0 = performance.now();
      paintDust().toBlob(blob => { if (blob) stars.style.backgroundImage = `url(${URL.createObjectURL(blob)})`; }); // PNG encoding happens off the main thread
      sky.dust = Math.round(performance.now() - t0);
      add('sick').then(() => idle(() => add('healed'))); schedule();
    }
  }

  // ---------- public API ----------
  let currentOrgan = null;
  function open(organId, retry = false) {
    if (!maps[organId]) return false;
    currentOrgan = organId; active = true; section.hidden = false;
    if (!cue) {
      const tools = document.querySelector('#detail .rotate-tools');
      if (tools) { cue = document.createElement('button'); cue.type = 'button'; cue.className = 'jr-cue'; cue.innerHTML = 'Scroll for the process map <span aria-hidden="true">↓</span>'; cue.onclick = e => go(0, {focus: e.detail === 0}); tools.append(cue); }
    }
    if (cue) cue.hidden = false;
    if (!built) {
      loading.hidden = false; loading.innerHTML = 'Loading the Order to Cash map…';
      // build only while open: a hidden section measures every natural-height station as 0
      load(maps[organId]).then(json => { data = json; if (!active) return; if (!built) build(); loading.hidden = true; measure(); mountBookend(); })
        .catch(err => { console.error('journey', err); loadPromise = null; if (!active) return; loading.hidden = false; loading.innerHTML = 'The process map could not load. <button type="button">Retry</button>'; status.textContent = 'The process map could not load.'; });
    } else { measure(); mountBookend(); }
    return true;
  }
  function close() {
    if (!active) return;
    active = false; closeDrawer({restore: false});
    if (cue) cue.hidden = true;
    if (bookend) { bookend.destroy(); bookend = null; const host = $('.jr-start .organ', track); if (host) host.innerHTML = ''; }
    if (scrollY > 0) scrollTo({top: 0, behavior: 'instant'});
    section.hidden = true;
  }
  function setMode(m) {
    if (m === mode || !['asis', 'tobe'].includes(m)) return;
    // keep the station under the screen centre where it is
    const cx = tx + vw / 2 - 24, cur = stations.find(st => (!st.ai || mode === 'tobe') && cx >= st.x && cx <= st.x + st.sw), rel = cur ? (cx - cur.x) / cur.sw : 0;
    mode = m; closeDrawer({restore: false}); applyMode(true);
    if (cur && (!cur.ai || mode === 'tobe')) { const want = clamp(cur.x + rel * cur.sw - vw / 2 + 24, 0, travel); scrollTo({top: topFor(distFor(want)), behavior: 'instant'}); }
  }
  function setFilter(f) {
    filter = f; section.dataset.f = f;
    section.querySelectorAll('.jr-filters button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
    const n = f === 'all' ? null : [...items.values()].filter(it => { const x = it.by[mode]; if (!x || x.kind !== 'step') return false; return f === 'pain' ? x.s.pp?.length : f === 'tpi' ? x.tpi : x.s.ty === f; }).length;
    status.textContent = n === null ? (mode === 'tobe' ? 'AI suggested map.' : 'As-Is map.') : `Showing ${{man: 'manual', hyb: 'semi-automated', auto: 'automated', pain: 'pain-point', tpi: 'TPI-touched'}[f]} steps (${n}).`;
  }
  return {
    open, close, setMode, setFilter, go, back,
    get active() { return active; },
    ready: () => readyPromise,
    stationRect: id => stations.find(st => st.id === id)?.el.getBoundingClientRect(),
    state: () => ({mode, filter, s, trackW: parseFloat(track.style.width) || 0, travel, pathLen, tx, ty, stations: stations.map(st => ({id: st.id, x: st.x, w: st.sw, h: st.sh, k: st.k}))}),
  };
}
