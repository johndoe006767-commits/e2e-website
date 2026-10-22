// Painted galaxy backdrop for the O2C journey, after the AstraZeneca silhouette imagery (ppt material, Picture6-14):
// cloudy violet nebula with magenta / cyan veils and bright filaments, warm light hotspots, clustered sparkle dust,
// a few cross-flare glints and soft out-of-focus "cells" floating at different depths.
// Everything is painted once on 2D canvases (no WebGL); the journey only moves the layers.

// Two moods: the As-Is map is the organ unwell (warm magenta-red, Picture12-14), AI suggested is healed (cool cyan-violet, Picture10-11).
export const MOODS = {
  sick: {veil: .55, base0: [8, 4, 16], base1: [36, 10, 52], veilA: [150, 12, 96], veilB: [176, 26, 64], fil: [255, 140, 205], hot: [[.74, .66, .13, [255, 150, 50], .55], [.3, .3, .12, [220, 40, 140], .4], [.92, .18, .1, [150, 70, 210], .35]]},
  healed: {veil: .6, base0: [4, 6, 18], base1: [20, 16, 58], veilA: [34, 140, 178], veilB: [80, 30, 130], fil: [180, 240, 248], hot: [[.72, .62, .14, [130, 232, 245], .55], [.28, .32, .12, [196, 214, 0], .22], [.92, .18, .1, [120, 90, 220], .4]]},
};

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function makeNoise(seed) {
  const r = rng(seed), perm = new Uint8Array(512), val = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const at = (x, y) => val[perm[(x & 255) + perm[y & 255]]];
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 5) => { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= .5; f *= 2.03; } return s / n; };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The nebula: domain-warped fbm for the cloud density, a second field choosing between the two veil colours,
// ridged noise for the bright filaments, gaussian light hotspots and a vignette.
// Painted in slices of rows, yielding to the browser every ~10 ms, so opening the map never stutters.
export async function paintNebula(mood, {w = 1280, h = 512, seed = 11} = {}) {
  const m = MOODS[mood], fbm = makeNoise(seed), c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), px = img.data, k = 2.4 / h;
  let slice = performance.now();
  for (let y = 0; y < h; y++) {
    if (performance.now() - slice > 10) { await new Promise(r => setTimeout(r)); slice = performance.now(); }
    for (let x = 0; x < w; x++) {
    const X = x * k, Y = y * k;
    const qx = fbm(X, Y, 4), qy = fbm(X + 5.2, Y + 1.3, 4);
    const n = fbm(X + 1.9 * qx + 1.7, Y + 1.9 * qy + 9.2, 5);
    const t = fbm(X * .6 + 8.1, Y * .6 + 3.3, 3);
    const ridge = 1 - Math.abs(2 * fbm(X * 2.2 + qx * 2, Y * 2.2 + qy * 2, 4) - 1), fil = ridge ** 7 * smooth(.42, .75, n);
    // a slow mask keeps the light in a few clouds, like the AZ imagery, with deep violet between them
    const mask = smooth(.38, .72, fbm(X * .32 + 3.1, Y * .32 + 7.4, 3));
    const dens = smooth(.3, .62, n), veil = smooth(.46, .82, n) * (.25 + .75 * mask) * m.veil, mix = smooth(.4, .62, t);
    let r = m.base0[0] + (m.base1[0] - m.base0[0]) * dens, gg = m.base0[1] + (m.base1[1] - m.base0[1]) * dens, b = m.base0[2] + (m.base1[2] - m.base0[2]) * dens;
    const vr = m.veilA[0] + (m.veilB[0] - m.veilA[0]) * mix, vg = m.veilA[1] + (m.veilB[1] - m.veilA[1]) * mix, vb = m.veilA[2] + (m.veilB[2] - m.veilA[2]) * mix;
    r += vr * veil; gg += vg * veil; b += vb * veil;
    r += m.fil[0] * fil * .4 * mask; gg += m.fil[1] * fil * .4 * mask; b += m.fil[2] * fil * .4 * mask;
    for (const [hx, hy, hr, col, s] of m.hot) {
      const dx = (x / w - hx) * (w / h), dy = y / h - hy, e = Math.exp(-(dx * dx + dy * dy) / (hr * hr)) * s * (.55 + .9 * n);
      r += col[0] * e; gg += col[1] * e; b += col[2] * e;
    }
    const vx = (x / w - .5) * 1.6, vy = (y / h - .5) * 1.9, vig = 1 - .6 * smooth(.35, 1.15, Math.sqrt(vx * vx + vy * vy));
    const i = (y * w + x) * 4;
    px[i] = Math.min(255, r * vig); px[i + 1] = Math.min(255, gg * vig); px[i + 2] = Math.min(255, b * vig); px[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Sparkle dust as a seamless tile: thousands of fine specks clustered in drifting bands, a few brighter stars with halos.
export function paintDust({size = 1024, seed = 5} = {}) {
  const r = rng(seed), c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), TAU = Math.PI * 2;
  const band = (x, y) => .5 + .25 * Math.sin(TAU * (x / size * 2 + y / size)) + .25 * Math.cos(TAU * (y / size * 3 - x / size));
  const dot = (x, y, rad, col) => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { const X = x + ox, Y = y + oy; if (X < -12 || X > size + 12 || Y < -12 || Y > size + 12) continue; g.fillStyle = col; g.beginPath(); g.arc(X, Y, rad, 0, TAU); g.fill(); } };
  const halo = (x, y, rad, rgb, a) => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { const X = x + ox, Y = y + oy; if (X < -rad || X > size + rad || Y < -rad || Y > size + rad) continue; const gr = g.createRadialGradient(X, Y, 0, X, Y, rad); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(.25, `rgba(${rgb},${a * .35})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2); } };
  const tints = ['255,255,255', '207,240,255', '160,226,240', '255,190,230', '255,220,240'];
  for (let i = 0; i < 4200; i++) {
    const x = r() * size, y = r() * size; if (r() > band(x, y) ** 1.6) continue;
    dot(x, y, .35 + r() * .7, `rgba(${tints[Math.floor(r() * tints.length)]},${.25 + r() * .6})`);
  }
  for (let i = 0; i < 70; i++) { const x = r() * size, y = r() * size, t = tints[Math.floor(r() * tints.length)]; halo(x, y, 3 + r() * 5, t, .5 + r() * .4); dot(x, y, .8 + r() * .7, `rgba(${t},1)`); }
  return c;
}

// Near layer: a few out-of-focus cells (bokeh) and cross-flare glints as DOM elements, each with its own parallax depth.
export function createFx(host, {seed = 9} = {}) {
  const r = rng(seed), els = [];
  const cells = [['255,130,200', 160], ['255,120,150', 120], ['170,236,245', 140], ['230,140,210', 200], ['255,210,120', 70], ['170,236,245', 90], ['255,130,200', 60], ['255,120,150', 110], ['200,170,255', 150], ['170,236,245', 56], ['255,150,215', 230]];
  for (const [rgb, s] of cells) {
    const el = document.createElement('i'); el.className = 'bokeh';
    el.style.cssText = `--s:${s}px;--c:${rgb};--b:${(s / 40).toFixed(1)}px;opacity:${(.12 + r() * .16).toFixed(2)}`;
    els.push({el, x: r(), y: .08 + r() * .84, speed: .05 + (s / 230) * .14}); host.append(el);
  }
  for (let i = 0; i < 9; i++) {
    const el = document.createElement('i'); el.className = 'glint';
    const s = 26 + r() * 46;
    el.style.cssText = `--s:${s.toFixed(0)}px;--tw:${(3 + r() * 4).toFixed(1)}s;--dl:${(-r() * 6).toFixed(1)}s`;
    els.push({el, x: r(), y: .06 + r() * .88, speed: .07 + r() * .05}); host.append(el);
  }
  return {
    update(tx, ty, vw, vh) {
      const pad = 260, W = vw + pad * 2;
      for (const e of els) {
        const x = (((e.x * W - tx * e.speed) % W) + W) % W - pad, y = e.y * vh - ty * e.speed;
        e.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      }
    },
  };
}
