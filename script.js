(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Footer year ---------- */
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- Top bar border on scroll ---------- */
  var topbar = document.getElementById("topbar");
  function onScrollBar() {
    if (topbar) topbar.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScrollBar();
  window.addEventListener("scroll", onScrollBar, { passive: true });

  /* ---------- Active nav link ---------- */
  var links = {};
  document.querySelectorAll(".menu a[href^='#']").forEach(function (a) {
    links[a.getAttribute("href").slice(1)] = a;
  });
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = links[e.target.id];
        if (a && !a.classList.contains("menu-cta")) a.classList.toggle("is-active", e.isIntersecting);
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(links).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spy.observe(s);
    });
  }

  /* ---------- Project filter ---------- */
  var chips = document.querySelectorAll(".chip");
  var cards = document.querySelectorAll(".card");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var f = chip.getAttribute("data-filter");
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      cards.forEach(function (card) {
        var cats = (card.getAttribute("data-cat") || "").split(" ");
        card.classList.toggle("is-hidden", f !== "all" && cats.indexOf(f) === -1);
      });
    });
  });

  /* ---------- 3D tilt on cards (mouse only) ---------- */
  if (!reduceMotion) {
    cards.forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          "rotateX(" + (-y * 6).toFixed(2) + "deg) rotateY(" + (x * 8).toFixed(2) + "deg) translateZ(6px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ---------- Photos for the "Beyond the lab" tiles ----------
     A tile switches to its photo style only if the image really loads. */
  var photos = {
    "tile-drone": "assets/drone.jpg",
    "tile-photo": "assets/photography.jpg",
    "tile-hike": "assets/hiking.jpg",
    "tile-arduino": "assets/arduino.jpg"
  };
  Object.keys(photos).forEach(function (cls) {
    var el = document.querySelector("." + cls);
    if (!el) return;
    var img = new Image();
    img.onload = function () { el.classList.add("has-photo"); };
    img.src = photos[cls];
  });

  /* ---------- Hero: 3D segmented mirror ---------- */
  var canvas = document.getElementById("hero-canvas");
  if (!canvas || !window.THREE) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (err) {
    return; // no WebGL: the page still works without the 3D scene
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 21);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaeb3be, 0.7));
  var key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(5, 6, 7);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xc9d2ff, 0.45);
  rim.position.set(-6, -3, 4);
  scene.add(rim);

  // Pointy-top hexagonal prism, axis along Z.
  var R = 1;
  var geo = new THREE.CylinderGeometry(R * 0.93, R * 0.93, 0.16, 6);
  geo.rotateX(Math.PI / 2);
  var edgeGeo = new THREE.EdgesGeometry(geo);
  var edgeMat = new THREE.LineBasicMaterial({ color: 0xaeb2bc });

  var group = new THREE.Group();
  scene.add(group);

  var seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  var segs = [];
  for (var q = -2; q <= 2; q++) {
    for (var r = -2; r <= 2; r++) {
      if (Math.abs(q + r) > 2) continue;
      var ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      var isCenter = ring === 0;
      var mat = new THREE.MeshStandardMaterial({
        color: isCenter ? 0x3b5bfd : 0xe9ebf0,
        roughness: isCenter ? 0.35 : 0.5,
        metalness: isCenter ? 0.15 : 0.08
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
      var bx = Math.sqrt(3) * R * (q + r / 2);
      var by = 1.5 * R * r;
      mesh.position.set(bx, by, 0);
      group.add(mesh);
      segs.push({
        mesh: mesh, bx: bx, by: by, ring: ring,
        // initial misalignment
        mz: (rnd() - 0.5) * 1.6, mrx: (rnd() - 0.5) * 0.7, mry: (rnd() - 0.5) * 0.7,
        // scatter direction used while scrolling
        sx: (rnd() - 0.5) * 2, sy: (rnd() - 0.5) * 2, sz: 0.6 + rnd() * 1.6
      });
    }
  }

  var target = { x: 0, y: 0 };
  var cur = { x: 0, y: 0 };
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  var scrollAmt = 0;
  function onScroll() {
    scrollAmt = Math.min(Math.max(window.scrollY / (window.innerHeight * 0.9), 0), 1);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function fit() {
    var w = Math.max(canvas.clientWidth, 1), h = Math.max(canvas.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  fit();
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(canvas.parentElement);
  else window.addEventListener("resize", fit);

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  var visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);
  }

  var t0 = performance.now();
  var scrollSmooth = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;

    var t = (now - t0) / 1000;
    var intro = reduceMotion ? 1 : Math.min(t / 2.8, 1);

    cur.x += (target.x - cur.x) * 0.06;
    cur.y += (target.y - cur.y) * 0.06;
    scrollSmooth += (scrollAmt - scrollSmooth) * 0.08;

    // The whole mirror: tilted back, follows the pointer, drifts when scrolling.
    group.rotation.x = -0.75 + cur.y * 0.18 + scrollSmooth * 0.5;
    group.rotation.y = cur.x * 0.32 + (reduceMotion ? 0 : Math.sin(t * 0.35) * 0.06);
    group.rotation.z = scrollSmooth * 0.5;

    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      // Centre segments align first, the outer ring last.
      var local = ease(Math.min(Math.max((intro * 1.6 - s.ring * 0.2), 0), 1));
      var off = 1 - local;
      s.mesh.position.x = s.bx + s.sx * scrollSmooth * 1.4;
      s.mesh.position.y = s.by + s.sy * scrollSmooth * 1.4;
      s.mesh.position.z = s.mz * off + s.sz * scrollSmooth * 1.6;
      s.mesh.rotation.x = s.mrx * off + s.sy * scrollSmooth * 0.4;
      s.mesh.rotation.y = s.mry * off + s.sx * scrollSmooth * 0.4;
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
