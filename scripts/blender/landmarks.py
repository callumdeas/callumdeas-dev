"""
Builds the landmark buildings headlessly and exports one GLB.

    Blender -b --factory-startup --python scripts/blender/landmarks.py -- <out.glb> [preview_dir]

Authoring conventions
- Coordinates in this file are written in three.js terms: y is up, the front of
  each building faces +z. They're converted to Blender (x, -z, y) on the way in,
  which the glTF exporter (export_yup) turns back into exactly these values.
- Every face gets a *named material*. The site maps names to its own PS1
  materials at runtime (so night lighting, neon flicker and textures still work).
- Box-projected UVs at a constant texel density (TEX units per texture tile),
  except faces flagged as signs, which get 0..1 UVs so the sign art fits.
- Empties mark runtime extras: glow_<kind>_<rrggbb>_<size>, smoke_<n>,
  anchor_knot, and spin_* objects that the site rotates.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else "public/models/landmarks.glb")
PREVIEW_DIR = os.path.abspath(argv[1]) if len(argv) > 1 else None

TEX = 0.55  # world units per texture tile

PREVIEW = {
    "Plaster": "#f3ebe6", "Cream": "#f1e2c2", "Stone": "#b3acbb", "Brick": "#b86a52",
    "Wood": "#a77650", "WoodDark": "#5c3d2e", "RoofRed": "#a9473f", "RoofSlate": "#525a78",
    "Dark": "#25222c", "Metal": "#8c93a3", "Silo": "#c9c4b8", "White": "#f6f2ec",
    "Gold": "#e0b04f", "Window": "#ffcf7a", "Lamp": "#ffb862", "NeonPink": "#ff4fb8",
    "NeonCyan": "#4ff0ff", "Screen": "#7cf0b0", "ArcadeWall": "#4a3470", "ArcadeSign": "#d42c8c",
    "DishSign": "#f2e2c4", "FlowerPink": "#f29ab8", "FlowerWhite": "#fff6f0", "Crop": "#86ad4f",
    "Soil": "#5a3d2c", "Pumpkin": "#e5782c", "Hay": "#d9b45a", "Leaf": "#3f6250",
    "Facade0": "#efcfcf", "Facade1": "#ece3d3", "Facade2": "#d6c8e6",
    "Awning0": "#c97a8a", "Awning1": "#c9a25a", "Awning2": "#8a6fb0",
    "Pitch": "#4f8f45", "PitchStripe": "#5fa052", "SeatBlue": "#3a6fb0", "SeatWhite": "#e8ecf2", "Scoreboard": "#101418",
    "ShopSign0": "#2b2230", "ShopSign1": "#2b2230", "ShopSign2": "#2b2230",
    "PostRed": "#c8282c", "PostSign": "#c8282c",
    # The Hill (Gloaming): the planet's own ground colours (art.ts ART.ground)
    "MountainGrass": "#62804f", "MountainRock": "#7c6b84", "Snow": "#f2e6ee", "Trail": "#c49a7c",
}


def srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def lin(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

MATERIALS = {}


def material(name):
    if name not in MATERIALS:
        m = bpy.data.materials.new(name)
        rgb = lin(srgb(PREVIEW.get(name, "#ff00ff")))
        m.diffuse_color = (*rgb, 1.0)
        m.use_nodes = True
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1.0)
        m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
        MATERIALS[name] = m
    return MATERIALS[name]


def to_blender(v):
    return Vector((v[0], -v[2], v[1]))


def rot_matrix(r):
    """r = (rx, ry, rz) radians about three.js axes, applied X then Y then Z."""
    if r is None:
        return Matrix.Identity(3)
    rx, ry, rz = r
    return Matrix.Rotation(rz, 3, "Z") @ Matrix.Rotation(ry, 3, "Y") @ Matrix.Rotation(rx, 3, "X")


class Builder:
    """Accumulates geometry for one mesh object, in three.js space."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.mats = []
        self.sign_faces = set()

    def mat_index(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def _finish(self, verts, mat, center, rot, sign=False):
        m = rot_matrix(rot)
        c = Vector(center)
        for v in verts:
            v.co = to_blender(m @ Vector(v.co) + c)
        faces = list({f for v in verts for f in v.link_faces})
        mi = self.mat_index(mat)
        for f in faces:
            f.material_index = mi
            if sign:
                self.sign_faces.add(f)
        return faces

    def box(self, center, size, mat, rot=None, taper=(1.0, 1.0), bevel=0.0, sign=False):
        res = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = res["verts"]
        sx, sy, sz = size
        # Built in three-space: cube's own z is our y (up). Swap so taper hits the top.
        for v in verts:
            x, y, z = v.co.x, v.co.z, -v.co.y
            top = y > 0
            v.co = Vector((x * sx * (taper[0] if top else 1), y * sy, z * sz * (taper[1] if top else 1)))
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            out = bmesh.ops.bevel(self.bm, geom=verts + edges, offset=bevel, segments=1, affect="EDGES", profile=0.5)
            verts = [v for v in set(verts) | set(out["verts"]) if v.is_valid]
        return self._finish(verts, mat, center, rot, sign)

    def cylinder(self, center, radius, height, mat, segments=8, radius_top=None, rot=None, cap=True):
        res = bmesh.ops.create_cone(
            self.bm, cap_ends=cap, cap_tris=False, segments=segments,
            radius1=radius, radius2=radius if radius_top is None else radius_top, depth=height,
        )
        verts = res["verts"]
        for v in verts:
            v.co = Vector((v.co.x, v.co.z, -v.co.y))
        return self._finish(verts, mat, center, rot)

    def cone(self, center, radius, height, mat, segments=4, rot=None):
        return self.cylinder(center, radius, height, mat, segments, radius_top=0.0, rot=rot)

    def ico(self, center, radius, mat, scale=(1, 1, 1)):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=1, radius=radius)
        verts = res["verts"]
        for v in verts:
            v.co = Vector((v.co.x * scale[0], v.co.z * scale[1], -v.co.y * scale[2]))
        return self._finish(verts, mat, center, None)

    def dome(self, center, radius, mat, segments=8, rings=3):
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=segments, v_segments=rings * 2, radius=radius)
        below = [v for v in res["verts"] if v.co.z < -1e-4]
        bmesh.ops.delete(self.bm, geom=below, context="VERTS")
        verts = [v for v in res["verts"] if v.is_valid]
        for v in verts:
            v.co = Vector((v.co.x, v.co.z, -v.co.y))
        return self._finish(verts, mat, center, None)

    def gable(self, center, width, height, depth, mat, rot=None, overhang=0.0):
        """Triangular prism roof: ridge along z (three space), base at center.y."""
        w = width / 2 + overhang
        d = depth / 2 + overhang
        pts = [(-w, 0, -d), (w, 0, -d), (0, height, -d), (-w, 0, d), (w, 0, d), (0, height, d)]
        verts = [self.bm.verts.new(Vector(p)) for p in pts]
        a, b, c, a2, b2, c2 = verts
        for f in ((a, c, b), (a2, b2, c2), (a, a2, c2, c), (b, c, c2, b2), (a, b, b2, a2)):
            self.bm.faces.new(f)
        return self._finish(verts, mat, center, rot)

    def tris(self, points, faces, mats):
        """Raw triangles in three space: points are Vectors, faces index triples (counter-clockwise from outside)."""
        vs = [self.bm.verts.new(to_blender(p)) for p in points]
        out = []
        for f, mat in zip(faces, mats):
            face = self.bm.faces.new([vs[i] for i in f])
            face.material_index = self.mat_index(mat)
            out.append(face)
        return out

    def arch(self, center, radius, thickness, mat, segments=9, depth=0.08):
        """Semicircle of blocks (rot about z-axis in three space)."""
        faces = []
        for i in range(segments):
            a0 = math.pi * i / segments
            a1 = math.pi * (i + 1) / segments
            am = (a0 + a1) / 2
            seg_len = 2 * radius * math.sin((a1 - a0) / 2) + 0.01
            c = (center[0] + math.cos(am) * radius, center[1] + math.sin(am) * radius, center[2])
            faces += self.box(c, (seg_len, thickness, depth), mat, rot=(0, 0, am - math.pi / 2))
        return faces

    def to_object(self, parent=None):
        bm = self.bm
        bm.normal_update()
        for f in bm.faces:
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for loop in f.loops:
                co = loop.vert.co
                if ax == 0:
                    u, v = co.y, co.z
                elif ax == 1:
                    u, v = co.x, co.z
                else:
                    u, v = co.x, co.y
                loop[self.uv].uv = (u / TEX, v / TEX)
        # Signs: map their front face to the full 0..1 texture.
        for f in self.sign_faces:
            if not f.is_valid:
                continue
            if f.normal.y < -0.7:  # three +z (front)
                xs = [l.vert.co.x for l in f.loops]
                zs = [l.vert.co.z for l in f.loops]
                x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
                for loop in f.loops:
                    # v is flipped because glTF stores 1 - v and the site's canvas textures use flipY.
                    loop[self.uv].uv = ((loop.vert.co.x - x0) / (x1 - x0), 1 - (loop.vert.co.z - z0) / (z1 - z0))
        mesh = bpy.data.meshes.new(self.name)
        bm.to_mesh(mesh)
        bm.free()
        for name in self.mats:
            mesh.materials.append(material(name))
        obj = bpy.data.objects.new(self.name, mesh)
        scene.collection.objects.link(obj)
        if parent:
            obj.parent = parent
        return obj


def root(name):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.5
    scene.collection.objects.link(e)
    return e


def marker(parent, name, pos):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.1
    e.location = to_blender(pos)
    e.parent = parent
    scene.collection.objects.link(e)
    return e


def glow(parent, kind, color, size, pos, i):
    # No dots in names: three.js strips them when sanitising node names.
    return marker(parent, f"glow_{kind}_{color.lstrip('#')}_{int(round(size * 100))}_{i}", pos)


def mirror(fn):
    for s in (1, -1):
        fn(s)


# ============================================================================ CHAPEL (Knotless)
def chapel():
    r = root("chapel")
    b = Builder("chapel_mesh")
    glows = []
    # Two-tier stone plinth with a front step
    b.box((0, -0.2, 0), (2.3, 0.45, 3.5), "Stone", bevel=0.03)
    b.box((0, 0.06, -0.2), (2.0, 0.12, 3.2), "Stone")
    b.box((0, 0.05, 1.95), (0.9, 0.1, 0.35), "Stone")
    # Nave
    b.box((0, 0.82, -0.25), (1.6, 1.4, 2.5), "Plaster")
    b.box((0, 0.15, -0.25), (1.66, 0.12, 2.56), "Stone")  # skirting
    # Buttresses + tall windows with pointed heads and sills
    for z in (-1.15, -0.25, 0.65):
        for s in (1, -1):
            b.box((0.86 * s, 0.62, z + 0.45), (0.14, 1.05, 0.16), "Stone", taper=(0.6, 0.8))
            b.box((0.81 * s, 0.98, z), (0.05, 0.5, 0.26), "Window")
            b.gable((0.81 * s, 1.23, z), 0.26, 0.16, 0.05, "Window", rot=(0, math.pi / 2, 0))
            b.box((0.83 * s, 0.71, z), (0.08, 0.04, 0.34), "Stone")
            glows.append(("night", "#ffcf7a", 0.75, (0.9 * s, 1.0, z)))
    # Roof with eaves, ridge cap
    b.gable((0, 1.52, -0.25), 1.7, 0.95, 2.5, "RoofSlate", overhang=0.13)
    b.box((0, 2.48, -0.25), (0.08, 0.06, 2.78), "Dark")
    # Tower
    b.box((0, 1.35, 1.15), (0.86, 2.7, 0.86), "Plaster")
    for sx in (1, -1):
        for sz in (1, -1):
            for i in range(5):
                b.box((0.42 * sx, 0.35 + i * 0.5, 1.15 + 0.42 * sz), (0.07, 0.22, 0.07), "Stone")
    b.box((0, 2.72, 1.15), (0.98, 0.1, 0.98), "Stone")  # cornice
    # Belfry with louvres
    b.box((0, 2.25, 1.585), (0.44, 0.5, 0.04), "Window")
    for i in range(4):
        b.box((0, 2.07 + i * 0.12, 1.61), (0.46, 0.035, 0.03), "Dark", rot=(-0.4, 0, 0))
    glows.append(("night", "#ffcf7a", 0.9, (0, 2.25, 1.68)))
    # Rose window with stone ring
    b.cylinder((0, 1.55, 1.59), 0.2, 0.04, "Window", segments=10, rot=(math.pi / 2, 0, 0))
    b.cylinder((0, 1.55, 1.585), 0.25, 0.03, "Stone", segments=10, rot=(math.pi / 2, 0, 0))
    for i in range(4):
        b.box((0, 1.55, 1.615), (0.4, 0.025, 0.02), "Stone", rot=(0, 0, i * math.pi / 4))
    glows.append(("night", "#ffcf7a", 0.8, (0, 1.55, 1.7)))
    # Arched door
    b.box((0, 0.45, 1.59), (0.44, 0.7, 0.04), "WoodDark")
    b.arch((0, 0.8, 1.6), 0.22, 0.06, "Stone", segments=7)
    b.box((0.25, 0.45, 1.6), (0.06, 0.7, 0.06), "Stone")
    b.box((-0.25, 0.45, 1.6), (0.06, 0.7, 0.06), "Stone")
    b.box((0.08, 0.42, 1.615), (0.03, 0.03, 0.02), "Gold")
    # Spire with corner pinnacles
    b.cone((0, 3.42, 1.15), 0.62, 1.35, "RoofSlate", segments=4, rot=(0, math.pi / 4, 0))
    for sx in (1, -1):
        for sz in (1, -1):
            b.cone((0.42 * sx, 2.95, 1.15 + 0.42 * sz), 0.07, 0.35, "RoofSlate", segments=4)
    # Wedding arch with flowers
    b.arch((0, 0.06, 2.15), 0.56, 0.06, "White", segments=11)
    for s in (1, -1):
        b.box((0.56 * s, 0.03, 2.15), (0.08, 0.1, 0.08), "White")
    for i in range(12):
        a = math.pi * i / 11
        b.ico((math.cos(a) * 0.56, 0.06 + math.sin(a) * 0.56, 2.15 + (0.04 if i % 2 else -0.04)), 0.075,
              "FlowerPink" if i % 2 else "FlowerWhite")
    # Benches either side of the path
    for s in (1, -1):
        b.box((0.95 * s, 0.22, 1.85), (0.12, 0.05, 0.55), "Wood")
        b.box((0.95 * s, 0.1, 1.65), (0.1, 0.2, 0.05), "WoodDark")
        b.box((0.95 * s, 0.1, 2.05), (0.1, 0.2, 0.05), "WoodDark")
    b.to_object(r)
    marker(r, "anchor_knot", (0, 4.2, 1.15))
    glows.append(("neon", "#ffd88a", 1.1, (0, 4.2, 1.15)))
    for i, g in enumerate(glows):
        glow(r, *g[:3], g[3], i)
    return r


# ============================================================================ WORKSHOP (Macbelt)
def workshop():
    r = root("workshop")
    b = Builder("workshop_mesh")
    glows = []
    b.box((0, -0.12, 0), (2.75, 0.45, 2.35), "Stone", bevel=0.03)
    # Plank walls with dark timber frame
    b.box((0, 0.75, 0), (2.2, 1.3, 1.8), "Wood")
    for x in (-1.1, -0.35, 0.35, 1.1):
        b.box((x, 0.75, 0.91), (0.08, 1.3, 0.04), "WoodDark")
        b.box((x, 0.75, -0.91), (0.08, 1.3, 0.04), "WoodDark")
    for z in (-0.9, 0, 0.9):
        for s in (1, -1):
            b.box((1.11 * s, 0.75, z), (0.04, 1.3, 0.08), "WoodDark")
    b.box((0, 1.42, 0), (2.28, 0.08, 1.88), "WoodDark")  # top plate
    # Lean-to roof with fascia
    b.box((0, 1.6, 0.05), (2.55, 0.1, 2.35), "RoofSlate", rot=(-0.24, 0, 0))
    b.box((0, 1.33, 1.2), (2.55, 0.12, 0.05), "WoodDark", rot=(-0.24, 0, 0))
    # Brick chimney with cap
    b.box((0.7, 1.85, -0.5), (0.34, 1.0, 0.34), "Brick")
    b.box((0.7, 2.38, -0.5), (0.42, 0.07, 0.42), "Stone")
    # Open workshop bay, half-raised slatted door, frame
    b.box((-0.35, 0.48, 0.905), (1.0, 0.76, 0.02), "Window")
    for i in range(4):
        b.box((-0.35, 0.92 + i * 0.07, 0.93), (1.04, 0.06, 0.04), "WoodDark")
    b.box((-0.35, 1.22, 0.93), (1.12, 0.05, 0.06), "Dark")
    for s in (1, -1):
        b.box((-0.35 + 0.53 * s, 0.6, 0.93), (0.05, 1.2, 0.06), "Dark")
    glows.append(("night", "#ffcf7a", 1.6, (-0.35, 0.5, 1.2)))
    # Side window with shutters
    b.box((0.65, 0.8, 0.905), (0.38, 0.34, 0.02), "Window")
    b.box((0.65, 0.8, 0.92), (0.03, 0.34, 0.02), "Dark")
    b.box((0.65, 0.8, 0.92), (0.38, 0.03, 0.02), "Dark")
    b.box((0.4, 0.8, 0.95), (0.1, 0.38, 0.03), "Wood", rot=(0, 0.5, 0))
    b.box((0.9, 0.8, 0.95), (0.1, 0.38, 0.03), "Wood", rot=(0, -0.5, 0))
    b.box((0.65, 0.6, 0.97), (0.44, 0.04, 0.1), "WoodDark")
    glows.append(("night", "#ffcf7a", 0.7, (0.65, 0.8, 1.05)))
    # Menu-bar sign: dark bar with a row of lit icons
    b.box((0, 1.3, 0.95), (1.9, 0.16, 0.05), "Dark")
    for i, x in enumerate((-0.3, -0.05, 0.2, 0.45, 0.7)):
        b.box((x, 1.3, 0.98), (0.08, 0.08, 0.02), "NeonCyan" if i == 0 else "Lamp")
    b.box((-0.75, 1.3, 0.98), (0.1, 0.1, 0.02), "White")  # the "apple"
    # Workbench with vice and tools, crates, barrel, ladder
    b.box((0.75, 0.42, 1.3), (0.8, 0.06, 0.38), "WoodDark")
    for x in (0.4, 1.1):
        for z in (1.15, 1.45):
            b.box((x, 0.2, z), (0.05, 0.4, 0.05), "WoodDark")
    b.box((0.45, 0.5, 1.25), (0.1, 0.08, 0.1), "Metal")
    b.box((0.85, 0.47, 1.3), (0.2, 0.04, 0.05), "Metal")
    b.box((1.05, 0.48, 1.25), (0.06, 0.06, 0.14), "Dark")
    b.box((-1.25, 0.15, 1.1), (0.3, 0.3, 0.3), "Wood", rot=(0, 0.4, 0))
    b.box((-1.2, 0.42, 1.08), (0.24, 0.24, 0.24), "Wood", rot=(0, 0.1, 0))
    b.cylinder((-1.3, 0.2, 0.5), 0.15, 0.4, "WoodDark", segments=8)
    for y in (0.08, 0.32):
        b.cylinder((-1.3, y, 0.5), 0.16, 0.03, "Metal", segments=8)
    for s in (1, -1):
        b.box((1.18, 0.75, 0.25 + 0.12 * s), (0.03, 1.5, 0.03), "Wood", rot=(0, 0, -0.12))
    for i in range(5):
        b.box((1.2 - i * 0.02, 0.3 + i * 0.27, 0.25), (0.03, 0.03, 0.26), "Wood")
    # Antenna on the roof
    b.box((-0.8, 2.0, -0.4), (0.03, 0.6, 0.03), "Metal")
    b.box((-0.8, 2.25, -0.4), (0.3, 0.02, 0.02), "Metal")
    b.to_object(r)

    gear = Builder("spin_gear")
    gear.cylinder((0, 0, 0), 0.3, 0.08, "Metal", segments=10, rot=(0, 0, math.pi / 2))
    gear.cylinder((0, 0, 0), 0.08, 0.12, "Dark", segments=8, rot=(0, 0, math.pi / 2))
    for i in range(10):
        a = i * math.pi * 2 / 10
        gear.box((0, math.cos(a) * 0.36, math.sin(a) * 0.36), (0.08, 0.11, 0.11), "Metal", rot=(a, 0, 0))
    g = gear.to_object(r)
    g.location = to_blender((1.14, 0.85, 0))
    marker(r, "smoke_0", (0.7, 2.45, -0.5))
    for i, gl in enumerate(glows):
        glow(r, *gl[:3], gl[3], i)
    return r


# ============================================================================ ARCADE (Name Game)
def arcade():
    r = root("arcade")
    b = Builder("arcade_mesh")
    glows = []
    b.box((0, -0.12, 0), (2.55, 0.45, 2.35), "Stone", bevel=0.03)
    b.box((0, 0.8, 0), (2.0, 1.4, 1.8), "ArcadeWall")
    b.box((0, 0.14, 0), (2.06, 0.18, 1.86), "Dark")  # dark base band
    # Art-deco stepped parapet
    b.box((0, 1.56, 0), (2.12, 0.12, 1.92), "Dark")
    b.box((0, 1.68, 0.4), (1.4, 0.14, 0.4), "ArcadeWall")
    b.box((0, 1.8, 0.4), (0.8, 0.12, 0.3), "ArcadeWall")
    # Marquee sign on posts
    for s in (1, -1):
        b.box((0.72 * s, 1.85, 0.62), (0.07, 0.5, 0.07), "Dark")
    b.box((0, 2.12, 0.64), (1.92, 0.5, 0.1), "ArcadeSign", sign=True)
    b.box((0, 2.4, 0.64), (1.98, 0.05, 0.12), "NeonCyan")
    b.box((0, 1.85, 0.64), (1.98, 0.05, 0.12), "NeonCyan")
    glows.append(("neon", "#ff5fc0", 2.6, (0, 2.1, 0.85)))
    # Neon trims
    b.box((0, 1.47, 0.925), (2.02, 0.05, 0.05), "NeonPink")
    for s in (1, -1):
        b.box((1.0 * s, 0.82, 0.925), (0.05, 1.3, 0.05), "NeonCyan")
    # Entrance: canopy, glass doors, step
    b.box((0, 1.05, 1.15), (1.0, 0.06, 0.5), "Dark", rot=(0.12, 0, 0))
    b.box((0, 1.0, 1.39), (1.0, 0.04, 0.03), "NeonPink")
    b.box((0, 0.46, 0.905), (0.62, 0.82, 0.02), "Screen")
    b.box((0, 0.46, 0.92), (0.03, 0.82, 0.02), "Dark")
    b.box((0, 0.05, 1.1), (0.8, 0.1, 0.35), "Stone")
    glows.append(("neon", "#7cf0b0", 1.3, (0, 0.5, 1.15)))
    # Poster windows
    for s in (1, -1):
        b.box((0.65 * s, 0.85, 0.905), (0.42, 0.36, 0.02), "NeonPink")
        b.box((0.65 * s, 0.85, 0.915), (0.46, 0.04, 0.02), "Dark")
    # Side wall: big pixel invader made of blocks
    INVADER = ["..X...X..", "...X.X...", "..XXXXX..", ".XX.X.XX.", "XXXXXXXXX", "X.XXXXX.X", "X.X...X.X", "...X.X..."]
    for row, line in enumerate(INVADER):
        for col, ch in enumerate(line):
            if ch == "X":
                b.box((1.005, 1.2 - row * 0.07, -0.3 + col * 0.07), (0.02, 0.065, 0.065), "NeonCyan")
    # Roof AC unit + vents
    b.box((-0.5, 1.75, -0.45), (0.5, 0.3, 0.4), "Metal")
    b.cylinder((-0.5, 1.91, -0.45), 0.13, 0.02, "Dark", segments=8)
    b.box((0.6, 1.68, -0.5), (0.12, 0.18, 0.12), "Metal")
    # Arcade cabinets outside
    for s in (1, -1):
        rot = (0, -0.3 * s, 0)
        cx = 0.78 * s
        b.box((cx, 0.32, 1.38), (0.34, 0.64, 0.3), "Dark", rot=rot)
        b.box((cx, 0.44, 1.535), (0.26, 0.2, 0.02), "Screen", rot=rot)
        b.box((cx, 0.68, 1.38), (0.34, 0.08, 0.32), "NeonPink", rot=rot)
        b.box((cx, 0.28, 1.56), (0.3, 0.06, 0.08), "Dark", rot=(0.4, -0.3 * s, 0))
        glows.append(("neon", "#7cf0b0", 0.6, (cx, 0.44, 1.7)))
    b.to_object(r)
    for i, gl in enumerate(glows):
        glow(r, *gl[:3], gl[3], i)
    return r


# ============================================================================ FARMHOUSE (Dish)
def farmhouse():
    r = root("farmhouse")
    b = Builder("farmhouse_mesh")
    glows = []
    b.box((-0.35, -0.12, -0.2), (1.95, 0.4, 1.65), "Stone", bevel=0.03)
    b.box((-0.35, 0.5, -0.2), (1.7, 1.0, 1.3), "Cream")
    for s in (1, -1):
        b.box((-0.35 + 0.86 * s, 0.5, 0.46), (0.06, 1.0, 0.04), "WoodDark")
        b.box((-0.35 + 0.86 * s, 0.5, -0.86), (0.06, 1.0, 0.04), "WoodDark")
    # Gable roof with overhang + bargeboards + ridge
    b.gable((-0.35, 1.0, -0.2), 1.5, 0.82, 1.9, "RoofRed", rot=(0, math.pi / 2, 0), overhang=0.12)
    b.box((-0.35, 1.84, -0.2), (2.2, 0.05, 0.06), "WoodDark")
    # Chimney
    b.box((-0.95, 1.55, -0.45), (0.28, 0.75, 0.28), "Brick")
    b.box((-0.95, 1.95, -0.45), (0.34, 0.06, 0.34), "Stone")
    # Porch: little roof on posts
    b.box((-0.35, 0.95, 0.72), (0.9, 0.06, 0.5), "RoofRed", rot=(0.25, 0, 0))
    for s in (1, -1):
        b.box((-0.35 + 0.4 * s, 0.45, 0.92), (0.05, 0.9, 0.05), "WoodDark")
    b.box((-0.35, 0.03, 0.75), (0.9, 0.06, 0.5), "Wood")
    # Door, windows with frames + flower boxes
    b.box((-0.35, 0.33, 0.455), (0.36, 0.62, 0.02), "WoodDark")
    b.box((-0.25, 0.33, 0.47), (0.03, 0.03, 0.02), "Gold")
    for x in (-0.95, 0.25):
        b.box((x, 0.62, 0.455), (0.32, 0.3, 0.02), "Window")
        b.box((x, 0.62, 0.47), (0.36, 0.04, 0.02), "White")
        b.box((x, 0.62, 0.47), (0.04, 0.34, 0.02), "White")
        b.box((x, 0.44, 0.52), (0.38, 0.08, 0.12), "WoodDark")
        for i in range(4):
            b.ico((x - 0.13 + i * 0.087, 0.5, 0.53), 0.04, "FlowerPink" if i % 2 else "FlowerWhite")
        glows.append(("night", "#ffcf7a", 0.7, (x, 0.62, 0.6)))
    # Hanging sign under the porch
    b.box((-0.35, 0.8, 0.95), (0.5, 0.18, 0.04), "DishSign", sign=True)
    # Silo with metal bands, ladder and dome
    b.cylinder((0.95, 0.8, -0.45), 0.36, 1.6, "Silo", segments=10)
    for y in (0.3, 0.7, 1.1, 1.5):
        b.cylinder((0.95, y, -0.45), 0.375, 0.04, "Metal", segments=10)
    b.dome((0.95, 1.6, -0.45), 0.37, "RoofRed", segments=10)
    for s in (1, -1):
        b.box((0.95 + 0.07 * s, 0.8, -0.08), (0.025, 1.6, 0.025), "Metal")
    for i in range(7):
        b.box((0.95, 0.15 + i * 0.22, -0.08), (0.14, 0.02, 0.02), "Metal")
    # Hay bales
    b.box((1.25, 0.15, 0.55), (0.42, 0.3, 0.3), "Hay")
    b.box((1.2, 0.42, 0.5), (0.42, 0.26, 0.3), "Hay", rot=(0, 0.2, 0))
    # Veg patch
    for row in range(4):
        x = -1.15 + row * 0.32
        b.box((x, 0.04, 1.15), (0.22, 0.08, 0.7), "Soil")
        for z in (-0.22, 0, 0.22):
            if row == 3 and z == 0:
                b.ico((x, 0.14, 1.15 + z), 0.13, "Pumpkin", scale=(1, 0.7, 1))
                b.box((x, 0.24, 1.15 + z), (0.02, 0.06, 0.02), "Leaf")
            else:
                b.cone((x, 0.17, 1.15 + z), 0.08, 0.2, "Crop", segments=4)
    # Fence
    for i in range(9):
        b.box((-1.4 + i * 0.3, 0.15, 1.65), (0.05, 0.3, 0.05), "Wood", taper=(0.7, 0.7))
    for y in (0.12, 0.24):
        b.box((-0.2, y, 1.65), (2.5, 0.035, 0.03), "Wood")
    b.to_object(r)
    marker(r, "smoke_0", (-0.95, 2.02, -0.45))
    for i, gl in enumerate(glows):
        glow(r, *gl[:3], gl[3], i)
    return r


# ============================================================================ HIGH STREET (client work)
# Three real client shopfronts. Sign boards use ShopSign<n> (0..1 UVs) so the
# site can paint each client's name on them.
def highstreet():
    r = root("highstreet")
    b = Builder("highstreet_mesh")
    glows = []
    b.box((0, -0.12, -0.15), (5.3, 0.4, 1.7), "Stone", bevel=0.03)
    b.box((0, 0.06, 1.05), (5.1, 0.04, 0.95), "Stone")  # pavement
    b.box((0, 0.04, 1.55), (5.1, 0.08, 0.06), "White")  # kerb
    shops = [(-1.6, 1.5, "gable"), (0.0, 1.75, "flat"), (1.6, 1.55, "gable")]
    W = 1.42
    for i, (x, h, roof) in enumerate(shops):
        fac = f"Facade{i}"
        b.box((x, h / 2, -0.15), (W, h, 0.9), fac)
        b.box((x, h - 0.03, 0.31), (W + 0.04, 0.06, 0.05), "White")  # cornice
        b.box((x, 1.02, 0.31), (W + 0.04, 0.04, 0.04), "White")  # string course
        for s_ in (1, -1):
            b.box((x + (W / 2 - 0.03) * s_, h / 2, 0.31), (0.06, h, 0.05), "White")  # pilasters
        if roof == "gable":
            b.gable((x, h, -0.15), W + 0.04, 0.5, 0.94, "RoofSlate", rot=(0, math.pi / 2, 0), overhang=0.05)
            b.box((x + 0.42, h + 0.32, -0.35), (0.14, 0.32, 0.14), "Brick")
        else:
            b.box((x, h + 0.08, -0.15), (W + 0.06, 0.1, 0.96), "Dark")
            b.box((x, h + 0.22, 0.28), (W - 0.1, 0.18, 0.05), fac)  # parapet
            b.box((x, h + 0.32, 0.28), (W - 0.04, 0.03, 0.07), "White")
        # Big shop window with mullions, door, stall riser
        b.box((x - 0.2, 0.46, 0.305), (0.8, 0.46, 0.02), "Window")
        for mx in (-0.47, 0.07):
            b.box((x + mx, 0.46, 0.32), (0.03, 0.46, 0.02), "Dark")
        b.box((x - 0.2, 0.46, 0.32), (0.8, 0.03, 0.02), "Dark")
        b.box((x - 0.2, 0.2, 0.33), (0.86, 0.05, 0.07), "Dark")
        b.box((x + 0.44, 0.33, 0.305), (0.28, 0.62, 0.02), "WoodDark")
        b.box((x + 0.36, 0.33, 0.32), (0.025, 0.025, 0.02), "Gold")
        glows.append(("night", "#ffcf7a", 1.0, (x - 0.2, 0.46, 0.5)))
        # Fascia sign with the client's name (painted at runtime)
        b.box((x, 0.88, 0.335), (W - 0.12, 0.2, 0.04), f"ShopSign{i}", sign=True)
        # Upper floor: two windows with sills
        for wx in (-0.32, 0.32):
            b.box((x + wx, 1.3, 0.305), (0.3, 0.3, 0.02), "Window")
            b.box((x + wx, 1.3, 0.32), (0.3, 0.025, 0.02), "White")
            b.box((x + wx, 1.13, 0.33), (0.36, 0.04, 0.06), "White")
        # Striped awning with valance
        b.box((x - 0.2, 0.76, 0.5), (0.98, 0.04, 0.4), f"Awning{i}", rot=(0.38, 0, 0))
        b.box((x - 0.2, 0.63, 0.69), (0.98, 0.08, 0.02), f"Awning{i}")
        # Planters either side of the door
        b.box((x + 0.66, 0.12, 0.55), (0.12, 0.2, 0.12), "WoodDark")
        b.ico((x + 0.66, 0.3, 0.55), 0.1, "Leaf", scale=(1, 1.2, 1))
    # Street lamps
    for x in (-2.45, -0.8, 0.8, 2.45):
        b.box((x, 0.4, 1.4), (0.05, 0.8, 0.05), "Dark")
        b.box((x, 0.82, 1.4), (0.12, 0.1, 0.12), "Lamp")
        b.cone((x, 0.91, 1.4), 0.1, 0.08, "Dark", segments=4, rot=(0, math.pi / 4, 0))
        glows.append(("night", "#ffb862", 0.9, (x, 0.82, 1.4)))
    # Bench, bin, flower stand
    b.box((-1.6, 0.22, 1.3), (0.6, 0.05, 0.14), "Wood")
    b.box((-1.6, 0.32, 1.22), (0.6, 0.12, 0.03), "Wood")
    b.cylinder((1.65, 0.18, 1.35), 0.09, 0.36, "Dark", segments=8)
    b.box((0.0, 0.18, 1.25), (0.5, 0.06, 0.25), "WoodDark")
    for k in range(5):
        b.ico((-0.18 + k * 0.09, 0.27, 1.25), 0.05, "FlowerPink" if k % 2 else "FlowerWhite")
    b.to_object(r)
    for i, gl in enumerate(glows):
        glow(r, *gl[:3], gl[3], i)
    return r


# ============================================================================ STADIUM (FanDuel, day job)
# A generic little football ground: no real club or brand. Floodlights use the
# Lamp material so they come on at dusk with everything else.
def stadium():
    r = root("stadium")
    b = Builder("stadium_mesh")
    glows = []
    b.cylinder((0, -0.12, 0), 2.15, 0.45, "Stone", segments=12)
    # Pitch with mown stripes and white markings
    for k in range(8):
        b.box((-1.05 + k * 0.3, 0.09, 0), (0.3, 0.04, 1.5), "Pitch" if k % 2 else "PitchStripe")
    def line(c, size):
        b.box(c, size, "White")
    line((0, 0.115, 0.74), (2.4, 0.01, 0.025))
    line((0, 0.115, -0.74), (2.4, 0.01, 0.025))
    line((1.19, 0.115, 0), (0.025, 0.01, 1.5))
    line((-1.19, 0.115, 0), (0.025, 0.01, 1.5))
    line((0, 0.115, 0), (0.025, 0.01, 1.5))
    for i in range(14):
        a = i * math.pi * 2 / 14
        line((math.cos(a) * 0.24, 0.115, math.sin(a) * 0.24), (0.1, 0.01, 0.025))
    for s_ in (1, -1):
        line((1.0 * s_, 0.115, 0), (0.025, 0.01, 0.6))  # penalty boxes
        line((1.1 * s_, 0.115, 0.3), (0.2, 0.01, 0.025))
        line((1.1 * s_, 0.115, -0.3), (0.2, 0.01, 0.025))
        # Goals
        b.box((1.24 * s_, 0.2, 0.18), (0.03, 0.2, 0.03), "White")
        b.box((1.24 * s_, 0.2, -0.18), (0.03, 0.2, 0.03), "White")
        b.box((1.24 * s_, 0.3, 0), (0.03, 0.03, 0.39), "White")
    # Tiered stands: low at the front so the presented camera sees the pitch
    def tiers(n, axis, sign, length):
        for k in range(n):
            h = 0.16 * (k + 1)
            off = 0.88 + k * 0.17 if axis == "z" else 1.36 + k * 0.17
            seat = "SeatBlue" if k % 2 == 0 else "SeatWhite"
            if axis == "z":
                b.box((0, h / 2 + 0.07, off * sign), (length + k * 0.3, h, 0.17), seat)
            else:
                b.box((off * sign, h / 2 + 0.07, 0), (0.17, h, length + k * 0.3), seat)
    tiers(2, "z", 1, 2.4)  # front
    tiers(5, "z", -1, 2.4)  # main stand
    tiers(4, "x", 1, 1.4)
    tiers(4, "x", -1, 1.4)
    # Main stand back wall, roof canopy on columns
    b.box((0, 0.6, -1.78), (3.4, 1.1, 0.12), "Plaster")
    for x in (-1.5, -0.5, 0.5, 1.5):
        b.box((x, 1.0, -1.05), (0.05, 0.8, 0.05), "Metal")
    b.box((0, 1.42, -1.42), (3.4, 0.06, 0.95), "RoofSlate", rot=(0.12, 0, 0))
    # Scoreboard on the main stand roof, facing the pitch
    b.box((0, 1.82, -1.6), (1.2, 0.5, 0.08), "Dark")
    b.box((0, 1.82, -1.555), (1.08, 0.38, 0.02), "Scoreboard", sign=True)
    for s_ in (1, -1):
        b.box((0.45 * s_, 1.55, -1.62), (0.05, 0.3, 0.05), "Metal")
    glows.append(("neon", "#9fd8ff", 1.4, (0, 1.82, -1.45)))
    # Floodlight towers in the corners
    for sx in (1, -1):
        for sz in (1, -1):
            x, z = 1.75 * sx, 1.3 * sz
            b.box((x, 1.3, z), (0.07, 2.6, 0.07), "Metal", taper=(0.6, 0.6))
            for k in range(5):
                b.box((x, 0.3 + k * 0.48, z), (0.18, 0.025, 0.025), "Metal", rot=(0, 0.6 * sx * sz, 0.6))
            head = (x - 0.08 * sx, 2.62, z - 0.06 * sz)
            b.box(head, (0.42, 0.3, 0.06), "Dark", rot=(-0.35 * sz, math.atan2(sx, sz), 0))
            b.box((head[0] - 0.02 * sx, head[1], head[2] - 0.02 * sz), (0.36, 0.24, 0.05), "Lamp", rot=(-0.35 * sz, math.atan2(sx, sz), 0))
            glows.append(("night", "#f4f8ff", 1.5, (head[0] - 0.15 * sx, head[1] - 0.05, head[2] - 0.15 * sz)))
    # Entrance gate at the front
    for s_ in (1, -1):
        b.box((0.42 * s_, 0.4, 1.4), (0.14, 0.8, 0.14), "Plaster")
    b.box((0, 0.84, 1.4), (1.0, 0.12, 0.16), "SeatBlue")
    for x in (-0.18, 0.0, 0.18):
        b.box((x, 0.2, 1.45), (0.04, 0.2, 0.12), "Metal")
    # Flags on the main stand
    for i, x in enumerate((-1.4, 0.0, 1.4)):
        b.box((x, 1.95, -1.82), (0.02, 0.45, 0.02), "Metal")
        b.box((x + 0.1, 2.1, -1.82), (0.2, 0.12, 0.01), "SeatBlue" if i % 2 == 0 else "White")
    b.to_object(r)
    for i, gl in enumerate(glows):
        glow(r, *gl[:3], gl[3], i)
    return r


# ============================================================================ POST OFFICE (enquiries)
def postoffice():
    r = root("postoffice")
    b = Builder("postoffice_mesh")
    glows = []
    b.box((0, -0.12, -0.1), (2.5, 0.4, 2.0), "Stone", bevel=0.03)
    # Red-brick building with cream quoins and a stone band
    b.box((0, 0.72, -0.3), (2.0, 1.3, 1.3), "Brick")
    for s in (1, -1):
        for i in range(5):
            b.box((0.99 * s, 0.17 + i * 0.27, 0.36), (0.07, 0.14, 0.07), "Cream")
    b.box((0, 1.38, -0.3), (2.08, 0.08, 1.38), "Cream")
    # Slate hipped roof with a ridge and twin chimneys
    b.box((0, 1.62, -0.3), (2.05, 0.42, 1.35), "RoofSlate", taper=(0.72, 0.45))
    b.box((0, 1.85, -0.3), (1.5, 0.05, 0.08), "Dark")
    for s in (1, -1):
        b.box((0.65 * s, 1.95, -0.55), (0.22, 0.5, 0.22), "Brick")
        b.box((0.65 * s, 2.22, -0.55), (0.28, 0.05, 0.28), "Stone")
    # Shopfront: cream surround, sign board, door and two big windows
    b.box((0, 0.62, 0.36), (1.9, 1.05, 0.04), "Cream")
    b.box((0, 1.2, 0.4), (1.7, 0.2, 0.05), "PostSign", sign=True)
    b.box((0, 0.4, 0.385), (0.4, 0.68, 0.02), "PostRed")
    b.box((0, 0.76, 0.39), (0.3, 0.16, 0.02), "Window")
    b.box((0.1, 0.38, 0.4), (0.03, 0.03, 0.02), "Gold")
    for x in (-0.6, 0.6):
        b.box((x, 0.6, 0.385), (0.6, 0.62, 0.02), "Window")
        b.box((x, 0.6, 0.4), (0.64, 0.04, 0.02), "WoodDark")
        b.box((x, 0.6, 0.4), (0.04, 0.66, 0.02), "WoodDark")
        b.box((x, 0.26, 0.43), (0.66, 0.05, 0.1), "Cream")
        glows.append(("night", "#ffcf7a", 0.9, (x, 0.6, 0.5)))
    b.box((0, 0.03, 0.62), (0.6, 0.06, 0.3), "Stone")  # step
    # Pillar box: the bit visitors actually post through
    px, pz = -1.0, 0.95
    b.cylinder((px, 0.32, pz), 0.14, 0.64, "PostRed", segments=8)
    b.cylinder((px, 0.05, pz), 0.17, 0.1, "Dark", segments=8)
    b.dome((px, 0.64, pz), 0.155, "PostRed", segments=8)
    b.cylinder((px, 0.64, pz), 0.165, 0.04, "PostRed", segments=8)
    b.box((px, 0.5, pz + 0.135), (0.14, 0.025, 0.02), "Dark")  # slot
    b.box((px, 0.36, pz + 0.135), (0.1, 0.08, 0.01), "White")  # collection plate
    # Phone box on the other side
    qx, qz = 1.0, 0.9
    b.box((qx, 0.55, qz), (0.36, 1.0, 0.36), "PostRed")
    b.box((qx, 1.1, qz), (0.4, 0.1, 0.4), "PostRed")
    b.dome((qx, 1.15, qz), 0.21, "PostRed", segments=6)
    for i in range(3):
        b.box((qx, 0.4 + i * 0.2, qz + 0.185), (0.24, 0.15, 0.01), "Window")
    b.box((qx, 0.98, qz + 0.185), (0.26, 0.06, 0.012), "White")
    glows.append(("night", "#ffe0a8", 0.7, (qx, 0.6, qz + 0.3)))
    # Lamp by the door
    b.box((-1.12, 0.4, 0.5), (0.04, 0.8, 0.04), "Dark")
    b.box((-1.12, 0.84, 0.5), (0.1, 0.1, 0.1), "Lamp")
    glows.append(("night", "#ffb862", 0.8, (-1.12, 0.84, 0.5)))
    b.to_object(r)
    marker(r, "smoke_0", (0.65, 2.3, -0.55))
    for i, gl in enumerate(glows):
        glow(r, *gl[:3], gl[3], i)
    return r


# ============================================================================ THE HILL (Gloaming)
# A plain snow-capped mountain: faceted slopes, a cairn on the summit, and a
# trail that winds up from the foot. Colours match the planet's own ground.
MTN_H = 2.5
MTN_R = 1.8
MTN_SEGS = 11
MTN_RINGS = (0.22, 0.55, 0.95, 1.35, MTN_R)


def mtn_noise(k, j):
    return 0.5 * math.sin(j * 2.3 + k * 1.7) + 0.5 * math.sin(j * 5.1 - k * 0.9)


def mtn_profile(r):
    return MTN_H * max(0.0, 1 - r / MTN_R) ** 1.15


def gloaming():
    r = root("gloaming")
    b = Builder("gloaming_mesh")

    # Slopes: a summit vertex, rings of jittered vertices, and a skirt sunk into the ground.
    verts = [Vector((0, MTN_H, 0))]
    rings = []
    for k, radius in enumerate(MTN_RINGS + (MTN_R + 0.25,)):
        ring = []
        for j in range(MTN_SEGS):
            n = mtn_noise(k, j)
            a = 2 * math.pi * j / MTN_SEGS + k * 0.17
            rr = radius * (1 + 0.07 * n)
            if k == 0:
                y = MTN_H - 0.03  # small flat summit for the cairn
            elif k == len(MTN_RINGS):
                y = -0.25
            else:
                y = mtn_profile(radius) + 0.12 * n
            ring.append(len(verts))
            verts.append(Vector((math.cos(a) * rr, y, -math.sin(a) * rr)))
        rings.append(ring)
    tris = []
    for j in range(MTN_SEGS):
        tris.append((0, rings[0][j], rings[0][(j + 1) % MTN_SEGS]))
    for k in range(len(rings) - 1):
        inner, outer = rings[k], rings[k + 1]
        for j in range(MTN_SEGS):
            j2 = (j + 1) % MTN_SEGS
            tris.append((inner[j], outer[j], outer[j2]))
            tris.append((inner[j], outer[j2], inner[j2]))

    def slope_mat(tri, i):
        y = sum(verts[v].y for v in tri) / 3
        n = math.sin(i * 1.9) * 0.5 + math.sin(i * 0.7) * 0.5
        if y > 1.55 + 0.18 * n:
            return "Snow"
        if y > 0.6 + 0.15 * n:
            return "MountainRock"
        return "MountainGrass"

    b.tris(verts, tris, [slope_mat(t, i) for i, t in enumerate(tris)])

    # The trail: ledges laid on the real slope (ray cast), winding 1.3 turns from the front foot to the summit.
    from mathutils.bvhtree import BVHTree

    bvh = BVHTree.FromPolygons(verts, tris)

    def ground(x, z):
        hit = bvh.ray_cast(Vector((x, MTN_H + 2, z)), Vector((0, -1, 0)))
        return hit[0].y if hit[0] is not None else 0.0

    steps = 44
    a0 = -math.pi / 2 - 0.35
    pts = []
    for i in range(steps + 1):
        t = i / steps
        a = a0 + t * 1.3 * 2 * math.pi
        rad = (MTN_R + 0.15) * (1 - t) + 0.2 * t
        pts.append((math.cos(a) * rad, -math.sin(a) * rad))
    for i in range(steps):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
        length = math.hypot(x1 - x0, z1 - z0)
        yaw = math.atan2(-(z1 - z0), x1 - x0)
        y = max(ground(mx, mz), 0.0)
        b.box((mx, y + 0.01, mz), (length + 0.04, 0.09, 0.17), "Trail", rot=(0, yaw, 0))

    # Cairn on the summit
    ty = MTN_H - 0.03
    stones = [(0, 0, 0.16, 0.08), (0.12, 0.05, 0.11, 0.06), (-0.1, 0.07, 0.11, 0.06), (0.02, -0.02, 0.12, 0.21), (0.0, 0.01, 0.09, 0.33), (0.01, 0.0, 0.06, 0.42)]
    for dx, dz, size, dy in stones:
        b.ico((dx, ty + dy, dz), size, "Stone", scale=(1, 0.75, 1))

    # Signpost where the trail starts
    sx, sz = pts[0][0] - 0.25, pts[0][1] + 0.15
    b.box((sx, 0.25, sz), (0.06, 0.5, 0.06), "WoodDark")
    b.box((sx + 0.1, 0.44, sz), (0.24, 0.07, 0.03), "Wood", rot=(0, 0.3, 0))

    b.to_object(r)
    return r


roots = [chapel(), workshop(), arcade(), farmhouse(), highstreet(), stadium(), postoffice(), gloaming()]

total_tris = 0
for o in bpy.data.objects:
    if o.type == "MESH":
        total_tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
print(f"[landmarks] objects={len(bpy.data.objects)} tris={total_tris} materials={sorted(MATERIALS)}")

# ---------------------------------------------------------------------------- previews
if PREVIEW_DIR:
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_shadows = False
    sh.show_cavity = True
    scene.render.resolution_x = 520
    scene.render.resolution_y = 400
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.color = (0.12, 0.1, 0.18)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    for i, rt in enumerate(roots):
        rt.location = Vector((i * 20, 0, 0))
    for i, rt in enumerate(roots):
        offset = Vector((i * 20, 0, 0))
        width = 6.5 if rt.name == "highstreet" else 4.8
        cam_data.ortho_scale = width
        look = offset + Vector((0, 0, 1.2))
        cam.location = look + Vector((3.2, -6.5, 3.2))
        cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(PREVIEW_DIR, f"{rt.name}.png")
        bpy.ops.render.render(write_still=True)
    for rt in roots:
        rt.location = (0, 0, 0)

# ---------------------------------------------------------------------------- export
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wanted = dict(
    filepath=OUT,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_vertex_color="NONE",
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    use_selection=False,
)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
kwargs = {k: v for k, v in wanted.items() if k in props}
for o in bpy.data.objects:
    if o.type == "CAMERA":
        bpy.data.objects.remove(o)
bpy.ops.export_scene.gltf(**kwargs)
print(f"[landmarks] wrote {OUT}")
