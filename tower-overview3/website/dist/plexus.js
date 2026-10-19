import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

// AstraZeneca "plexus": 1 px lines joining soft dots, wrapping part of an organ and dissolving into dust
// (brand images Picture1-5). Two draw calls per organ; drawn with normal blending so it reads on the light page.
const vertexShader = /* glsl */`
attribute float aSeed;
attribute float aDust;
uniform float uTime;
uniform float uDrift;
uniform float uSize;
uniform float uPixelRatio;
uniform float uPointMax;
varying float vA;
void main() {
  float wave = 0.5 + 0.5 * sin(uTime * 0.7 + aSeed * 6.2832);
  vec3 p = position + normal * wave * uDrift * (0.3 + aDust);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vA = (0.75 + 0.25 * sin(uTime * 1.3 + aSeed * 12.0)) * (aDust > 0.5 ? 0.5 : 1.0);
  gl_PointSize = min(uSize * uPixelRatio * (aDust > 0.5 ? 0.55 : 1.0) * (0.7 + 0.6 * fract(aSeed * 7.0)), uPointMax);
}`;
const pointFragment = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFade;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.55, 1.0, d);
  gl_FragColor = vec4(uColor, a * vA * uOpacity * uFade);
  #include <colorspace_fragment>
}`;
const lineFragment = /* glsl */`
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFade;
varying float vA;
void main() {
  gl_FragColor = vec4(uColor, uOpacity * uFade * mix(0.8, 1.0, vA));
  #include <colorspace_fragment>
}`;

export const PLEXUS_PRESETS = {
  organ: { nodes: 180, dust: 90, k: 3, radius: 0.17 },
  brain: { nodes: 220, dust: 80, k: 3, radius: 0.15 },
  heart: { nodes: 420, dust: 120, k: 4, radius: 0.12 },
};

/** meshes share one parent; `unit` = the organ's largest dimension in that parent's units.
 *  `look` holds uniforms shared with the organ's glass (uFade, uTime, uSize, uPixelRatio, uPointMax). */
export function createPlexus({ meshes, unit, seed = 1, lineColor, dotColor, look, preset = PLEXUS_PRESETS.organ, scale = 1 }) {
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const nodes = Math.max(24, Math.round(preset.nodes * scale)), dustCount = Math.round(preset.dust * scale);
  const box = new THREE.Box3();
  for (const mesh of meshes) { mesh.geometry.computeBoundingBox(); box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix)); }
  const centre = box.getCenter(new THREE.Vector3());
  const cap = new THREE.Vector3(random() - 0.5, random() * 0.6, random() - 0.2).normalize(); // partial wrap, as in the brand images
  const samplers = meshes.map(mesh => ({ mesh, sampler: new MeshSurfaceSampler(mesh).setRandomGenerator(random).build(), weight: mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count }));
  const total = samplers.reduce((s, x) => s + x.weight, 0);
  const pick = () => { let r = random() * total; for (const s of samplers) { if ((r -= s.weight) <= 0) return s; } return samplers[samplers.length - 1]; };
  const p = new THREE.Vector3(), n = new THREE.Vector3(), dir = new THREE.Vector3();
  const sample = () => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const s = pick(); s.sampler.sample(p, n); p.applyMatrix4(s.mesh.matrix); n.transformDirection(s.mesh.matrix);
      const keep = THREE.MathUtils.smoothstep(dir.copy(p).sub(centre).normalize().dot(cap), -0.2, 0.6);
      if (random() < keep) return true;
    }
    return true;
  };
  const pos = [], nor = [], seeds = [], dust = [];
  for (let i = 0; i < nodes + dustCount; i++) {
    sample();
    const isDust = i >= nodes;
    const lift = isDust ? (0.05 + 0.17 * random()) * unit : 0.012 * unit;
    const q = p.clone().addScaledVector(n, lift);
    if (isDust) q.add(new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.1 * unit));
    pos.push(q.x, q.y, q.z); nor.push(n.x, n.y, n.z); seeds.push(random()); dust.push(isDust ? 1 : 0);
  }
  // k nearest neighbours within a radius among net nodes, plus a few tails into the dust.
  const at = i => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const edges = new Set(), maxD = (preset.radius * unit) ** 2;
  for (let i = 0; i < nodes; i++) {
    const a = at(i), near = [];
    for (let j = 0; j < nodes; j++) if (j !== i) { const d = a.distanceToSquared(at(j)); if (d < maxD) near.push([d, j]); }
    near.sort((x, y) => x[0] - y[0]);
    for (const [, j] of near.slice(0, preset.k)) edges.add(i < j ? `${i}:${j}` : `${j}:${i}`);
    if (dustCount && random() < 0.3) {
      let best = -1, bd = Infinity;
      for (let j = nodes; j < nodes + dustCount; j++) { const d = a.distanceToSquared(at(j)); if (d < bd) { bd = d; best = j; } }
      if (best >= 0 && bd < maxD * 2.5) edges.add(`${i}:${best}`);
    }
  }
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pointGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  pointGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  pointGeometry.setAttribute('aDust', new THREE.Float32BufferAttribute(dust, 1));
  const lp = [], ln = [], ls = [], ld = [];
  for (const e of edges) for (const i of e.split(':').map(Number)) {
    lp.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); ln.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); ls.push(seeds[i]); ld.push(dust[i]);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lineGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3));
  lineGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(ls, 1));
  lineGeometry.setAttribute('aDust', new THREE.Float32BufferAttribute(ld, 1));
  const shared = { uTime: look.uTime, uSize: look.uSize, uPixelRatio: look.uPixelRatio, uPointMax: look.uPointMax, uFade: look.uPlexus, uDrift: { value: 0.006 * unit } };
  const material = (fragmentShader, color, opacity) => new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader, fragmentShader, transparent: true, blending: THREE.NormalBlending, depthTest: true, depthWrite: false, toneMapped: false,
  });
  const points = new THREE.Points(pointGeometry, material(pointFragment, dotColor, 0.85));
  const lines = new THREE.LineSegments(lineGeometry, material(lineFragment, lineColor, 0.5));
  points.renderOrder = 6; lines.renderOrder = 5;
  const group = new THREE.Group();
  group.name = 'Plexus';
  group.add(lines, points);
  group.raycast = () => false; // never part of organ picking
  for (const o of [points, lines]) { o.raycast = () => {}; o.frustumCulled = false; }
  return group;
}
