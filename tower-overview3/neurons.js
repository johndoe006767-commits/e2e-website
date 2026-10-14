import * as THREE from 'three';

// An illustrative neural network, separate from the anatomical atlas.
export function createNeuronNetwork(brain, corticalMeshes, options = {}) {
  const count = options.count ?? 4;
  let seed = options.seed ?? 715;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const network = new THREE.Group();
  network.name = `Organ surface network - ${count} neurons`;
  network.userData.source = 'Supplied dist/neurons.js';
  // Work in normalized brain units while inheriting its rotation and position.
  network.scale.setScalar(1 / brain.scale.x);
  brain.add(network);
  brain.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector3(0, options.generic ? 0 : 0.25, 0);
  const glowColor = new THREE.Color(options.color || '#ff263d').multiplyScalar(2.8);
  // Keep every lobe of a lung in the same network, but never join the pair.
  // Each group also gets its own projection origin and raycast targets so a
  // connection cannot accidentally snap onto the opposite organ.
  const groups = new Map();
  for (const mesh of corticalMeshes) {
    const id = mesh.userData.networkGroup || 'whole';
    if (!groups.has(id)) groups.set(id, { meshes: [], center: center.clone(), bounds: new THREE.Box3() });
    const group = groups.get(id);
    group.meshes.push(mesh);
    mesh.geometry.computeBoundingBox();
    group.bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  }
  if (groups.size > 1) {
    for (const group of groups.values()) group.bounds.getCenter(group.center);
  }
  const candidates = [];
  {
    for (const mesh of corticalMeshes) {
      const positions = mesh.geometry.attributes.position;
      const normals = mesh.geometry.attributes.normal;
      const step = Math.max(1, Math.floor(positions.count / 1000));
      for (let v = 0; v < positions.count; v += step) {
        const normal = new THREE.Vector3().fromBufferAttribute(normals, v).transformDirection(mesh.matrixWorld);
        const point = new THREE.Vector3().fromBufferAttribute(positions, v).applyMatrix4(mesh.matrixWorld).addScaledVector(normal, 0.028);
        candidates.push({ point, normal, group: mesh.userData.networkGroup || 'whole' });
      }
    }
  }
  // Seeded random surface scatter. Pair members each receive two process
  // neurons, preserving the supplied model's left/right connection boundaries.
  const anchors = [];
  const groupIds = [...groups.keys()];
  for (let i = 0; i < count; i++) {
    const groupId = groupIds[i % groupIds.length];
    const pool = candidates.filter(c => c.group === groupId && !anchors.includes(c));
    const ranked = pool.map(candidate => ({candidate, distance: anchors.length
      ? Math.min(...anchors.map(a => a.point.distanceToSquared(candidate.point))) : random()}))
      .sort((a,b) => b.distance-a.distance);
    // Pick randomly among well-separated candidates, never from a fixed grid.
    const choice = ranked[Math.floor(random()*Math.max(1, Math.ceil(ranked.length*.12)))];
    anchors.push(choice.candidate);
  }
  const surface = (direction, fallback, groupId = 'whole') => {
    const group = groups.get(groupId);
    const origin = group.center;
    const targets = group.meshes;
    const unit = direction.clone().normalize();
    raycaster.set(origin.clone().addScaledVector(unit, 5), unit.clone().negate());
    let hit = raycaster.intersectObjects(targets, false)[0];
    // The atlas has small open seams between regions; sample just beside a
    // seam before bridging it between two known surface anchors.
    if (!hit) {
      for (const offset of [0.012, -0.012, 0.035, -0.035]) {
        const nearby = unit.clone().add(new THREE.Vector3(offset, 0.01, 0)).normalize();
        raycaster.set(origin.clone().addScaledVector(nearby, 5), nearby.clone().negate());
        hit = raycaster.intersectObjects(targets, false)[0];
        if (hit) break;
      }
    }
    if (!hit && fallback) return { point: fallback.clone(), normal: unit };
    if (!hit) throw new Error('Unable to anchor neuron to cortical surface');
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.dot(unit) < 0) normal.negate();
    return { point: hit.point.clone().addScaledVector(normal, 0.025), normal };
  };
  const neurons = [];
  const links = new THREE.Group();
  network.add(links);
  const filament = new THREE.MeshBasicMaterial({
    color: glowColor, transparent: true, opacity: 0.62,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
  });
  const connection = filament.clone();
  connection.opacity = 0.25;
  const membrane = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: glowColor } },
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 n; varying vec3 eye;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.0);
      n=normalize(normalMatrix*normal);eye=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform vec3 glowColor; varying vec3 n; varying vec3 eye;
      void main(){float rim=pow(1.0-clamp(abs(dot(normalize(n),normalize(eye))),0.0,1.0),2.2);
      gl_FragColor=vec4(glowColor,0.07+rim*0.38);}`,
  });
  const somaGeometry = new THREE.SphereGeometry(0.043, 20, 14);
  const nucleusGeometry = new THREE.SphereGeometry(0.013, 12, 8);
  function tube(points, radius, mat, parent, segments = 12) {
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 5, false), mat);
    mesh.renderOrder = 5;
    parent.add(mesh);
  }
  for (let i = 0; i < count; i++) {
    const neuron = new THREE.Group();
    neuron.name = `Neuron ${i + 1}`;
    const y = -0.4 + (i + 0.5) / count * 1.35;
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const radius = Math.sqrt(1 - y * y);
    const direction = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const sampled = anchors[i];
    const groupId = sampled.group || 'whole';
    direction.copy(sampled.point).sub(groups.get(groupId).center).normalize();
    const anchor = surface(direction, sampled.point, groupId);
    neuron.userData.networkGroup = groupId;
    direction.copy(anchor.point).sub(groups.get(groupId).center).normalize();
    neuron.position.copy(anchor.point);
    neuron.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), anchor.normal);
    neuron.userData.direction = direction;
    const soma = new THREE.Mesh(somaGeometry, membrane);
    soma.scale.set(1.05, 0.82, 0.9);
    soma.renderOrder = 6;
    neuron.add(soma);
    const nucleus = new THREE.Mesh(nucleusGeometry, filament);
    nucleus.renderOrder = 6;
    neuron.add(nucleus);
    // Fine dendrites bifurcate into tapered terminals around a translucent soma.
    for (let branch = 0; branch < 6; branch++) {
      const angle = branch / 6 * Math.PI * 2 + random() * 0.45;
      const length = 0.12 + random() * 0.085;
      const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), (random() - 0.5) * 0.8);
      const bend = new THREE.Vector3(-direction.y, direction.x, 0).multiplyScalar((random() - 0.5) * 0.06);
      const middle = direction.clone().multiplyScalar(length * 0.55).add(bend);
      const end = direction.clone().multiplyScalar(length);
      tube([direction.clone().multiplyScalar(0.025), middle, end], 0.0032, filament, neuron);
      for (const side of [-1, 1]) {
        const tip = end.clone().add(new THREE.Vector3(
          Math.cos(angle + side * 0.7), Math.sin(angle + side * 0.7), (random() - 0.5) * 0.4,
        ).multiplyScalar(0.055 + random() * 0.045));
        tube([middle, end.clone().lerp(tip, 0.35), tip], 0.0015, filament, neuron, 8);
      }
    }
    neuron.rotateZ(random() * Math.PI);
    network.add(neuron);
    neurons.push(neuron);
  }
  // Build one connected graph per anatomical side, including across the
  // lobes within a lung. No edge is allowed to cross between paired organs.
  const edges = new Set();
  const sameGroup = (a, b) => neurons[a].userData.networkGroup === neurons[b].userData.networkGroup;
  const addEdge = (a, b) => {
    if (sameGroup(a, b)) edges.add([Math.min(a, b), Math.max(a, b)].join(':'));
  };
  for (const groupId of groups.keys()) {
    const members = neurons.map((n, i) => i).filter(i => neurons[i].userData.networkGroup === groupId);
    if (!members.length) continue;
    const reached = new Set([members[0]]);
    while (reached.size < members.length) {
      let best = Infinity, from, to;
      for (const a of reached) {
        for (const b of members) {
          if (reached.has(b)) continue;
          const distance = neurons[a].position.distanceToSquared(neurons[b].position);
          if (distance < best) { best = distance; from = a; to = b; }
        }
      }
      addEdge(from, to);
      reached.add(to);
    }
  }
  for (let i = 0; i < neurons.length; i++) {
    const nearest = neurons.map((n, j) => ({ j, d: n.position.distanceToSquared(neurons[i].position) }))
      .filter(n => n.j !== i && sameGroup(i, n.j)).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const { j } of nearest) addEdge(i, j);
  }
  for (const edge of edges) {
    const [a, b] = edge.split(':').map(Number);
    const points = [];
    for (let step = 0; step <= 32; step++) {
      const direction = neurons[a].userData.direction.clone().lerp(neurons[b].userData.direction, step / 32).normalize();
      const fallback = neurons[a].position.clone().lerp(neurons[b].position, step / 32);
      points.push(surface(direction, fallback, neurons[a].userData.networkGroup).point);
    }
    points[0].copy(neurons[a].position);
    points[32].copy(neurons[b].position);
    tube(points, 0.003, connection, links, 96);
  }
  return network;
}
