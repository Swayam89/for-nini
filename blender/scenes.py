# Blender scenes for Nini's birthday site.
#   B=/Applications/Blender.app/Contents/MacOS/Blender
#   $B -b --factory-startup -P blender/scenes.py -- --scene gift --out /tmp/gift --quality preview --res 1440x810
#   add --still 60 for a single look-dev frame, --flames off for the unlit cake.
import bpy, bmesh, math, os, random, sys
from mathutils import Vector

sys.path.insert(0, os.path.expanduser('~/.claude/skills/swaysalyedweb/scripts/blender'))
import stc_blender as stc

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default

SCENE = arg('--scene', 'gift')
OUT = arg('--out', '/tmp/nini_' + SCENE)
QUALITY = arg('--quality', 'draft')
RES = tuple(int(v) for v in arg('--res', '1440x810').split('x'))
STILL = arg('--still')
FLAMES = arg('--flames', 'on') == 'on'

random.seed(7)


# ---------- helpers ----------
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob

def mat(name, **kw):
    return stc.new_material(name, **kw)

def emissive(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], out.inputs[0])
    m['em'] = em.name
    return m

def flame_material():
    """Flame: white-gold core to orange to red rim (by facing), with soft transparent edges."""
    m = bpy.data.materials.new('flame')
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.45
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    e = ramp.color_ramp.elements
    e[0].position = 0.0; e[0].color = (1.0, 0.74, 0.30, 1)
    e[1].position = 0.75; e[1].color = (0.9, 0.22, 0.03, 1)
    el = e.new(0.4); el.color = (1.0, 0.48, 0.1, 1)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 5.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 2.2
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(lw.outputs['Facing'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    nt.links.new(pw.outputs[0], mix.inputs['Fac'])
    nt.links.new(em.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m

def em_node(m):
    return m.node_tree.nodes[m['em']]

def box(name, size, loc=(0, 0, 0), bevel=0.004, open_top=False, thickness=0.0):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    if open_top:
        top = [f for f in bm.faces if f.normal.z > 0.9]
        bmesh.ops.delete(bm, geom=top, context='FACES')
    bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = loc
    if thickness:
        s = ob.modifiers.new('solid', 'SOLIDIFY'); s.thickness = thickness; s.offset = -1
    if bevel:
        b = ob.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 3; b.limit_method = 'ANGLE'
    for p in me.polygons:
        p.use_smooth = True
    return ob

def cylinder(name, r, h, loc, verts=96, bevel=0.006):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    ob = bpy.context.active_object; ob.name = name
    if bevel:
        b = ob.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 4; b.limit_method = 'ANGLE'
    bpy.ops.object.shade_smooth()
    return ob

def sphere(name, r, loc, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc)
    ob = bpy.context.active_object; ob.name = name
    bpy.ops.object.shade_smooth()
    return ob

def heart(name, size, depth=0.35):
    """Pillow heart: the classic outline swept through depth with sin(v), so every slice is a heart.
    Built in local x/y (y up) with depth on z; size = width in metres."""
    nu, nv = 96, 28
    verts, faces = [], []
    for j in range(1, nv):
        v = math.pi * j / nv
        for i in range(nu):
            t = 2 * math.pi * i / nu
            x = 16 * math.sin(t) ** 3
            y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
            s = math.sin(v) ** 0.6
            verts.append((x * s / 34.0, (y + 2.5) * s / 34.0, 7.5 * depth * math.cos(v) / 34.0 * 2.2))
    top = len(verts); verts.append((0, 2.5 / 34.0 * 0.0, 7.5 * depth / 34.0 * 2.2))
    bot = len(verts); verts.append((0, 0, -7.5 * depth / 34.0 * 2.2))
    for j in range(nv - 2):
        for i in range(nu):
            a = j * nu + i; b = j * nu + (i + 1) % nu
            faces.append((a, b, b + nu, a + nu))
    for i in range(nu):
        faces.append((top, (i + 1) % nu, i))
        last = (nv - 2) * nu
        faces.append((bot, last + i, last + (i + 1) % nu))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate(); me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    ob.scale = (size, size, size)
    ob.rotation_euler = (math.radians(90), 0, 0)  # stand it up, facing -y
    return ob

def anim(ob, keys, interp='BEZIER'):
    stc.keyframes(ob, keys, interpolation=interp)

def key_value(socket, frames_vals, interp='BEZIER'):
    for f, v in frames_vals:
        socket.default_value = v
        socket.keyframe_insert('default_value', frame=f)

def fairy_lights(count=46, y=3.2, spread=4.2, z=(0.35, 1.7), color=(1.0, 0.62, 0.28)):
    m = emissive('fairy', color, 22.0)
    for i in range(count):
        x = -spread / 2 + spread * i / (count - 1) + random.uniform(-0.05, 0.05)
        zz = z[0] + (z[1] - z[0]) * (0.5 + 0.45 * math.sin(i * 0.55)) + random.uniform(-0.12, 0.12)
        s = sphere('fl%02d' % i, random.uniform(0.012, 0.022), (x, y + random.uniform(-0.6, 0.6), zz), seg=12)
        s.data.materials.append(m)
        stc._vis(s, diffuse=False, shadow=False)

def studio_floor(color=(0.035, 0.008, 0.01), rough=0.32):
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    fl = bpy.context.active_object; fl.name = 'Floor'
    fl.data.materials.append(mat('floor', base_color=color, roughness=rough, specular=0.5))
    return fl


# ---------- gift box (hero film, 120 frames) ----------
def build_gift():
    scene = stc.setup(quality=QUALITY, res=RES, fps=30, exposure=-0.15)
    stc.world((0.010, 0.004, 0.004), 0.6, horizon=(0.02, 0.008, 0.006))
    studio_floor()
    fairy_lights()

    velvet = mat('velvet', base_color=(0.20, 0.004, 0.018), roughness=0.55, sheen=0.35,
                 sheen_tint=(1.0, 0.3, 0.35), coat=0.15, coat_roughness=0.3)
    lining = mat('lining', base_color=(0.95, 0.72, 0.42), metallic=0.6, roughness=0.28)
    gold = mat('gold', base_color=(1.0, 0.70, 0.30), metallic=1.0, roughness=0.22)
    rose = mat('rose', base_color=(0.98, 0.42, 0.40), metallic=0.85, roughness=0.18, coat=0.5)

    W, D, H, LH = 0.40, 0.40, 0.30, 0.085
    base = box('Base', (W, D, H), (0, 0, H / 2), open_top=True, thickness=0.012)
    base.data.materials.append(velvet); base.data.materials.append(lining)
    # inner lining: a slightly smaller open box
    inner = box('Inner', (W - 0.026, D - 0.026, H - 0.012), (0, 0, H / 2 + 0.006), open_top=True, bevel=0.002)
    inner.data.materials.append(lining)
    # ribbons on the base sides
    rb = 0.05
    for i, (x, y, sx, sy) in enumerate(((0, -D / 2 - 0.003, rb, 0.006), (0, D / 2 + 0.003, rb, 0.006),
                                        (-W / 2 - 0.003, 0, 0.006, rb), (W / 2 + 0.003, 0, 0.006, rb))):
        r = box('RibbonBase%d' % i, (sx, sy, H - 0.01), (x, y, H / 2 - 0.004), bevel=0.001)
        r.data.materials.append(gold)

    # glow inside the box
    glow_m = emissive('glow', (1.0, 0.78, 0.45), 0.0)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.11))
    glow = bpy.context.active_object; glow.scale = (W - 0.03, D - 0.03, 1)
    glow.data.materials.append(glow_m)
    L = bpy.data.lights.new('inner', 'POINT'); L.shadow_soft_size = 0.08; L.color = (1.0, 0.72, 0.4)
    inner_light = link(bpy.data.objects.new('inner', L)); inner_light.location = (0, 0, 0.2)

    # lid: pivot empty so the lid, its ribbons and the bow move together
    pivot = link(bpy.data.objects.new('LidPivot', None)); pivot.location = (0, 0, H)
    lid = box('Lid', (W + 0.024, D + 0.024, LH), (0, 0, LH / 2 - 0.018), bevel=0.006)
    lid.data.materials.append(velvet); lid.parent = pivot
    for i, (sx, sy) in enumerate(((rb, D + 0.03), (W + 0.03, rb))):
        r = box('RibbonLid%d' % i, (sx, sy, LH + 0.004), (0, 0, LH / 2 - 0.017), bevel=0.0015)
        r.data.materials.append(gold); r.parent = pivot
    top = LH - 0.018 + 0.004
    # bow: two flattened torus loops, a knot and two tails
    for side in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.016, major_segments=48, minor_segments=16,
                                         location=(side * 0.058, 0, top + 0.045))
        loop = bpy.context.active_object; loop.name = 'Loop%d' % side
        loop.rotation_euler = (math.radians(90), math.radians(side * 32), 0)
        loop.scale = (1.0, 0.62, 0.9)
        bpy.ops.object.shade_smooth()
        loop.data.materials.append(gold); loop.parent = pivot
        t = box('Tail%d' % side, (0.045, 0.16, 0.006), (side * 0.06, -0.07, top + 0.004), bevel=0.002)
        t.rotation_euler = (math.radians(-8), 0, math.radians(side * 28))
        t.data.materials.append(gold); t.parent = pivot
    knot = sphere('Knot', 0.028, (0, 0, top + 0.03)); knot.scale = (1, 0.8, 0.9)
    knot.data.materials.append(gold); knot.parent = pivot

    # sparks and hearts that rise out of the box
    spark_m = emissive('spark', (1.0, 0.8, 0.5), 18.0)
    sparks = []
    for i in range(54):
        s = sphere('spark%02d' % i, random.uniform(0.0035, 0.008), (0, 0, 0.1), seg=10)
        s.data.materials.append(spark_m)
        stc._vis(s, shadow=False)
        sparks.append(s)
    hearts = []
    for i in range(9):
        h = heart('heart%d' % i, random.uniform(0.07, 0.12))
        h.data.materials.append(rose if i % 3 else gold)
        hearts.append(h)

    # lights
    stc.softbox('key', (1.2, 0.9), (-1.3, -1.4, 1.6), target=(0, 0, 0.2), power=260, color=(1.0, 0.86, 0.72))
    stc.softbox('rim', (0.5, 1.4), (1.4, 1.2, 0.9), target=(0, 0, 0.25), power=220, color=(1.0, 0.55, 0.32))
    stc.softbox('fill', (1.6, 0.8), (1.6, -1.2, 0.5), target=(0, 0, 0.15), power=60, color=(1.0, 0.8, 0.75))
    stc.softbox('top', (1.0, 1.0), (0, 0.1, 2.0), target=(0, 0, 0), power=90, color=(1.0, 0.9, 0.8))

    cam = stc.cam(lens_mm=45, location=(1.0, -1.75, 0.72), target=(0, 0, 0.36), dof_fstop=4.0)
    anim(cam, [
        (1, dict(location=(1.0, -1.75, 0.72), target=(0, 0, 0.36), lens=45)),
        (40, dict(location=(0.45, -1.3, 0.58), target=(0, 0, 0.2), lens=45)),
        (80, dict(location=(0.12, -1.0, 0.95), target=(0, 0.02, 0.36), lens=40)),
        (104, dict(location=(0.02, -0.32, 1.0), target=(0, 0, 0.12), lens=36)),
        (120, dict(location=(0.0, -0.04, 0.42), target=(0, 0, 0.0), lens=32)),
    ])

    # lid: a breath (1-30), lifts and drifts back out of frame (34-78)
    anim(pivot, [
        (1, dict(location=(0, 0, H), rotation_deg=(0, 0, 0))),
        (30, dict(location=(0, 0, H + 0.004), rotation_deg=(0, 0, 0))),
        (44, dict(location=(0, 0.02, H + 0.12), rotation_deg=(-6, 4, 3))),
        (78, dict(location=(0.05, 0.9, H + 1.6), rotation_deg=(-38, 14, 12))),
    ])
    key_value(em_node(glow_m).inputs['Strength'], [(30, 0.0), (48, 4.0), (90, 9.0), (120, 40.0)])
    L.energy = 0
    for f, v in ((30, 0.0), (48, 14.0), (90, 24.0), (120, 30.0)):
        L.energy = v; L.keyframe_insert('energy', frame=f)

    for i, s in enumerate(sparks):
        a = random.uniform(0, 2 * math.pi)
        r0 = random.uniform(0.0, 0.15)
        start = random.randint(46, 76)
        rise = random.uniform(0.6, 1.5)
        twist = random.uniform(1.0, 2.6)
        keys = [(1, dict(location=(r0 * math.cos(a), r0 * math.sin(a), 0.1)))]
        keys.append((start, dict(location=(r0 * math.cos(a), r0 * math.sin(a), 0.1))))
        for j, f in enumerate(range(start + 12, 121, 12)):
            k = (f - start) / (120 - start)
            rr = r0 + 0.18 * k
            aa = a + twist * k
            keys.append((f, dict(location=(rr * math.cos(aa), rr * math.sin(aa), 0.1 + rise * k))))
        anim(s, keys)
    for i, h in enumerate(hearts):
        a = 2 * math.pi * i / len(hearts)
        start = 50 + i * 3
        keys = [(1, dict(location=(0, 0, 0.05), rotation_deg=(90, 0, 0), scale=(0.001,) * 3)),
                (start, dict(location=(0, 0, 0.12), rotation_deg=(90, 0, 0), scale=(0.001,) * 3))]
        sz = h.scale[0] if h.scale[0] > 0.01 else 0.1
        sz = random.uniform(0.07, 0.12)
        for f in (start + 20, 120):
            k = (f - start) / (120 - start)
            r = 0.1 + 0.32 * k
            keys.append((f, dict(location=(r * math.cos(a + k), r * math.sin(a + k) * 0.7, 0.2 + 0.9 * k),
                                 rotation_deg=(90 + 15 * math.sin(i), 0, (i * 40 + 160 * k)),
                                 scale=(sz,) * 3)))
        anim(h, keys)
    return scene, 1, 120


# ---------- cake (finale film, 72 frames) ----------
def build_cake():
    scene = stc.setup(quality=QUALITY, res=RES, fps=30, exposure=-0.25)
    stc.world((0.010, 0.004, 0.004), 0.6, horizon=(0.02, 0.008, 0.006))
    studio_floor(color=(0.03, 0.01, 0.01), rough=0.38)
    fairy_lights(count=56, y=2.6, spread=4.6, z=(0.5, 1.9))

    gold = mat('gold', base_color=(1.0, 0.70, 0.30), metallic=1.0, roughness=0.2)
    frost = mat('frost', base_color=(0.92, 0.46, 0.50), roughness=0.55, sheen=0.4,
                subsurface=0.25, subsurface_radius=(0.8, 0.4, 0.3), subsurface_scale=0.01)
    cream = mat('cream', base_color=(1.0, 0.93, 0.84), roughness=0.5, subsurface=0.2,
                subsurface_scale=0.008)
    pearl = mat('pearl', base_color=(1.0, 0.95, 0.9), roughness=0.15, coat=0.8)
    berry = mat('berry', base_color=(0.55, 0.02, 0.05), roughness=0.2, coat=1.0)
    wax = mat('wax', base_color=(1.0, 0.72, 0.58), roughness=0.4, subsurface=0.4, subsurface_scale=0.01)
    flame_m = flame_material()

    stand = cylinder('Stand', 0.30, 0.022, (0, 0, 0.13)); stand.data.materials.append(gold)
    stem = cylinder('Stem', 0.05, 0.12, (0, 0, 0.06), bevel=0.01); stem.data.materials.append(gold)
    foot = cylinder('Foot', 0.13, 0.016, (0, 0, 0.008)); foot.data.materials.append(gold)
    z0 = 0.141
    t1 = cylinder('Tier1', 0.23, 0.16, (0, 0, z0 + 0.08), bevel=0.012); t1.data.materials.append(frost)
    t2 = cylinder('Tier2', 0.155, 0.12, (0, 0, z0 + 0.16 + 0.06), bevel=0.01); t2.data.materials.append(cream)
    top2 = z0 + 0.28
    # pearl borders
    for (r, z, n, pr) in ((0.232, z0 + 0.008, 64, 0.011), (0.232, z0 + 0.158, 64, 0.009),
                          (0.157, z0 + 0.168, 48, 0.009), (0.157, top2 - 0.002, 48, 0.008)):
        for i in range(n):
            a = 2 * math.pi * i / n
            s = sphere('pearl', pr, (r * math.cos(a), r * math.sin(a), z), seg=12)
            s.data.materials.append(pearl)
    # gold band on tier 1
    band = cylinder('Band', 0.2335, 0.02, (0, 0, z0 + 0.06), bevel=0.0); band.data.materials.append(gold)
    # berries on the lower ledge
    for i in range(18):
        a = 2 * math.pi * i / 18 + 0.1
        s = sphere('berry', 0.014, (0.195 * math.cos(a), 0.195 * math.sin(a), z0 + 0.172), seg=16)
        s.data.materials.append(berry)
    # candles and flames
    flames, lights = [], []
    for i in range(7):
        a = 2 * math.pi * i / 7 + math.pi / 2
        x, y = 0.095 * math.cos(a), 0.095 * math.sin(a)
        c = cylinder('candle%d' % i, 0.0065, 0.075, (x, y, top2 + 0.0375), verts=24, bevel=0.001)
        c.data.materials.append(wax)
        f = sphere('flame%d' % i, 0.007, (x, y, top2 + 0.09), seg=16)
        f.scale = (1, 1, 2.6)
        f.data.materials.append(flame_m)
        stc._vis(f, shadow=False)
        Lf = bpy.data.lights.new('fl%d' % i, 'POINT'); Lf.energy = 2.2; Lf.color = (1.0, 0.6, 0.25)
        Lf.shadow_soft_size = 0.01
        lo = link(bpy.data.objects.new('fl%d' % i, Lf)); lo.location = (x, y, top2 + 0.093)
        flames.append(f); lights.append(lo)
        if not FLAMES:
            f.hide_render = True; lo.hide_render = True
            wick = sphere('wick%d' % i, 0.0018, (x, y, top2 + 0.079), seg=8)
            wick.scale = (1, 1, 3)
            wick.data.materials.append(mat('wick', base_color=(0.02, 0.02, 0.02), roughness=0.8))

    # "Nini" topper in gold script
    font = None
    for p in ('/System/Library/Fonts/Supplemental/SnellRoundhand.ttc',
              '/System/Library/Fonts/Supplemental/Zapfino.ttf',
              '/System/Library/Fonts/Supplemental/Brush Script.ttf'):
        if os.path.exists(p):
            try:
                font = bpy.data.fonts.load(p); break
            except Exception:
                font = None
    cu = bpy.data.curves.new('Topper', 'FONT')
    cu.body = 'Nini'
    if font:
        cu.font = font
    cu.align_x = 'CENTER'; cu.size = 0.11; cu.extrude = 0.004; cu.bevel_depth = 0.0012; cu.bevel_resolution = 3
    topper = link(bpy.data.objects.new('Topper', cu))
    topper.data.materials.append(gold)
    topper.rotation_euler = (math.radians(90), 0, 0)
    topper.location = (0, 0.03, top2 + 0.16)
    for side in (-1, 1):
        st = cylinder('stick', 0.0016, 0.14, (side * 0.05, 0.03, top2 + 0.08), verts=12, bevel=0)
        st.data.materials.append(gold)

    stc.softbox('key', (1.2, 0.9), (-1.2, -1.5, 1.5), target=(0, 0, 0.3), power=170, color=(1.0, 0.84, 0.7))
    stc.softbox('rim', (0.5, 1.4), (1.3, 1.1, 1.0), target=(0, 0, 0.35), power=200, color=(1.0, 0.55, 0.32))
    stc.softbox('fill', (1.6, 0.8), (1.6, -1.3, 0.6), target=(0, 0, 0.25), power=45, color=(1.0, 0.8, 0.75))

    cam = stc.cam(lens_mm=42, location=(0.75, -1.75, 0.8), target=(0, 0, 0.3), dof_fstop=3.2)
    anim(cam, [
        (1, dict(location=(0.9, -2.6, 1.0), target=(0, 0, 0.3), lens=42)),
        (40, dict(location=(0.35, -1.9, 0.8), target=(0, 0, 0.34), lens=48)),
        (72, dict(location=(0.0, -1.95, 0.74), target=(0, 0, 0.29), lens=50)),
    ])
    return scene, 1, 72


scene, f0, f1 = build_gift() if SCENE == 'gift' else build_cake()
if STILL:
    os.makedirs(OUT, exist_ok=True)
    scene.render.image_settings.file_format = 'JPEG'
    scene.frame_set(int(STILL))
    scene.render.filepath = os.path.join(OUT, '%s_%s.jpg' % (SCENE, STILL))
    bpy.ops.render.render(write_still=True)
else:
    scene.render.image_settings.quality = 82
    if arg('--range'):
        f0, f1 = (int(v) for v in arg('--range').split('-'))
    stc.render_frames(OUT, f0, f1, fmt=arg('--fmt', 'WEBP'), resume=True)
