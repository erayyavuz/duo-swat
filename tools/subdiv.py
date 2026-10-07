import bpy, sys, bmesh
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-2])
for o in list(bpy.data.objects):
    if o.name=='Icosphere': bpy.data.objects.remove(o)
mesh=bpy.data.objects['r_handMeshNode']
bpy.context.view_layer.objects.active=mesh; mesh.select_set(True)
bm=bmesh.new(); bm.from_mesh(mesh.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(mesh.data); bm.free()
print("verts merged", len(mesh.data.vertices))
sub=mesh.modifiers.new("sub",'SUBSURF'); sub.levels=2; sub.render_levels=2
bpy.ops.object.modifier_move_to_index(modifier="sub", index=0)
bpy.ops.object.modifier_apply(modifier="sub")
bpy.ops.object.shade_smooth()
print("verts after", len(mesh.data.vertices), len(mesh.vertex_groups))
bpy.ops.export_scene.gltf(filepath=sys.argv[-1], export_format='GLB', export_skins=True, export_animations=False, export_materials='NONE', export_texcoords=False)
