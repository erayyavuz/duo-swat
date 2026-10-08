# Blender: fast bone-only search for a grip (no rendering). Writes best params to argv[-1].
import bpy, sys, os, json, math, random
from mathutils import Vector, Matrix, Euler
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
import addon_utils
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService
body = HumanService.create_human(scale=0.1, macro_detail_dict={
    'gender': 0.0, 'age': 0.4, 'muscle': 0.2, 'weight': 0.12, 'proportions': 0.75, 'height': 0.5,
    'cupsize': 0.5, 'firmness': 0.5, 'race': {'asian': 0.0, 'caucasian': 1.0, 'african': 0.0}})
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.mpfb.add_standard_rig()
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT'); arm.data.edit_bones['lowerarm01.L'].use_connect = False
bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones
for b in pb: b.rotation_mode = 'XYZ'
la = pb['lowerarm01.L']; la_rest = la.matrix.copy()
keepb = {'lowerarm02.L', 'wrist.L'} | {f'finger{i}-{j}.L' for i in range(1, 6) for j in range(1, 4)} | {f'metacarpal{i}.L' for i in range(1, 5)}
vgn = {g.index: g.name for g in body.vertex_groups}
SAMP = []
for v in body.data.vertices:
    ws = {vgn[g.group]: g.weight for g in v.groups}
    if sum(w for n, w in ws.items() if n in keepb) > 0.6 and not any(n in ('HelperGeometry', 'JointCubes') and w > 0 for n, w in ws.items()):
        SAMP.append(v.index)
SAMP = SAMP[::2]
print('SAMPLES', len(SAMP))
def surface():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg); me = ev.to_mesh()
    out = [b2r(me.vertices[i].co) for i in SAMP]
    ev.to_mesh_clear()
    return out
r2b = lambda v: Vector((v[0], -v[2], v[1]))
b2r = lambda v: Vector((v.x, v.z, -v.y))
def apply(p):
    global CUR; CUR = p
    la.matrix = la_rest
    for n, vals in p['fingers'].items():
        for j, v in enumerate(vals):
            pb[f'finger{n}-{j+1}.L'].rotation_euler = Euler(v if isinstance(v, list) else (v, 0, 0), 'XYZ')
    bpy.context.view_layer.update()
    H = lambda n: pb[n].head.copy()
    O = H('wrist.L'); F = (H('finger3-1.L') - O).normalized()
    A = H('finger2-1.L') - H('finger5-1.L'); A = (A - F * A.dot(F)).normalized()
    rest = Matrix((A, F, F.cross(A))).transposed().to_4x4(); rest.translation = O
    Ft = r2b(p['f']).normalized(); At = r2b(p['a']); At = (At - Ft * At.dot(Ft)).normalized()
    tgt = Matrix((At, Ft, Ft.cross(At))).transposed().to_4x4(); tgt.translation = r2b(p['o'])
    la.matrix = tgt @ rest.inverted() @ la.matrix
    bpy.context.view_layer.update()
def pts(n):  # rig-space points along finger n
    return [b2r(pb[f'finger{n}-{j}.L'].head) for j in (1, 2, 3)] + [b2r(pb[f'finger{n}-3.L'].tail)]
BACK = -0.0052
BOTTOM = -0.0589
def cost():
    # Hand entirely behind the held (right) half: palm and all five digits resting on the
    # back, nothing past the top/side outline, only wrist + palm heel below the bottom edge.
    e = 0
    for n in range(1, 6):
        p = pts(n)
        for i, v in enumerate(p[1:]):
            if v.x > 0.076: e += 0.3 + 30 * (v.x - 0.076)
            if v.x < 0.006: e += 0.3 + 30 * (0.006 - v.x)
            if v.y > 0.05: e += 0.3 + 30 * (v.y - 0.05)
        e += 20 * abs(p[3].z - (BACK - 0.0075))         # pads on the back
        e += 10 * abs(p[2].z - (BACK - 0.008)) + 6 * abs(p[1].z - (BACK - 0.0085))
    bad = 0.0; vis = 0
    for v in surface():
        inside = -0.002 < v.x < 0.0845 and abs(v.y) < 0.0602
        if inside and v.z > BACK - 0.0003: bad += 1 + 400 * (v.z - (BACK - 0.0003))
        if v.z > -0.001 and v.y > -0.064: bad += 1                      # nothing in front of the phone
        if v.x > 0.0845 and v.y > -0.05: vis += 1                       # peeking past the right edge
    e += bad * 0.02 + vis * 0.004
    w = b2r(pb['wrist.L'].head)
    if w.y > -0.075: e += 4 * (w.y + 0.075)
    if w.y < -0.105: e += 4 * (-0.105 - w.y)
    e += 1.5 * abs(w.x - 0.048)
    # fingers close together, not splayed
    xs = [pts(n)[3].x for n in range(2, 6)]
    e += 0.8 * max(0, (max(xs) - min(xs)) - 0.05)
    return e
P0 = {"side": "L", "o": [0.0, -0.115, -0.019], "f": [0.35, 1, 0], "a": [-1, 0.35, 0.15],
      "fingers": {"1": [[0, 0, 0], 0.3, 0.2], "2": [-0.35, -0.25, -0.1], "3": [-0.35, -0.25, -0.1], "4": [-0.35, -0.25, -0.1], "5": [-0.3, -0.25, -0.1]}}
def mutate(p, s):
    q = json.loads(json.dumps(p))
    k = (random.choice([0, 3, 3]) if os.environ.get('TO') else 3) if os.environ.get('THUMB') else (random.choice([0, 3, 4, 5]) if os.environ.get('FREEZE') else random.randint(0, 5))
    if k == 0: q['o'] = [q['o'][i] + random.gauss(0, 0.006 * s) for i in range(3)]
    elif k == 1: q['f'] = [q['f'][i] + random.gauss(0, (0.04 if os.environ.get('WEB') else 0.15) * s) for i in range(3)]
    elif k == 2: q['a'] = [q['a'][i] + random.gauss(0, (0.04 if os.environ.get('WEB') else 0.2) * s) for i in range(3)]
    elif k == 3:
        q['fingers']['1'][0] = [min(1.0, max(-1.0, q['fingers']['1'][0][i] + random.gauss(0, 0.2 * s))) for i in range(3)]
        for j in (1, 2): q['fingers']['1'][j] = min(0.8, max(-0.2, q['fingers']['1'][j] + random.gauss(0, 0.15 * s)))
    else:
        # fingers move together (closed, like the reference), tiny per-finger offsets
        j = random.randint(0, 2); dv = random.gauss(0, 0.2 * s)
        def bump(n, j, d):
            v = q['fingers'][n][j]
            if isinstance(v, list): v[0] = min(1.5, max(-0.6, v[0] + d))
            else: q['fingers'][n][j] = min(1.5, max(-0.6, v + d))
        for n in '2345': bump(n, j, dv)
        bump(random.choice('2345'), random.randint(0, 2), random.gauss(0, 0.08 * s))
    return q
random.seed(int(os.environ.get('SEED', '1')))
best = json.load(open(out)) if os.path.exists(out) and os.environ.get('CONT') else P0
apply(best); bc = cost()
N = int(os.environ.get('N', '2500'))
if os.environ.get('PRINT'): N = 0
for it in range(N):
    s = 1.2 - it / N
    q = mutate(best, s); apply(q); c = cost()
    if c < bc: bc, best = c, q
apply(best)
print('COST', round(bc, 4))
for n in range(1, 6): print('TIP', n, [round(x, 3) for x in pts(n)[3]])
if N: json.dump(best, open(out, 'w'))
