# Blender (headless): pose a MakeHuman right forearm+hand around a proxy of the phone's held
# half, render check views, and optionally export the posed hand as a static GLB.
# usage: blender -b -P pose_hand.py -- params.json outdir [export.glb]
import bpy, sys, os, json, math, bmesh
from mathutils import Vector, Matrix, Euler
argv = sys.argv[sys.argv.index('--') + 1:]
prm = json.load(open(argv[0])); out = argv[1]; exp = argv[2] if len(argv) > 2 else None
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
import addon_utils
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.humanservice import HumanService
S = '.' + prm.get('side', 'L')
body = HumanService.create_human(scale=0.1, macro_detail_dict={
    'gender': 0.0, 'age': 0.4, 'muscle': 0.2, 'weight': 0.12, 'proportions': 0.75, 'height': 0.5,
    'cupsize': 0.5, 'firmness': 0.5, 'race': {'asian': 0.0, 'caucasian': 1.0, 'african': 0.0}})
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.mpfb.add_standard_rig()
bpy.context.view_layer.objects.active = body
bpy.ops.mpfb.load_library_skin(filepath=os.path.join(LocationService.get_user_data('skins'), 'young_caucasian_female', 'young_caucasian_female.mhmat'))
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
body.select_set(True); bpy.context.view_layer.objects.active = body
if body.data.shape_keys: bpy.ops.object.shape_key_remove(all=True, apply_mix=True)

# keep only forearm + hand geometry
keep = {f'lowerarm01{S}', f'lowerarm02{S}', f'wrist{S}'} | {f'finger{i}-{j}{S}' for i in range(1, 6) for j in range(1, 4)} | {f'metacarpal{i}{S}' for i in range(1, 5)}
bone_names = {b.name for b in arm.data.bones}
vg = {g.index: g.name for g in body.vertex_groups}
bm = bmesh.new(); bm.from_mesh(body.data); dl = bm.verts.layers.deform.verify()
kill = []
for v in bm.verts:
    d = {vg[i]: w for i, w in v[dl].items()}
    if any(n in ('HelperGeometry', 'JointCubes') and w > 0 for n, w in d.items()): kill.append(v); continue
    tot = sum(w for n, w in d.items() if n in bone_names) or 1
    if sum(w for n, w in d.items() if n in keep) / tot < 0.5: kill.append(v)
bmesh.ops.delete(bm, geom=kill, context='VERTS')
# survivors follow only forearm/hand bones (stray upper-arm weight would stretch them)
keep_idx = {i for i, n in vg.items() if n in keep}
for v in bm.verts:
    d = v[dl]
    for i in [i for i in d.keys() if vg[i] in bone_names and i not in keep_idx]: del d[i]
bm.to_mesh(body.data); bm.free()
for m in list(body.modifiers):
    if m.type == 'MASK': body.modifiers.remove(m)

# free the forearm from the upper arm so the whole forearm+hand can be placed rigidly
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
arm.data.edit_bones[f'lowerarm01{S}'].use_connect = False
bpy.ops.object.mode_set(mode='POSE')
pb = arm.pose.bones
for b in pb: b.rotation_mode = 'XYZ'

def rot(name, x=0, y=0, z=0):
    b = pb[name]; b.rotation_euler = Euler((x, y, z), 'XYZ')

# local finger / wrist rotations (radians); curl about local X
for n, (bn, vals) in enumerate(prm['fingers'].items()):
    for j, v in enumerate(vals):
        if isinstance(v, list): rot(f'finger{bn}-{j+1}{S}', *v)
        else: rot(f'finger{bn}-{j+1}{S}', v)
rot(f'wrist{S}', *prm.get('wrist', [0, 0, 0]))
rot(f'lowerarm02{S}', *prm.get('forearm', [0, 0, 0]))
bpy.context.view_layer.update()

# palm frame from posed joints (armature space == world, armature at origin)
print('ARM WORLD', arm.matrix_world)
Wm = arm.matrix_world.copy()
H = lambda n: pb[n].head.copy()          # armature space
O = H(f'wrist{S}'); F = (H(f'finger3-1{S}') - O).normalized()
A = H(f'finger2-1{S}') - H(f'finger5-1{S}'); A = (A - F * A.dot(F)).normalized()
N = F.cross(A)
rest = Matrix((A, F, N)).transposed().to_4x4(); rest.translation = O
# target, given in rig space (three.js: x right, y up, z to camera) -> Blender (x, -z, y)
r2b = lambda v: Vector((v[0], -v[2], v[1]))
Ft = r2b(prm['f']).normalized(); At = r2b(prm['a']); At = (At - Ft * At.dot(Ft)).normalized()
Nt = Ft.cross(At)
tgt = Matrix((At, Ft, Nt)).transposed().to_4x4(); tgt.translation = r2b(prm['o'])
tgt = Wm.inverted() @ tgt                # world target -> armature space
M = tgt @ rest.inverted()
la = pb[f'lowerarm01{S}']
la.matrix = M @ la.matrix
bpy.context.view_layer.update()

for n in range(1, 6):
    t = pb[f'finger{n}-3{S}'].tail; h1 = pb[f'finger{n}-1{S}'].head
    print('TIP', n, 'rig xyz', round(t.x, 3), round(t.z, 3), round(-t.y, 3), ' base', round(h1.x, 3), round(h1.z, 3), round(-h1.y, 3))
# ---- long almond nails: copy MakeHuman's fingernail patches off the posed hand,
# stretch them past the fingertip, taper, lift a little and give them thickness.
def make_nails():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg); me = ev.to_mesh()
    gi = body.vertex_groups['fingernails'].index
    wts = [0.0] * len(body.data.vertices)
    for v in body.data.vertices:
        for g in v.groups:
            if g.group == gi: wts[v.index] = g.weight
    bmn = bmesh.new(); bmn.from_mesh(me); ev.to_mesh_clear()
    bmn.verts.ensure_lookup_table()
    bmesh.ops.delete(bmn, geom=[f for f in bmn.faces if not all(wts[v.index] > 0.5 for v in f.verts)], context='FACES')
    bmesh.ops.delete(bmn, geom=[v for v in bmn.verts if not v.link_faces], context='VERTS')
    tips = [arm.matrix_world @ pb[f'finger{n}-3{S}'].tail for n in range(1, 6)]
    seen = set()
    for f0 in list(bmn.faces):
        if f0 in seen: continue
        isl, stack = set(), [f0]
        while stack:
            f = stack.pop()
            if f in isl: continue
            isl.add(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g not in isl: stack.append(g)
        seen |= isl
        vs = {v for f in isl for v in f.verts}
        c = sum((v.co for v in vs), Vector()) / len(vs)
        n = sum((f.normal for f in isl), Vector()).normalized()
        ti = min(range(5), key=lambda i: (tips[i] - c).length); t = tips[ti]
        ext = 0.55 if ti == 0 else 1.0
        d = (t - c); d = (d - n * d.dot(n)).normalized()
        L = max((v.co - c).dot(d) for v in vs)
        for v in vs:
            r = v.co - c
            a = r.dot(d)
            if a > 0:
                k = a / L
                lat = r - d * a - n * r.dot(n)
                v.co += d * a * 1.1 * ext - lat * 0.3 * k * k + n * 0.0004 * k
            lat2 = r - d * r.dot(d) - n * r.dot(n)
            v.co -= n * (lat2.length ** 2) * 9.0          # transverse curvature
            v.co += n * 0.0003
    bmesh.ops.solidify(bmn, geom=bmn.faces[:], thickness=0.0004)
    nm = bpy.data.meshes.new('nails'); bmn.to_mesh(nm); bmn.free()
    o = bpy.data.objects.new('nails', nm); bpy.context.collection.objects.link(o)
    mt = bpy.data.materials.new('nail'); mt.use_nodes = True
    p = mt.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value = (0.42, 0.01, 0.02, 1)
    p.inputs['Roughness'].default_value = 0.18; p.inputs['Coat Weight'].default_value = 1.0
    nm.materials.append(mt)
    for poly in nm.polygons: poly.use_smooth = True
    return o
nails = make_nails()

# ---- proxy phone (held half + open flap) in Blender coords
def box(name, size, loc, rotz=0, mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size; o.rotation_euler = (0, 0, rotz)
    if mat: o.data.materials.append(mat)
    return o
def mat(name, col, emit=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value = (*col, 1)
    if emit: p.inputs['Emission Color'].default_value = (*col, 1); p.inputs['Emission Strength'].default_value = emit
    return m
W, Hh, T = 0.0823, 0.1178, 0.0052
bpy.ops.object.mode_set(mode='OBJECT')
held = box('held', (W, T, Hh), (W / 2, T / 2, 0), mat=mat('body', (0.05, 0.06, 0.08)))
scr = box('screen', (W - 0.003, 0.0004, Hh - 0.003), (W / 2, -0.0002, 0), mat=mat('scr', (0.55, 0.65, 0.8), 1.5))
ang = math.radians(118)
# flap: hinge at x=0, swings toward the camera (-y in Blender) and left
fx = -math.cos(math.pi - ang); fy = -math.sin(math.pi - ang)
flap = box('flap', (W, T, Hh), (W / 2 * -math.cos(math.radians(180 - 118)) * -1 * -1, 0, 0), mat=mat('body2', (0.05, 0.06, 0.08)))
flap.location = (-(W / 2) * math.cos(math.radians(62)), -(W / 2) * math.sin(math.radians(62)), 0)
flap.rotation_euler = (0, 0, math.radians(62))

# ---- lights, cameras, render
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 700; bpy.context.scene.render.resolution_y = 560
w = bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.72, 0.68, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
bpy.ops.object.light_add(type='SUN', location=(0.3, -0.5, 0.6)); bpy.context.active_object.data.energy = 3; bpy.context.active_object.rotation_euler = (math.radians(50), math.radians(20), math.radians(-30))
def cam(name, loc, rot, lens=55):
    bpy.ops.object.camera_add(location=loc, rotation=rot); c = bpy.context.active_object; c.data.lens = lens; c.data.clip_start = 0.01; return c
views = {
  'front': cam('front', (0.02, -0.42, -0.01), (math.radians(90), 0, 0)),
  'front3q': cam('f3q', (0.25, -0.36, 0.05), (math.radians(85), 0, math.radians(35))),
  'back': cam('back', (0.05, 0.42, -0.02), (math.radians(90), 0, math.radians(180))),
  'side': cam('side', (0.45, -0.01, -0.02), (math.radians(90), 0, math.radians(90))),
  'top': cam('top', (0.05, -0.02, 0.4), (0, 0, 0)),
}
for k, c in views.items():
    bpy.context.scene.camera = c
    bpy.context.scene.render.filepath = os.path.join(out, f'{k}.png')
    bpy.ops.render.render(write_still=True)

if exp:
    # bake the pose into a static mesh, drop the rig and proxies, export
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    for m in list(body.modifiers):
        if m.type == 'ARMATURE': bpy.ops.object.modifier_apply(modifier=m.name)
    sub = body.modifiers.new('sub', 'SUBSURF'); sub.levels = 2
    bpy.ops.object.modifier_apply(modifier='sub')
    bpy.ops.object.shade_smooth()
    body.data.materials.clear()
    for o in list(bpy.data.objects):
        if o not in (body, nails): bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); nails.select_set(True)
    bpy.ops.export_scene.gltf(filepath=exp, export_format='GLB', use_selection=True, export_materials='NONE', export_texcoords=True, export_skins=False, export_apply=False)
    print('EXPORTED', exp, len(body.data.vertices))
