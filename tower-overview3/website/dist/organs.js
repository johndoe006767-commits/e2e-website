import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const organs = [
  { id: 'brain', label: 'Brain', color: '#f5dfd9', neurons: '#ff263d' },
  { id: 'liver', label: 'Liver', color: '#d5a04d', neurons: '#25f4eb', files: ['7197'] },
  { id: 'lungs', label: 'Lungs', color: '#649fdf', neurons: '#ff811e', files: ['7333', '7337', '7383', '7370', '7371'], networkGroups: ['right', 'right', 'right', 'left', 'left'] },
  { id: 'kidneys', label: 'Kidneys', color: '#a58bdd', neurons: '#aeff2e', files: ['7204', '7205'], networkGroups: ['right', 'left'] },
  { id: 'spleen', label: 'Spleen', color: '#bd577f', neurons: '#ffe544', files: ['7196'] },
  { id: 'intestines', label: 'Intestines', color: '#78c69b', neurons: '#c450ff', files: ['7206', '7207', '7208', '14543nsn', '14544', '14542'] },
  { id: 'pancreas', label: 'Pancreas', color: '#e0a28c', neurons: '#377cff', files: ['7198'] },
  { id: 'stomach', label: 'Stomach', color: '#49b7ae', neurons: '#ff4bab', files: ['7148'] },
];

export async function loadOrganGeometry(config) {
  const loader = new STLLoader();
  const geometry = await Promise.all(config.files.map(id => loader.loadAsync(`./assets/organs/FMA${id}.stl`)));
  const root = new THREE.Group();
  const content = new THREE.Group();
  root.add(content);
  const meshes = geometry.map((raw, index) => {
    // Preserve the atlas's geometry and relative placement. Smooth shared
    // normals rather than retaining STL's flat per-triangle shading.
    raw.deleteAttribute('normal');
    const smooth = mergeVertices(raw, 0.0001);
    raw.dispose();
    smooth.computeVertexNormals();
    smooth.rotateX(-Math.PI / 2); // BodyParts3D is Z-up, Three.js is Y-up.
    const mesh = new THREE.Mesh(smooth);
    mesh.userData.networkGroup = config.networkGroups?.[index] || 'whole';
    content.add(mesh);
    return mesh;
  });
  content.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(content);
  content.position.sub(bounds.getCenter(new THREE.Vector3()));
  root.scale.setScalar(3.55 / Math.max(...bounds.getSize(new THREE.Vector3()).toArray()));
  root.name = config.label;
  return { root, meshes };
}
