# Blender: merge, extrude the open wrist into a seamless forearm (weighted to the wrist joint),
# subdivide, export. usage: blender -b -P subdiv.py -- in.glb out.glb
import bpy, sys, bmesh, math
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-2])
for o in list(bpy.data.objects):
    if o.name == 'Icosphere': bpy.data.objects.remove(o)
mesh = bpy.data.objects['r_handMeshNode']
bpy.context.view_layer.objects.active = mesh; mesh.select_set(True)
me = mesh.data
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.verts.ensure_lookup_table()
deform = bm.verts.layers.deform.verify()
wrist_idx = mesh.vertex_groups['wrist'].index
# the wrist end is a slanted closed cap: slice it off flat to get an open ring
geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((0, 0, 0.058)), plane_no=Vector((0, 0, 1)), clear_outer=True)
# boundary ring at the wrist = the open edge loop with the highest glTF-y (Blender z)
bnd = [e for e in bm.edges if e.is_boundary]
ring = list({v for e in bnd for v in e.verts})
print('boundary verts', len(ring))
c = sum((v.co for v in ring), Vector()) / len(ring)
# glTF +y (towards the elbow) is Blender +z; palm side is glTF -x = Blender -x
d0 = Vector((0, 0, 1))
d1 = Vector((-math.sin(math.radians(38)), 0, math.cos(math.radians(38))))
edges = bnd
prev_c = c.copy()
steps = 10
for i in range(steps):
    t = (i + 1) / steps
    dirv = (d0.lerp(d1, min(1, t * 1.6))).normalized()
    step = 0.012 if i < 2 else 0.028
    ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
    nv = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    edges = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMEdge) and all(v in nv for v in g.verts)]
    new_c = prev_c + dirv * step
    s = 1.0 + 0.035 * (1 if i > 1 else 0.3)
    for v in nv:
        off = v.co - prev_c
        # keep the ring perpendicular-ish to the travel direction, widen gently
        off = off - dirv * off.dot(dirv) * 0.5
        v.co = new_c + off * s
        for k in list(v[deform].keys()): del v[deform][k]
        v[deform][wrist_idx] = 1.0
    prev_c = new_c
bm.to_mesh(me); bm.free()
print("verts merged+arm", len(me.vertices))
sub = mesh.modifiers.new("sub", 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
bpy.ops.object.modifier_move_to_index(modifier="sub", index=0)
bpy.ops.object.modifier_apply(modifier="sub")
bpy.ops.object.shade_smooth()
print("verts after", len(me.vertices))
bpy.ops.export_scene.gltf(filepath=sys.argv[-1], export_format='GLB', export_skins=True, export_animations=False, export_materials='NONE', export_texcoords=False)
