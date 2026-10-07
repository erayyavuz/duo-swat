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

function skinMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xd9a587, roughness: 0.52, metalness: 0,
    sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffc9b0),
    clearcoat: 0.08, clearcoatRoughness: 0.6,
  });
  // cheap subsurface: warm the terminator and add a reddish wrap term
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float wrap = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
      outgoingLight += vec3(0.32, 0.06, 0.03) * wrap * 0.35 * diffuseColor.rgb;
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
    this._buildForearm(mesh, root);
    this.ready = true;
    return this;
  }

  // Forearm + knit sleeve, built in the armature's space so it follows the mirror/rotation.
  // The rigged hand ends at a cut-off wrist; the sleeve cuff hides that seam.
  _buildForearm(mesh, root) {
    const pos = mesh.geometry.attributes.position;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
    let cx = 0, cz = 0, n = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < maxY - 0.006) continue;
      const x = pos.getX(i), z = pos.getZ(i);
      cx += x; cz += z; n++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    cx /= n; cz /= n;
    const rx = (maxX - minX) / 2, rz = (maxZ - minZ) / 2;
    const arm = new THREE.Group();
    arm.position.set(cx, maxY - 0.012, cz);
    root.add(arm);
    // forearm: elliptical, slightly widening toward the elbow
    const fa = new THREE.CylinderGeometry(1, 1.12, 0.05, 48, 6, true);
    fa.translate(0, 0.025, 0);
    const fm = new THREE.Mesh(fa, this.material);
    fm.scale.set(rx * 0.97, 1, rz * 0.97);
    arm.add(fm);
    // knit sleeve with a ribbed cuff
    const sleeveGeo = new THREE.CylinderGeometry(1, 1.25, 0.42, 96, 60, true);
    const sp = sleeveGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
      const a = Math.atan2(z, x);
      const t = (y + 0.21) / 0.42;           // 0 at cuff
      const rib = t < 0.12 ? 0.045 * Math.max(0, Math.cos(a * 34)) : 0.012 * Math.sin(a * 60 + y * 900);
      const fold = t > 0.12 ? 0.05 * Math.sin(y * 70 + a * 2) * Math.min(1, (t - 0.12) * 6) : 0;
      const k = 1 + rib + fold;
      sp.setXYZ(i, x * k, y, z * k);
    }
    sleeveGeo.computeVertexNormals();
    sleeveGeo.translate(0, 0.21 + 0.012, 0);
    const knit = new THREE.MeshPhysicalMaterial({
      color: 0x8b7d6b, roughness: 0.95, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xd8cbb8),
      side: THREE.DoubleSide,
    });
    this.sleeveMaterial = knit;
    const sleeve = new THREE.Mesh(sleeveGeo, knit);
    sleeve.scale.set(rx * 1.32, 1, rz * 1.45);
    arm.add(sleeve);
    this.arm = arm;
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
