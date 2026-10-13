/* Home background: the phase portrait of a damped pendulum (theta on x, omega on y). Particles follow its flow: they spiral into
   the stable well and are thrown away from the unstable upright. The pointer stirs them, a click releases a burst. */
(function () {
  "use strict";
  var canvas = document.getElementById("field");
  if (!canvas) return;
  canvas.style.display = "none"; return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, dpr = 1, P = [], mouse = { x: -999, y: -999, on: false };
  var XR = 3 * Math.PI, YR = 3.2, N;
  function rnd(p) { p.x = Math.random() * W; p.y = Math.random() * H; p.age = 0; p.life = 260 + Math.random() * 380; }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    N = Math.round(Math.min(520, Math.max(160, W * H / 3800)));
    P = []; for (var i = 0; i < N; i++) { var p = { x: 0, y: 0 }; rnd(p); p.age = Math.random() * p.life; P.push(p); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (reduce) { for (var k = 0; k < 220; k++) step(); }
  }
  function step() {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.045)"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1.2; ctx.lineCap = "round";
    var sx = XR / W, sy = YR / (H / 2);
    for (var i = 0; i < P.length; i++) {
      var p = P[i], th = (p.x - W / 2) * sx, om = (H / 2 - p.y) * sy;
      var a = Math.sin(th + Math.PI) * -1;          // theta measured from the hanging position: alpha = -sin(theta)
      a = -Math.sin(th) - 0.22 * om;
      var vth = om, vom = a;
      if (mouse.on) {
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 22000) { var f = (1 - d2 / 22000) * 0.9; vom += (dy / (Math.sqrt(d2) + 1)) * f * -2.5; vth += (dx / (Math.sqrt(d2) + 1)) * f * 1.4; }
      }
      var nx = p.x + vth * 0.045 / sx, ny = p.y - vom * 0.045 / sy;
      var sp = Math.min(1, Math.hypot(vth, vom) / 3);
      ctx.strokeStyle = "rgba(" + Math.round(190 - 143 * sp) + "," + Math.round(190 - 83 * sp) + ",255," + (0.22 + 0.5 * sp) + ")";
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny; p.age++;
      if (p.x < -20) p.x += W + 40; else if (p.x > W + 20) p.x -= W + 40;
      if (p.age > p.life || p.y < -20 || p.y > H + 20) rnd(p);
    }
  }
  function loop() { requestAnimationFrame(loop); step(); }
  window.addEventListener("resize", resize);
  resize();
  if (!reduce) {
    window.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; });
    document.addEventListener("pointerleave", function () { mouse.on = false; });
    window.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest("a,button,.spot")) return;
      for (var i = 0; i < 40; i++) { var p = P[(Math.random() * P.length) | 0]; p.x = e.clientX + (Math.random() - 0.5) * 30; p.y = e.clientY + (Math.random() - 0.5) * 30; p.age = 0; }
    });
    requestAnimationFrame(loop);

    // Magnetic buttons
    Array.prototype.forEach.call(document.querySelectorAll(".home-nav a"), function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.25, y = (e.clientY - (r.top + r.height / 2)) * 0.35;
        el.style.transform = "translate(" + x + "px," + (y - 2) + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }
})();


/* Home: a rover on a lunar plain (oblique 3D view), driven like a TurtleBot: W forward, X back, A / D rotate, S stop.
   It moves only while a key is held. Three craters, each with an icon, are the three pages: drive into one and you are taken there,
   or click it and the rover drives itself in. */
(function () {
  "use strict";
  var cv = document.getElementById("moon"), hint = document.getElementById("moon-hint");
  if (!cv) return;
  var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1, K = 0.5, HW = 0;
  var CR = [
    { name: "Projects", href: "projects.html", fx: 0.12, fy: 0.62, icon: "gear" },
    { name: "Academy", href: "academics.html", fx: 0.38, fy: 0.3, icon: "cap" },
    { name: "Life", href: "life.html", fx: 0.62, fy: 0.3, icon: "drone" },
    { name: "CV", href: "downloads.html", fx: 0.88, fy: 0.62, icon: "doc" }
  ];
  var rover = { x: 0, y: 0, a: -Math.PI / 2 }, keys = {}, trail = [], goal = null, near = -1, leaving = false, started = false, enter = 0;
  var VMAX = 130, WMAX = 2.1;

  function size() {
    var r = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    HW = H / K;
    CR.forEach(function (c) { c.x = c.fx * W; c.y = c.fy * HW; c.r = Math.max(34, Math.min(62, W * 0.085)); });
    if (!started) { rover.x = W / 2; rover.y = HW * 0.9; started = true; }
  }
  function go(c) { if (leaving) return; leaving = true; if (window.pageGo) window.pageGo(c.href); else setTimeout(function () { window.location.href = c.href; }, 300); }

  var map = { w: "w", arrowup: "w", x: "x", arrowdown: "x", a: "a", arrowleft: "a", d: "d", arrowright: "d", s: "s" };
  function typing(e) { var t = e.target && e.target.tagName; return t === "INPUT" || t === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey; }
  window.addEventListener("keydown", function (e) {
    if (typing(e) || document.body.classList.contains("intro-on") || document.body.classList.contains("spot-open")) return;
    var k = map[e.key.toLowerCase()];
    if (k) { keys[k] = true; goal = null; if (k === "s") keys = {}; if (e.key.indexOf("Arrow") === 0) e.preventDefault(); }
  });
  window.addEventListener("keyup", function (e) { var k = map[e.key.toLowerCase()]; if (k) keys[k] = false; });
  window.addEventListener("blur", function () { keys = {}; });
  Array.prototype.forEach.call(document.querySelectorAll("#pad button"), function (b) {
    var k = b.getAttribute("data-k");
    b.addEventListener("pointerdown", function (e) { keys[k] = true; goal = null; b.setPointerCapture(e.pointerId); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { b.addEventListener(ev, function () { keys[k] = false; }); });
  });
  function hitCrater(e) {
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = (e.clientY - r.top) / K;
    for (var i = 0; i < CR.length; i++) if (Math.hypot(x - CR[i].x, (y - CR[i].y)) < CR[i].r + 22) return i;
    return -1;
  }
  cv.addEventListener("pointerdown", function (e) { var i = hitCrater(e); if (i >= 0) goal = i; });
  cv.addEventListener("pointermove", function (e) { cv.style.cursor = hitCrater(e) >= 0 ? "pointer" : "default"; });

  function wrapA(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  var last = performance.now();
  function update(dt) {
    var v = 0, w = 0;
    if (goal !== null) {
      var c = CR[goal], dx = c.x - rover.x, dy = c.y - rover.y, d = Math.hypot(dx, dy), err = wrapA(Math.atan2(dy, dx) - rover.a);
      w = Math.max(-WMAX * 2.2, Math.min(WMAX * 2.2, err * 7));
      v = Math.abs(err) < 0.6 ? Math.min(VMAX * 2.8, d * 6 + 60) : 0;
    } else {
      if (keys.w) v += VMAX; if (keys.x) v -= VMAX * 0.7;
      if (keys.a) w -= WMAX; if (keys.d) w += WMAX;
    }
    rover.a = wrapA(rover.a + w * dt);
    rover.x = Math.max(18, Math.min(W - 18, rover.x + Math.cos(rover.a) * v * dt));
    rover.y = Math.max(18, Math.min(HW - 10, rover.y + Math.sin(rover.a) * v * dt));
    if (v !== 0) {
      var t = trail[trail.length - 1];
      if (!t || Math.hypot(t.x - rover.x, t.y - rover.y) > 8) { trail.push({ x: rover.x, y: rover.y }); if (trail.length > 140) trail.shift(); }
    }
    near = -1;
    for (var i = 0; i < CR.length; i++) if (Math.hypot(rover.x - CR[i].x, rover.y - CR[i].y) < CR[i].r * 0.55) near = i;
    if (near >= 0) { enter += dt; go(CR[near]); } else enter = 0;
    if (hint) hint.textContent = near >= 0 ? "Entering " + CR[near].name + "…" : "Hold W A X D to drive. Drive into a target, or click one.";
  }

  function sx(x) { return x; }
  function sy(y) { return y * K; }

  function icon(kind, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (kind === "gear") {
      for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.78, Math.sin(a) * s * 0.78); ctx.lineTo(Math.cos(a) * s * 1.02, Math.sin(a) * s * 1.02); ctx.lineWidth = 4.4; ctx.stroke(); }
      ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, s * 0.72, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * 0.26, 0, 6.3); ctx.stroke();
    } else if (kind === "cap") {
      ctx.beginPath(); ctx.moveTo(0, -s * 0.62); ctx.lineTo(s * 1.05, -s * 0.12); ctx.lineTo(0, s * 0.38); ctx.lineTo(-s * 1.05, -s * 0.12); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.58, s * 0.12); ctx.lineTo(-s * 0.58, s * 0.62); ctx.quadraticCurveTo(0, s * 0.95, s * 0.58, s * 0.62); ctx.lineTo(s * 0.58, s * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 1.05, -s * 0.12); ctx.lineTo(s * 1.05, s * 0.5); ctx.stroke();
    } else {
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p[0] * s * 0.7, p[1] * s * 0.55); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(p[0] * s * 0.78, p[1] * s * 0.6, s * 0.34, s * 0.12, 0, 0, 6.3); ctx.stroke();
      });
      ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(29,29,31,0.16)";
    trail.forEach(function (p) { ctx.beginPath(); ctx.ellipse(sx(p.x), sy(p.y), 1.5, 0.8, 0, 0, 6.3); ctx.fill(); });
    CR.forEach(function (c, k) {
      var hot = near === k || goal === k, X = sx(c.x), Y = sy(c.y), rx = c.r, ry = c.r * K;
      ctx.strokeStyle = hot ? "#2f6bff" : "#c7c7cc"; ctx.lineWidth = hot ? 2 : 1.3;
      ctx.beginPath(); ctx.ellipse(X, Y, rx, ry, 0, 0, 6.3); ctx.stroke();
      ctx.setLineDash([2, 6]); ctx.strokeStyle = hot ? "rgba(47,107,255,0.6)" : "rgba(0,0,0,0.12)";
      ctx.beginPath(); ctx.ellipse(X, Y, rx * 0.55, ry * 0.55, 0, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = hot ? "#2f6bff" : "#a1a1a6"; ctx.beginPath(); ctx.arc(X, Y, 2.4, 0, 6.3); ctx.fill();
      if (hot) { ctx.strokeStyle = "rgba(47,107,255,0.35)"; ctx.beginPath(); ctx.ellipse(X, Y, rx * (1.15 + 0.08 * Math.sin(t / 250)), ry * (1.15 + 0.08 * Math.sin(t / 250)), 0, 0, 6.3); ctx.stroke(); }
      ctx.font = "500 13px Geist, -apple-system, sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = hot ? "#2f6bff" : "#6e6e73"; ctx.fillText(c.name, X, Y + ry + 20);
    });
    drawRover();
  }

  // rover as a small 3D box with wheels, projected with the same oblique view as the ground
  function drawRover() {
    var ca = Math.cos(rover.a), sa = Math.sin(rover.a), L = 17, Wd = 11, Hh = 9;
    function P(lx, ly, z) { var gx = rover.x + lx * ca - ly * sa, gy = rover.y + lx * sa + ly * ca; return [sx(gx), sy(gy) - z]; }
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(sx(rover.x) + 3, sy(rover.y) + 3, L * 1.15, Wd * 0.7, 0, 0, 6.3); ctx.fill();
    // wheels (under the body)
    ctx.fillStyle = "#1d1d1f";
    [[-9, -Wd], [9, -Wd], [-9, Wd], [9, Wd]].forEach(function (w) { var p = P(w[0], w[1], 4); ctx.beginPath(); ctx.ellipse(p[0], p[1], 5.2, 4.2, 0, 0, 6.3); ctx.fill(); });
    var base = [P(-L, -Wd, 5), P(L, -Wd, 5), P(L, Wd, 5), P(-L, Wd, 5)], top = [P(-L, -Wd, 5 + Hh), P(L, -Wd, 5 + Hh), P(L, Wd, 5 + Hh), P(-L, Wd, 5 + Hh)];
    // side faces: draw those facing the viewer (screen-down) first
    var faces = [[0, 1], [1, 2], [2, 3], [3, 0]];
    faces.forEach(function (f) {
      var a = base[f[0]], b = base[f[1]], ta = top[f[0]], tb = top[f[1]];
      var nx = (b[1] - a[1]), ny = -(b[0] - a[0]); // outward normal in screen space (clockwise polygon)
      var cxm = (base[0][0] + base[2][0]) / 2, cym = (base[0][1] + base[2][1]) / 2, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if ((mx - cxm) * nx + (my - cym) * ny < 0) { nx = -nx; ny = -ny; }
      if (ny <= 0) return;
      ctx.fillStyle = "#e4e4e9"; ctx.strokeStyle = "#1d1d1f"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(tb[0], tb[1]); ctx.lineTo(ta[0], ta[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#1d1d1f"; ctx.lineWidth = 1.4;
    ctx.beginPath(); top.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); ctx.stroke();
    // front marker and mast
    var fr = P(L * 0.62, 0, 5 + Hh), m0 = P(-L * 0.3, 0, 5 + Hh), m1 = P(-L * 0.3, 0, 5 + Hh + 11);
    ctx.fillStyle = "#2f6bff"; ctx.beginPath(); ctx.arc(fr[0], fr[1], 3, 0, 6.3); ctx.fill();
    ctx.strokeStyle = "#1d1d1f"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke();
    ctx.fillStyle = "#1d1d1f"; ctx.beginPath(); ctx.arc(m1[0], m1[1], 2.6, 0, 6.3); ctx.fill();
  }

  size(); window.addEventListener("resize", size);
  if ("ResizeObserver" in window) new ResizeObserver(size).observe(cv);
  (function loop(now) { requestAnimationFrame(loop); var dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(now); })(performance.now());
})();
