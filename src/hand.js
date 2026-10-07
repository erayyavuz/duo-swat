import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Right forearm + hand cut from a MakeHuman base mesh (CC0, generated with MPFB2 in
// Blender, see tools/export_hand_mpfb.py), with the CC0 "young caucasian male" skin
// texture. It keeps the MakeHuman rig, so the grip is posed with ordinary bone rotations.

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

const key = (n) => n.replace(/[^a-z0-9]/gi, '').toLowerCase();

export class Hand {
  constructor() {
    this.group = new THREE.Group();
    this.ready = false;
  }

  async load(url, skinUrl) {
    const [gltf, map] = await Promise.all([
      new GLTFLoader().loadAsync(url),
      new THREE.TextureLoader().loadAsync(skinUrl),
    ]);
    map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    this.material = skinMaterial(map);
    const root = gltf.scene;
    this.bones = {};
    root.traverse((o) => {
      if (o.isSkinnedMesh) { o.material = this.material; o.frustumCulled = false; this.mesh = o; }
      if (o.isBone) this.bones[key(o.name)] = o;
    });
    this.rest = {};
    for (const [k, b] of Object.entries(this.bones)) this.rest[k] = b.quaternion.clone();
    this.root = root;
    this.inner = new THREE.Group();   // its transform re-bases the palm frame
    this.inner.add(root);
    this.group.add(this.inner);
    this.ready = true;
    return this;
  }

  bone(name) { return this.bones[key(name)]; }

  // pose: { thumb:{curl:[a,b,c], spread, twist}, index:{...}, middle, ring, pinky, wrist:{flex, dev} }
  // curl rotates about each bone's local X (flexion), spread about local Z, twist about local Y.
  setPose(pose) {
    for (const [k, q] of Object.entries(this.rest)) this.bones[k].quaternion.copy(q);
    const FING = { thumb: 1, index: 2, middle: 3, ring: 4, pinky: 5 };
    const qa = new THREE.Quaternion();
    const rot = (b, axis, a) => { if (b && a) b.quaternion.multiply(qa.setFromAxisAngle(axis, a)); };
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
    for (const [name, n] of Object.entries(FING)) {
      const c = pose[name]; if (!c) continue;
      const b1 = this.bone(`finger${n}-1.R`);
      rot(b1, Z, c.spread); rot(b1, Y, c.twist);
      (c.curl || []).forEach((a, i) => rot(this.bone(`finger${n}-${i + 1}.R`), X, a));
    }
    if (pose.wrist) { const w = this.bone('wrist.R'); rot(w, X, pose.wrist.flex); rot(w, Z, pose.wrist.dev); }
    this.root.updateMatrixWorld(true);
  }

  // Grip vector (fitted by tools/fitgrip.js): wrist xyz, fingers yaw/pitch, palm roll,
  // thumb curl x3 + spread + twist, index/middle/ring/pinky curl x3, wrist flex + deviation.
  applyGrip(x) {
    const [ox, oy, oz, yaw, pitch, roll, ...c] = x;
    const pose = { thumb: { curl: [c[0], c[1], c[2]], spread: c[3], twist: c[4] } };
    ['index', 'middle', 'ring', 'pinky'].forEach((f, i) => { pose[f] = { curl: [c[5 + i * 3], c[6 + i * 3], c[7 + i * 3]] }; });
    pose.wrist = { flex: c[17], dev: c[18] };
    this.setPose(pose);
    const F = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch));
    const up = Math.abs(F.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(F, up).normalize();
    const back = new THREE.Vector3().crossVectors(side, F).normalize();
    const A = side.multiplyScalar(Math.cos(roll)).add(back.multiplyScalar(Math.sin(roll)));
    this.placePalm(new THREE.Vector3(ox, oy, oz), F, A);
  }

  // Re-base the arm so the palm frame (wrist origin, fingers direction, thumb side) lands on
  // the target frame given in this.group's parent space. Call after setPose.
  placePalm(origin, fingersDir, thumbDir) {
    this.inner.position.set(0, 0, 0); this.inner.quaternion.identity(); this.inner.scale.set(1, 1, 1);
    this.inner.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    const p = (n) => this.bone(n).getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const O = p('wrist.R');
    const F = p('finger3-1.R').sub(O).normalize();
    const A = p('finger2-1.R').sub(p('finger5-1.R'));
    A.addScaledVector(F, -A.dot(F)).normalize();
    const N = new THREE.Vector3().crossVectors(F, A);
    const rest = new THREE.Matrix4().makeBasis(A, F, N).setPosition(O);
    const Ft = fingersDir.clone().normalize();
    const At = thumbDir.clone().addScaledVector(Ft, -thumbDir.dot(Ft)).normalize();
    const Nt = new THREE.Vector3().crossVectors(Ft, At);
    const target = new THREE.Matrix4().makeBasis(At, Ft, Nt).setPosition(origin);
    target.multiply(rest.invert()).decompose(this.inner.position, this.inner.quaternion, this.inner.scale);
    this.inner.updateMatrixWorld(true);
  }
}
