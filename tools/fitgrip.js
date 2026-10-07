// Minimal-change grip repair: stay close to a reference grip, remove surface penetration
// and anything crossing in front of the screen (except the thumb on the right bezel).
(() => {
  const A = __app, h = A.hand, T = A.THREE;
  const inv = new T.Matrix4().copy(A.rig.matrixWorld).invert();
  const P = (n) => h.bone(n).getWorldPosition(new T.Vector3()).applyMatrix4(inv);
  const mesh = h.mesh, pos = mesh.geometry.attributes.position;
  const samples = []; for (let i = 0; i < pos.count; i += 6) samples.push(i);
  const v = new T.Vector3(); const BACK = -0.0052, W = 0.0823, HH = 0.059;
  const ref = window.__ref;
  const apply = (x) => { h.applyGrip(x); A.rig.updateMatrixWorld(true); };
  function cost(x) {
    let bad = 0, front = 0;
    mesh.skeleton.update();
    for (const i of samples) {
      mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
      const over = v.x > -0.0015 && v.x < W + 0.001 && Math.abs(v.y) < HH + 0.001;
      if (over && v.z < 0.0015 && v.z > BACK - 0.0004) bad += Math.min(v.z - (BACK - 0.0004), 0.0015 - v.z) + 0.0004;
      // nothing but the thumb (lower right, on the bezel) may sit in front of the screen plane
      const near = v.x > -0.012 && v.x < 0.1 && Math.abs(v.y) < 0.08;
      const thumbZone = v.x > 0.07 && v.y < 0.01;
      if (near && v.z >= 0.0 && !thumbZone) front += 0.001 + v.z * 0.1;
    }
    let reg = 0; for (let i = 0; i < x.length; i++) reg += ((x[i] - ref[i]) / (i < 3 ? 0.01 : 0.5)) ** 2;
    return bad * 30 + front * 3 + reg * 0.002;
  }
  const lims = x => x.map((_, i) => (i < 3 ? 0.002 : 0.06));
  let x = (window.__x ?? ref).slice(); apply(x); let best = cost(x);
  const L = lims(x);
  for (let it = 0; it < (window.__iters ?? 800); it++) {
    const y = x.slice(); const k = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < k; j++) { const i = Math.floor(Math.random() * y.length); y[i] += (Math.random() - 0.5) * 2 * L[i]; }
    y[23] = Math.max(-0.5, Math.min(0.5, y[23])); y[24] = Math.max(-0.4, Math.min(0.4, y[24]));
    apply(y); const c = cost(y); if (c < best) { best = c; x = y; }
  }
  window.__x = x; apply(x);
  return { cost: +best.toFixed(5), x: x.map(v => +v.toFixed(3)) };
})();
