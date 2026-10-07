import * as THREE from 'three';

// iPhone Duo, built to Apple's published dimensions (Sep 2026):
// unfolded 117.8 x 164.6 x 5.2 mm, folded 117.8 x 84.1 x 11.3 mm.
// Mirror-polished grade 5 titanium enclosure, micro-blasted hinge cover,
// 7.6" nano-texture inner display, 5.4" outer display with hole-punch camera,
// rear camera plateau with two 48MP cameras.
// Model units are millimetres; the whole phone group is scaled to metres.

export const D = { H: 117.8, W: 82.3, T: 5.2, GAP: 0.9, R: 13.5, BEVEL: 0.75 };
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
    color: 0x040405, roughness, metalness: 0, clearcoat, clearcoatRoughness: 0.04, side: THREE.DoubleSide,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1,
    specularIntensity: clearcoat ? 0.6 : 0.25,
  });
  mat.userData.uniforms = {
    uBlur: { value: 0 }, uZoom: { value: 1 }, uBright: { value: 1 },
    uDim: { value: new THREE.Vector2(1, 1) },            // brightness of the u<0.5 / u>0.5 halves
    uSize: { value: new THREE.Vector2(0, 0) },           // display size in mm (0 = no corner mask)
    uCorner: { value: 8 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.uniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uBlur; uniform float uZoom; uniform float uBright; uniform vec2 uDim; uniform vec2 uSize; uniform float uCorner;`)
      .replace('#include <emissivemap_fragment>', `
#ifdef USE_EMISSIVEMAP
  if (uSize.x > 0.0) {
    vec2 q = abs(vEmissiveMapUv - 0.5) * uSize - (uSize * 0.5 - uCorner);
    if (length(max(q, 0.0)) > uCorner) discard;
  }
  vec2 zuv = (vEmissiveMapUv - 0.5) / uZoom + 0.5;
  vec4 emissiveColor = vec4(0.0);
  // 13-tap disc blur on top of a mip bias: soft, iOS-like wake-up blur
  float rad = uBlur * 0.016;
  float bias = uBlur * 2.6;
  emissiveColor += texture2D(emissiveMap, zuv, bias) * 0.16;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5235988 + 0.3;
    float rr = (i < 6) ? 0.55 : 1.0;
    vec2 o = vec2(cos(a), sin(a) * 1.41) * rad * rr;
    emissiveColor += texture2D(emissiveMap, zuv + o, bias) * 0.07;
  }
  float side = mix(uDim.x, uDim.y, smoothstep(0.497, 0.503, vEmissiveMapUv.x));
  totalEmissiveRadiance *= emissiveColor.rgb * uBright * side;
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
      back: new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.55 }),
      plateau: new THREE.MeshPhysicalMaterial({ metalness: 0.0, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
      bezel: new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.3, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      lensGlass: new THREE.MeshPhysicalMaterial({ color: 0x030407, roughness: 0.03, metalness: 0.3, clearcoat: 1, iridescence: 0.25, iridescenceIOR: 1.4 }),
      lensRing: new THREE.MeshPhysicalMaterial({ metalness: 0.9, roughness: 0.18, color: 0x2a2c31 }),
      lensInner: new THREE.MeshPhysicalMaterial({ metalness: 0.6, roughness: 0.3, color: 0x15171c }),
      dark: new THREE.MeshStandardMaterial({ color: 0x010101, roughness: 0.6 }),
      flash: new THREE.MeshPhysicalMaterial({ color: 0xf2efe6, roughness: 0.25, transmission: 0.2 }),
      inner: screenMaterial(s.innerTex, { roughness: 0.38 }),      // nano-texture: soft reflections
      outer: screenMaterial(s.outerTex, { roughness: 0.06, clearcoat: 1 }),
    };
  }

  setFinish(name) {
    const m = this.mats;
    if (name === 'white') {
      m.frame.color.set(0xd9d3c7);
      m.hinge.color.set(0xbdb7ad);
      m.back.color.set(0xe9e8e4);
      m.plateau.color.set(0xe6e5e1);
    } else {
      m.frame.color.set(0x3b404c);
      m.hinge.color.set(0x30343e);
      m.back.color.set(0x262a33);
      m.plateau.color.set(0x2a2e38);
    }
    this.finish = name;
  }

  _halfBody() {
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

    // back glass
    const back = new THREE.Mesh(new THREE.ShapeGeometry(halfShape(W, H, R, 0.8, 0.8), 24), this.mats.back);
    back.rotation.y = Math.PI; back.position.z = -T - 0.03;
    // rotation.y flips x; mirror back so it lines up
    back.scale.x = -1;
    g.add(back);
    return { g, frame };
  }

  _build() {
    const { W, H, T, GAP, R } = D;

    // ---- fixed half (held by the hand), local x in [-W, 0], screen at z=0 facing +z
    const fixed = this._halfBody();
    this.fixed = fixed.g;
    this.group.add(this.fixed);
    this._cameraPlateau(this.fixed);

    // ---- swinging half: pivot on the hinge line; at angle 0 it lies on top of the fixed half
    this.pivot = new THREE.Group();
    this.pivot.position.set(0, 0, GAP / 2);
    this.group.add(this.pivot);
    const flap = this._halfBody();
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

    this._buildDisplay();
  }

  // ---- the 7.6" inner display: one continuous panel that bends through the hinge.
  // Columns are spaced densely near the crease; positions are recomputed per fold angle.
  _buildDisplay() {
    const { W, H } = D;
    this.dS = W - 2.3; this.dH = H / 2 - 2.3;
    const K = 241;
    this.dCols = [];
    for (let k = 0; k < K; k++) { const q = (k / (K - 1)) * 2 - 1; this.dCols.push(this.dS * Math.sign(q) * Math.abs(q) ** 1.7); }
    const pos = new Float32Array(K * 2 * 3), nor = new Float32Array(K * 2 * 3), uv = new Float32Array(K * 2 * 2), idx = [];
    for (let k = 0; k < K; k++) for (let r = 0; r < 2; r++) {
      const i = k * 2 + r;
      // viewer's left is the swinging half (s > 0) once the phone is mirrored into place
      uv[i * 2] = (this.dS - this.dCols[k]) / (2 * this.dS);
      uv[i * 2 + 1] = r;
    }
    for (let k = 0; k < K - 1; k++) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.display = new THREE.Mesh(g, this.mats.inner);
    this.display.frustumCulled = false;
    this.mats.inner.userData.uniforms.uSize.value.set(2 * this.dS, 2 * this.dH);
    this.mats.inner.userData.uniforms.uCorner.value = D.R - 3;
    this.group.add(this.display);
  }

  _bendDisplay(a) {
    const g = this.display.geometry, P = g.attributes.position.array, N = g.attributes.normal.array;
    const z0 = 0.08, off = 0.08, gap = D.GAP / 2;
    const sa = Math.sin(a), ca = Math.cos(a);
    // flap screen line: Q(s) = G + s*d (s >= 0), normal nf
    const Gx = -off * sa, Gz = gap - off * ca, dx = -ca, dz = sa, nfx = -sa, nfz = -ca;
    const phi = Math.PI - a;                    // how far the display turns through the crease
    let fillet = null;
    if (a > 0.15 && phi > 0.02) {
      const u = (z0 - Gz) / dz;
      const Hx = Gx + u * dx;
      const t = Math.min(7, 5 * Math.tan(phi / 2));
      const R = t / Math.tan(phi / 2);
      fillet = { sA: Hx - t, sB: u + t, Ax: Hx - t, R, phi };
    }
    const cols = this.dCols;
    for (let k = 0; k < cols.length; k++) {
      const s = cols[k];
      let x, z, nx, nz;
      if (fillet && s > fillet.sA && s < fillet.sB) {
        const psi = ((s - fillet.sA) / (fillet.sB - fillet.sA)) * fillet.phi;
        x = fillet.Ax + fillet.R * Math.sin(psi); z = z0 + fillet.R - fillet.R * Math.cos(psi);
        nx = -Math.sin(psi); nz = Math.cos(psi);
      } else if (s <= (fillet ? fillet.sA : 0)) {
        x = s; z = z0; nx = 0; nz = 1;
      } else {
        x = Gx + s * dx; z = Gz + s * dz; nx = nfx; nz = nfz;
      }
      for (let r = 0; r < 2; r++) {
        const i = (k * 2 + r) * 3;
        P[i] = x; P[i + 1] = r ? this.dH : -this.dH; P[i + 2] = z;
        N[i] = nx; N[i + 1] = 0; N[i + 2] = nz;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
  }

  _cameraPlateau(half) {
    const { W, H, T } = D;
    const pw = 54, ph = 25.5, depth = 1.9, m = 4.2;
    const cx = -W + m + pw / 2, cy = H / 2 - m - ph / 2;
    const shape = roundedRectShape(cx, cy, pw, ph, ph / 2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth - 1.0, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.6, bevelSegments: 6, curveSegments: 32 });
    const plateau = new THREE.Mesh(geo, this.mats.plateau);
    plateau.rotation.y = Math.PI; plateau.scale.x = -1;
    plateau.position.z = -T - 0.5;
    half.add(plateau);
    const zTop = -T - depth - 0.05;
    const lens = (x, r) => {
      // raised dark bezel ring, then the glass with a few internal element rings
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.25, 1.4, 64), this.mats.lensRing);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, cy, zTop - 0.5);
      half.add(ring);
      const face = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r, 64), this.mats.lensInner);
      face.rotation.y = Math.PI; face.position.set(x, cy, zTop - 1.21);
      half.add(face);
      const glassM = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 64), this.mats.lensGlass);
      glassM.rotation.y = Math.PI; glassM.position.set(x, cy, zTop - 1.22);
      half.add(glassM);
      for (const k of [0.5, 0.3]) {
        const iris = new THREE.Mesh(new THREE.RingGeometry(r * k - 0.25, r * k, 48), this.mats.lensRing);
        iris.rotation.y = Math.PI; iris.position.set(x, cy, zTop - 1.23);
        half.add(iris);
      }
    };
    const r = 7.6;
    lens(-W + m + 1.4 + r, r);
    lens(-W + m + 1.4 + r * 3 + 1.2, r);
    const fx = -W + m + pw - 8.5;
    const flash = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32), this.mats.flash);
    flash.scale.set(1.25, 0.9, 1);
    flash.rotation.y = Math.PI; flash.position.set(fx, cy + 4.2, -T - depth - 0.06);
    half.add(flash);
    const mic = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), this.mats.dark);
    mic.rotation.y = Math.PI; mic.position.set(fx, cy - 3.8, -T - depth - 0.06);
    half.add(mic);
  }

  _outerDisplay(half) {
    const { W, H, T, R } = D;
    // 5.4" outer display (1.41:1) on the back of the flap
    const sw = W - 3.2, sh = H - 3.6;
    const bez = new THREE.Mesh(new THREE.ShapeGeometry(halfShape(W, H, R, 0.7, 0.7), 24), this.mats.bezel);
    bez.rotation.y = Math.PI; bez.scale.x = -1; bez.position.z = -T - 0.05;
    half.add(bez);
    // rounded like the body on the outer edge, square on the hinge side
    const g = new THREE.ShapeGeometry(halfShape(W, H, R - 0.4, 1.6, 1.6), 32);
    remapUV(g, (x, y) => [0.5 - (x + W / 2) / sw, (y) / sh + 0.5]);   // u flipped: the phone is mirrored into place
    const scr = new THREE.Mesh(g, this.mats.outer);
    scr.rotation.y = Math.PI; scr.scale.x = -1; scr.position.z = -T - 0.08;
    half.add(scr);
    this.outerScreen = scr;
    // hole-punch Center Stage camera, upper right when viewed folded
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), this.mats.lensGlass);
    hole.rotation.y = Math.PI; hole.scale.x = -1;
    hole.position.set(-W + 10.5, H / 2 - 8, -T - 0.11);
    half.add(hole);
  }

  setAngle(a) {
    this.angle = a;
    this.pivot.rotation.y = a;
    this._bendDisplay(a);
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
