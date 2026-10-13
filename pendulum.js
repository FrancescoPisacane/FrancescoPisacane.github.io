/* Control lab UI: cart-pole drawing and controls.
   Physics and controllers live in pendcore.js. */
(function () {
  "use strict";

  var canvas = document.getElementById("pend");
  if (!canvas || !window.PendCore) return;
  var Core = window.PendCore, wrap = Core.wrap, XMAX = Core.XMAX, DT = Core.DT;
  var ctx = canvas.getContext("2d");
  var sim = new Core.Sim();

  /* ---------- Cart-pole canvas ---------- */
  var W = 0, H = 0, dpr = 1;
  function sizeOf(cv) {
    var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    return { w: r.width, h: r.height, d: d };
  }
  function resize() { var z = sizeOf(canvas); W = z.w; H = z.h; dpr = z.d; }
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);

  var C = { ink: "#1d1d1f", soft: "#6e6e73", line: "#d2d2d7", accent: "#2f6bff" };
  (function () {
    var cs = getComputedStyle(document.documentElement);
    C.ink = cs.getPropertyValue("--ink").trim() || C.ink;
    C.soft = cs.getPropertyValue("--ink-soft").trim() || C.soft;
    C.accent = cs.getPropertyValue("--accent").trim() || C.accent;
  })();
  var SPAN = 2 * XMAX + 1.3;

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function draw() {
    var s = sim.s, l = 0.5;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var ppm = W / SPAN, railY = H * 0.62, cx = W / 2;

    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - XMAX * ppm - 12, railY + 14); ctx.lineTo(cx + XMAX * ppm + 12, railY + 14); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - XMAX * ppm - 12, railY + 6); ctx.lineTo(cx - XMAX * ppm - 12, railY + 22);
    ctx.moveTo(cx + XMAX * ppm + 12, railY + 6); ctx.lineTo(cx + XMAX * ppm + 12, railY + 22);
    ctx.stroke();

    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(cx, railY - 2 * l * ppm - 30); ctx.lineTo(cx, railY + 14); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = C.line; ctx.beginPath(); ctx.moveTo(cx - 5, railY + 28); ctx.lineTo(cx + 5, railY + 28); ctx.lineTo(cx, railY + 21); ctx.closePath(); ctx.fill();
    var x = cx + s[0] * ppm, cw = Math.max(34, 0.55 * ppm), ch = cw * 0.47;
    var tipX = x + 2 * l * ppm * Math.sin(s[2]);
    var tipY = railY - ch / 2 - 2 * l * ppm * Math.cos(s[2]);

    ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, railY - ch / 2); ctx.lineTo(tipX, tipY); ctx.stroke();

    ctx.fillStyle = C.ink;
    roundRect(ctx, x - cw / 2, railY - ch / 2, cw, ch, 7); ctx.fill();
    [-0.27, 0.27].forEach(function (kx) {
      ctx.fillStyle = "#fff"; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + kx * cw, railY + ch / 2 + 1, 7, 0, 6.3); ctx.fill(); ctx.stroke();
    });

    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.arc(tipX, tipY, 11, 0, 6.3); ctx.fill();

    if (sim.pointer !== null) {
      var px = cx + sim.pointer * ppm;
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(px, tipY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(px, tipY, 4, 0, 6.3); ctx.fill();
    }
  }

  /* ---------- Controls ---------- */
  var elRead = document.getElementById("pend-read"), elStatus = document.getElementById("pend-status");
  var elPid = document.getElementById("pid-panel");
  var modeBtns = Array.prototype.slice.call(document.querySelectorAll("[data-pmode]"));

  function setMode(mm) {
    if (sim.mode === "pid" && mm !== "pid") {
      // leaving PID: tuned gains go back to the working defaults
      Array.prototype.forEach.call(document.querySelectorAll("#pid-panel input"), function (i) { i.value = i.getAttribute("value"); i.dispatchEvent(new Event("input")); });
    }
    sim.setMode(mm);
    modeBtns.forEach(function (b) { var on = b.getAttribute("data-pmode") === mm; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    if (elPid) elPid.hidden = mm !== "pid";
  }
  modeBtns.forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-pmode")); }); });

  [["kp", "g-kp"], ["ki", "g-ki"], ["kd", "g-kd"], ["cen", "g-cen"]].forEach(function (p) {
    var inp = document.getElementById(p[1]), out = document.getElementById(p[1] + "-v");
    if (!inp) return;
    
    function upd() {
      sim.gains[p[0]] = parseFloat(inp.value);
      if (out) out.textContent = p[0] === "cen" ? sim.gains.cen.toFixed(1) : String(Math.round(sim.gains[p[0]]));
    }
    inp.addEventListener("input", upd); upd();
  });

  var bReset = document.getElementById("pend-reset"), bDrop = document.getElementById("pend-drop");
  if (bReset) bReset.addEventListener("click", function () { sim.resetUpright(); });
  if (bDrop) bDrop.addEventListener("click", function () { sim.resetHanging(); });

  function worldX(e) { var r = canvas.getBoundingClientRect(); return (e.clientX - r.left - r.width / 2) / (r.width / SPAN); }
  canvas.addEventListener("pointerdown", function (e) { sim.pointer = worldX(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", function (e) { if (sim.pointer !== null) sim.pointer = worldX(e); });
  function release() { sim.pointer = null; }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.style.touchAction = "pan-y";

  function statusText() {
    if (sim.mode === "nmpc") {
      var ph = sim.phase();
      return ph === "balance" ? "MPC balancing" : ph === "catch" ? "MPC catching" : "MPC swing-up";
    }
    if (sim.mode === "off") return "No controller";
    return sim.pidActive() ? (Math.abs(wrap(sim.s[2])) < 0.35 ? "PID holding" : "PID struggling") : "Outside the linear range";
  }

  var readTick = 0, running = true, last = performance.now();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { running = en[0].isIntersecting; last = performance.now(); }).observe(canvas);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    var steps = Math.round(dt / DT), budget = performance.now() + 14, k;
    for (k = 0; k < steps; k++) { sim.step(); if (performance.now() > budget) break; }
    draw();
    readTick += dt;
    if (readTick > 0.12) {
      readTick = 0;
      var dv = wrap(sim.s[2]) * 180 / Math.PI, deg = (Math.abs(dv) < 0.05 ? 0 : dv).toFixed(1);
      if (elRead) elRead.textContent = "θ " + (dv >= 0.05 ? "+" : "") + deg + "°   x " + sim.s[0].toFixed(2) + " m";
      if (elStatus) elStatus.textContent = statusText();
    }
  }

  setMode("nmpc");
  sim.resetHanging();
  requestAnimationFrame(frame);
})();
