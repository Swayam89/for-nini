/* Live three.js layer: glossy 3D hearts drifting behind the transparent chapters.
   API: Hearts.setOn(bool), Hearts.front(bool), Hearts.burst(x, y, n), Hearts.celebrate(). */
(function () {
  'use strict';
  var canvas = document.getElementById('hearts');
  var queue = [], api = {};
  ['setOn', 'front', 'burst', 'celebrate'].forEach(function (k) {
    api[k] = function () { queue.push([k, arguments]); if (k === 'setOn') canvas.classList.toggle('on', !!arguments[0]); if (k === 'front') canvas.classList.toggle('front', !!arguments[0]); };
  });
  window.Hearts = api;

  function start() {
    var THREE = window.THREE;
    if (!THREE) return;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) { return; }
    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(DPR);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 14);
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new window.RoomEnvironment(), 0.04).texture;
    var key = new THREE.DirectionalLight(0xffe0c0, 2.2); key.position.set(-4, 6, 8); scene.add(key);
    var rim = new THREE.DirectionalLight(0xff8a60, 2.5); rim.position.set(6, -2, -6); scene.add(rim);

    // a puffy heart: the classic bezier outline, extruded with a deep bevel
    var s = new THREE.Shape();
    s.moveTo(25, 25);
    s.bezierCurveTo(25, 25, 20, 0, 0, 0);
    s.bezierCurveTo(-30, 0, -30, 35, -30, 35);
    s.bezierCurveTo(-30, 55, -10, 77, 25, 95);
    s.bezierCurveTo(60, 77, 80, 55, 80, 35);
    s.bezierCurveTo(80, 35, 80, 0, 50, 0);
    s.bezierCurveTo(35, 0, 25, 25, 25, 25);
    var geo = new THREE.ExtrudeGeometry(s, { depth: 14, bevelEnabled: true, bevelSegments: 10, steps: 1, bevelSize: 12, bevelThickness: 14, curveSegments: 36 });
    geo.center(); geo.rotateZ(Math.PI); geo.scale(0.0105, 0.0105, 0.0105);
    geo.computeVertexNormals();

    var mats = [
      new THREE.MeshPhysicalMaterial({ color: 0xb3132e, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }),
      new THREE.MeshPhysicalMaterial({ color: 0xff7d8c, roughness: 0.25, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 }),
      new THREE.MeshPhysicalMaterial({ color: 0xe9b45a, roughness: 0.2, metalness: 1, clearcoat: 0.6 }),
      new THREE.MeshPhysicalMaterial({ color: 0xf6c3c0, roughness: 0.35, metalness: 0.0, clearcoat: 1 })
    ];

    var group = new THREE.Group(); scene.add(group);
    var hearts = [];
    var COUNT = innerWidth < 720 ? 18 : 30;
    var view = { w: 10, h: 10 };
    function rand(a, b) { return a + Math.random() * (b - a); }
    for (var i = 0; i < COUNT; i++) {
      var m = new THREE.Mesh(geo, mats[i % mats.length]);
      var h = { m: m, z: rand(-8, 4), spin: rand(-0.6, 0.6), wob: rand(0, 6.28), sp: rand(0.25, 0.7), sc: rand(0.4, 0.95), push: new THREE.Vector2() };
      m.scale.setScalar(h.sc);
      m.position.set(rand(-1, 1), rand(-1, 1), h.z);
      m.rotation.set(rand(-0.4, 0.4), rand(0, 6.28), rand(-0.3, 0.3));
      group.add(m); hearts.push(h);
    }
    var bursts = [];

    function halfExtent(z) {
      var d = camera.position.z - z, hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
      return { x: hh * camera.aspect, y: hh };
    }
    function resize() {
      var w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    function edgeX(e) { var sgn = Math.random() < 0.5 ? -1 : 1; return sgn * rand(innerWidth < 720 ? 0.25 : 0.5, 1.05) * e.x; }
    hearts.forEach(function (h) { var e = halfExtent(h.z); h.m.position.x = edgeX(e); h.m.position.y = rand(-e.y, e.y); });
    window.addEventListener('resize', resize);

    var mouse = new THREE.Vector2(9, 9), mouseS = new THREE.Vector2(), lastScroll = scrollY, scrollV = 0;
    window.addEventListener('pointermove', function (e) { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1)); });

    var on = false, front = false, clock = new THREE.Clock();
    function screenToWorld(x, y, z) {
      var e = halfExtent(z);
      return new THREE.Vector3((x / innerWidth * 2 - 1) * e.x, -(y / innerHeight * 2 - 1) * e.y, z);
    }

    var real = {
      setOn: function (v) { on = !!v; canvas.classList.toggle('on', on || front); },
      front: function (v) { front = !!v; canvas.classList.toggle('front', front); canvas.classList.toggle('on', on || front); },
      burst: function (x, y, n) {
        if (!on && !front) return;
        for (var i = 0; i < (n || 8); i++) {
          var m = new THREE.Mesh(geo, mats[i % mats.length]);
          var p = screenToWorld(x, y, 2); m.position.copy(p);
          var sc = rand(0.25, 0.55); m.scale.setScalar(sc);
          var a = rand(0, Math.PI * 2), sp = rand(2.5, 6);
          scene.add(m);
          bursts.push({ m: m, v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + 3, rand(-2, 2)), life: 0, max: rand(1.4, 2.4), sc: sc, spin: rand(-6, 6) });
        }
      },
      celebrate: function () {
        var n = 0;
        var iv = setInterval(function () {
          real.burst(rand(0.15, 0.85) * innerWidth, rand(0.3, 0.8) * innerHeight, 7);
          if (++n > 6) clearInterval(iv);
        }, 260);
      }
    };
    window.Hearts = real;
    queue.forEach(function (q) { real[q[0]].apply(null, q[1]); });

    function tick() {
      requestAnimationFrame(tick);
      var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      scrollV += ((scrollY - lastScroll) * 0.02 - scrollV) * 0.1; lastScroll = scrollY;
      if (!on && !front && !bursts.length) return;
      mouseS.lerp(mouse, 0.06);
      group.rotation.y = mouseS.x * 0.12; group.rotation.x = -mouseS.y * 0.08;
      var mp = new THREE.Vector3();
      hearts.forEach(function (h) {
        var m = h.m, e = halfExtent(h.z);
        m.position.y += (h.sp + scrollV * 1.6) * dt;
        m.position.x += Math.sin(t * 0.6 + h.wob) * 0.12 * dt;
        m.rotation.y += h.spin * dt; m.rotation.z = Math.sin(t * 0.8 + h.wob) * 0.2;
        // the cursor gently pushes hearts away
        mp.set(mouseS.x * e.x, mouseS.y * e.y, h.z);
        var dx = m.position.x - mp.x, dy = m.position.y - mp.y, d2 = dx * dx + dy * dy;
        if (d2 < 4) { var f = (4 - d2) * 0.6 * dt; h.push.x += dx * f; h.push.y += dy * f; }
        h.push.multiplyScalar(0.94);
        m.position.x += h.push.x; m.position.y += h.push.y;
        if (m.position.y > e.y + 1.2) { m.position.y = -e.y - 1.2; m.position.x = edgeX(e); }
        if (m.position.y < -e.y - 1.4) { m.position.y = e.y + 1.2; }
        if (m.position.x > e.x + 1.5) m.position.x = -e.x - 1.2;
        if (m.position.x < -e.x - 1.5) m.position.x = e.x + 1.2;
      });
      bursts = bursts.filter(function (b) {
        b.life += dt;
        b.v.y -= 5.5 * dt; b.v.multiplyScalar(0.985);
        b.m.position.addScaledVector(b.v, dt);
        b.m.rotation.y += b.spin * dt;
        var k = 1 - Math.max(0, (b.life - b.max * 0.6) / (b.max * 0.4));
        b.m.scale.setScalar(b.sc * Math.max(k, 0.001));
        if (b.life > b.max) { scene.remove(b.m); return false; }
        return true;
      });
      renderer.render(scene, camera);
    }
    tick();
  }
  if (window.THREE) start(); else window.addEventListener('three:ready', start, { once: true });
})();
