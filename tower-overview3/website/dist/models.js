import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { organs, loadOrganGeometry, colorsFor } from './organs.js?v=20261019-az';
import { createNeuronNetwork } from './neurons.js?v=20261019-az';
import { createPlexus, PLEXUS_PRESETS } from './plexus.js?v=20261019-az';
export const replacementModels = new Map();

// ---------- AstraZeneca glass (brand images Picture1-5) ----------
// Normal blending (the old additive glow washed out on the light page), toneMapped:false and the
// colour-space chunk so a brand hex renders as that hex. The camera is orthographic: the view vector is constant.
const glassVertex = /* glsl */`
varying vec3 vN;
varying vec3 vObj;
void main() {
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vObj = position;
  gl_Position = projectionMatrix * p;
}`;
const glassFront = /* glsl */`
uniform vec3 uFace;
uniform vec3 uBase;
uniform vec3 uShadow;
uniform vec3 uHighlight;
uniform float uAlphaFace;
uniform float uAlphaRim;
uniform float uRimPower;
uniform float uInk;
uniform float uInvSize;
uniform float uFade;
uniform float uOnDark;
varying vec3 vN;
varying vec3 vObj;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 n = normalize(vN);
  vec3 V = vec3(0.0, 0.0, 1.0);
  float NdV = clamp(dot(n, V), 0.0, 1.0);
  float thick = 1.0 - NdV;                         // pseudo-thickness: 0 face-on, 1 at the silhouette
  float rim = pow(thick, uRimPower);
  vec3 tint = mix(uFace, uBase, smoothstep(0.05, 0.55, thick));
  tint = mix(tint, uShadow, smoothstep(0.55, 0.98, thick));
  vec3 q = vObj * uInvSize;                        // organ-size units, so mm and m models get the same ink
  float ink = vnoise(q * 2.6 + 3.1) * 0.65 + vnoise(q * 6.1 + 7.7) * 0.35;
  tint = mix(tint, uShadow, uInk * smoothstep(0.42, 0.9, ink) * (0.25 + 0.75 * thick));
  vec3 L1 = normalize(vec3(-0.45, 0.80, 0.55)), L2 = normalize(vec3(0.70, 0.15, 0.70));
  float s1 = pow(max(dot(n, normalize(L1 + V)), 0.0), 110.0);
  float s2 = pow(max(dot(n, normalize(L2 + V)), 0.0), 36.0) * 0.30;
  vec3 R = reflect(-V, n);
  float band = smoothstep(0.20, 0.45, R.y) * (1.0 - smoothstep(0.55, 0.85, R.y));
  float spec = s1 + s2 + 0.22 * band;
  // Inside the dark body (uOnDark = 1) the organ reads as light emitted in the fill, not as dim glass.
  tint = mix(tint, mix(tint, vec3(1.0), 0.35), uOnDark * (1.0 - thick));
  vec3 col = tint + uHighlight * spec + vec3(0.62, 0.85, 0.95) * rim * 0.55 * uOnDark;
  float alpha = mix(mix(uAlphaFace, uAlphaFace + 0.3, uOnDark), uAlphaRim, rim) + 0.55 * spec;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0) * uFade);
  #include <colorspace_fragment>
}`;
const glassBack = /* glsl */`
uniform vec3 uShadow;
uniform float uAlpha;
uniform float uFade;
varying vec3 vN;
varying vec3 vObj;
void main() {
  float NdV = abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0)));
  float a = uAlpha * (0.35 + 0.65 * pow(1.0 - NdV, 1.6));
  gl_FragColor = vec4(uShadow, a * uFade);
  #include <colorspace_fragment>
}`;

/** Uniforms one organ's glass, plexus and halo share, so scene.js can fade and size them in one place. */
export function createLook() {
  return { uFade: { value: 1 }, uOnDark: { value: 0 }, uPlexus: { value: 0.35 }, uTime: { value: 0 }, uSize: { value: 2 }, uPixelRatio: { value: 1 }, uPointMax: { value: 64 } };
}
export function glassMaterials(colors, unit, look, { alphaFace = 0.5, alphaRim = 0.92, rimPower = 2.2 } = {}) {
  const front = new THREE.ShaderMaterial({
    uniforms: {
      uFace: { value: new THREE.Color(colors.face) }, uBase: { value: new THREE.Color(colors.base) }, uShadow: { value: new THREE.Color(colors.shadow) },
      uHighlight: { value: new THREE.Color(colors.highlight) }, uAlphaFace: { value: alphaFace }, uAlphaRim: { value: alphaRim }, uRimPower: { value: rimPower },
      uInk: { value: colors.ink }, uInvSize: { value: 1 / unit }, uFade: look.uFade, uOnDark: look.uOnDark,
    },
    vertexShader: glassVertex, fragmentShader: glassFront, transparent: true, blending: THREE.NormalBlending,
    depthWrite: false, depthTest: true, side: THREE.FrontSide, toneMapped: false,
  });
  const back = new THREE.ShaderMaterial({
    uniforms: { uShadow: { value: new THREE.Color(colors.shadow) }, uAlpha: { value: colors.backAlpha }, uFade: look.uFade },
    vertexShader: glassVertex, fragmentShader: glassBack, transparent: true, blending: THREE.NormalBlending,
    depthWrite: false, depthTest: false, side: THREE.BackSide, toneMapped: false,
  });
  return { front, back };
}
// Colour-less nearest-surface pass, shared by every organ: only the nearest glass surface is shaded.
// Same vertex shader as the glass front pass; the depth bias is the only margin between them.
export const cortexDepth = new THREE.ShaderMaterial({
  vertexShader: glassVertex,
  fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
  colorWrite: false, depthWrite: true, side: THREE.FrontSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
const noPick = () => {};
/** Turns a surface mesh into the glass: front pass on the mesh itself (renderOrder 3), depth and back children. */
export function applyGlass(mesh, glass, order = 3) {
  mesh.material = glass.front;
  mesh.renderOrder = order;
  const depth = new THREE.Mesh(mesh.geometry, cortexDepth); depth.renderOrder = 2; depth.raycast = noPick; mesh.add(depth);
  const back = new THREE.Mesh(mesh.geometry, glass.back); back.renderOrder = 0; back.raycast = noPick; mesh.add(back);
}
function stripped(geometry, matrix) {
  const g = geometry.clone();
  if (matrix) g.applyMatrix4(matrix);
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
  g.morphAttributes = {};
  return g;
}
function mergeAll(geometries) {
  const indexed = geometries.every(g => g.index);
  const parts = indexed ? geometries : geometries.map(g => g.index ? g.toNonIndexed() : g);
  const merged = mergeGeometries(parts, false);
  geometries.forEach(g => g.dispose());
  return merged;
}

const plexusScale = () => (innerWidth < 768 ? 0.5 : 1);

export async function loadReplacement(id) {
 let root, network, plexus;
 const colors = colorsFor(id);
 const look = createLook();
 if (id === 'brain') {
  const brain = new THREE.Group();
  const draco = new DRACOLoader().setDecoderPath('./assets/draco/').setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync('./assets/brain.glb');
  const bounds = new THREE.Box3();
  gltf.scene.updateMatrixWorld(true);
  const groups = { cortex: [], outer: [], inner: [] };
  const CATEGORY = { cortex: 'cortex', cerebellum: 'outer', brainstem: 'outer', white_matter: 'inner', ventricles: 'inner', diencephalon: 'inner', deep_grey: 'inner' };
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    let owner = mesh;
    while (owner.parent && !owner.userData.bx_cat) owner = owner.parent;
    const data = owner.userData;
    // Exclude vessels, nerves, atlas tract tubes and the enveloping white matter.
    const group = CATEGORY[data.bx_cat];
    if (!group || /White matter of telencephalon/.test(data.bx_label || '')) return;
    groups[group].push(mesh);
    if (data.bx_core) bounds.expandByObject(mesh);
  });
  const center = bounds.getCenter(new THREE.Vector3());
  gltf.scene.position.sub(center);
  brain.add(gltf.scene);
  const size = Math.max(...bounds.getSize(new THREE.Vector3()).toArray());
  brain.scale.setScalar(3.55 / size);
  // The neurons are anchored on the original cortical meshes (same seeded anchors as before), then merged:
  // 395 sub-meshes become three, cutting about 1,280 draw calls per frame.
  network = createNeuronNetwork(brain, groups.cortex, { count: 4, seed: 715, color: colors.shadow, core: colors.highlight });
  brain.updateMatrixWorld(true);
  const toBrain = new THREE.Matrix4().copy(brain.matrixWorld).invert();
  const merged = {};
  for (const [name, meshes] of Object.entries(groups)) {
    merged[name] = new THREE.Mesh(mergeAll(meshes.map(m => stripped(m.geometry, new THREE.Matrix4().multiplyMatrices(toBrain, m.matrixWorld)))));
    merged[name].userData.networkGroup = 'whole';
  }
  brain.remove(gltf.scene);
  gltf.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
  draco.dispose();
  const glass = glassMaterials(colors, size, look);
  applyGlass(merged.cortex, glass, 3);
  applyGlass(merged.outer, glass, 3.5); // not 3: framing and the flow page use the cortex only, as before
  const inner = glassMaterials(colors, size, look);
  inner.back.uniforms.uAlpha.value = 0.16;
  merged.inner.material = inner.back; merged.inner.material.side = THREE.FrontSide; merged.inner.renderOrder = 1;
  brain.add(merged.inner, merged.outer, merged.cortex);
  plexus = createPlexus({ meshes: [merged.cortex], unit: size, seed: 901, lineColor: colors.base, dotColor: colors.shadow, look, preset: PLEXUS_PRESETS.brain, scale: plexusScale() });
  brain.add(plexus);
  root = brain;
 } else {
  const config = organs.find(o => o.id === id);
  const { root: loadedRoot, meshes } = await loadOrganGeometry(config);
  const content = meshes[0].parent;
  const unit = 3.55 / loadedRoot.scale.x; // organ's largest dimension in millimetres
  network = createNeuronNetwork(loadedRoot, meshes, { generic: true, color: colors.shadow, core: colors.highlight, count: 4, seed: 715 + organs.findIndex(o => o.id === id) * 137 });
  // Merge lobes per side (lungs 5 -> 2, intestines 6 -> 1) once the anchors are placed.
  const bySide = new Map();
  for (const mesh of meshes) { const g = mesh.userData.networkGroup; if (!bySide.has(g)) bySide.set(g, []); bySide.get(g).push(mesh); }
  const glass = glassMaterials(colors, unit, look);
  const surfaces = [];
  for (const [side, group] of bySide) {
    const mesh = new THREE.Mesh(mergeAll(group.map(m => stripped(m.geometry))));
    mesh.userData.networkGroup = side;
    group.forEach(m => content.remove(m));
    applyGlass(mesh, glass, 3);
    content.add(mesh);
    surfaces.push(mesh);
  }
  plexus = createPlexus({ meshes: surfaces, unit, seed: 401 + organs.findIndex(o => o.id === id) * 53, lineColor: colors.base, dotColor: colors.shadow, look, scale: plexusScale() });
  content.add(plexus);
  root = loadedRoot;
 }

 // Keep geometry, shader passes and network from the supplied viewer together.
 const wrapper = new THREE.Group();
 wrapper.add(root);
 if (id === 'brain') wrapper.rotation.set(0.12, Math.atan2(0.92,0.37), 0);
 else wrapper.rotation.set(0.06, -0.12, 0);
 const model = new THREE.Group(); model.add(wrapper);
 const physicalSize = {brain:0.18,lungs:0.30,liver:0.25,stomach:0.18,kidneys:0.25,pancreas:0.20,spleen:0.13,intestines:0.30}[id];
 model.scale.setScalar(physicalSize / 3.55);
 model.updateMatrixWorld(true);
 const pieces=[];
 root.traverse(o => {if(o.isMesh && o.visible && o.renderOrder === 3) pieces.push(stripped(o.geometry, o.matrixWorld));});
 const geometry=mergeAll(pieces);

 // Process anchors stay visible over the organ for the leader lines; the connecting edges wrap the surface.
 network.traverse(object=>{if(object.isMesh){const anchor=/^Neuron \d+$/.test(object.parent?.name||'');object.material.depthTest=!anchor;object.renderOrder=anchor?20:19;object.raycast=noPick;}});
 network.raycast=()=>false;
 network.visible=false;
 replacementModels.set(id, model);
 return {model, geometry, network, look, plexus};
}
