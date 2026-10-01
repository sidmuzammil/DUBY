"""Original Duby robot-otter. Reproducible source; Blender 4.3.2, no external assets."""
import bpy, math, pathlib, json, hashlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/duby'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
materials={}
for name,color,metal,rough in [('Ceramic',(0.88,0.84,0.73,1),.12,.27),('Graphite',(.025,.047,.055,1),.25,.3),('Teal',(.06,.78,.64,1),.25,.24),('Lilac',(.51,.40,.69,1),.15,.32)]:
 m=bpy.data.materials.new(name); m.diffuse_color=color; m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 materials[name]=m
parts=[]
def shape(name,loc,scale,mat,bone):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc)
 o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(materials[mat]);parts.append((o,bone))
 for p in o.data.polygons:p.use_smooth=True
 return o
shape('Pear body',(0,0,.90),(.52,.37,.64),'Ceramic','body')
shape('Chest inset',(0,-.325,1.00),(.25,.065,.28),'Lilac','body')
shape('Status pearl',(0,-.395,1.07),(.055,.027,.055),'Teal','body')
shape('Head',(0,-.02,1.74),(.63,.43,.50),'Ceramic','head')
shape('Face inset',(0,-.389,1.74),(.48,.105,.32),'Graphite','head')
for side in [-1,1]:
 suffix='L' if side<0 else 'R'
 ear=shape('Petal ear '+suffix,(side*.49,0,2.13),(.19,.135,.31),'Ceramic','ear'+suffix);ear.rotation_euler[1]=side*.25
 shape('Ear inset '+suffix,(side*.49,-.113,2.16),(.10,.03,.19),'Lilac','ear'+suffix)
 shape('Eye '+suffix,(side*.18,-.490,1.81),(.072,.024,.113),'Teal','eye'+suffix)
 shape('Eye glint '+suffix,(side*.17,-.513,1.85),(.017,.009,.023),'Ceramic','eye'+suffix)
 hand=shape('Flipper '+suffix,(side*.50,-.02,.98),(.16,.15,.31),'Ceramic','hand'+suffix);hand.rotation_euler[1]=side*-.27
 shape('Foot '+suffix,(side*.25,-.12,.35),(.19,.26,.12),'Graphite','body')
shape('Nose',(0,-.505,1.68),(.065,.033,.037),'Lilac','head')
def tube(name,points,radius,mat,bone):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=12;curve.bevel_depth=radius;curve.bevel_resolution=3
 s=curve.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 bpy.ops.object.convert(target='MESH');obj=bpy.context.object;obj.data.materials.append(materials[mat]);parts.append((obj,bone));obj.select_set(False)
 return obj
tube('Crescent tail',[(0,.27,.59),(.28,.54,.6),(.62,.55,.91),(.74,.40,1.17),(.64,.35,1.28)],.11,'Lilac','tail')
shape('Tail light',(.64,.35,1.28),(.11,.105,.10),'Teal','tail')
tube('Quiet smile',[(-.10,-.492,1.60),(0,-.503,1.575),(.10,-.492,1.60)],.013,'Ceramic','head')
bpy.ops.object.select_all(action='DESELECT')
rig_data=bpy.data.armatures.new('Duby rig');rig=bpy.data.objects.new('Duby',rig_data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones={'root':((0,0,.2),None),'body':((0,0,.7),'root'),'head':((0,0,1.4),'body'),'tail':((0,.27,.6),'body')}
for side in [-1,1]:
 s='L' if side<0 else 'R'
 bones['ear'+s]=((side*.49,0,1.99),'head');bones['hand'+s]=((side*.47,0,1.18),'body');bones['eye'+s]=((side*.18,-.49,1.81),'head')
for name,(head,parent) in bones.items():
 b=rig_data.edit_bones.new(name);b.head=head;b.tail=Vector(head)+Vector((0,0,.15))
 if parent:b.parent=rig_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
# Four skinned meshes, one per material, with rigid bone weights at each component.
for obj,bone in parts:
 g=obj.vertex_groups.new(name=bone);g.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
groups={mat:[o for o,b in parts if o.data.materials[0].name==mat] for mat in materials}
for mat,group in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=bpy.context.object;o.name='Duby '+mat
 mod=o.modifiers.new('Duby skin','ARMATURE');mod.object=rig;o.parent=rig
clips=['Available','Greeting','Listening','Understanding','Working','Needs approval','Needs information','Completed','Error','Offline','Paused','Sleeping']
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=90
for idx,name in enumerate(clips):
 action=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=action
 for f in [1,16,31,46,61,76,90]:
  t=(f-1)/89*math.tau
  for pb in rig.pose.bones:pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0);pb.location=(0,0,0);pb.scale=(1,1,1)
  rig.pose.bones['root'].location.z=.018*math.sin(t)
  if name=='Greeting':rig.pose.bones['handR'].rotation_euler.y=-1.7+.25*math.sin(t*2);rig.pose.bones['earL'].rotation_euler.y=-.2
  if name in ['Listening','Working']:rig.pose.bones['head'].rotation_euler.x=.14;rig.pose.bones['tail'].rotation_euler.z=.16*math.sin(t)
  if name=='Working':rig.pose.bones['handL'].rotation_euler.x=.25+.15*math.sin(t*2)
  if name in ['Understanding','Error','Needs information']:rig.pose.bones['head'].rotation_euler.y=.16*math.sin(t/2)
  if name=='Needs approval':rig.pose.bones['handL'].rotation_euler.y=.5;rig.pose.bones['handR'].rotation_euler.y=-.5
  if name=='Completed':rig.pose.bones['head'].rotation_euler.x=.15*math.sin(t*2);rig.pose.bones['tail'].rotation_euler.y=.3*math.sin(t)
  if name in ['Offline','Paused','Sleeping']:rig.pose.bones['head'].rotation_euler.x=.12;rig.pose.bones['root'].location.z=-.07
  for side in ['L','R']:
   rig.pose.bones['eye'+side].scale.z=.12 if name=='Sleeping' or (f==76 and name=='Available') else 1
  for pb in rig.pose.bones:
   for prop in ['rotation_euler','location','scale']:pb.keyframe_insert(data_path=prop,frame=f,group=pb.name)
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=False
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in rig.children:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'duby.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_skins=True)
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=bpy.data.actions['Available'];scene.frame_set(1)
# Reference/fallback artwork comes from this same editable model.
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False;scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.world.color=(.35,.35,.35)
for loc,power,size in [((3,-4,6),650,5),((-4,-2,3),450,4),((1,3,5),750,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1.2))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=3.15
for name,loc in [('front',(0,-7,2.8)),('side',(7,0,2.8)),('rear',(0,7,2.8)),('three-quarter',(3,-7,3.0))]:
 camera.location=loc;camera.rotation_euler=(Vector((0,0,1.25))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
# A 4-by-3 fallback atlas; each tile is rendered from its actual animation pose.
scene.render.resolution_x=192;scene.render.resolution_y=192;scene.cycles.samples=32
atlas=bpy.data.images.new('Duby fallback atlas',width=768,height=576,alpha=True)
canvas=[0.0]*(768*576*4)
for index,clip in enumerate(clips):
 rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(46)
 scene.render.filepath=str(OUT/('atlas-tile.png'));bpy.ops.render.render(write_still=True)
 tile=bpy.data.images.load(str(OUT/'atlas-tile.png'),check_existing=False);pixels=list(tile.pixels)
 x=(index%4)*192;y=(2-index//4)*192
 for row in range(192):canvas[((y+row)*768+x)*4:((y+row)*768+x+192)*4]=pixels[row*192*4:(row+1)*192*4]
 bpy.data.images.remove(tile)
atlas.pixels=canvas;atlas.filepath_raw=str(OUT/'atlas.png');atlas.file_format='PNG';atlas.save();(OUT/'atlas-tile.png').unlink()
rig.animation_data.action=bpy.data.actions['Available'];scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'duby.blend'))
manifest={'name':'Duby','author':'Duby contributors','license':'CC-BY-4.0','generator':'scripts/create-duby.py','blender':bpy.app.version_string,'clips':clips,'bones':len(bones),'provenance':'Original scripted geometry, rig, materials and keyframes; no upstream mascot assets.','files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.suffix in ['.glb','.blend','.png']}}
(OUT/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
