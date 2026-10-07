import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Screens } from './screens.js';
import { Phone, D, OPEN_CATCH } from './phone.js';
import { Hand } from './hand.js';
import { Fly, Corpses } from './fly.js';
import { Sound } from './audio.js';
import { TrailPass } from './trail.js';

const Q = new URLSearchParams(location.search);
const { clamp, lerp } = THREE.MathUtils;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 50);
const CAM_BASE = new THREE.Vector3(0, 0, 0.42);
camera.position.copy(CAM_BASE);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(Math.min(devicePixelRatio, 2));
composer.addPass(new RenderPass(scene, camera));
const trail = new TrailPass();
composer.addPass(trail);
composer.addPass(new OutputPass());

new RGBELoader().load('assets/' + (Q.get('hdr') ?? 'lebombo') + '_1k.hdr', (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;
  scene.background = hdr;
  scene.backgroundBlurriness = +(Q.get('blur') ?? 0.22);
  scene.backgroundIntensity = 0.8;
  const rot = +(Q.get('bgrot') ?? 4.7);
  scene.backgroundRotation.set(0, rot, 0);
  scene.environmentRotation.set(0, rot, 0);
  assetsReady();
});

const key = new THREE.DirectionalLight(0xfff1e0, 1.6);
key.position.set(0.4, 0.7, 0.6);
scene.add(key);

// ------------------------------------------------------------------ objects
const screens = new Screens();
const phone = new Phone(screens);
const rig = new THREE.Group();               // hand + phone, metres
scene.add(rig);
// The phone is modelled with its held half on the left; mirroring it gives the real
// device's layout: the right (camera) half is held, the outer-display half swings
// open and shut like a book cover.
const mirror = new THREE.Group();
mirror.scale.x = -1;
rig.add(mirror);
mirror.add(phone.group);
const hand = new Hand();
rig.add(hand.group);

// Right hand holding the right half: edge in the palm, thumb on the front bezel, fingers
// hooked round the back. Posed in Blender against a proxy of the held half (rig space).
const handReady = hand.load('assets/hand-posed.glb', 'assets/skin.jpg').then(() => {
  if (Q.has('handonly')) phone.group.visible = false;
});

const fly = new Fly(scene);
const corpses = new Corpses(scene);

// a soft contact shadow under the fly on the fixed screen
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const flyShadow = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 }));
phone.fixed.add(flyShadow);

const sound = new Sound();

// ------------------------------------------------------------------ layout
const ROT_BASE = new THREE.Euler(+(Q.get('rx') ?? 0.15), +(Q.get('ry') ?? -0.4), 0);
const viewHalf = new THREE.Vector2();
function layout() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  trail.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  camera.aspect = aspect;
  // keep the open phone (~0.17 m wide) comfortably inside narrow portrait screens
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(0.42, 0.135 / (tanH * aspect));
  CAM_BASE.set(0, 0, dist);
  camera.position.copy(CAM_BASE);
  camera.updateProjectionMatrix();
  viewHalf.set(tanH * dist * aspect, tanH * dist);
  const flyScale = clamp(dist / 0.42, 1, 1.7);
  fly.model.object.scale.setScalar(flyScale);
  fly.baseScale = flyScale;
  corpses.setFloor((z) => -Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (CAM_BASE.z - z) + 0.005 * flyScale, flyScale);
  fly.setBounds(
    new THREE.Vector3(-viewHalf.x * 0.82, -viewHalf.y * 0.72, -0.02),
    new THREE.Vector3(viewHalf.x * 0.82, viewHalf.y * 0.72, 0.03),
  );
}

// ------------------------------------------------------------------ helpers
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
const mmToWorld = (x, y, z, out = new THREE.Vector3()) => phone.group.localToWorld(out.set(x, y, z));
const dirToWorld = (v) => v.transformDirection(phone.group.matrixWorld);

// wedge centre (aim point) in phone-local mm, on the bisector between the halves
function wedgeCenterLocal(a = phone.angle, r = 42) {
  const phi = Math.PI - a / 2;
  return new THREE.Vector3(Math.cos(phi) * r, 0, Math.sin(phi) * r);
}

const flyCtx = {
  landWorld(spot, hoverMm) {
    const stand = 3.4 * fly.baseScale;
    return mmToWorld(spot.x, spot.y, 0.06 + stand + hoverMm);
  },
  landQuat(yaw) {
    // fly up = screen normal (+z local), forward along (sin yaw, cos yaw) in the screen plane
    const fwd = new THREE.Vector3(Math.sin(yaw), Math.cos(yaw), 0);
    const up = new THREE.Vector3(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(up, fwd);
    const m = new THREE.Matrix4().makeBasis(right, up, fwd);
    const local = new THREE.Quaternion().setFromRotationMatrix(m);
    phone.group.getWorldQuaternion(tmpQ);
    return tmpQ.clone().multiply(local);
  },
  clampLand(spot) {
    spot.x = clamp(spot.x, -72, -10);
    spot.y = clamp(spot.y, -48, 48);
  },
  screenNormal() { return dirToWorld(new THREE.Vector3(0, 0, 1)); },
  // keep the fly from flying through the halves while they are open
  avoid(f) {
    if (game.mode !== 'open' && game.mode !== 'opening') return;
    const p = phone.localOf(f.pos);
    const inX = p.x > -D.W && p.x < 0, inY = Math.abs(p.y) < D.H / 2;
    if (inX && inY && p.z > -2 && p.z < 7) {
      f.vel.addScaledVector(dirToWorld(new THREE.Vector3(0, 0, 1)), (7 - p.z) * 0.02);
    }
    const a = phone.angle;
    const n = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));     // flap screen normal (into wedge)
    const d = new THREE.Vector3(-Math.cos(a), 0, Math.sin(a));      // along the flap
    const q = p.clone().sub(new THREE.Vector3(0, 0, D.GAP / 2));
    const along = q.dot(d), off = q.dot(n);
    if (along > 0 && along < D.W && Math.abs(p.y) < D.H / 2 && off > -2 && off < 7) {
      f.vel.addScaledVector(dirToWorld(n), (7 - off) * 0.02);
    }
  },
};

// ------------------------------------------------------------------ game state
const ui = {
  caught: document.getElementById('caught'),
  missed: document.getElementById('missed'),
  hint: document.getElementById('hint'),
  toast: document.getElementById('toast'),
  sound: document.getElementById('sound'),
};
const game = {
  mode: 'intro',          // intro | opening | open | snapping | shut | reopening
  t: 0, modeT: 0,
  caught: 0, missed: 0,
  snapFrom: OPEN_CATCH,
  pendingCatch: false, holdFor: 0,
  scr: { flap: 0, fixed: 0, blur: 1.5, outer: 1 },   // display state, eased every frame
  shake: 0,
  respawnIn: -1,
  stillFor: 0,
  landCooldown: 4,
};
const aim = { target: new THREE.Vector3(0, -0.005, 0), pos: new THREE.Vector3(0, -0.32, 0), vel: new THREE.Vector3() };
const lastAimPos = aim.pos.clone();
ui.hint.classList.add('gone');

function setMode(m) { game.mode = m; game.modeT = 0; }

let toastTimer;
function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 900);
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function snap() {
  if (game.mode !== 'open') return;
  game.snapFrom = phone.angle;
  game.pendingCatch = false;
  setMode('snapping');
  sound.whoosh();
  ui.hint.classList.add('gone');
  // the fly's escape reflex: houseflies react in ~50-150 ms
  if (fly.flying || fly.state === 'landed') {
    const wc = mmToWorld(...wedgeCenterLocal().toArray());
    if (fly.pos.distanceTo(wc) < 0.11) {
      fly.reactAt = (fly.state === 'landed' ? 0.12 : 0.06) + Math.random() * 0.08;
    }
  }
}

// ------------------------------------------------------------------ input
const pointer = { touch: false, downAt: 0, lastX: 0, lastY: 0, moved: 0 };
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function pointerToWorld(cx, cy, out) {
  const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(plane, out);
  return out;
}
function soundFirstGesture() {
  if (sound.userChoice === undefined && !sound.enabled) sound.enable().then(updateSoundBtn);
}
canvas.addEventListener('pointerdown', (e) => {
  soundFirstGesture();
  pointer.touch = e.pointerType !== 'mouse';
  pointer.downAt = performance.now(); pointer.moved = 0;
  pointer.lastX = e.clientX; pointer.lastY = e.clientY;
  if (!pointer.touch) { pointerToWorld(e.clientX, e.clientY, aim.target); snap(); }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') {
    pointerToWorld(e.clientX, e.clientY, aim.target);
  } else if (e.buttons || e.pressure > 0) {
    // touch: relative drag so the finger never hides the phone
    const s = (viewHalf.x * 2) / innerWidth * 1.15;
    aim.target.x += (e.clientX - pointer.lastX) * s;
    aim.target.y -= (e.clientY - pointer.lastY) * s;
    pointer.moved += Math.hypot(e.clientX - pointer.lastX, e.clientY - pointer.lastY);
    pointer.lastX = e.clientX; pointer.lastY = e.clientY;
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse' && pointer.moved < 10 && performance.now() - pointer.downAt < 350) snap();
});
addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); soundFirstGesture(); snap(); }
});

function updateSoundBtn() {
  ui.sound.textContent = sound.enabled ? 'Sound on' : 'Sound off';
  ui.sound.setAttribute('aria-pressed', String(sound.enabled));
}
ui.sound.addEventListener('click', async () => {
  if (sound.enabled) { sound.disable(); sound.userChoice = false; }
  else { await sound.enable(); sound.userChoice = true; }
  updateSoundBtn();
});
updateSoundBtn();

for (const b of document.querySelectorAll('.sw')) {
  b.addEventListener('click', () => {
    phone.setFinish(b.dataset.finish);
    for (const o of document.querySelectorAll('.sw')) { o.classList.toggle('active', o === b); o.setAttribute('aria-checked', String(o === b)); }
  });
}

setInterval(() => screens.draw(), 15000);

// ------------------------------------------------------------------ start
let started = false;
let pendingAssets = 3;
function assetsReady() {
  if (--pendingAssets > 0) return;
  document.getElementById('veil').classList.add('gone');
  started = true;
}
handReady.then(assetsReady);
screens.ready.then(assetsReady);
addEventListener('resize', layout);
layout();
fly.spawn(true);

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
const innerU = phone.mats.inner.userData.uniforms;
const outerU = phone.mats.outer.userData.uniforms;
game.timeScale = +(Q.get('slow') ?? 1);

function tick() {
  let dt = Math.min(clock.getDelta(), 1 / 30) * game.timeScale;
  if (game.manualDt !== undefined) { dt = game.manualDt; game.manualDt = 0; }   // debug stepping
  if (!started) { composer.render(); return; }
  game.t += dt; game.modeT += dt;

  // ---- phone fold state machine
  const M = game.mode;
  if (M === 'intro') {
    // the hand brings the folded phone up into view, then unfolds it
    const k = easeOut(clamp(game.modeT / 1.1, 0, 1));
    aim.pos.set(0, lerp(-0.3, aim.target.y, k), 0);
    phone.setAngle(0);
    if (game.modeT > 1.5) { setMode('opening'); sound.unfold(); }
  } else if (M === 'opening') {
    const k = easeInOut(clamp(game.modeT / 1.15, 0, 1));
    phone.setAngle(lerp(0, OPEN_CATCH, k));
    if (k >= 1) { setMode('open'); ui.hint.classList.remove('gone'); }
  } else if (M === 'snapping') {
    // a flick of the wrist: accelerates hard, slams into the magnets
    const dur = 0.13;
    const k = clamp(game.modeT / dur, 0, 1);
    let a = game.snapFrom * (1 - Math.pow(k, 2.5));
    // a fly still inside the wedge when it's nearly shut gets pressed between the screens
    if (fly.state !== 'caught' && (fly.flying || fly.state === 'landed')) {
      phone.setAngle(Math.max(a, 0.001));
      rig.updateMatrixWorld(true);
      let w = phone.wedgeInfo(fly.pos);
      // the closing half is a moving wall: a fly it sweeps over gets carried along with it
      const swept = w.phi < Math.PI - a && w.phi > Math.PI - game.snapFrom - 0.05;
      if (swept && w.r < D.W - 1.5 && Math.abs(w.y) < D.H / 2 - 1) {
        const phi = Math.PI - a + 0.01;
        fly.pos.copy(mmToWorld(Math.cos(phi) * w.r, w.y, Math.sin(phi) * w.r));
        w = phone.wedgeInfo(fly.pos);
      }
      if (w.inside && a < 0.3) {
        if (fly.state !== 'landed') fly.landYaw = Math.random() * 6.28;
        game.pendingCatch = true;
        fly.catchAt(new THREE.Vector2(w.local.x, w.local.y), fly.landYaw);
      }
    }
    a = Math.max(a, game.pendingCatch ? 0.035 : 0);
    phone.setAngle(a);
    if (k >= 1) {
      setMode('shut');
      game.shake = game.pendingCatch ? 1.0 : 0.7;
      sound.clack(false);
      if (game.pendingCatch) sound.squish();
      navigator.vibrate?.(game.pendingCatch ? [18, 30, 12] : 14);
      if (game.pendingCatch) {
        game.caught++; ui.caught.textContent = game.caught;
        screens.setCaught(game.caught);
        setTimeout(() => toast(pick(['Gotcha.', 'Splat.', 'Folded.', 'Pressed flat.'])), 120);
        game.holdFor = 0.6;
      } else {
        game.missed++; ui.missed.textContent = game.missed;
        toast(pick(['Missed.', 'Too slow.', 'It saw that.', 'Nope.']));
        game.holdFor = 0.28;
      }
    }
  } else if (M === 'shut') {
    // tiny rebound off the magnets
    const b = Math.sin(clamp(game.modeT / 0.09, 0, 1) * Math.PI) * 0.06 * (game.pendingCatch ? 0.5 : 1);
    phone.setAngle((game.pendingCatch ? 0.035 : 0) + b);
    if (game.modeT > game.holdFor) { setMode('reopening'); sound.unfold(); }
  } else if (M === 'reopening') {
    const k = clamp(game.modeT / 0.7, 0, 1);
    const a = lerp(game.pendingCatch ? 0.035 : 0, OPEN_CATCH, easeInOut(k) * 0.35 + easeOutBack(k) * 0.65);
    phone.setAngle(a);
    if (game.pendingCatch && fly.state === 'caught' && a > 0.45) {
      // the corpse peels off the screen and drops to the bottom of the view, where it stays
      const v = flyCtx.screenNormal().multiplyScalar(0.06).add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0.05, 0));
      corpses.add(fly.model.object, v);
      fly.state = 'gone'; fly.model.object.visible = false;
      game.pendingCatch = false;
      game.respawnIn = 1.3;
    }
    if (k >= 1) setMode('open');
  } else if (M === 'open') {
    phone.setAngle(OPEN_CATCH + Math.sin(game.t * 1.3) * 0.012);   // a hand is never perfectly still
  }

  if (Q.has('a')) {
    // debug: freeze at a fixed fold angle, skip the intro
    if (game.mode === 'intro' || game.mode === 'opening') { setMode('open'); aim.pos.copy(aim.target); }
    phone.setAngle(THREE.MathUtils.degToRad(+Q.get('a')));
  }
  // ---- screens, as seen in hands-on footage:
  // folding: the swinging half goes dark at once, the held half frosts over and dims;
  // folded: inner off, the outer Lock Screen wakes (slight zoom + blur settling);
  // unfolding: held half lights first (frosted), the other joins past ~70 deg, and the
  // whole panel resolves from heavy blur to sharp once it's open.
  {
    // Everything is a smooth function of the fold angle, plus one eased "settle" once open,
    // so the panel never pops: the swinging half fades as it leaves ~110 deg, the held half
    // frosts and dims through the middle of the travel, and once open the frost clears
    // over ~0.6 s with an ease-out.
    const a = phone.angle, S = game.scr;
    const sm = THREE.MathUtils.smoothstep;
    const closing = M === 'snapping' || M === 'shut';
    const flapTarget = sm(a, 0.95, 1.85);
    const fixedTarget = sm(a, 0.12, 0.8) * (closing ? 0.6 + 0.4 * sm(a, 1.2, 2.0) : 1);
    const travel = 1 - sm(a, 1.75, 2.0);                 // frost while the halves are moving
    const ease = (v, t, rate) => v + (t - v) * (1 - Math.exp(-dt * rate));
    S.flap = ease(S.flap, flapTarget, 22);
    S.fixed = ease(S.fixed, fixedTarget, 18);
    if (M === 'open') {
      S.settle = Math.min(1, (S.settle ?? 0) + dt / 0.6);
    } else S.settle = 0;
    const settleCurve = 1 - Math.pow(1 - S.settle, 3);
    const blurTarget = Math.max(travel * 1.35, closing ? 1.2 * (1 - sm(a, 1.9, 2.06)) : 0, M === 'open' ? 1.35 * (1 - settleCurve) * (S.blurAtOpen ?? 1) : 0);
    S.blur = ease(S.blur, blurTarget, M === 'open' ? 40 : 14);
    if (M !== 'open') S.blurAtOpen = Math.min(1, S.blur / 1.35);
    const shutLongEnough = (M === 'shut' && game.modeT > 0.08) || M === 'intro' || Q.has('a');
    S.outer = ease(S.outer, a < 0.22 && shutLongEnough ? 1 : 0, S.outer < 0.5 && a < 0.22 ? 7 : 30);
    innerU.uBright.value = 1.12;
    innerU.uDim.value.set(S.flap, S.fixed);
    innerU.uBlur.value = S.blur;
    innerU.uZoom.value = 1 + S.blur * 0.03;
    outerU.uBright.value = S.outer;
    outerU.uBlur.value = (1 - S.outer) * 1.4;
    outerU.uZoom.value = 1 + (1 - S.outer) * 0.05;
  }

  // ---- aim + rig
  if (M !== 'intro') {
    aim.target.x = clamp(aim.target.x, -viewHalf.x * 0.9, viewHalf.x * 0.9);
    aim.target.y = clamp(aim.target.y, -viewHalf.y * 0.85, viewHalf.y * 0.85);
    aim.pos.lerp(aim.target, 1 - Math.exp(-dt * 16));
  }
  aim.vel.subVectors(aim.pos, lastAimPos).divideScalar(Math.max(dt, 1e-4));
  lastAimPos.copy(aim.pos);
  const lean = aim.vel;
  rig.rotation.set(
    ROT_BASE.x - clamp(lean.y * 0.12, -0.25, 0.25),
    ROT_BASE.y + clamp(lean.x * 0.15, -0.3, 0.3),
    clamp(-lean.x * 0.08, -0.15, 0.15),
  );
  // put the wedge centre under the aim point
  rig.position.set(0, 0, 0);
  rig.updateMatrixWorld(true);
  const wc = mmToWorld(...wedgeCenterLocal(OPEN_CATCH).toArray());
  rig.position.copy(aim.pos).sub(wc);
  if (M === 'shut') rig.position.y -= 0.004 * Math.sin(clamp(game.modeT / 0.15, 0, 1) * Math.PI);
  rig.updateMatrixWorld(true);

  // ---- fly behaviour
  const speed = aim.vel.length();
  if (speed < 0.08) game.stillFor += dt; else game.stillFor = 0;
  game.landCooldown -= dt;
  if (fly.reactAt !== undefined) {
    fly.reactAt -= dt;
    if (fly.reactAt <= 0) {
      fly.reactAt = undefined;
      if (fly.state !== 'caught') {
        const wcw = mmToWorld(...wedgeCenterLocal().toArray());
        const dir = fly.pos.clone().sub(wcw).normalize();
        // escape outward through the open side of the wedge
        const out = mmToWorld(...wedgeCenterLocal(phone.angle, 140).toArray()).sub(wcw).normalize();
        fly.startle(dir.add(out).normalize(), 2.1);
      }
    }
  }
  if (fly.flying && speed > 0.55) {
    const wcw = mmToWorld(...wedgeCenterLocal().toArray());
    if (fly.pos.distanceTo(wcw) < 0.075 && Math.random() < dt * 6) fly.startle(fly.pos.clone().sub(wcw).normalize(), 1);
  }
  if (fly.state === 'landed' && (speed > 0.3 || M === 'reopening')) fly.takeOff(flyCtx);
  if (fly.state === 'fly' && M === 'open' && game.stillFor > 1.2 && game.landCooldown < 0 && Math.random() < dt * 0.35) {
    const spot = new THREE.Vector2(lerp(-65, -18, Math.random()), lerp(-40, 42, Math.random()));
    fly.land(spot, Math.random() * Math.PI * 2);
    game.landCooldown = 8 + Math.random() * 6;
  }
  if (fly.state === 'land' && (M !== 'open' || speed > 0.2)) { fly.state = 'fly'; fly.pickTarget(); }
  fly.update(dt, flyCtx);
  corpses.update(dt);
  if (fly.state === 'gone') {
    game.respawnIn -= dt;
    if (game.respawnIn <= 0) fly.spawn(true);
  }

  // contact shadow on the fixed screen
  {
    const p = phone.localOf(fly.model.object.position);
    const h = p.z;
    const on = fly.model.object.visible && p.x < -2 && p.x > -D.W && Math.abs(p.y) < D.H / 2 && h > -1 && h < 40 && fly.state !== 'caught';
    flyShadow.material.opacity = on ? clamp(1 - h / 40, 0, 1) * 0.9 : 0;
    flyShadow.position.set(p.x + 1.5, p.y - 1.5, 0.12);
    const s = 1 + h / 25;
    flyShadow.scale.set(s, s, 1);
  }

  // ---- audio
  {
    tmpV.copy(fly.pos).project(camera);
    const d = fly.pos.distanceTo(camera.position);
    const near = clamp(1 - (d - CAM_BASE.z * 0.6) / (CAM_BASE.z * 0.9), 0, 1);
    sound.buzz(tmpV.x, near, fly.vel.length(), fly.flying && fly.model.object.visible && Math.abs(tmpV.x) < 1.6, dt);
  }

  // ---- camera shake + motion trail during the snap
  game.shake = Math.max(0, game.shake - dt * 5);
  const sh = game.shake * game.shake * 0.0022;
  camera.position.set(CAM_BASE.x + (Math.random() - 0.5) * sh, CAM_BASE.y + (Math.random() - 0.5) * sh, CAM_BASE.z);
  trail.amount = M === 'snapping' ? 0.38 : Math.max(0, trail.amount - dt * 6);

  if (Q.has('flycam')) {
    // debug: orbit a close-up camera around the fly
    const [az, el, dist] = (Q.get('flycam') || '0.6,0.3,0.035').split(',').map(Number);
    const fp = fly.model.object.position;
    camera.position.set(fp.x + Math.sin(az) * Math.cos(el) * dist, fp.y + Math.sin(el) * dist, fp.z + Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(fp);
  }
  composer.render();
}
renderer.setAnimationLoop(tick);

window.__app = { ROT_BASE, THREE, scene, camera, phone, renderer, screens, hand, rig, fly, game, aim, snap, sound, corpses };
