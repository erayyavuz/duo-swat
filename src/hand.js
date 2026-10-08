import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Left forearm + hand cut from a female MakeHuman base mesh (CC0, generated with MPFB2 in
// Blender), CC0 "young caucasian female" skin, long almond nails with red polish.

const NOISE = `
float hsh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;

function skinMaterial(map) {
  const m = new THREE.MeshPhysicalMaterial({
    map, roughness: 0.52, metalness: 0,
    sheen: 0.3, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffd9c8),
    clearcoat: 0.08, clearcoatRoughness: 0.5,
  });
  // fine pores (bind-space noise so they stick to the skin) + a warm subsurface wrap
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkinPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkinPos;\n' + NOISE)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 pn = vec3(vnoise(vSkinPos * 1800.0), vnoise(vSkinPos * 1800.0 + 17.0), vnoise(vSkinPos * 1800.0 + 41.0)) - 0.5;
        normal = normalize(normal + pn * 0.09);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= 0.9 + 0.2 * vnoise(vSkinPos * 600.0);`)
      .replace('#include <opaque_fragment>', `
        float wrap = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.5);
        outgoingLight += vec3(0.32, 0.08, 0.05) * wrap * 0.4 * diffuseColor.rgb;
        #include <opaque_fragment>`);
  };
  return m;
}

export class Hand {
  constructor() {
    this.group = new THREE.Group();
    this.ready = false;
  }

  // The grip is posed and baked in Blender (tools/blender/pose_hand.py, params in
  // tools/blender/grip.json), already in rig space: no runtime skinning.
  async load(url, skinUrl) {
    const [gltf, map] = await Promise.all([
      new GLTFLoader().loadAsync(url),
      new THREE.TextureLoader().loadAsync(skinUrl),
    ]);
    map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    this.material = skinMaterial(map);
    // glossy red polish on the nails (a separate mesh in the GLB)
    this.nailMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8a0710, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
      sheen: 0.2, sheenColor: new THREE.Color(0xff5060),
    });
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (/nail/i.test(o.name) || /nail/i.test(o.parent?.name ?? '')) o.material = this.nailMaterial;
      else { o.material = this.material; this.mesh = o; }
    });
    this.group.add(gltf.scene);
    this.ready = true;
    return this;
  }
}
