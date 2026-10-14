import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { organs, loadOrganGeometry } from './organs.js';
import { createNeuronNetwork } from './neurons.js';
export const replacementModels = new Map();
const vertexShader = `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = -p.xyz;
  gl_Position = projectionMatrix * p;
}`;
const fragmentShader = `
uniform vec3 color;
uniform float strength;
uniform float rimPower;
uniform vec3 highlight;
uniform float fill;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 n = normalize(vNormal);
  float facing = clamp(abs(dot(n, normalize(vView))), 0.0, 1.0);
  float rim = pow(1.0 - facing, rimPower);
  float broad = pow(1.0 - facing, 1.4);
  float light = 0.78 + 0.22 * max(dot(n, normalize(vec3(-0.5, 0.8, 0.6))), 0.0);
  vec3 tint = mix(color, highlight, pow(rim, 3.0) * 0.6);
  gl_FragColor = vec4(sqrt(tint) * light * 1.35, strength * (fill + 0.18 * broad + 0.86 * rim));
}`;
function material(strength, color = 0xf5dfd9, rimPower = 3.8) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength }, rimPower: { value: rimPower }, highlight: { value: new THREE.Color(1, 0.94, 0.91) }, fill: { value: 0.06 } },
    vertexShader, fragmentShader, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    side: THREE.DoubleSide,
  });
}
const materials = {
  cortex: material(0.85),
  cerebellum: material(0.22, 0xf1dcd5, 3.3),
  brainstem: material(0.35, 0xf5e3dc, 3.2),
  white_matter: material(0.22, 0xfff3ec, 3.2),
  ventricles: material(0.24, 0xffeee7, 3.4),
  diencephalon: material(0.10, 0xf0dad4),
  deep_grey: material(0.085, 0xedd6cf),
};
materials.cortex.depthTest = true;
materials.cortex.side = THREE.FrontSide;
// Use the exact same vertex calculation in both passes. A small depth bias
// keeps the color surface consistently in front of its depth-only copy instead
// of competing with it as floating-point rounding changes during rotation.
const cortexDepth = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
  colorWrite: false,
  depthWrite: true,
  side: THREE.FrontSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const distantCortex = material(0.018);
distantCortex.side = THREE.FrontSide;

export async function loadReplacement(id) {
 let root, network;
 if (id === 'brain') {
  const brain = new THREE.Group();
  const draco = new DRACOLoader().setDecoderPath('./assets/draco/').setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync('./assets/brain.glb');
  const bounds = new THREE.Box3();
  gltf.scene.updateMatrixWorld(true);
  const corticalMeshes = [];
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    let owner = mesh;
    while (owner.parent && !owner.userData.bx_cat) owner = owner.parent;
    const data = owner.userData;
    const cat = data.bx_cat;
    // Exclude vessels, nerves, atlas tract tubes and the enveloping white matter
    // to preserve the readable cortical and ventricular silhouette of the references.
    mesh.visible = Boolean(materials[cat]) && !/White matter of telencephalon/.test(data.bx_label || '');
    if (!mesh.visible) return;
    mesh.material.dispose();
    mesh.material = materials[cat];
    mesh.renderOrder = 1;
    if (cat === 'cortex') corticalMeshes.push(mesh);
    if (data.bx_core) bounds.expandByObject(mesh);
  });
  // A colorless nearest-surface pass keeps gyri readable. Interior layers are
  // drawn first and remain visible beneath the luminous cortical surface.
  for (const mesh of corticalMeshes) {
    const depth = new THREE.Mesh(mesh.geometry, cortexDepth);
    depth.renderOrder = 2;
    mesh.add(depth);
    const distant = new THREE.Mesh(mesh.geometry, distantCortex);
    distant.renderOrder = 0;
    mesh.add(distant);
    mesh.renderOrder = 3;
  }
  const center = bounds.getCenter(new THREE.Vector3());
  gltf.scene.position.sub(center);
  brain.add(gltf.scene);
  brain.scale.setScalar(3.55 / Math.max(...bounds.getSize(new THREE.Vector3()).toArray()));


  network = createNeuronNetwork(brain, corticalMeshes, {count:4,seed:715});
  draco.dispose();
  root = brain;
 } else {
 const config = organs.find(o => o.id === id);
      const { root: loadedRoot, meshes } = await loadOrganGeometry(config);
      const surfaceMaterial = material(0.86, config.color, 3.3);
      surfaceMaterial.depthTest = true;
      surfaceMaterial.side = THREE.FrontSide;
      surfaceMaterial.uniforms.fill.value = 0.16;
      const highlight = new THREE.Color(config.color).lerp(new THREE.Color('#ffffff'), 0.38);
      surfaceMaterial.uniforms.highlight.value.copy(highlight);
      const backMaterial = material(0.13, config.color, 2.5);
      backMaterial.side = THREE.BackSide;
      backMaterial.uniforms.highlight.value.copy(highlight);
      for (const mesh of meshes) {
        mesh.material.dispose();
        mesh.material = surfaceMaterial;
        mesh.renderOrder = 3;
        const depth = new THREE.Mesh(mesh.geometry, cortexDepth);
        depth.renderOrder = 2;
        mesh.add(depth);
        const back = new THREE.Mesh(mesh.geometry, backMaterial);
        back.renderOrder = 0;
        mesh.add(back);
      }


 network = createNeuronNetwork(loadedRoot, meshes, {generic:true,color:config.neurons,count:4,seed:715+organs.findIndex(o=>o.id===id)*137});
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
 root.traverse(o => {if(o.isMesh && o.visible && o.renderOrder === 3) {
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
  for(const name of Object.keys(g.attributes)) if(!['position','normal'].includes(name)) g.deleteAttribute(name);
  pieces.push(g.index ? g.toNonIndexed() : g);
 }});
 const geometry=mergeGeometries(pieces,false); pieces.forEach(g=>g.dispose());

 // Keep the supplied network readable through this translucent overview's
 // depth-only organ masks. Geometry and organ-specific materials are retained.
 network.traverse(object=>{if(object.isMesh){object.material.depthTest=false;object.renderOrder=20;}});
 network.visible=false;
 replacementModels.set(id, model);
 return {model, geometry, network};
}
