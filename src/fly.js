import * as THREE from 'three';

// Common housefly (Musca domestica), modelled in millimetres (forward = +z, up = +y),
// scaled up ~1.5x so it reads on screen. Wings beat ~200 Hz in reality, far above the
// frame rate, so in flight each wing is drawn at a random stroke phase plus a faint
// motion-blur fan, which is how a fast shutter / the eye actually perceives them.

const SCALE = 0.0015;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const thoraxTex = () => canvasTex(256, 128, (ctx, w, h) => {
  // u wraps around the body axis; u = 0.75 is the dorsal midline, 0.25 the belly
  ctx.fillStyle = '#4e4b45'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2a2724'; ctx.fillRect(0.05 * w, 0, 0.4 * w, h);
  // four dark longitudinal stripes on the back
  ctx.fillStyle = '#151311';
  for (const u of [0.665, 0.715, 0.765, 0.815]) ctx.fillRect((u - 0.0175) * w, 0, w * 0.035, h);
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.4})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
});

const abdomenTex = () => canvasTex(256, 128, (ctx, w, h) => {
  ctx.fillStyle = '#2e2b27'; ctx.fillRect(0, 0, w, h);
  // yellowish translucent flanks (u = 0.5 and 1.0 are the sides)
  ctx.fillStyle = 'rgba(160,128,70,0.6)';
  ctx.fillRect(0.42 * w, 0, 0.14 * w, h);
  ctx.fillRect(0.0, 0, 0.06 * w, h); ctx.fillRect(0.94 * w, 0, 0.06 * w, h);
  // checker "tessellated" dorsal pattern
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    ctx.fillStyle = (i + j) % 2 ? 'rgba(120,112,98,0.38)' : 'rgba(14,12,10,0.4)';
    ctx.fillRect(0.56 * w + i * 0.064 * w, j * h / 4, 0.064 * w, h / 4);
  }
  for (let j = 1; j < 4; j++) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, j * h / 4 - 1, w, 2); }
});

const wingTex = () => canvasTex(256, 128, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(120,120,110,0.65)'); g.addColorStop(1, 'rgba(210,215,220,0.28)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,35,30,0.85)'; ctx.lineWidth = 1.6;
  const veins = [[0.0, 0.5, 1.0, 0.42], [0.0, 0.52, 0.95, 0.62], [0.05, 0.55, 0.85, 0.82], [0.1, 0.5, 0.95, 0.25], [0.3, 0.6, 0.6, 0.95]];
  for (const [x0, y0, x1, y1] of veins) { ctx.beginPath(); ctx.moveTo(x0 * w, y0 * h); ctx.quadraticCurveTo((x0 + x1) / 2 * w, (y0 + y1) / 2 * h - 6, x1 * w, y1 * h); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0.55 * w, 0.4 * h); ctx.lineTo(0.62 * w, 0.75 * h); ctx.stroke();
});

const fanTex = () => canvasTex(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(0, h / 2, 0, 0, h / 2, w);
  g.addColorStop(0, 'rgba(90,90,85,0.5)'); g.addColorStop(0.7, 'rgba(160,165,170,0.22)'); g.addColorStop(1, 'rgba(200,200,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
});

function ellipsoid(rx, ry, rz, mat, seg = 32) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  g.rotateX(Math.PI / 2);          // poles along z so the texture's v runs along the body
  const m = new THREE.Mesh(g, mat);
  m.scale.set(rx, ry, rz);
  return m;
}

let SHARED;
function shared() {
  if (SHARED) return SHARED;
  SHARED = {
    thorax: new THREE.MeshPhysicalMaterial({ map: thoraxTex(), roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0x8a857c), sheenRoughness: 0.5 }),
    abdomen: new THREE.MeshPhysicalMaterial({ map: abdomenTex(), roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color(0x777060) }),
    head: new THREE.MeshPhysicalMaterial({ color: 0x48443d, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xb8a98a) }),
    face: new THREE.MeshPhysicalMaterial({ color: 0xb8a57a, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color(0xfff2c8) }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0x7a1e12, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.5, sheenColor: new THREE.Color(0xff6040) }),
    leg: new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.6 }),
    wing: new THREE.MeshPhysicalMaterial({ map: wingTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [200, 600] }),
    fan: new THREE.MeshBasicMaterial({ map: fanTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.55 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.8 }),
  };
  return SHARED;
}

// --- legs: hip -> femur -> knee -> tibia -> ankle -> tarsus
function makeLeg(mat, side, idx) {
  const hip = new THREE.Group();
  const lens = [[1.7, 1.9, 1.5], [1.8, 2.0, 1.5], [2.0, 2.3, 1.7]][idx];
  const radii = [0.13, 0.09, 0.06];
  let parent = hip;
  const joints = [];
  for (let s = 0; s < 3; s++) {
    const j = new THREE.Group();
    parent.add(j);
    const geo = new THREE.CylinderGeometry(radii[s] * 0.8, radii[s], lens[s], 6, 1);
    geo.translate(0, -lens[s] / 2, 0);
    const m = new THREE.Mesh(geo, mat);
    j.add(m);
    const next = new THREE.Group();
    next.position.y = -lens[s];
    j.add(next);
    joints.push(j);
    parent = next;
  }
  // tiny foot pad
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat);
  parent.add(pad);
  hip.userData = { side, idx, joints };
  return hip;
}

// leg poses: [hipYawOut, hipPitch, knee, ankle] per leg pair (front, mid, hind)
const POSES = {
  flight: [[0.3, -0.35, -1.7, 0.9], [0.4, 0.55, -1.8, 0.9], [0.35, 1.05, -1.5, 0.6]],
  stand: [[0.7, -0.5, -1.0, 0.9], [1.35, 0.0, -0.9, 0.8], [0.95, 0.55, -0.95, 0.8]],
  dead: [[0.25, 1.2, -2.4, 1.2], [0.3, 0.6, -2.5, 1.3], [0.3, 0.2, -2.4, 1.2]],
};

export class FlyModel {
  constructor() {
    const M = shared();
    this.object = new THREE.Group();          // world-space container (metres)
    this.body = new THREE.Group();            // millimetre space
    this.body.scale.setScalar(SCALE);
    this.object.add(this.body);

    // thorax
    const thorax = ellipsoid(1.35, 1.25, 1.65, M.thorax);
    thorax.position.set(0, 0.1, 1.0);
    this.body.add(thorax);
    // scutellum bump
    const scut = ellipsoid(0.7, 0.45, 0.6, M.thorax, 16);
    scut.position.set(0, 0.95, -0.45);
    this.body.add(scut);
    // abdomen
    const abd = ellipsoid(1.45, 1.05, 1.95, M.abdomen);
    abd.position.set(0, -0.15, -1.75);
    abd.rotation.x = -0.12;
    this.body.add(abd);
    // head
    const head = ellipsoid(1.25, 1.15, 0.85, M.head);
    head.position.set(0, 0.2, 3.05);
    this.body.add(head);
    const face = ellipsoid(0.55, 0.8, 0.4, M.face, 16);
    face.position.set(0, -0.05, 3.62);
    this.body.add(face);
    // compound eyes, large and red-brown, nearly meeting on top (male)
    for (const s of [-1, 1]) {
      const eye = ellipsoid(0.82, 1.0, 0.72, M.eye, 24);
      eye.position.set(s * 0.62, 0.32, 3.18);
      eye.rotation.y = s * 0.35;
      this.body.add(eye);
    }
    // proboscis
    const prob = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.1, 8), M.face);
    prob.position.set(0, -0.85, 3.45); prob.rotation.x = 0.4;
    this.body.add(prob);
    // bristles on thorax (silhouette detail)
    const hairGeo = new THREE.CylinderGeometry(0.01, 0.03, 0.45, 3);
    hairGeo.translate(0, 0.22, 0);
    for (let i = 0; i < 26; i++) {
      const h = new THREE.Mesh(hairGeo, M.hair);
      const a = (Math.random() - 0.5) * 2.2, z = 0.2 + Math.random() * 2.0;
      h.position.set(Math.sin(a) * 1.2, Math.cos(a) * 1.1 + 0.1, z);
      h.rotation.set(-0.9 + Math.random() * 0.3, 0, -a * 0.8);
      this.body.add(h);
    }

    // legs
    this.legs = [];
    const hipZ = [1.9, 1.15, 0.45];
    for (let idx = 0; idx < 3; idx++) for (const s of [-1, 1]) {
      const leg = makeLeg(M.leg, s, idx);
      leg.position.set(s * 0.55, -0.85, hipZ[idx]);
      this.body.add(leg);
      this.legs.push(leg);
    }

    // wings
    this.wings = [];
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(s * 0.55, 1.0, 1.2);
      const geo = new THREE.PlaneGeometry(6.4, 2.3);
      geo.translate(3.2, 0, 0);
      const wing = new THREE.Mesh(geo, M.wing);
      wing.rotation.x = -Math.PI / 2;   // lie in the xz plane
      const holder = new THREE.Group();
      holder.add(wing);
      hinge.add(holder);
      if (s < 0) holder.scale.x = -1;
      // motion blur fan, a sector swept through the stroke
      const fanGeo = new THREE.CircleGeometry(6.6, 24, -1.15, 2.3);
      fanGeo.rotateX(-Math.PI / 2);     // stroke plane ~ horizontal, sweeping fore-aft
      const fan = new THREE.Mesh(fanGeo, M.fan);
      const fanHolder = new THREE.Group();
      fanHolder.add(fan);
      hinge.add(fanHolder);
      if (s < 0) fanHolder.scale.x = -1;
      this.body.add(hinge);
      this.wings.push({ s, hinge, holder, fanHolder, fan });
    }

    this.legPose = POSES.flight.map((p) => p.slice());
    this.flying = true;
    this.dead = false;
    this.shadow = null;
  }

  setLegPose(name, k = 1) {
    const target = POSES[name];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
      this.legPose[i][j] += (target[i][j] - this.legPose[i][j]) * k;
    }
  }

  applyLegs(t = 0, walking = 0) {
    for (const leg of this.legs) {
      const { side, idx, joints } = leg.userData;
      const [yawOut, pitch, knee, ankle] = this.legPose[idx];
      const step = walking ? Math.sin(t * 22 + idx * 2.1 + (side > 0 ? Math.PI : 0)) * 0.35 * walking : 0;
      leg.rotation.set(0, 0, 0);
      // spread outward around the body axis, then swing forward/back
      joints[0].rotation.set(pitch + step, 0, side * yawOut);
      joints[1].rotation.set(knee, 0, 0);
      joints[2].rotation.set(ankle, 0, 0);
    }
  }

  // stroke: wings beating (flying) or folded back over the abdomen
  animateWings(t, beating) {
    for (const w of this.wings) {
      if (beating) {
        const phase = Math.random() * Math.PI * 2;
        const sweep = Math.sin(phase) * 1.1;          // + = toward the back
        w.hinge.rotation.set(0, 0, w.s * (0.3 + Math.cos(phase) * 0.25));
        w.holder.rotation.set(0, w.s * sweep, 0);
        w.holder.children[0].rotation.x = -Math.PI / 2 + Math.cos(phase) * 0.6;  // pitch flip each half-stroke
        w.fan.visible = true;
        w.fanHolder.rotation.set(0, 0, 0);
        w.holder.children[0].material.opacity = 0.55;
      } else {
        w.hinge.rotation.set(0, 0, 0);
        // folded: swept back ~ 155deg, slightly overlapping, tilted down
        w.holder.rotation.set(0, w.s * 1.32, 0);
        w.holder.children[0].rotation.x = -Math.PI / 2 + 0.08;
        w.fan.visible = false;
        w.holder.children[0].material.opacity = 1;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Behaviour: erratic saccadic flight inside a box, landing on the screen,
// escape reflex when the phone moves fast or snaps nearby.

const v3 = () => new THREE.Vector3();

export class Fly {
  constructor(scene) {
    this.model = new FlyModel();
    scene.add(this.model.object);
    this.pos = v3(); this.vel = v3(); this.target = v3();
    this.state = 'fly';            // fly | land | landed | escape | caught | falling | gone
    this.t = 0; this.stateT = 0; this.nextTurn = 0;
    this.bounds = { min: v3(), max: v3() };
    this.heading = new THREE.Quaternion();
    this.landSpot = null;          // phone-local mm
    this.reaction = 0;
    this.spin = v3();
  }

  setBounds(min, max) { this.bounds.min.copy(min); this.bounds.max.copy(max); }

  spawn(fromEdge = true) {
    const b = this.bounds;
    const side = Math.random() < 0.5 ? -1 : 1;
    if (fromEdge) this.pos.set(side * (b.max.x + 0.06), THREE.MathUtils.lerp(b.min.y, b.max.y, Math.random()), THREE.MathUtils.lerp(b.min.z, b.max.z, Math.random()));
    else this.pos.set(THREE.MathUtils.lerp(b.min.x, b.max.x, 0.8), b.max.y * 0.6, 0.02);
    this.vel.set(-side * 0.25, 0, 0);
    this.state = 'fly'; this.stateT = 0;
    this.model.dead = false;
    this.model.object.visible = true;
    this.model.object.scale.setScalar(this.baseScale ?? 1);
    this.model.object.quaternion.identity();
    this.model.setLegPose('flight', 1);
    this.pickTarget();
  }

  pickTarget(bias) {
    const b = this.bounds;
    this.target.set(
      THREE.MathUtils.lerp(b.min.x, b.max.x, Math.random()),
      THREE.MathUtils.lerp(b.min.y, b.max.y, Math.random()),
      THREE.MathUtils.lerp(b.min.z, b.max.z, Math.random()),
    );
    if (bias) this.target.lerp(bias, 0.5);
    this.nextTurn = 0.25 + Math.random() * 0.9;
    this.cruise = 0.16 + Math.random() * 0.22;
  }

  // dir: unit vector to flee along
  startle(dir, strength = 1) {
    if (this.state === 'caught' || this.state === 'falling' || this.state === 'gone') return;
    const b = this.bounds;
    this.state = 'escape'; this.stateT = 0;
    this.landSpot = null;
    const away = dir.clone().multiplyScalar(0.12 + 0.06 * strength).add(this.pos);
    away.x = THREE.MathUtils.clamp(away.x, b.min.x, b.max.x);
    away.y = THREE.MathUtils.clamp(away.y, b.min.y, b.max.y);
    away.z = THREE.MathUtils.clamp(away.z, b.min.z, b.max.z);
    this.target.copy(away);
    this.vel.addScaledVector(dir, 0.6 * strength);
    this.nextTurn = 0.35;
    this.cruise = 0.55;
  }

  get flying() { return this.state === 'fly' || this.state === 'escape' || this.state === 'land'; }

  update(dt, ctx) {
    this.t += dt; this.stateT += dt;
    const m = this.model;
    const o = m.object;

    if (this.state === 'fly' || this.state === 'escape' || this.state === 'land') {
      this.nextTurn -= dt;
      if (this.state !== 'land' && this.nextTurn <= 0) {
        if (this.state === 'escape' && this.stateT > 0.5) this.state = 'fly';
        this.pickTarget();
      }
      let tgt = this.target;
      if (this.state === 'land') {
        tgt = ctx.landWorld(this.landSpot, 6);          // approach a point hovering above the spot
        if (this.pos.distanceTo(tgt) < 0.006) {
          this.state = 'landed'; this.stateT = 0; this.landedFor = 1.6 + Math.random() * 3.5;
          this.vel.set(0, 0, 0);
        }
      }
      // steering: accelerate toward target, plus high-frequency jitter (bobbing)
      const desired = v3().subVectors(tgt, this.pos);
      const dist = desired.length();
      const speed = this.state === 'land' ? Math.min(0.12, dist * 3 + 0.02) : this.cruise;
      desired.normalize().multiplyScalar(speed);
      const steer = desired.sub(this.vel).multiplyScalar(this.state === 'escape' ? 14 : 7);
      this.vel.addScaledVector(steer, dt);
      const j = 0.35;
      this.vel.x += (Math.random() - 0.5) * j * dt * 10;
      this.vel.y += (Math.random() - 0.5) * j * dt * 10 + Math.sin(this.t * 13) * 0.02;
      this.vel.z += (Math.random() - 0.5) * j * dt * 6;
      if (dist < 0.02 && this.state !== 'land') this.nextTurn = Math.min(this.nextTurn, 0.05);
      // keep out of the phone's solid halves
      ctx.avoid?.(this);
      this.pos.addScaledVector(this.vel, dt);

      // orientation: face velocity, bank into turns
      const fwd = this.vel.lengthSq() > 1e-6 ? this.vel.clone().normalize() : v3().set(0, 0, 1);
      const look = new THREE.Matrix4().lookAt(new THREE.Vector3(), fwd.clone().negate(), new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(look);
      // nose slightly down, body pitched like a hovering fly
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, 0)));
      this.heading.slerp(q, 1 - Math.exp(-dt * 12));
      o.quaternion.copy(this.heading);
      o.position.copy(this.pos);
      m.setLegPose('flight', 1 - Math.exp(-dt * 10));
      m.applyLegs(this.t);
      m.animateWings(this.t, true);
    } else if (this.state === 'landed') {
      // stuck to the phone: follow it in phone-local space
      const wp = ctx.landWorld(this.landSpot, 0);
      this.pos.copy(wp);
      o.position.copy(wp);
      const q = ctx.landQuat(this.landYaw);
      o.quaternion.copy(q);
      this.heading.copy(q);
      m.setLegPose('stand', 1 - Math.exp(-dt * 12));
      // walk a little, then pause and rub front legs
      const walking = (Math.sin(this.stateT * 1.3) > 0.4) ? 1 : 0;
      if (walking) {
        this.landSpot.x += Math.sin(this.landYaw) * dt * 8;
        this.landSpot.y += Math.cos(this.landYaw) * dt * 8;
        this.landYaw += (Math.random() - 0.5) * dt * 3;
        ctx.clampLand(this.landSpot);
      }
      m.applyLegs(this.t, walking);
      if (!walking) {
        const front = m.legs.slice(0, 2);
        for (const leg of front) leg.userData.joints[0].rotation.x += Math.sin(this.t * 18) * 0.25 - 0.4;
      }
      m.animateWings(this.t, false);
      if (this.stateT > this.landedFor) this.takeOff(ctx);
    } else if (this.state === 'caught') {
      const wp = ctx.landWorld(this.landSpot, 0.4);
      o.position.copy(wp);
      o.quaternion.copy(ctx.landQuat(this.landYaw));
      m.setLegPose('dead', 1);
      m.applyLegs(0);
      m.animateWings(0, false);
      o.scale.set(1.06, 1.06, 0.55).multiplyScalar(this.baseScale ?? 1);
    } else if (this.state === 'falling') {
      this.vel.y -= 1.6 * dt;
      this.vel.multiplyScalar(1 - dt * 0.8);
      this.pos.addScaledVector(this.vel, dt);
      o.position.copy(this.pos);
      o.rotateX(this.spin.x * dt); o.rotateY(this.spin.y * dt); o.rotateZ(this.spin.z * dt);
      if (this.pos.y < this.bounds.min.y - 0.18) { this.state = 'gone'; o.visible = false; }
    }
  }

  land(spot, yaw) { this.state = 'land'; this.stateT = 0; this.landSpot = spot; this.landYaw = yaw; }

  takeOff(ctx) {
    const n = ctx.screenNormal();
    this.state = 'fly'; this.stateT = 0;
    this.pos.addScaledVector(n, 0.004);
    this.vel.copy(n).multiplyScalar(0.3);
    this.landSpot = null;
    this.pickTarget();
  }

  catchAt(spot, yaw) {
    this.state = 'caught'; this.stateT = 0; this.landSpot = spot; this.landYaw = yaw;
    this.model.dead = true;
  }

  drop(worldPos, vel) {
    this.state = 'falling'; this.stateT = 0;
    this.pos.copy(worldPos);
    this.vel.copy(vel);
    this.model.object.scale.set(1, 1, 0.8).multiplyScalar(this.baseScale ?? 1);
    // belly up
    this.model.object.rotateZ(Math.PI);
    this.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6);
  }
}
