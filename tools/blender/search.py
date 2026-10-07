# Blender: fast bone-only search for a grip (no rendering). Writes best params to argv[-1].
import bpy, sys, os, json, math, random
from mathutils import Vector, Matrix, Euler
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
import addon_utils
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
bpy.ops.mpfb.create_human()
bpy.ops.mpfb.add_standard_rig()
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT'); arm.data.edit_bones['lowerarm01.R'].use_connect = False
bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones
for b in pb: b.rotation_mode = 'XYZ'
la = pb['lowerarm01.R']; la_rest = la.matrix.copy()
r2b = lambda v: Vector((v[0], -v[2], v[1]))
b2r = lambda v: Vector((v.x, v.z, -v.y))
def apply(p):
    la.matrix = la_rest
    for n, vals in p['fingers'].items():
        for j, v in enumerate(vals):
            pb[f'finger{n}-{j+1}.R'].rotation_euler = Euler(v if isinstance(v, list) else (v, 0, 0), 'XYZ')
    bpy.context.view_layer.update()
    H = lambda n: pb[n].head.copy()
    O = H('wrist.R'); F = (H('finger3-1.R') - O).normalized()
    A = H('finger2-1.R') - H('finger5-1.R'); A = (A - F * A.dot(F)).normalized()
    rest = Matrix((A, F, F.cross(A))).transposed().to_4x4(); rest.translation = O
    Ft = r2b(p['f']).normalized(); At = r2b(p['a']); At = (At - Ft * At.dot(Ft)).normalized()
    tgt = Matrix((At, Ft, Ft.cross(At))).transposed().to_4x4(); tgt.translation = r2b(p['o'])
    la.matrix = tgt @ rest.inverted() @ la.matrix
    bpy.context.view_layer.update()
def pts(n):  # rig-space points along finger n
    return [b2r(pb[f'finger{n}-{j}.R'].head) for j in (1, 2, 3)] + [b2r(pb[f'finger{n}-3.R'].tail)]
BACK = -0.0052
def cost():
    e = 0
    # thumb: tip on front bezel near the right edge
    t = pts(1)
    e += 3 * (t[3] - Vector((0.07, -0.01, 0.009))).length
    for v in t[1:]:
        if v.x < 0.083 and v.z < 0.006 and v.z > BACK - 0.008: e += 0.5   # through phone
    # fingers: pads (tip and last joint) against the back, inside the outline, nothing in front
    for n in range(2, 6):
        p = pts(n)
        for i, v in enumerate(p):
            inside = -0.001 < v.x < 0.083 and abs(v.y) < 0.059
            if inside and v.z > BACK - 0.007: e += 0.4 + 20 * (v.z - (BACK - 0.007))   # penetrating / in front
            if i >= 2: e += 2 * abs(v.z - (BACK - 0.0085)) + (0 if inside else 0.05)
        if p[3].y > 0.025: e += 2 * (p[3].y - 0.025)
        # wrap round the back: tips well in from the edge, knuckles behind the phone
        e += 1.5 * abs(p[3].x - 0.045)
        if p[0].z > -0.009: e += 3 * (p[0].z + 0.009)
    w = b2r(pb['wrist.R'].head)
    if w.y > -0.055: e += 3 * (w.y + 0.055)
    return e
P0 = {"o": [0.118, -0.078, -0.02], "f": [-0.3, 1, -0.05], "a": [0.7, 0, 0.7],
      "fingers": {"1": [[0, 0, 0], 0.1, 0.1], "2": [0.7, 0.6, 0.3], "3": [0.75, 0.6, 0.3], "4": [0.8, 0.6, 0.3], "5": [0.85, 0.65, 0.3]}}
def mutate(p, s):
    q = json.loads(json.dumps(p))
    k = random.randint(0, 5)
    if k == 0: q['o'] = [q['o'][i] + random.gauss(0, 0.006 * s) for i in range(3)]
    elif k == 1: q['f'] = [q['f'][i] + random.gauss(0, 0.15 * s) for i in range(3)]
    elif k == 2: q['a'] = [q['a'][i] + random.gauss(0, 0.2 * s) for i in range(3)]
    elif k == 3:
        q['fingers']['1'][0] = [q['fingers']['1'][0][i] + random.gauss(0, 0.25 * s) for i in range(3)]
        for j in (1, 2): q['fingers']['1'][j] = min(1.2, max(-0.3, q['fingers']['1'][j] + random.gauss(0, 0.2 * s)))
    else:
        n = str(random.randint(2, 5)); j = random.randint(0, 2)
        q['fingers'][n][j] = min(1.5, max(0.0, q['fingers'][n][j] + random.gauss(0, 0.25 * s)))
    return q
random.seed(int(os.environ.get('SEED', '1')))
best = json.load(open(out)) if os.path.exists(out) and os.environ.get('CONT') else P0
apply(best); bc = cost()
N = int(os.environ.get('N', '2500'))
for it in range(N):
    s = 1.2 - it / N
    q = mutate(best, s); apply(q); c = cost()
    if c < bc: bc, best = c, q
apply(best)
print('COST', round(bc, 4))
for n in range(1, 6): print('TIP', n, [round(x, 3) for x in pts(n)[3]])
json.dump(best, open(out, 'w'))
