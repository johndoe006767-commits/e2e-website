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
  // AstraZeneca restyle: soft dots and lines in the tower's shadow colour, normal blending (reads on the light page).
  const nodeColor = new THREE.Color(options.color || '#3C1053');
  const coreColor = new THREE.Color(options.core || '#FFFFFF');
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
  const filament = new THREE.MeshBasicMaterial({ color: coreColor, transparent: true, opacity: 0.95, depthWrite: false, depthTest: true, toneMapped: false });
  const connection = new THREE.MeshBasicMaterial({ color: nodeColor, transparent: true, opacity: 0.7, depthWrite: false, depthTest: true, toneMapped: false });
  const membrane = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: nodeColor } },
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    blending: THREE.NormalBlending, side: THREE.FrontSide,
    vertexShader: `varying vec3 n;
      void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 glowColor; varying vec3 n;
      void main(){float rim=pow(1.0-clamp(abs(n.z),0.0,1.0),2.0);
      gl_FragColor=vec4(mix(glowColor,vec3(1.0),0.25*(1.0-rim)),0.55+rim*0.4);
      #include <colorspace_fragment>
      }`,
  });
  const somaGeometry = new THREE.SphereGeometry(0.034, 20, 14);
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
    soma.renderOrder = 6;
    neuron.add(soma);
    const nucleus = new THREE.Mesh(nucleusGeometry, filament);
    nucleus.renderOrder = 6;
    neuron.add(nucleus);
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
