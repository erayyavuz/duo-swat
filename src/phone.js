import * as THREE from 'three';

// iPhone Duo, built to Apple's published dimensions (Sep 2026):
// unfolded 117.8 x 164.6 x 5.2 mm, folded 117.8 x 84.1 x 11.3 mm.
// Mirror-polished grade 5 titanium enclosure, micro-blasted hinge cover,
// 7.6" nano-texture inner display, 5.4" outer display with hole-punch camera,
// rear camera plateau with two 48MP cameras.
// Model units are millimetres; the whole phone group is scaled to metres.

export const D = { H: 117.8, W: 82.3, T: 5.2, GAP: 0.9, R: 11.5, BEVEL: 0.75 };
export const OPEN_CATCH = THREE.MathUtils.degToRad(118);

function halfShape(w, h, r, inset = 0, hingeInset = inset) {
  // Half extends from x=-w (outer edge) to x=0 (hinge edge). Only outer corners rounded.
  const s = new THREE.Shape();
  const x0 = -w + inset, x1 = -hingeInset, y0 = -h / 2 + inset, y1 = h / 2 - inset;
  const k = Math.max(0.2, r - inset);
  s.moveTo(x1, y0);
  s.lineTo(x1, y1);
  s.lineTo(x0 + k, y1);
  // continuous-curvature-ish corner (squircle) using a cubic
  s.bezierCurveTo(x0 + k * 0.28, y1, x0, y1 - k * 0.28, x0, y1 - k);
  s.lineTo(x0, y0 + k);
  s.bezierCurveTo(x0, y0 + k * 0.28, x0 + k * 0.28, y0, x0 + k, y0);
  s.lineTo(x1, y0);
  return s;
}

function roundedRectShape(cx, cy, w, h, r) {
  const s = new THREE.Shape();
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
  s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

// Remap ShapeGeometry UVs with a function of (x, y) in mm.
function remapUV(geo, fn) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const [u, v] = fn(p.getX(i), p.getY(i));
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

// Emissive screen material with a blur/zoom "wake" control on the emissive map.
function screenMaterial(tex, { roughness, clearcoat = 0 }) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x050506, roughness, metalness: 0, clearcoat, clearcoatRoughness: 0.04,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1,
    specularIntensity: clearcoat ? 0.6 : 0.25,
  });
  mat.userData.uniforms = {
    uBlur: { value: 0 }, uZoom: { value: 1 }, uBright: { value: 1 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.uniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uBlur; uniform float uZoom; uniform float uBright;`)
      .replace('#include <emissivemap_fragment>', `
#ifdef USE_EMISSIVEMAP
  vec2 zuv = (vEmissiveMapUv - 0.5) / uZoom + 0.5;
  vec4 emissiveColor = vec4(0.0);
  // 13-tap disc blur on top of a mip bias: soft, iOS-like wake-up blur
  float rad = uBlur * 0.012;
  float bias = uBlur * 4.0;
  emissiveColor += texture2D(emissiveMap, zuv, bias) * 0.16;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5235988 + 0.3;
    float rr = (i < 6) ? 0.55 : 1.0;
    vec2 o = vec2(cos(a), sin(a) * 1.41) * rad * rr;
    emissiveColor += texture2D(emissiveMap, zuv + o, bias) * 0.07;
  }
  totalEmissiveRadiance *= emissiveColor.rgb * uBright;
#endif`);
  };
  return mat;
}

export class Phone {
  constructor(screens) {
    this.screens = screens;
    this.group = new THREE.Group();          // scaled to metres; hinge axis = local Y
    this.group.scale.setScalar(0.001);
    this.angle = 0;                            // 0 = folded, PI = flat open
    this.mats = this._materials();
    this._build();
    this.setFinish('night');
    this.setAngle(0);
  }

  _materials() {
    const s = this.screens;
    return {
      frame: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.11, envMapIntensity: 1.25 }),
      hinge: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.42 }),
      back: new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.32 }),
      plateau: new THREE.MeshPhysicalMaterial({ metalness: 0.0, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }),
      bezel: new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.3, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      lensGlass: new THREE.MeshPhysicalMaterial({ color: 0x05060a, roughness: 0.02, metalness: 0.2, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.6 }),
      lensRing: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.08, color: 0x3c3f45 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x010101, roughness: 0.6 }),
      flash: new THREE.MeshPhysicalMaterial({ color: 0xf2efe6, roughness: 0.25, transmission: 0.2 }),
      inner: screenMaterial(s.innerTex, { roughness: 0.62 }),      // nano-texture: matte
      outer: screenMaterial(s.outerTex, { roughness: 0.06, clearcoat: 1 }),
    };
  }

  setFinish(name) {
    const m = this.mats;
    if (name === 'white') {
      m.frame.color.set(0xd8d4cc);
      m.hinge.color.set(0xb9b5ae);
      m.back.color.set(0xe9e6df);
      m.plateau.color.set(0xe2dfd8);
    } else {
      m.frame.color.set(0x3a4560);
      m.hinge.color.set(0x2f3850);
      m.back.color.set(0x1b2234);
      m.plateau.color.set(0x222a3e);
    }
    this.finish = name;
  }

  _halfBody(withScreenUV) {
    const { W, H, T, R, BEVEL } = D;
    const g = new THREE.Group();
    // titanium frame body (extruded, polished bevel)
    const shape = halfShape(W, H, R, BEVEL, BEVEL * 0.6);
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: T - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL,
      bevelSegments: 6, curveSegments: 28,
    });
    body.translate(0, 0, -T + BEVEL);
    const frame = new THREE.Mesh(body, this.mats.frame);
    g.add(frame);

    // front cover glass with black border, then the display panel
    const bez = new THREE.Mesh(new THREE.ShapeGeometry(halfShape(W, H, R, 0.55, 0.0), 24), this.mats.bezel);
    bez.position.z = 0.03;
    g.add(bez);
    const scr = new THREE.ShapeGeometry(halfShape(W, H, R - 1, 2.3, 0.0), 24);
    remapUV(scr, withScreenUV);
    const screen = new THREE.Mesh(scr, this.mats.inner);
    screen.position.z = 0.06;
    g.add(screen);

    // back glass
    const back = new THREE.Mesh(new THREE.ShapeGeometry(halfShape(W, H, R, 0.8, 0.8), 24), this.mats.back);
    back.rotation.y = Math.PI; back.position.z = -T - 0.03;
    // rotation.y flips x; mirror back so it lines up
    back.scale.x = -1;
    g.add(back);
    return { g, frame, screen };
  }

  _build() {
    const { W, H, T, GAP, R } = D;

    // ---- fixed half (held by the hand), local x in [-W, 0], screen at z=0 facing +z
    const fixed = this._halfBody((x, y) => [(x + W) / (2 * W), (y + H / 2) / H]);
    this.fixed = fixed.g;
    this.group.add(this.fixed);
    this._cameraPlateau(this.fixed);

    // ---- swinging half: pivot on the hinge line; at angle 0 it lies on top of the fixed half
    this.pivot = new THREE.Group();
    this.pivot.position.set(0, 0, GAP / 2);
    this.group.add(this.pivot);
    const flap = this._halfBody((x, y) => [0.5 + (-x) / (2 * W), (y + H / 2) / H]);
    this.flap = flap.g;
    this.flap.scale.z = -1;                 // screen faces -z when folded, body above
    this.flap.position.z = GAP / 2 - GAP / 2;
    this.pivot.add(this.flap);
    this._outerDisplay(this.flap);

    // ---- hinge cover: micro-blasted titanium half-cylinder that rotates at half angle
    const rCover = (T * 2 + GAP) / 2 - 0.15;
    const coverGeo = new THREE.CylinderGeometry(rCover, rCover, H - 1.2, 40, 1, false, 0, Math.PI);
    // CylinderGeometry theta 0..PI sweeps +z..-z through +x
    this.spine = new THREE.Mesh(coverGeo, this.mats.hinge);
    this.spineHolder = new THREE.Group();
    this.spineHolder.position.set(0, 0, GAP / 2);
    this.spineHolder.add(this.spine);
    this.group.add(this.spineHolder);
    // a thin dark gap where the cover meets the halves
    const capGeo = new THREE.CylinderGeometry(rCover - 0.6, rCover - 0.6, H - 0.2, 40, 1, false, 0, Math.PI);
    this.spineInner = new THREE.Mesh(capGeo, this.mats.dark);
    this.spineHolder.add(this.spineInner);

    // side buttons on the fixed half's outer edge (Touch ID side button + Camera Control)
    const btnMat = this.mats.frame;
    const sideBtn = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 14, 6, 12), btnMat);
    sideBtn.position.set(-W - 0.15, H / 2 - 30, -T / 2);
    this.fixed.add(sideBtn);
    const camCtl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 2.6), this.mats.lensGlass);
    camCtl.position.set(-W - 0.1, H / 2 - 55, -T / 2);
    this.fixed.add(camCtl);
    // volume buttons on the top edge
    for (let i = 0; i < 2; i++) {
      const v = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 7, 6, 12), btnMat);
      v.rotation.z = Math.PI / 2;
      v.position.set(-W + 18 + i * 12, H / 2 + 0.1, -T / 2);
      this.fixed.add(v);
    }

    this.innerScreens = [fixed.screen, flap.screen];
  }

  _cameraPlateau(half) {
    const { W, H, T } = D;
    // horizontal plateau along the top of the back
    const pw = W - 9, ph = 21, pr = ph / 2, depth = 1.6;
    const shape = roundedRectShape(-W / 2, H / 2 - 4.5 - ph / 2, pw, ph, pr);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth - 0.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 4, curveSegments: 24 });
    const plateau = new THREE.Mesh(geo, this.mats.plateau);
    plateau.rotation.y = Math.PI; plateau.scale.x = -1;
    plateau.position.z = -T - 0.3;
    half.add(plateau);
    const cy = H / 2 - 4.5 - ph / 2, zTop = -T - depth - 0.05;
    const lens = (x, r) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.7, r + 0.9, 1.1, 48), this.mats.lensRing);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, cy, zTop - 0.4);
      half.add(ring);
      const glassM = new THREE.Mesh(new THREE.CircleGeometry(r, 48), this.mats.lensGlass);
      glassM.rotation.y = Math.PI; glassM.position.set(x, cy, zTop - 0.97);
      half.add(glassM);
      const iris = new THREE.Mesh(new THREE.RingGeometry(r * 0.28, r * 0.42, 40), this.mats.lensRing);
      iris.rotation.y = Math.PI; iris.position.set(x, cy, zTop - 0.98);
      half.add(iris);
    };
    lens(-W + 15, 6.2);
    lens(-W + 32, 6.2);
    const flash = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), this.mats.flash);
    flash.rotation.y = Math.PI; flash.position.set(-W + 50, cy, -T - depth - 0.06);
    half.add(flash);
    const mic = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), this.mats.dark);
    mic.rotation.y = Math.PI; mic.position.set(-W + 58, cy, -T - depth - 0.06);
    half.add(mic);
  }

  _outerDisplay(half) {
    const { W, H, T, R } = D;
    // 5.4" outer display (1.41:1) on the back of the flap
    const sw = W - 3.2, sh = H - 3.6;
    const bez = new THREE.Mesh(new THREE.ShapeGeometry(halfShape(W, H, R, 0.7, 0.7), 24), this.mats.bezel);
    bez.rotation.y = Math.PI; bez.scale.x = -1; bez.position.z = -T - 0.05;
    half.add(bez);
    const g = new THREE.ShapeGeometry(roundedRectShape(-W / 2, 0, sw, sh, R - 1.6), 24);
    remapUV(g, (x, y) => [(x + W / 2) / sw + 0.5, (y) / sh + 0.5]);
    const scr = new THREE.Mesh(g, this.mats.outer);
    scr.rotation.y = Math.PI; scr.scale.x = -1; scr.position.z = -T - 0.08;
    half.add(scr);
    this.outerScreen = scr;
    // hole-punch Center Stage camera, upper right when viewed folded
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), this.mats.lensGlass);
    hole.rotation.y = Math.PI; hole.scale.x = -1;
    hole.position.set(-10, H / 2 - 7.5, -T - 0.11);
    half.add(hole);
  }

  setAngle(a) {
    this.angle = a;
    this.pivot.rotation.y = a;
    // cover rotates at half angle and sinks along its bulge as the phone opens,
    // so its flat face tucks below the display when flat
    const h = a / 2, k = 1.0 * Math.sin(h) ** 2;
    this.spineHolder.rotation.y = h;
    this.spineHolder.position.set(Math.cos(h) * k - 0.25, 0, D.GAP / 2 - Math.sin(h) * k);
  }

  // Wedge test in phone-local metres-free space (mm). Returns {inside, r, phi, y}.
  localOf(worldPos, out = new THREE.Vector3()) {
    out.copy(worldPos);
    this.group.worldToLocal(out);
    return out;
  }

  wedgeInfo(worldPos) {
    const p = this.localOf(worldPos);
    const r = Math.hypot(p.x, p.z);
    let phi = Math.atan2(p.z, p.x);           // fixed half lies along phi = PI
    if (phi < 0) phi += Math.PI * 2;
    const inside = r < D.W - 1.5 && Math.abs(p.y) < D.H / 2 - 1 && phi <= Math.PI + 0.02 && phi >= Math.PI - this.angle - 0.02;
    return { inside, r, phi, y: p.y, local: p };
  }
}
