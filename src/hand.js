import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Rigged hand from @webxr-input-profiles/assets (MIT, (c) 2019 Amazon), subdivided in Blender.
// Its 25 WebXR joints are flat siblings, so the grip pose is built here with manual FK:
// each joint rotation is applied to every joint further down that finger.

const FINGERS = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
const SEG = {
  thumb: ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'],
  other: ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'],
};

const NOISE = `
float hsh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;

function skinMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xe2b59c, roughness: 0.5, metalness: 0,
    sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffd2bf),
    clearcoat: 0.12, clearcoatRoughness: 0.55,
  });
  // Skin detail in the mesh's bind space (so it sticks to the skin as it poses):
  // blotchy redness, fine pores perturbing the normal, and a cheap subsurface wrap.
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkinPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkinPos;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float blot = vnoise(vSkinPos * 90.0) * 0.6 + vnoise(vSkinPos * 260.0) * 0.4;
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 0.9, 0.86), smoothstep(0.35, 0.85, blot));
        diffuseColor.rgb *= 0.96 + 0.08 * vnoise(vSkinPos * 700.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 pn = vec3(vnoise(vSkinPos * 1500.0), vnoise(vSkinPos * 1500.0 + 17.0), vnoise(vSkinPos * 1500.0 + 41.0)) - 0.5;
        normal = normalize(normal + pn * 0.12);`)
      .replace('#include <opaque_fragment>', `
        float wrap = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.5);
        outgoingLight += vec3(0.30, 0.07, 0.04) * wrap * 0.45 * diffuseColor.rgb;
        #include <opaque_fragment>`);
  };
  return m;
}

export class Hand {
  constructor() {
    this.group = new THREE.Group();
    this.ready = false;
    this.material = skinMaterial();
  }

  async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const root = gltf.scene;
    let mesh;
    root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
    mesh.material = this.material;
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this.bones = {};
    root.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.rest = {};
    for (const [n, b] of Object.entries(this.bones)) this.rest[n] = { p: b.position.clone(), q: b.quaternion.clone() };
    this.root = root;
    this.group.add(root);
    this._addNails();
    this.ready = true;
    return this;
  }

  // Fingernails sit on the back of each distal phalanx, parented to that joint.
  _addNails() {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xe2ab9a, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2,
    });
    const geo = new THREE.SphereGeometry(1, 20, 12);
    const R = { thumb: [0.0062, 0.0075, 0.0086], index: [0.0048, 0.0058, 0.0066], middle: [0.005, 0.006, 0.0068], ring: [0.0046, 0.0056, 0.0062], pinky: [0.0041, 0.0049, 0.0055] };
    this.nails = [];
    for (const f of FINGERS) {
      const key = f.split('-')[0];
      const bone = this.bones[`${f}-phalanx-distal`], tip = this.bones[`${f}-tip`];
      const len = bone.position.distanceTo(tip.position);
      const [w, l, h] = R[key];
      const n = new THREE.Mesh(geo, mat);
      n.scale.set(w * 0.88, 0.0009, l);
      // local -Z runs toward the tip, +Y is the back of the finger
      n.position.set(0, h * 0.86, -len * 0.5);
      n.rotation.x = 0.12;
      bone.add(n);
      this.nails.push(n);
    }
  }

  // pose: { thumb: {spread, twist, curl:[a,b,c]}, index: {spread, curl:[a,b,c]}, ... }
  setPose(pose) {
    const P = {}, Qt = {};
    for (const [n, r] of Object.entries(this.rest)) { P[n] = r.p.clone(); Qt[n] = r.q.clone(); }
    const axis = new THREE.Vector3(), rot = new THREE.Quaternion(), tmp = new THREE.Vector3();
    const rotateChain = (names, from, ax, ang) => {
      const pivot = P[names[from]].clone();
      rot.setFromAxisAngle(ax, ang);
      for (let k = from; k < names.length; k++) {
        const n = names[k];
        if (k > from) { tmp.copy(P[n]).sub(pivot).applyQuaternion(rot); P[n].copy(pivot).add(tmp); }
        Qt[n].premultiply(rot);
      }
    };
    for (const f of FINGERS) {
      const key = f.split('-')[0];
      const cfg = pose[key];
      if (!cfg) continue;
      const names = (f === 'thumb' ? SEG.thumb : SEG.other).map((s) => `${f}-${s}`);
      const base = f === 'thumb' ? 0 : 1;
      // spread (abduction) about the joint's local Y, twist about local Z
      if (cfg.spread) { axis.set(0, 1, 0).applyQuaternion(Qt[names[base]]); rotateChain(names, base, axis, cfg.spread); }
      if (cfg.twist) { axis.set(0, 0, 1).applyQuaternion(Qt[names[base]]); rotateChain(names, base, axis, cfg.twist); }
      (cfg.curl || []).forEach((a, i) => {
        const j = base + i;
        if (j >= names.length - 1 || !a) return;
        axis.set(1, 0, 0).applyQuaternion(Qt[names[j]]);
        rotateChain(names, j, axis, a);
      });
    }
    for (const [n, b] of Object.entries(this.bones)) { b.position.copy(P[n]); b.quaternion.copy(Qt[n]); }
    this.jointPos = P;
  }
}
