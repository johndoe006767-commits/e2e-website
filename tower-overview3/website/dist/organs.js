import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// AstraZeneca palette (measured from the brand imagery in ppt material/). One row per tower:
// base = identity colour (cards, plexus lines, flow page); face = glass colour seen face-on;
// shadow = rims, back faces, ink and plexus dots; cardText = contrast-safe text on the light cards.
// Re-map a tower by editing its row; every consumer reads this table.
export const AZ = { mulberry: '#830051', lime: '#C4D600', navy: '#003865', gold: '#F0AB00', magenta: '#D0006F', purple: '#3C1053', lightBlue: '#68D2DF', graphite: '#3F4444', platinum: '#9DB0AC', white: '#FFFFFF' };
export const towerColors = {
  lungs:      { tower: 'R2R',             base: AZ.lightBlue, face: '#9FE3EB', shadow: AZ.navy,     highlight: AZ.white,  cardText: AZ.navy,     backAlpha: .18, ink: .55 },
  liver:      { tower: 'CAPEX',           base: AZ.lime,      face: '#DCE56A', shadow: AZ.navy,     highlight: AZ.white,  cardText: '#4F6B1F',   backAlpha: .22, ink: .60 },
  intestines: { tower: 'O2C',             base: AZ.gold,      face: '#F7C95A', shadow: AZ.mulberry, highlight: AZ.white,  cardText: AZ.mulberry, backAlpha: .12, ink: .50 },
  brain:      { tower: 'FP&A Commercial', base: AZ.magenta,   face: '#EB80B5', shadow: AZ.purple,   highlight: AZ.white,  cardText: AZ.magenta,  backAlpha: .20, ink: .35 },
  kidneys:    { tower: 'Controlling',     base: AZ.mulberry,  face: '#C1689F', shadow: AZ.purple,   highlight: AZ.white,  cardText: AZ.mulberry, backAlpha: .22, ink: .50 },
  stomach:    { tower: 'P2P',             base: AZ.navy,      face: '#5C88AE', shadow: '#001A33',   highlight: '#C9EEF4', cardText: AZ.navy,     backAlpha: .22, ink: .45 },
  spleen:     { tower: 'Tax',             base: AZ.purple,    face: '#8465A0', shadow: '#120520',   highlight: AZ.white,  cardText: AZ.purple,   backAlpha: .22, ink: .45 },
  pancreas:   { tower: 'FP&A Operations', base: AZ.platinum,  face: '#C6D2CF', shadow: AZ.navy,     highlight: AZ.white,  cardText: AZ.graphite, backAlpha: .20, ink: .40 },
};
export const colorsFor = id => towerColors[id];

export const organs = [
  { id: 'brain', label: 'Brain' },
  { id: 'liver', label: 'Liver', files: ['7197'] },
  { id: 'lungs', label: 'Lungs', files: ['7333', '7337', '7383', '7370', '7371'], networkGroups: ['right', 'right', 'right', 'left', 'left'] },
  { id: 'kidneys', label: 'Kidneys', files: ['7204', '7205'], networkGroups: ['right', 'left'] },
  { id: 'spleen', label: 'Spleen', files: ['7196'] },
  { id: 'intestines', label: 'Intestines', files: ['7206', '7207', '7208', '14543nsn', '14544', '14542'] },
  { id: 'pancreas', label: 'Pancreas', files: ['7198'] },
  { id: 'stomach', label: 'Stomach', files: ['7148'] },
].map(o => ({ ...o, color: towerColors[o.id].base }));

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
