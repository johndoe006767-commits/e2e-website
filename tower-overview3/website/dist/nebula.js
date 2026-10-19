import * as T from 'three';

// Dark starry nebula from the AstraZeneca silhouette imagery (Picture6-14), drawn behind everything as one
// full-screen pass over the light page. NEBULA_OPACITY sets how much of the light page and lab photo show through.
export const NEBULA_OPACITY = 0.35;      // inside the oval behind the body / zoomed organ
export const NEBULA_OPACITY_PAGE = 0.15; // rest of the page

const vertexShader = /* glsl */`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const fragmentShader = /* glsl */`
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uTime;
uniform vec4 uOrgan[8];      // xy = organ centre in CSS px, z = radius, w = weight
uniform vec3 uOrganCol[8];
uniform float uGlow;         // organ colour glow strength
uniform float uFade;
uniform float uFadePage;
uniform vec3 uCentre;        // oval centre in CSS px (y down), z = size in CSS px
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uStarA;
uniform vec3 uStarB;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCTAVES; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s; }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uPixelRatio;   // CSS px, y down
  vec2 uv = px / uResolution.y * uPixelRatio;
  vec2 p = uv * 3.0;
  float n1 = fbm(p + vec2(0.0, uTime * 0.012));
  float n2 = fbm(p * 2.4 + 5.0 - vec2(uTime * 0.008, 0.0));
  vec3 col = mix(uC0, uC1, smoothstep(0.25, 0.8, n1));
  col = mix(col, uC2, smoothstep(0.35, 0.85, n2) * 0.7);
  col = mix(col, uC3, pow(n2, 3.0) * 0.7);
  // two layers of stars with twinkle; stars stay crisp even though the nebula itself is faint
  float starA = 0.0; vec3 starCol = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 90.0 : 190.0;
    vec2 g = px / scale * (layer == 0 ? 6.0 : 9.0); vec2 gi = floor(g), gf = fract(g) - 0.5;
    float h = hash21(gi + float(layer) * 31.7); vec2 off = (vec2(hash21(gi + 3.1), hash21(gi + 7.7)) - 0.5) * 0.6;
    float r = layer == 0 ? 0.08 : 0.06;
    float star = (1.0 - smoothstep(0.0, r, length(gf + off))) * step(layer == 0 ? 0.93 : 0.88, h);
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + 3.0 * h) + h * 50.0);
    float sa = star * tw * (layer == 0 ? 0.95 : 0.65);
    if (sa > starA) { starA = sa; starCol = mix(uStarA, uStarB, step(0.6, hash21(gi + 1.3))); }
  }
  for (int i = 0; i < 8; i++) {
    vec2 q = (px - uOrgan[i].xy) / max(uOrgan[i].z, 1.0);
    col += uOrganCol[i] * exp(-dot(q, q) * 2.2) * uOrgan[i].w * uGlow;
  }
  vec2 o = (px - uCentre.xy) / vec2(uCentre.z * 0.36, uCentre.z * 0.56);
  float oval = 1.0 - smoothstep(0.45, 1.0, length(o));
  float alpha = max(mix(uFadePage, uFade, oval), starA);
  col = mix(col, starCol, starA / max(alpha, 1e-3));
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export function createNebula({ mobile = false } = {}) {
  const c = hex => new T.Color(hex);
  const uniforms = {
    uResolution: { value: new T.Vector2(1, 1) }, uPixelRatio: { value: 1 }, uTime: { value: 0 }, uGlow: { value: 0.28 }, uFade: { value: NEBULA_OPACITY }, uFadePage: { value: NEBULA_OPACITY_PAGE }, uCentre: { value: new T.Vector3() },
    uOrgan: { value: Array.from({ length: 8 }, () => new T.Vector4()) },
    uOrganCol: { value: Array.from({ length: 8 }, () => new T.Color()) },
    uC0: { value: c('#0E0820') }, uC1: { value: c('#3A0E27') }, uC2: { value: c('#1B2C45') }, uC3: { value: c('#452E61') },
    uStarA: { value: c('#CFE9F7') }, uStarB: { value: c('#E7B6DA') },
  };
  const material = new T.ShaderMaterial({ uniforms, vertexShader, fragmentShader, defines: { OCTAVES: mobile ? 2 : 3 },
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  mesh.renderOrder = -3; mesh.frustumCulled = false; mesh.raycast = () => {};
  mesh.name = 'Nebula backdrop';
  document.body.dataset.bg = 'page';
  return { mesh, uniforms };
}
