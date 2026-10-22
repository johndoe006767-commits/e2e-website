// Overview tower cards: the manual / semi-automated / automated step mix, pain points and TPIs.
// The numbers come from TOWER_HEALTH in scene.js, the same figures the zoomed-in vital-signs panel shows.
import {towerColors, AZ} from './organs.js?v=20261023-o2c10';

export const accentFor = id => towerColors[id]?.base || AZ.platinum;
export const inkFor = id => towerColors[id]?.cardText || AZ.graphite;

const whole = value => Number.isInteger(value) && value >= 0 ? value : null;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const width = n => `${String(n).length}ch`;
const SEGMENTS = [['man', 'manual', 'Manual'], ['hyb', 'semi', 'Semi-automated'], ['auto', 'automated', 'Automated']];

// Accepts one TOWER_HEALTH entry: {manual, semi, auto, tpis, pain}. Missing values show as TBC.
export function healthMetrics(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const steps = {manual: whole(entry.manual), semi: whole(entry.semi), automated: whole(entry.auto)};
  const known = steps.manual !== null && steps.semi !== null && steps.automated !== null;
  return {
    steps: known ? {...steps, total: steps.manual + steps.semi + steps.automated} : null,
    pain: whole(entry.pain),
    tpis: whole(entry.tpis),
  };
}

// The visual bar is aria-hidden, so the same numbers are given to screen readers in words.
export function metricsSentence(m) {
  if (!m) return '';
  return [
    m.steps ? `${m.steps.total} steps: ${m.steps.manual} manual, ${m.steps.semi} semi-automated, ${m.steps.automated} automated` : 'Step mix to be confirmed',
    m.pain === null ? 'Pain points to be confirmed' : plural(m.pain, 'pain point', 'pain points'),
    m.tpis === null ? 'TPIs to be confirmed' : plural(m.tpis, 'TPI', 'TPIs'),
  ].join('. ') + '.';
}

function barMarkup(m) {
  if (!m.steps) return '<span class="hb-bar hb-bar-tbc"></span>';
  const segments = SEGMENTS.filter(([, key]) => m.steps[key] > 0)
    .map(([k, key]) => `<span class="hb-seg" data-k="${k}" style="--n:${m.steps[key]}"></span>`).join('');
  return `<span class="hb-bar"><span class="hb-fill">${segments}</span></span>`;
}

function countsMarkup(m) {
  if (!m.steps) return '<span class="hb-row hb-row-tbc">Step mix TBC</span>';
  return `<span class="hb-row">${SEGMENTS.map(([k, key]) =>
    `<span class="hb-n" data-k="${k}"><i></i><b data-v="${m.steps[key]}" style="min-width:${width(m.steps[key])}">${m.steps[key]}</b></span>`).join('')}</span>`;
}

function pillsMarkup(m) {
  const pain = m.pain === null
    ? '<span class="hb-pill hb-pp hb-tbc"><b>!</b>TBC</span>'
    : `<span class="hb-pill hb-pp"><b>!</b><em data-v="${m.pain}" style="min-width:${width(m.pain)}">${m.pain}</em><span class="w">&nbsp;pain ${m.pain === 1 ? 'point' : 'points'}</span></span>`;
  const tpi = m.tpis === null
    ? '<span class="hb-pill hb-tpi hb-tbc"><b>TPI</b>TBC</span>'
    : `<span class="hb-pill hb-tpi"><b>TPI</b><em data-v="${m.tpis}" style="min-width:${width(m.tpis)}">${m.tpis}</em></span>`;
  return `<span class="hb-pills">${pain}${tpi}</span>`;
}

// Body of an overview card. Inline elements only, because it sits inside a <button>.
export function cardMarkup(m, delay) {
  return `<span class="hb${m.steps ? '' : ' hb-nosteps'}" aria-hidden="true" style="--d:${Math.round(delay)}ms">${barMarkup(m)}${countsMarkup(m)}${pillsMarkup(m)}</span>`;
}

export function legendMarkup(note) {
  return SEGMENTS.map(([k, , label]) => `<span class="hb-key" data-k="${k}"><i></i>${label}</span>`).join('')
    + '<span class="hb-key hb-key-pp"><b>!</b>Pain points</span><span class="hb-key hb-key-tpi"><b>TPI</b>Targeted Process Improvements</span>'
    + (note ? `<span class="hb-key-note">${note}</span>` : '');
}

// Numbers count up while the bar charges. Reduced motion shows the final values at once.
export function countUp(root, reduced) {
  const values = [...root.querySelectorAll('[data-v]')];
  cancelAnimationFrame(root._hbFrame);
  if (reduced) {
    values.forEach(el => { el.textContent = el.dataset.v; });
    return;
  }
  const start = performance.now() + (parseFloat(root.style.getPropertyValue('--d')) || 0), duration = 720;
  values.forEach(el => { el.textContent = '0'; });
  const tick = now => {
    const t = Math.min(1, Math.max(0, (now - start) / duration)), eased = 1 - Math.pow(1 - t, 3);
    values.forEach(el => { el.textContent = String(Math.round(Number(el.dataset.v) * eased)); });
    if (t < 1) root._hbFrame = requestAnimationFrame(tick);
  };
  root._hbFrame = requestAnimationFrame(tick);
}

export function resetCounts(root) {
  cancelAnimationFrame(root._hbFrame);
  root.querySelectorAll('[data-v]').forEach(el => { el.textContent = el.dataset.v; });
}
