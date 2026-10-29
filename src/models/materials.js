import * as THREE from 'three';

/** Emissive that is tinted by the vertex color (used for windows / lamps). */
function vertexColorEmissive(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 totalEmissiveRadiance = emissive;',
      'vec3 totalEmissiveRadiance = emissive * vColor.rgb;'
    );
  };
  mat.customProgramCacheKey = () => 'vc-emissive';
  return mat;
}

export const MATS = {
  std: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 }),
  soft: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.75 }),
  gold: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 1.0 }),
  glass: new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.06, metalness: 0.6, transparent: true, opacity: 0.82,
  }),
  // Windows & lamps: faint by day, glowing at night (driven by the day cycle).
  lit: vertexColorEmissive(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0.1,
  })),
  // Always glowing (neon, crystals, screens) – picked up by bloom.
  neon: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) }),
};

export function setNightLevel(night) {
  MATS.lit.emissiveIntensity = 0.08 + night * 2.4;
  const n = 1.2 + night * 1.2;
  MATS.neon.color.setRGB(n, n, n);
}
