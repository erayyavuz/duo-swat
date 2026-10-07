import bpy, os, bmesh
bpy.ops.wm.read_factory_settings(use_empty=True)
import addon_utils
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services.locationservice import LocationService
bpy.ops.mpfb.create_human()
body = bpy.context.active_object
bpy.ops.mpfb.add_standard_rig()
bpy.context.view_layer.objects.active = body
skin = os.path.join(LocationService.get_user_data('skins'), 'young_caucasian_male', 'young_caucasian_male.mhmat')
print(bpy.ops.mpfb.load_library_skin(filepath=skin))
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
print('dims', body.dimensions[:], 'scale', body.scale[:], arm.scale[:])
# apply modifiers except armature (MPFB adds a mask for helper geometry, maybe subsurf)
print('mods', [(m.name, m.type) for m in body.modifiers])
vg = {g.index: g.name for g in body.vertex_groups}
keep_bones = {'lowerarm01.R', 'lowerarm02.R', 'wrist.R'} | {f'finger{i}-{j}.R' for i in range(1, 6) for j in range(1, 4)} | {f'metacarpal{i}.R' for i in range(1, 5)}
print('groups sample', [n for n in vg.values() if 'helper' in n.lower() or 'joint' in n.lower()][:10], len(vg))
bpy.context.view_layer.objects.active = body
body.select_set(True)
if body.data.shape_keys: bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
bone_names = {b.name for b in arm.data.bones}
me = body.data
bm = bmesh.new(); bm.from_mesh(me)
deform = bm.verts.layers.deform.verify()
kill = []
for v in bm.verts:
    d = v[deform]
    names = {vg[i]: w for i, w in d.items()}
    helper = any(n in ('HelperGeometry', 'JointCubes') and w > 0 for n, w in names.items())
    w_keep = sum(w for n, w in names.items() if n in keep_bones)
    tot = sum(w for n, w in names.items() if n in bone_names) or 1
    if helper or w_keep / tot < 0.5:
        kill.append(v)
bmesh.ops.delete(bm, geom=kill, context='VERTS')
bm.to_mesh(me); bm.free()
print('verts kept', len(me.vertices))
# drop non-armature modifiers (mask etc.), add subsurf before armature and apply it
for m in list(body.modifiers):
    if m.type != 'ARMATURE': body.modifiers.remove(m)
bpy.context.view_layer.objects.active = body
sub = body.modifiers.new('sub', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
bpy.ops.object.modifier_move_to_index(modifier='sub', index=0)
bpy.ops.object.modifier_apply(modifier='sub')
bpy.ops.object.shade_smooth()
print('verts sub', len(me.vertices))
# remove material (texture is applied in three.js)
me.materials.clear()
for o in list(bpy.data.objects):
    if o not in (body, arm): bpy.data.objects.remove(o)
# bone info for posing
for b in arm.data.bones:
    if b.name in keep_bones: print('bone', b.name, 'parent', b.parent.name if b.parent else None, 'head', [round(x, 4) for x in b.head_local], 'tail', [round(x, 4) for x in b.tail_local])
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(os.getcwd(), 'arm.glb'), export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_materials='NONE', export_texcoords=True)
