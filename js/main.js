/* For Nini: scroll choreography, Blender film players, CSS 3D tracks, the ring, the wish. */
(function () {
  'use strict';
  var RM = document.documentElement.classList.contains('rm');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- Blender film: frames drawn on a 2D canvas (works from file://) ---------- */
  function Film(canvas, dir, count, ext) {
    var ctx = canvas.getContext('2d');
    var imgs = new Array(count), ok = new Array(count), p = 0, loaded = 0, self = this;
    this.count = count;
    this.onload = null;
    function src(i) { return dir + '/f_' + String(i + 1).padStart(4, '0') + '.' + ext; }
    this.load = function () {
      // keyframes first (every 8th), then the rest, so a fast scrub never shows a blank
      var order = [];
      for (var i = 0; i < count; i += 8) order.push(i);
      for (var j = 0; j < count; j++) if (j % 8) order.push(j);
      order.forEach(function (i) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () { ok[i] = true; loaded++; if (self.onload) self.onload(loaded, count); if (Math.round(p * (count - 1)) === i || loaded < 3) self.draw(); };
        im.onerror = function () { loaded++; if (self.onload) self.onload(loaded, count); };
        im.src = src(i);
        imgs[i] = im;
      });
    };
    // frames are 1440 wide: a canvas larger than the source only costs fill rate.
    // Checked on every draw, because a page opened in a background tab lays out at 0x0.
    function fit() {
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return false;
      var k = Math.min(DPR, Math.max(1, 1440 / cw));
      var w = Math.round(cw * k), h = Math.round(ch * k);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      return true;
    }
    this.size = function () { this.draw(); };
    this.progress = function (v) {
      var prev = Math.round(p * (count - 1));
      p = clamp(v, 0, 1);
      if (Math.round(p * (count - 1)) !== prev) this.draw();
    };
    this.draw = function () {
      var want = Math.round(p * (count - 1)), k = -1;
      for (var d = 0; d < count; d++) {
        if (want - d >= 0 && ok[want - d]) { k = want - d; break; }
        if (want + d < count && ok[want + d]) { k = want + d; break; }
      }
      if (k < 0 || !fit()) return;
      var im = imgs[k], W = canvas.width, H = canvas.height;
      var s = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      var w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    };
  }

  // image (u, v in 0..1) -> screen px, for a cover-fit 1440x810 frame
  function coverPoint(el, u, v) {
    var W = el.clientWidth, H = el.clientHeight, iw = 1440, ih = 810;
    var s = Math.max(W / iw, H / ih);
    return { x: (W - iw * s) / 2 + u * iw * s, y: (H - ih * s) / 2 + v * ih * s, s: s };
  }

  var gift = new Film($('#giftFilm'), 'assets/seq/gift', 120, 'webp');
  var cake = new Film($('#cakeFilm'), 'assets/seq/cake', 72, 'webp');

  /* ---------- music: "This Town" starts on the tap that opens the present ---------- */
  var music = (function () {
    var song = $('#song'), btn = $('#soundBtn'), START = 50, BASE = 0.55;
    var started = false, muted = false, ducked = false;
    function fade(v, s, done) { gsap.to(song, { volume: v, duration: s, ease: 'sine.inOut', overwrite: true, onComplete: done }); }
    function play() { var pr = song.play(); if (pr) pr.catch(function () {}); }
    function ui() { var on = started && !muted && !ducked; btn.classList.toggle('off', !on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    song.addEventListener('ended', function () { song.currentTime = START; play(); });   // loop back to the main part
    btn.addEventListener('click', function () {
      if (!started) { api.start(); return; }
      muted = !muted;
      if (muted) fade(0, 0.6, function () { song.pause(); });
      else if (!ducked) { play(); fade(BASE, 1.2); }
      ui();
    });
    document.addEventListener('visibilitychange', function () {
      if (!started || muted || ducked) return;
      if (document.hidden) song.pause(); else play();
    });
    var api = {
      start: function () {
        if (started) return;
        started = true; song.volume = 0;
        // start at 0:50, the main part of the song; the seek has to wait for metadata if the file is still loading
        var seek = function () { try { if (song.currentTime < START) song.currentTime = START; } catch (e) {} };
        if (song.readyState >= 1) seek(); else song.addEventListener('loadedmetadata', seek, { once: true });
        play(); fade(BASE, 3); ui();
      },
      duck: function (on) {
        if (on === ducked) return;
        ducked = on;
        if (!started || muted) return ui();
        if (on) fade(0, 0.4, function () { song.pause(); });
        else { play(); fade(BASE, 1.2); }
        ui();
      },
      swell: function () { if (started && !muted && !ducked) { fade(0.8, 1.5); setTimeout(function () { if (!muted && !ducked) fade(BASE, 4); }, 9000); } }
    };
    return api;
  })();

  /* ---------- gate ---------- */
  var lenis = null;
  var gate = $('#gate'), gateBtn = $('#gateBtn');
  document.documentElement.classList.add('locked');
  gift.onload = function (n, total) {
    $('#gateBar').style.transform = 'scaleX(' + (n / total) + ')';
    $('#gateCount').textContent = String(Math.round(100 * n / total)).padStart(3, '0');
    if (n / total > 0.5) gateBtn.disabled = false;
  };
  setTimeout(function () { gateBtn.disabled = false; }, 6000);
  gift.load();
  gateBtn.addEventListener('click', function () {
    gate.classList.add('open');
    music.start();
    document.documentElement.classList.remove('locked');
    if (lenis) lenis.start();
    cake.load();
    popHearts(innerWidth / 2, innerHeight / 2, 18);
    ScrollTrigger.refresh();
    sizeAll(); placeFlames();
  });

  /* ---------- smooth scroll ---------- */
  gsap.registerPlugin(ScrollTrigger);
  if (!RM && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function goTo(target) {
    var el = typeof target === 'string' ? $(target) : target;
    if (lenis) lenis.scrollTo(el, { duration: 2.2 }); else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  }
  $$('[data-goto]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); goTo(a.getAttribute('data-goto')); });
  });

  var pinEnd = function (n) { return function () { return '+=' + Math.round(innerHeight * n); }; };

  /* ---------- 01 hero: the gift opens ---------- */
  (function () {
    var sec = $('#hero');
    if (RM) { gift.progress(0); return; }
    var S = { p: 0 };
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: pinEnd(4), pin: true, scrub: 0.8, invalidateOnRefresh: true } })
      .to(S, { p: 1, duration: 1, onUpdate: function () { gift.progress(S.p); } }, 0)
      .to('#scrollHint', { autoAlpha: 0, duration: 0.05 }, 0)
      .to('#heroCopy1', { autoAlpha: 0, y: -80, filter: 'blur(8px)', duration: 0.16 }, 0.14)
      .fromTo('#heroCopy2', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.42)
      .to('#heroCopy2', { autoAlpha: 0, y: -40, duration: 0.08 }, 0.68)
      .to('#heroPortal', { opacity: 1, duration: 0.1 }, 0.9);
  })();

  /* ---------- depth tracks: the camera flies forward through photos ---------- */
  function depthTrack(sec, opts) {
    var world = $('.world', sec);
    if (opts.dust) {
      for (var i = 0; i < opts.dust; i++) {
        var d = document.createElement('span');
        d.className = 'item dust';
        d.dataset.x = (Math.random() * 120 - 60).toFixed(1);
        d.dataset.y = (Math.random() * 90 - 45).toFixed(1);
        d.dataset.z = Math.round(Math.random() * opts.dustDepth);
        d.dataset.s = (0.6 + Math.random() * 2.4).toFixed(2);
        world.appendChild(d);
      }
    }
    var items = $$('.item', world).map(function (el) {
      return { el: el, title: el.classList.contains('title-card'), x: +el.dataset.x, y: +el.dataset.y, z: +el.dataset.z, r: +(el.dataset.r || 0), s: +(el.dataset.s || 1), o: -1 };
    });
    var maxZ = Math.max.apply(null, items.filter(function (it) { return !it.el.classList.contains('dust'); }).map(function (it) { return it.z; }));
    var near = opts.near || 760, far = opts.far || 4200, total = maxZ + (opts.tail || 0);
    function place() {
      items.forEach(function (it) {
        var x = it.x * innerWidth / 100, y = it.y * innerHeight / 100;
        it.el.style.transform = 'translate(-50%,-50%) translate3d(' + x + 'px,' + y + 'px,' + (-it.z) + 'px) rotateZ(' + it.r + 'deg) scale(' + it.s + ')';
      });
    }
    function update(p) {
      var cam = p * total;
      world.style.transform = 'translate3d(0,0,' + cam.toFixed(1) + 'px)';
      items.forEach(function (it) {
        var zr = cam - it.z;
        var o = smooth(-far, -far + 1400, zr) * (1 - smooth(near - 380, near, zr));
        if (opts.hold && !it.title) o *= smooth(opts.hold * 0.4, opts.hold, cam);
        o = Math.round(o * 100) / 100;
        if (o !== it.o) { it.o = o; it.el.style.opacity = o; it.el.style.visibility = o > 0 ? 'visible' : 'hidden'; }
      });
    }
    place(); update(0);
    window.addEventListener('resize', place);
    // mouse parallax through the perspective origin: near layers slide, far layers barely move
    var mx = 0, my = 0, cx = 0, cy = 0;
    sec.addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
    gsap.ticker.add(function () {
      cx += (mx - cx) * 0.06; cy += (my - cy) * 0.06;
      if (Math.abs(mx - cx) > 0.0005 || Math.abs(my - cy) > 0.0005) sec.style.perspectiveOrigin = (50 - cx * 14) + '% ' + (50 - cy * 14) + '%';
    });
    return { update: update };
  }

  /* ---------- 02 memories ---------- */
  (function () {
    var sec = $('#memories');
    if (RM) return;
    var T = depthTrack(sec, { dust: innerWidth < 720 ? 30 : 55, dustDepth: 8200, near: 800, far: 2700, tail: 520, hold: 700 });
    var S = { p: 0 };
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: pinEnd(8), pin: true, scrub: 1, invalidateOnRefresh: true } })
      .to(S, { p: 1, duration: 1, onUpdate: function () { T.update(S.p); } }, 0);
  })();

  /* ---------- 03 statement ---------- */
  (function () {
    var el = $('#statement');
    var HL = { 'warmer.': 1, 'chose': 1, 'me.': 1, 'favourite': 1, 'safest': 1, 'adventure.': 1 };
    el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w) {
      return '<span class="w' + (HL[w] ? ' hl' : '') + '">' + w + '</span>';
    }).join(' ');
    if (RM) return;
    var words = $$('.w', el);
    gsap.timeline({ scrollTrigger: { trigger: '#words', start: 'top top', end: pinEnd(1.6), pin: true, scrub: 0.6 } })
      .to(words, { opacity: 1, stagger: 0.05, duration: 0.3, ease: 'none' })
      .to({}, { duration: 0.6 });
  })();

  /* ---------- 04 garba ring ---------- */
  (function () {
    var sec = $('#garba'), stage = $('#ringStage'), ring = $('#ring');
    var cards = $$('.card', ring), N = cards.length, step = 360 / N;
    var R = 400, scrollRot = 0, drag = 0, vel = 0, dirty = true;
    function size() {
      var cw = clamp(innerWidth * 0.2, 170, 300);
      ring.style.setProperty('--cw', cw + 'px');
      cards.forEach(function (c) { c.style.setProperty('--cw', cw + 'px'); });
      R = cw * 0.5 / Math.tan(Math.PI / N) * 1.3;
      cards.forEach(function (c, i) { c.style.transform = 'rotateY(' + (i * step) + 'deg) translateZ(' + R + 'px)'; });
      dirty = true;
    }
    function render() {
      var rot = scrollRot + drag;
      ring.style.transform = 'translateZ(' + (-R * 0.9) + 'px) rotateX(-10deg) rotateY(' + rot.toFixed(2) + 'deg)';
      cards.forEach(function (c, i) {
        var a = (i * step + rot) * Math.PI / 180;
        c.style.setProperty('--shade', ((1 - Math.cos(a)) * 0.42).toFixed(3));
      });
    }
    size(); render();
    window.addEventListener('resize', size);
    gsap.ticker.add(function () {
      if (!down && Math.abs(vel) > 0.01) { drag += vel; vel *= 0.9; dirty = true; }
      if (dirty) { render(); dirty = false; }
    });
    var down = false, sx = 0, lx = 0, moved = 0;
    stage.addEventListener('pointerdown', function (e) { down = true; sx = lx = e.clientX; moved = 0; vel = 0; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - lx; lx = e.clientX; moved = Math.max(moved, Math.abs(e.clientX - sx));
      drag += dx * 0.2; vel = dx * 0.2; dirty = true;
    });
    stage.addEventListener('pointerup', function (e) {
      down = false;
      if (moved < 6) {
        stage.releasePointerCapture(e.pointerId);
        var hit = document.elementsFromPoint(e.clientX, e.clientY).filter(function (n) { return n.classList && n.classList.contains('card'); })[0];
        if (hit) openImage($('img', hit));
      }
    });
    if (RM) return;
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: pinEnd(4), pin: true, scrub: 1 } })
      .to({ v: 0 }, { v: 1, duration: 1, onUpdate: function () { scrollRot = -this.targets()[0].v * 400; dirty = true; } }, 0)
      .fromTo('#garbaWord', { xPercent: 0 }, { xPercent: -45, duration: 1 }, 0)
      .from('.garba-head', { autoAlpha: 0, y: 40, duration: 0.12 }, 0);
  })();

  /* ---------- 05 up close ---------- */
  (function () {
    var sec = $('#close');
    if (RM) return;
    var T = depthTrack(sec, { near: 820, far: 3400, tail: 300 });
    var S = { p: 0 };
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: pinEnd(8), pin: true, scrub: 1, invalidateOnRefresh: true } })
      .to(S, { p: 1, duration: 1, onUpdate: function () { T.update(S.p); } }, 0);
  })();

  /* ---------- 06 films: layered parallax, tilt, play in view ---------- */
  (function () {
    var cards = $$('.vcard');
    // posters at rest; a card plays (muted) only while the pointer is on it, so nothing decodes during the scroll
    cards.forEach(function (c) {
      var v = $('video', c);
      c.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { var pr = v.play(); if (pr) pr.catch(function () {}); } });
      c.addEventListener('pointerleave', function () { v.pause(); });
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--ty', ((e.clientX - r.left) / r.width - 0.5) * 16 + 'deg');
        c.style.setProperty('--tx', -((e.clientY - r.top) / r.height - 0.5) * 12 + 'deg');
      });
      c.addEventListener('pointerleave', function () { c.style.setProperty('--tx', '0deg'); c.style.setProperty('--ty', '0deg'); });
      c.addEventListener('click', function () { openVideo($('video', c).getAttribute('src')); });
    });
    if (RM) return;
    gsap.from('.films-head > *', { autoAlpha: 0, y: 50, stagger: 0.12, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.films-head', start: 'top 80%' } });
    cards.forEach(function (c) {
      var sp = +c.dataset.speed;
      gsap.fromTo(c, { '--py': (-sp * 70) + 'px' }, { '--py': (sp * 70) + 'px', ease: 'none', scrollTrigger: { trigger: '#films', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  })();

  /* ---------- 07 letter ---------- */
  (function () {
    if (RM) return;
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#letter', start: 'top top', end: pinEnd(2.2), pin: true, scrub: 0.8 } })
      .fromTo('#paper', { rotateX: 74, y: '28vh', scale: 0.82, autoAlpha: 0 }, { rotateX: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, 0)
      .from('#paper .kicker, #paper .greet, #paper .line, #paper .sign', { autoAlpha: 0, y: 18, stagger: 0.07, duration: 0.12 }, 0.3)
      .to({}, { duration: 0.15 });
  })();

  /* ---------- 08 cake: the push-in, the wish ---------- */
  var cakeSec = $('#cake');
  (function () {
    if (RM) { cake.progress(1); $('#flames').style.opacity = 1; return; }
    var S = { p: 0 };
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: cakeSec, start: 'top top', end: pinEnd(3), pin: true, scrub: 0.8,
      onUpdate: function (st) { if (st.progress < 0.7 && cakeSec.classList.contains('blown')) relight(); } } })
      .to(S, { p: 1, duration: 0.82, onUpdate: function () { cake.progress(S.p); flamesEl.style.opacity = smooth(0.94, 1, S.p); } }, 0)
      .fromTo('#cakeCopy', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.74)
      .to({}, { duration: 0.18 });
  })();

  // flame tips in the last cake frame (u, v of the 1440x810 image); see blender/scenes.py build_cake
  var FLAMES = [[0.432, 0.225], [0.448, 0.214], [0.469, 0.235], [0.5, 0.217], [0.530, 0.235], [0.551, 0.214], [0.566, 0.225]];
  var flamesEl = $('#flames');
  FLAMES.forEach(function () { var g = document.createElement('i'); g.className = 'flame-glow'; flamesEl.appendChild(g); });
  function placeFlames() {
    $$('.flame-glow', flamesEl).forEach(function (g, i) { var pt = coverPoint(cakeSec, FLAMES[i][0], FLAMES[i][1]); g.style.left = pt.x + 'px'; g.style.top = pt.y + 'px'; });
  }
  placeFlames(); window.addEventListener('resize', placeFlames);
  var smoke = $('#smoke'), sctx = smoke.getContext('2d'), puffs = [], smoking = false;
  function blow() {
    if (cakeSec.classList.contains('blown')) return;
    cakeSec.classList.add('blown');
    music.swell();
    smoke.width = smoke.clientWidth * DPR; smoke.height = smoke.clientHeight * DPR;
    FLAMES.forEach(function (f) {
      var pt = coverPoint(smoke, f[0], f[1]);
      for (var i = 0; i < 26; i++) puffs.push({ x: pt.x * DPR, y: pt.y * DPR, vx: (Math.random() - 0.5) * 0.5, vy: -0.6 - Math.random() * 1.2, r: 2 + Math.random() * 4, life: 0, max: 90 + Math.random() * 80, delay: i * 2 });
    });
    if (!smoking) { smoking = true; gsap.ticker.add(drawSmoke); }
    setTimeout(function () { confetti(); if (window.Hearts) { Hearts.front(true); Hearts.celebrate(); } }, 450);
  }
  function drawSmoke() {
    sctx.clearRect(0, 0, smoke.width, smoke.height);
    puffs = puffs.filter(function (p) { return p.life < p.max + p.delay; });
    puffs.forEach(function (p) {
      p.life++;
      if (p.life < p.delay) return;
      p.x += p.vx + Math.sin((p.life + p.delay) * 0.05) * 0.4 * DPR; p.y += p.vy * DPR; p.r += 0.18 * DPR;
      var a = 0.22 * (1 - (p.life - p.delay) / p.max);
      sctx.fillStyle = 'rgba(230,220,210,' + Math.max(a, 0).toFixed(3) + ')';
      sctx.beginPath(); sctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); sctx.fill();
    });
    if (!puffs.length) { smoking = false; gsap.ticker.remove(drawSmoke); sctx.clearRect(0, 0, smoke.width, smoke.height); }
  }
  function relight() {
    cakeSec.classList.remove('blown');
    if (window.Hearts) Hearts.front(false);
  }
  $('#blowBtn').addEventListener('click', blow);
  $('#relightBtn').addEventListener('click', relight);
  ScrollTrigger.create({ trigger: cakeSec, start: 'top bottom', end: 'bottom top', onLeave: function () { if (window.Hearts) Hearts.front(false); }, onLeaveBack: function () { if (window.Hearts) Hearts.front(false); } });

  /* ---------- confetti ---------- */
  var cf = $('#confetti'), cctx = cf.getContext('2d'), bits = [], cfOn = false;
  var COLORS = ['#e9b45a', '#ffe2a6', '#b3132e', '#ff7d8c', '#fbf3e6', '#f6c3c0'];
  function confetti() {
    cf.width = innerWidth * DPR; cf.height = innerHeight * DPR;
    for (var i = 0; i < 260; i++) {
      var side = i % 2 ? 1 : -1;
      bits.push({ x: (side > 0 ? innerWidth * 0.02 : innerWidth * 0.98) * DPR, y: innerHeight * 0.75 * DPR,
        vx: -side * (6 + Math.random() * 12) * DPR * (innerWidth < 720 ? 0.6 : 1), vy: -(10 + Math.random() * 14) * DPR,
        w: (6 + Math.random() * 8) * DPR, h: (8 + Math.random() * 10) * DPR, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
        c: COLORS[i % COLORS.length], heart: Math.random() < 0.25, t: 0 });
    }
    if (!cfOn) { cfOn = true; gsap.ticker.add(drawConfetti); }
  }
  function heartPath(c, s) {
    c.beginPath(); c.moveTo(0, s * 0.3);
    c.bezierCurveTo(0, 0, -s * 0.5, 0, -s * 0.5, s * 0.3); c.bezierCurveTo(-s * 0.5, s * 0.6, 0, s * 0.8, 0, s);
    c.bezierCurveTo(0, s * 0.8, s * 0.5, s * 0.6, s * 0.5, s * 0.3); c.bezierCurveTo(s * 0.5, 0, 0, 0, 0, s * 0.3); c.fill();
  }
  function drawConfetti() {
    cctx.clearRect(0, 0, cf.width, cf.height);
    bits = bits.filter(function (b) { return b.y < cf.height + 40 && b.t < 600; });
    bits.forEach(function (b) {
      b.t++; b.vy += 0.32 * DPR; b.vx *= 0.985; b.vy *= 0.985; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      cctx.save(); cctx.translate(b.x, b.y); cctx.rotate(b.rot); cctx.fillStyle = b.c;
      if (b.heart) heartPath(cctx, b.h * 1.4); else { cctx.scale(1, Math.cos(b.t * 0.12)); cctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); }
      cctx.restore();
    });
    if (!bits.length) { cfOn = false; gsap.ticker.remove(drawConfetti); cctx.clearRect(0, 0, cf.width, cf.height); }
  }

  /* ---------- live 3D hearts: shown only over the transparent chapters ---------- */
  (function () {
    var on = {};
    ['#words', '#films', '#letter'].forEach(function (id) {
      var sec = $(id), el = sec.parentNode.classList.contains('pin-spacer') ? sec.parentNode : sec;
      ScrollTrigger.create({ trigger: el, start: 'top 85%', end: 'bottom 15%', onToggle: function (st) {
        on[id] = st.isActive;
        var any = Object.keys(on).some(function (k) { return on[k]; });
        if (window.Hearts) Hearts.setOn(any); else $('#hearts').classList.toggle('on', any);
      } });
    });
  })();

  /* ---------- nav: chapter title, number, progress ---------- */
  (function () {
    $$('.sec').forEach(function (sec) {
      var el = sec.parentNode.classList.contains('pin-spacer') ? sec.parentNode : sec;
      ScrollTrigger.create({ trigger: el, start: 'top 50%', end: 'bottom 50%', onToggle: function (st) {
        if (!st.isActive) return;
        $('#navTitle').textContent = sec.dataset.title;
        $('#navNum').textContent = sec.dataset.num;
      } });
    });
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (st) { $('#navLine').style.transform = 'scaleX(' + st.progress.toFixed(4) + ')'; } });
  })();

  /* ---------- lightbox ---------- */
  var lb = $('#lightbox'), lbBody = $('#lbBody');
  function openLB(node) {
    lbBody.innerHTML = ''; lbBody.appendChild(node); lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop();
  }
  function closeLB() {
    music.duck(false);
    lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true');
    var v = $('video', lbBody); if (v) v.pause();
    setTimeout(function () { lbBody.innerHTML = ''; }, 400);
    if (lenis) lenis.start();
  }
  function openImage(img) { var i = new Image(); i.src = img.getAttribute('src'); i.alt = img.alt; openLB(i); }
  function openVideo(src) {
    music.duck(true);
    var v = document.createElement('video'); v.src = src; v.controls = true; v.autoplay = true; v.playsInline = true; openLB(v);
    var pr = v.play(); if (pr) pr.catch(function () {});
  }
  $$('.polaroid, .shot').forEach(function (f) { f.addEventListener('click', function () { openImage($('img', f)); }); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.id === 'lbClose') closeLB(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLB(); });

  /* ---------- cursor and heart pops ---------- */
  var cur = $('#cursor'), tx = -100, ty = -100, kx = -100, ky = -100;
  window.addEventListener('pointermove', function (e) {
    tx = e.clientX; ty = e.clientY;
    cur.classList.toggle('big', !!e.target.closest && !!e.target.closest('a,button,.polaroid,.shot,.card,.vcard,#heroName'));
  });
  gsap.ticker.add(function () { kx += (tx - kx) * 0.22; ky += (ty - ky) * 0.22; cur.style.transform = 'translate3d(' + kx + 'px,' + ky + 'px,0)'; });
  var HEART = '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/>';
  function popHearts(x, y, n) {
    for (var i = 0; i < n; i++) {
      var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'pop-heart'); s.innerHTML = HEART;
      s.style.left = x + 'px'; s.style.top = y + 'px';
      s.style.fill = ['#ff7d8c', '#e9b45a', '#b3132e', '#ffe2a6'][i % 4];
      document.body.appendChild(s);
      var a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 120;
      gsap.fromTo(s, { x: -8, y: -8, scale: 0.4, rotate: 0, opacity: 1 },
        { x: Math.cos(a) * d - 8, y: Math.sin(a) * d - 60 - 8, scale: 0.6 + Math.random(), rotate: (Math.random() - 0.5) * 90, opacity: 0, duration: 1.1 + Math.random() * 0.6, ease: 'power2.out', onComplete: s.remove.bind(s) });
    }
  }
  window.addEventListener('click', function (e) {
    if (e.target.closest('button,a,.polaroid,.shot,.card,.ring-stage,.lightbox,.gate')) return;
    popHearts(e.clientX, e.clientY, 7);
    if (window.Hearts) Hearts.burst(e.clientX, e.clientY, 6);
  });
  $('#heroName').addEventListener('click', function (e) { popHearts(e.clientX, e.clientY, 24); });

  /* ---------- sizes ---------- */
  function sizeAll() { gift.size(); cake.size(); }
  sizeAll();
  window.addEventListener('resize', sizeAll);
  if (RM) { gateBtn.disabled = false; }
})();
