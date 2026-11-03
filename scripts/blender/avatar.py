"""
Builds the low-poly Callum avatar headlessly and exports a rigged, animated GLB.

    Blender -b --factory-startup --python scripts/blender/avatar.py -- <out.glb> [preview_dir]

Conventions
- Blender Z-up, character faces -Y (becomes +Z in three.js with export_yup).
- Feet at z=0, top of beanie at z=1.0. three.js scales to world size.
- Every vertex belongs to exactly one bone (rigid skinning, like PS1 characters).
- Colours are per-face vertex colours (sRGB hex) so the PS1 shader can flat-shade them.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else "public/models/avatar.glb")
PREVIEW_DIR = os.path.abspath(argv[1]) if len(argv) > 1 else None
# "beanie" (orange puffer + beanie) or "cap" (khaki cap + white tee, the secret unlock)
OUTFIT = os.environ.get("AVATAR_OUTFIT", "beanie")

# --------------------------------------------------------------------------- palette
PALETTE = {
    "skin": "#d9a07c",
    "skin_shadow": "#c08566",
    "beard": "#2a1d18",
    "hair": "#2f211b",
    "eye": "#1a1414",
    "beanie": "#d0612a",
    "beanie_rib": "#bd5524",
    "beanie_cuff": "#b44d1f",
    "patch": "#c9a27a",
    "jacket": "#c8571f",
    "jacket_quilt": "#a9461a",
    "zip": "#7a3412",
    "hoodie": "#b9b5ae",
    "hoodie_shadow": "#9d9992",
    "cat": "#26222c",
    "cat_eye": "#f4d23a",
    "cat_nose": "#e88aa0",
    "shorts": "#2b2b30",
    "shorts_hem": "#3c3c44",
    "sock": "#f4f2ee",
    "shoe": "#f2f0ea",
    "shoe_sole": "#c9c6bd",
    "shoe_accent": "#5b8fd4",
    "frame": "#e8eef2",
    "lens": "#cfe4f2",
    "tee": "#efebe3",
    "tee_shadow": "#d8d2c6",
    "tee_print": "#3a3434",
    "cap": "#8c8466",
    "cap_brim": "#77704f",
    "cap_button": "#6a6346",
    "frame_dark": "#2e2a2a",
}

COLOR_NAMES = list(PALETTE.keys())

BONES = ["hips", "spine", "head", "arm.L", "arm.R", "leg.L", "leg.R"]


def hex_to_srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)


# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24

# --------------------------------------------------------------------------- mesh build
bm = bmesh.new()
deform = bm.verts.layers.deform.verify()
color_layer = bm.faces.layers.int.new("cidx")


def tag(verts, faces, color, bone, material=0):
    gi = BONES.index(bone)
    ci = COLOR_NAMES.index(color)
    for v in verts:
        v[deform][gi] = 1.0
    for f in faces:
        f[color_layer] = ci
        f.material_index = material


def box(center, size, color, bone, taper=(1.0, 1.0), bevel=0.0, material=0, face_colors=None, rot=None):
    """Axis-aligned box. taper scales the top face (x, y). face_colors overrides per side: {'front': name, ...}."""
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res["verts"]
    sx, sy, sz = size
    for v in verts:
        top = v.co.z > 0
        v.co.x *= sx * (taper[0] if top else 1.0)
        v.co.y *= sy * (taper[1] if top else 1.0)
        v.co.z *= sz
    if rot is not None:
        m = Matrix.Rotation(rot[1], 3, rot[0])
        for v in verts:
            v.co = m @ v.co
    for v in verts:
        v.co += Vector(center)
    faces = list({f for v in verts for f in v.link_faces})
    if bevel > 0:
        edges = list({e for v in verts for e in v.link_edges})
        out = bmesh.ops.bevel(bm, geom=verts + edges, offset=bevel, segments=1, affect="EDGES", profile=0.5)
        verts = list(set(verts) | set(out["verts"]))
        verts = [v for v in verts if v.is_valid]
        faces = list({f for v in verts for f in v.link_faces})
    tag(verts, faces, color, bone, material)
    if face_colors:
        c = Vector(center)
        for f in faces:
            n = f.normal
            d = f.calc_center_median() - c
            side = None
            if n.y < -0.7:
                side = "front"
            elif n.y > 0.7:
                side = "back"
            elif n.z > 0.7:
                side = "top"
            elif n.z < -0.7:
                side = "bottom"
            elif abs(n.x) > 0.7:
                side = "side"
            if side in face_colors:
                f[color_layer] = COLOR_NAMES.index(face_colors[side])
            _ = d
    return verts


def mirror_x(fn):
    for s in (1, -1):
        fn(s, "L" if s > 0 else "R")


# ---- Legs, cuffs, shoes ----------------------------------------------------
def legs(s, side):
    bone = f"leg.{side}"
    x = 0.075 * s
    # Black shorts to just above the knee, bare shins, white socks
    box((x, 0, 0.29), (0.114, 0.124, 0.14), "shorts", bone)
    box((x, 0, 0.225), (0.118, 0.128, 0.02), "shorts_hem", bone)
    box((x, 0, 0.145), (0.078, 0.086, 0.14), "skin", bone)
    box((x, 0, 0.08), (0.084, 0.092, 0.04), "sock", bone)
    box((x, -0.02, 0.03), (0.105, 0.17, 0.06), "shoe", bone, taper=(0.95, 0.9), face_colors={"bottom": "shoe_sole", "side": "shoe"})
    box((x, -0.02, 0.008), (0.11, 0.175, 0.016), "shoe_sole", bone)
    box((x + 0.054 * s, -0.01, 0.035), (0.004, 0.07, 0.02), "shoe_accent", bone)


mirror_x(legs)

# ---- Hips -----------------------------------------------------------------
box((0, 0, 0.37), (0.25, 0.14, 0.08), "shorts", "hips")

if OUTFIT == "beanie":
    # ---- Torso: puffer jacket built from quilted bands -------------------------
    band_h = 0.068
    for i in range(4):
        z = 0.41 + band_h * (i + 0.5)
        wide = i % 2 == 0
        w = 0.36 if wide else 0.345
        d = 0.225 if wide else 0.215
        taper = 0.97 if i == 3 else 1.0
        box((0, 0, z), (w - i * 0.006, d, band_h), "jacket" if wide else "jacket_quilt", "spine", taper=(taper, taper))
    # Shoulders
    box((0, 0, 0.69), (0.33, 0.2, 0.03), "jacket", "spine", taper=(0.85, 0.9))
    # Open front: grey hoodie panel with a pixel-art cat print + zip edges
    box((0, -0.112, 0.54), (0.12, 0.012, 0.25), "hoodie", "spine")
    CAT = [
        "C.......C",
        "CC.....CC",
        "CCCCCCCCC",
        "CYYCCCYYC",
        "CCCCCCCCC",
        "CCCCPCCCC",
        ".CCCCCCC.",
        "..CCCCC..",
    ]
    CAT_COLORS = {"C": "cat", "Y": "cat_eye", "P": "cat_nose"}
    PX = 0.008
    for row, line in enumerate(CAT):
        z = 0.59 - row * PX
        col = 0
        while col < len(line):
            ch = line[col]
            run = 1
            while col + run < len(line) and line[col + run] == ch:
                run += 1
            if ch in CAT_COLORS:
                x = (col + run / 2 - len(line) / 2) * PX
                box((x, -0.12, z), (run * PX, 0.006, PX), CAT_COLORS[ch], "spine")
            col += run
    for s in (1, -1):
        box((0.064 * s, -0.116, 0.54), (0.008, 0.01, 0.26), "zip", "spine")
    # Hood bunched behind the neck
    box((0, 0.06, 0.715), (0.24, 0.1, 0.07), "hoodie", "spine", taper=(0.9, 0.8), face_colors={"top": "hoodie_shadow"})
else:
    # ---- Torso: plain white tee with a small dark print (photo 2) ------------
    box((0, 0, 0.545), (0.34, 0.21, 0.27), "tee", "spine", taper=(0.95, 0.95), face_colors={"bottom": "tee_shadow"})
    box((0, 0, 0.69), (0.31, 0.19, 0.03), "tee", "spine", taper=(0.85, 0.9))
    box((0, -0.006, 0.7), (0.12, 0.2, 0.02), "tee_shadow", "spine")  # collar
    box((0, -0.107, 0.585), (0.06, 0.006, 0.07), "tee_print", "spine")
    box((0, -0.107, 0.535), (0.04, 0.006, 0.012), "tee_print", "spine")

# ---- Arms ------------------------------------------------------------------
def arms(s, side):
    bone = f"arm.{side}"
    x = 0.225 * s
    if OUTFIT == "cap":
        box((x, 0, 0.62), (0.105, 0.115, 0.08), "tee", bone)  # short sleeve
        box((x, 0, 0.5), (0.075, 0.08, 0.16), "skin", bone)
        box((x, -0.005, 0.38), (0.072, 0.077, 0.08), "skin", bone, bevel=0.012)
        return
    for i in range(3):
        z = 0.62 - i * 0.072
        wide = i % 2 == 0
        box((x, 0, z), (0.11 if wide else 0.102, 0.12 if wide else 0.112, 0.072), "jacket" if wide else "jacket_quilt", bone)
    box((x, 0, 0.395), (0.1, 0.108, 0.03), "jacket_quilt", bone)
    box((x, -0.005, 0.35), (0.07, 0.075, 0.07), "skin", bone, bevel=0.012)


mirror_x(arms)

# ---- Head ------------------------------------------------------------------
HZ = 0.8  # head centre
box((0, 0, HZ), (0.24, 0.23, 0.25), "skin", "head", bevel=0.035)
box((0, 0, 0.705), (0.1, 0.09, 0.05), "skin_shadow", "head")  # neck
# Ears
for s in (1, -1):
    box((0.124 * s, 0.01, 0.8), (0.03, 0.05, 0.06), "skin", "head")
# Hair at the back / sides below the beanie
box((0, 0.065, 0.8), (0.252, 0.125, 0.2), "hair", "head")
for s in (1, -1):
    box((0.118 * s, 0.0, 0.83), (0.02, 0.1, 0.07), "hair", "head")
# Beard: chin block, cheeks, moustache
box((0, -0.045, 0.715), (0.25, 0.16, 0.1), "beard", "head", bevel=0.02)
for s in (1, -1):
    box((0.112 * s, -0.03, 0.765), (0.035, 0.15, 0.08), "beard", "head")
box((0, -0.118, 0.765), (0.1, 0.02, 0.022), "beard", "head")
# Nose
box((0, -0.124, 0.792), (0.035, 0.03, 0.045), "skin_shadow", "head", taper=(0.7, 0.7))
# Eyes
for s in (1, -1):
    box((0.052 * s, -0.115, 0.83), (0.022, 0.01, 0.022), "eye", "head")

# Glasses: big clear frames (rims) + tinted lenses in their own material slot
FRAME = "frame" if OUTFIT == "beanie" else "frame_dark"


def glasses(s, _side):
    cx = 0.058 * s
    cz = 0.832
    fy = -0.128
    w, h, t = 0.09, 0.07, 0.01
    box((cx, fy, cz + h / 2), (w, 0.012, t), FRAME, "head")
    box((cx, fy, cz - h / 2), (w, 0.012, t), FRAME, "head")
    box((cx - w / 2, fy, cz), (t, 0.012, h), FRAME, "head")
    box((cx + w / 2, fy, cz), (t, 0.012, h), FRAME, "head")
    box((cx, fy + 0.002, cz), (w - t, 0.004, h - t), "lens", "head", material=1)
    # Temple arm back to the ear
    box((0.122 * s, -0.05, cz + 0.02), (0.008, 0.16, 0.01), FRAME, "head")


mirror_x(glasses)
box((0, -0.128, 0.84), (0.03, 0.012, 0.01), FRAME, "head")  # bridge

if OUTFIT == "beanie":
    # Beanie: cuff + ribbed crown, slightly slouched
    box((0, 0, 0.9), (0.27, 0.26, 0.055), "beanie_cuff", "head")
    box((0, 0.005, 0.96), (0.255, 0.245, 0.075), "beanie", "head", taper=(0.82, 0.82), face_colors={"top": "beanie_rib"})
    for i, x in enumerate([-0.09, -0.045, 0.0, 0.045, 0.09]):
        box((x, -0.124, 0.955), (0.012, 0.004, 0.06), "beanie_rib", "head", taper=(1, 1))
    box((-0.06, -0.137, 0.9), (0.04, 0.006, 0.03), "patch", "head")
else:
    # Khaki cap: rounded crown, forward brim, top button
    box((0, 0.01, 0.93), (0.262, 0.252, 0.09), "cap", "head", taper=(0.86, 0.86), bevel=0.02)
    box((0, -0.16, 0.893), (0.2, 0.12, 0.018), "cap_brim", "head", taper=(0.9, 1.0))
    box((0, 0.01, 0.98), (0.03, 0.03, 0.012), "cap_button", "head")

# --------------------------------------------------------------------------- mesh object
mesh = bpy.data.meshes.new("Avatar")
bm.normal_update()
bm.to_mesh(mesh)
bm.free()

body_obj = bpy.data.objects.new("Avatar", mesh)
scene.collection.objects.link(body_obj)
for name in BONES:
    body_obj.vertex_groups.new(name=name)

# Per-face colour index -> corner colour attribute (sRGB)
col = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
cidx = mesh.attributes["cidx"].data
for poly in mesh.polygons:
    rgba = hex_to_srgb(PALETTE[COLOR_NAMES[cidx[poly.index].value]])
    for li in poly.loop_indices:
        col.data[li].color_srgb = rgba
mesh.attributes.remove(mesh.attributes["cidx"])
mesh.color_attributes.active_color = col
mesh.color_attributes.render_color_index = 0

# Materials: Body reads the colour attribute (so the exporter keeps COLOR_0); Lens is separate.
def make_material(name, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "BLENDED"
    return mat


mesh.materials.append(make_material("Body"))
mesh.materials.append(make_material("Lens", alpha=0.45))

# --------------------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new("Rig")
rig = bpy.data.objects.new("Rig", arm_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head = head
    b.tail = tail
    if parent:
        b.parent = eb[parent]
    return b


bone("hips", (0, 0, 0.36), (0, 0, 0.44))
bone("spine", (0, 0, 0.44), (0, 0, 0.7), "hips")
bone("head", (0, 0, 0.7), (0, 0, 0.98), "spine")
for s, side in ((1, "L"), (-1, "R")):
    bone(f"arm.{side}", (0.225 * s, 0, 0.66), (0.225 * s, 0, 0.36), "spine")
    bone(f"leg.{side}", (0.075 * s, 0, 0.36), (0.075 * s, 0, 0.02), "hips")
# Consistent roll so local X is the swing axis for limbs
for b in eb:
    b.roll = 0.0
bpy.ops.object.mode_set(mode="OBJECT")

body_obj.parent = rig
mod = body_obj.modifiers.new("Armature", "ARMATURE")
mod.object = rig

for pb in rig.pose.bones:
    pb.rotation_mode = "XYZ"

# --------------------------------------------------------------------------- animation
rad = math.radians
rig.animation_data_create()


def key(frame, bone_name, rot=None, loc=None):
    pb = rig.pose.bones[bone_name]
    if rot is not None:
        pb.rotation_euler = tuple(rad(a) for a in rot)
        pb.keyframe_insert("rotation_euler", frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert("location", frame=frame)


def reset_pose():
    for pb in rig.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)


def new_action(name):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data.action = action
    reset_pose()
    return action


def finish(action, length):
    action.frame_range = (0, length)
    action.use_frame_range = True
    action.use_cyclic = True
    # Linear-ish loops: make every curve cyclic so ends join cleanly.
    curves = []
    if hasattr(action, "layers") and len(action.layers) > 0:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    curves.extend(bag.fcurves)
    else:
        curves = list(action.fcurves)
    for fc in curves:
        if not any(m.type == "CYCLES" for m in fc.modifiers):
            fc.modifiers.new("CYCLES")


# Arms hang slightly away from the body: +Z swings arm.R outward, -Z swings arm.L outward.
ARM_OUT = 7


# Idle: breathing, gentle sway, a slow look around. 96 frames = 4 s.
act = new_action("idle")
for f, breath, look, tilt in [(0, 0, 0, 0), (24, 1.5, 10, 2), (48, 0, 0, 0), (72, 1.5, -8, -2), (96, 0, 0, 0)]:
    key(f, "hips", loc=(0, breath * 0.004, 0))
    key(f, "spine", rot=(-breath, 0, tilt * 0.5))
    key(f, "head", rot=(breath * 0.5, look, tilt))
    key(f, "arm.L", rot=(0, 0, -ARM_OUT - breath))
    key(f, "arm.R", rot=(0, 0, ARM_OUT + breath))
    key(f, "leg.L", rot=(0, 0, 0))
    key(f, "leg.R", rot=(0, 0, 0))
finish(act, 96)

# Walk: 24-frame stride.
act = new_action("walk")
for f, phase in [(0, 1), (6, 0), (12, -1), (18, 0), (24, 1)]:
    swing = 32 * phase
    bob = 0.0 if phase != 0 else 0.022
    key(f, "hips", loc=(0, bob, 0), rot=(0, 6 * phase, 0))
    key(f, "spine", rot=(4, -9 * phase, 0))
    key(f, "head", rot=(-3, 4 * phase, 0))
    key(f, "leg.L", rot=(swing, 0, 0))
    key(f, "leg.R", rot=(-swing, 0, 0))
    key(f, "arm.L", rot=(-swing * 0.9, 0, -ARM_OUT))
    key(f, "arm.R", rot=(swing * 0.9, 0, ARM_OUT))
finish(act, 24)

# Wave: right arm up and waggling. 48 frames.
act = new_action("wave")
for f, raise_amt, waggle in [(0, 0, 0), (12, 1, 0), (18, 1, 22), (24, 1, -18), (30, 1, 22), (36, 1, 0), (48, 0, 0)]:
    key(f, "arm.R", rot=(0, 0, ARM_OUT + 150 * raise_amt + waggle))
    key(f, "arm.L", rot=(0, 0, -ARM_OUT))
    key(f, "head", rot=(0, -6 * raise_amt, -4 * raise_amt))
    key(f, "spine", rot=(0, 0, 3 * raise_amt))
    key(f, "hips", loc=(0, 0, 0))
    key(f, "leg.L", rot=(0, 0, 0))
    key(f, "leg.R", rot=(0, 0, 0))
finish(act, 48)

rig.animation_data.action = bpy.data.actions["idle"]
reset_pose()

# --------------------------------------------------------------------------- stats
tris = sum(len(p.vertices) - 2 for p in mesh.polygons)
print(f"[avatar] verts={len(mesh.vertices)} tris={tris} bones={len(BONES)} actions={[a.name for a in bpy.data.actions]}")
ungrouped = [v.index for v in mesh.vertices if len(v.groups) != 1]
print(f"[avatar] vertices without exactly one group: {len(ungrouped)}")

# --------------------------------------------------------------------------- preview renders
if PREVIEW_DIR:
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "VERTEX"
    shading.show_shadows = False
    shading.show_cavity = False
    scene.render.resolution_x = 360
    scene.render.resolution_y = 480
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.color = (0.12, 0.1, 0.18)

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.25
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def shoot(name, yaw_deg, action=None, frame=0):
        if action:
            rig.animation_data.action = bpy.data.actions[action]
        scene.frame_set(frame)
        r = 3.0
        yaw = math.radians(yaw_deg)
        cam.location = (math.sin(yaw) * -r * -1, -math.cos(yaw) * r, 0.62)
        direction = Vector((0, 0, 0.5)) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(PREVIEW_DIR, f"{name}.png")
        bpy.ops.render.render(write_still=True)

    shoot("front", 0, "idle", 0)
    shoot("three_quarter", 35, "idle", 0)
    shoot("side", 90, "idle", 0)
    shoot("back", 180, "idle", 0)
    shoot("walk_a", 60, "walk", 0)
    shoot("walk_b", 60, "walk", 12)
    shoot("wave", 20, "wave", 18)
    rig.animation_data.action = bpy.data.actions["idle"]
    scene.frame_set(0)

# --------------------------------------------------------------------------- export
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
body_obj.select_set(True)
bpy.context.view_layer.objects.active = rig

wanted = dict(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_force_sampling=True,
    export_frame_range=False,
    export_skins=True,
    export_all_influences=False,
    export_def_bones=False,
    export_materials="EXPORT",
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=False,
    export_active_vertex_color_when_no_material=True,
    export_normals=True,
    export_texcoords=False,
    export_cameras=False,
    export_lights=False,
)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
kwargs = {k: v for k, v in wanted.items() if k in props}
skipped = sorted(set(wanted) - set(kwargs))
if skipped:
    print(f"[avatar] exporter ignored unsupported options: {skipped}")
bpy.ops.export_scene.gltf(**kwargs)
print(f"[avatar] wrote {OUT}")
