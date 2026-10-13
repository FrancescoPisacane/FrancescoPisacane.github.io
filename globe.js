/* Dotted 3D globe built on Three.js (r128 global build).
   Globe(canvas, opts) returns an API object, or null without WebGL.
   opts: places, lat, lon, z, smooth, spin, showAll, drag, onPin(i)
   Land is drawn as shaded dots from the 0.5° run-length mask in land.js. */
(function () {
  "use strict";

  var D2R = Math.PI / 180;
  var ACCENT = 0x2f6bff;

  function ll2v(lat, lon, r) {
    var p = lat * D2R, l = lon * D2R;
    return new THREE.Vector3(r * Math.cos(p) * Math.cos(l), r * Math.sin(p), -r * Math.cos(p) * Math.sin(l));
  }

  function decodeMask() {
    var L = window.LAND;
    if (!L) return null;
    var m = new Uint8Array(L.w * L.h), pos = 0, v = 0;
    for (var i = 0; i < L.runs.length; i++) {
      var n = L.runs[i];
      if (v) m.fill(1, pos, pos + n);
      pos += n;
      v ^= 1;
    }
    return m;
  }

  function landDots(n) {
    var L = window.LAND, m = decodeMask();
    if (!m) return new Float32Array(0);
    var out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (2 * (i + 0.5)) / n;
      var lat = Math.asin(y) / D2R;
      if (lat < -58) continue; // skip Antarctica
      var lon = ((i * ga) / D2R) % 360;
      if (lon > 180) lon -= 360;
      var r = Math.min(L.h - 1, Math.floor(((90 - lat) / 180) * L.h));
      var c = Math.min(L.w - 1, Math.floor(((lon + 180) / 360) * L.w));
      if (m[r * L.w + c]) {
        var p = ll2v(lat, lon, 1);
        out.push(p.x, p.y, p.z);
      }
    }
    return new Float32Array(out);
  }

  /* ---------- Shaders ---------- */
  var BODY_VERT =
    "varying vec3 vN;" +
    "void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }";

  // Soft studio lighting fixed in view space: the globe turns, the light does not.
  var BODY_FRAG =
    "uniform vec3 uLight; uniform vec3 cLit; uniform vec3 cShade; varying vec3 vN;" +
    "void main(){ float d = clamp(dot(normalize(vN), uLight) * 0.5 + 0.5, 0.0, 1.0);" +
    "  vec3 c = mix(cShade, cLit, smoothstep(0.12, 0.92, d)); gl_FragColor = vec4(c, 1.0); }";

  // Faint blue atmosphere: strongest just outside the limb, fading to nothing.
  var ATMO_FRAG =
    "uniform vec3 uColor; uniform float uR; varying vec3 vN;" +
    "void main(){ float nz = clamp(abs(normalize(vN).z), 0.0, 1.0);" +
    "  float rho = uR * sqrt(max(0.0, 1.0 - nz * nz));" +
    "  float outside = exp(-(rho - 1.0) * 20.0) * 0.5 * smoothstep(uR, uR - 0.05, rho);" +
    "  float inside = 0.16 * smoothstep(0.84, 1.0, rho);" +
    "  float a = rho >= 1.0 ? outside : inside;" +
    "  gl_FragColor = vec4(uColor, a); }";

  var DOT_VERT =
    "uniform float uScale; uniform float uSize; uniform vec3 uLight; varying float vShade; varying float vFacing;" +
    "void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);" +
    "  vec3 n = normalize(normalMatrix * position); vFacing = n.z;" +
    "  vShade = dot(n, uLight) * 0.5 + 0.5;" +
    "  gl_PointSize = uSize * uScale / -mv.z * (0.62 + 0.38 * clamp(n.z, 0.0, 1.0));" +
    "  gl_Position = projectionMatrix * mv; }";

  var DOT_FRAG =
    "uniform vec3 cLight; uniform vec3 cDark; varying float vShade; varying float vFacing;" +
    "void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;" +
    "  float a = smoothstep(0.5, 0.36, r);" +
    "  vec3 c = mix(cDark, cLight, smoothstep(0.18, 0.95, vShade));" +
    "  gl_FragColor = vec4(c, a * (0.5 + 0.5 * smoothstep(0.0, 0.4, vFacing))); }";

  function Globe(canvas, opts) {
    opts = opts || {};
    if (!window.THREE) return null;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    var group = new THREE.Group();
    scene.add(group);

    var LIGHT = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();

    // Body
    var body = new THREE.Mesh(
      new THREE.SphereGeometry(0.994, 96, 64),
      new THREE.ShaderMaterial({
        uniforms: {
          uLight: { value: LIGHT },
          cLit: { value: new THREE.Color(0xffffff) },
          cShade: { value: new THREE.Color(0xe1e5f0) }
        },
        vertexShader: BODY_VERT,
        fragmentShader: BODY_FRAG
      })
    );
    group.add(body);

    // Atmosphere (does not rotate with the globe)
    var atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.16, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0.47, 0.6, 1.0) }, uR: { value: 1.16 } },
        vertexShader: BODY_VERT,
        fragmentShader: ATMO_FRAG,
        transparent: true,
        depthWrite: false
      })
    );
    atmo.renderOrder = 3;
    if (opts.atmosphere !== false) scene.add(atmo);

    // Land dots (fewer on small screens)
    var DOTN = opts.dots || (window.innerWidth < 700 ? 60000 : 110000);
    var dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(landDots(DOTN), 3));
    var dotMat = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 400 },
        uSize: { value: 0.021 * Math.sqrt(110000 / DOTN) },
        uLight: { value: LIGHT },
        cLight: { value: new THREE.Color(0xc4cad8) },
        cDark: { value: new THREE.Color(0x7d869b) }
      },
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      transparent: true,
      depthWrite: false
    });
    var dots = new THREE.Points(dg, dotMat);
    dots.renderOrder = 1;
    group.add(dots);

    // Pins, pulse rings and arcs
    var places = opts.places || [];
    var pins = [], halos = [], rings = [], rings2 = [], arcs = [];
    var dotGeo = new THREE.SphereGeometry(0.0085, 20, 14);
    var haloGeo = new THREE.SphereGeometry(0.0125, 20, 14);
    var ringGeo = new THREE.RingGeometry(0.014, 0.0185, 56);
    var zAxis = new THREE.Vector3(0, 0, 1);

    function makeRing(pos, normal) {
      var ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      ring.position.copy(pos);
      ring.quaternion.setFromUnitVectors(zAxis, normal);
      ring.renderOrder = 2;
      group.add(ring);
      return ring;
    }

    places.forEach(function (p, i) {
      var pos = ll2v(p.lat, p.lon, 1.004);
      var n = pos.clone().normalize();

      var halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      halo.position.copy(pos);
      group.add(halo);
      var pin = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: ACCENT }));
      pin.position.copy(pos);
      group.add(pin);
      pin.visible = halo.visible = !!opts.showAll;
      pins.push(pin);
      halos.push(halo);

      rings.push(makeRing(pos, n));
      rings2.push(makeRing(pos, n));

      if (i > 0) {
        var a = ll2v(places[i - 1].lat, places[i - 1].lon, 1).normalize();
        var b = n.clone();
        var ang = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
        var N = 72, pts = [];
        for (var k = 0; k <= N; k++) {
          var s = k / N, w1 = Math.sin((1 - s) * ang) / Math.sin(ang), w2 = Math.sin(s * ang) / Math.sin(ang);
          var v = a.clone().multiplyScalar(w1).add(b.clone().multiplyScalar(w2)).normalize();
          v.multiplyScalar(1.004 + Math.sin(Math.PI * s) * Math.min(0.14, ang * 0.2));
          pts.push(v);
        }
        var curve = new THREE.CatmullRomCurve3(pts);
        var tube = new THREE.TubeGeometry(curve, N, 0.0028, 5, false);
        tube.setDrawRange(0, 0);
        var mesh = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.85 }));
        mesh.renderOrder = 2;
        group.add(mesh);
        arcs[i - 1] = { mesh: mesh, segs: N, radial: 5 };
      }
    });

    var view = { lat: opts.lat != null ? opts.lat : 20, lon: opts.lon != null ? opts.lon : -30, z: opts.z || 4.4 };
    var api = {
      view: view,
      target: null,
      smooth: opts.smooth || 0,
      spin: opts.spin || 0,
      active: -1,
      dragging: false,
      frames: [],
      after: []
    };
    var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

    function fit() {
      var w = Math.max(canvas.clientWidth, 1), h = Math.max(canvas.clientHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dotMat.uniforms.uScale.value = renderer.domElement.height / 2;
    }
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(canvas);
    else window.addEventListener("resize", fit);

    function applyView() {
      group.rotation.set(view.lat * D2R, (-90 - view.lon) * D2R, 0, "XYZ");
      camera.position.set(0, 0, view.z);
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      group.updateMatrixWorld(true);
    }

    api.onFrame = function (fn) { api.frames.push(fn); };   // update the view
    api.onAfter = function (fn) { api.after.push(fn); };    // read screen positions of this frame
    api.setVisited = function (i, on) { if (pins[i]) pins[i].visible = halos[i].visible = on; };
    api.setActive = function (i) { api.active = i; if (pins[i]) pins[i].visible = halos[i].visible = true; };
    api.setArc = function (i, p) {
      var a = arcs[i];
      if (a) a.mesh.geometry.setDrawRange(0, Math.floor(a.segs * Math.min(1, Math.max(0, p))) * a.radial * 6);
    };
    api.focus = function (lat, lon, z) { api.target = { lat: lat, lon: lon, z: z }; };
    api.pinScreen = function (i) {
      var pin = pins[i];
      if (!pin) return null;
      pin.getWorldPosition(tmp);
      tmp2.copy(camera.position).sub(tmp).normalize();
      var facing = tmp.clone().normalize().dot(tmp2) > 0.04;
      tmp.project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * canvas.clientWidth, y: (-tmp.y * 0.5 + 0.5) * canvas.clientHeight, visible: facing };
    };
    api.pinAt = function (px, py, radius) {
      var best = -1, bd = radius * radius;
      for (var i = 0; i < pins.length; i++) {
        var s = api.pinScreen(i);
        if (!s || !s.visible || !pins[i].visible) continue;
        var d = (s.x - px) * (s.x - px) + (s.y - py) * (s.y - py);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };

    /* ---------- Drag to rotate, click a pin ---------- */
    if (opts.drag) {
      var drag = null, vel = { x: 0, y: 0 };
      canvas.style.touchAction = "pan-y";
      canvas.style.cursor = "grab";

      canvas.addEventListener("pointerdown", function (e) {
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0, touch: e.pointerType === "touch" };
        api.dragging = true;
        vel.x = vel.y = 0;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      });
      canvas.addEventListener("pointermove", function (e) {
        var rect = canvas.getBoundingClientRect();
        if (!drag) {
          if (e.pointerType === "mouse") {
            var h = api.pinAt(e.clientX - rect.left, e.clientY - rect.top, 16);
            canvas.style.cursor = h >= 0 ? "pointer" : "grab";
            canvas.title = h >= 0 ? places[h].title : "";
          }
          return;
        }
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        var k = 0.16 * (view.z / 3);
        view.lon -= dx * k;
        if (!drag.touch) view.lat = Math.max(-75, Math.min(75, view.lat + dy * k));
        vel.x = -dx * k; vel.y = drag.touch ? 0 : dy * k;
        api.target = null;
      });
      function end(e) {
        if (!drag) return;
        var wasClick = drag.moved < 5;
        drag = null;
        api.dragging = false;
        canvas.style.cursor = "grab";
        if (wasClick && opts.onPin) {
          var rect = canvas.getBoundingClientRect();
          var i = api.pinAt(e.clientX - rect.left, e.clientY - rect.top, 20);
          if (i >= 0) opts.onPin(i);
        }
      }
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
      if (opts.wheel) canvas.addEventListener("wheel", function (e) { e.preventDefault(); var t = api.target || (api.target = { lat: view.lat, lon: view.lon, z: view.z }); t.z = Math.max(1.8, Math.min(7, t.z * Math.exp(e.deltaY * 0.0015))); }, { passive: false });
      api.onFrame(function () {
        if (!api.dragging && (vel.x || vel.y)) {
          view.lon += vel.x; view.lat = Math.max(-75, Math.min(75, view.lat + vel.y));
          vel.x *= 0.93; vel.y *= 0.93;
          if (Math.abs(vel.x) < 0.01) vel.x = 0;
          if (Math.abs(vel.y) < 0.01) vel.y = 0;
        }
      });
    }

    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);
    }

    var last = performance.now(), dead = false;
    function loop(now) {
      if (dead) return;
      requestAnimationFrame(loop);
      var dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!visible) return;

      if (api.target && api.smooth > 0 && !api.dragging) {
        var k = 1 - Math.pow(1 - api.smooth, dt * 60);
        view.lat += (api.target.lat - view.lat) * k;
        var dl = ((api.target.lon - view.lon + 540) % 360) - 180;
        view.lon += dl * k;
        view.z += (api.target.z - view.z) * k;
      } else if (api.spin && !api.dragging) {
        view.lon += api.spin * dt;
      }
      if (view.lon > 180) view.lon -= 360;
      if (view.lon < -180) view.lon += 360;

      for (var i = 0; i < api.frames.length; i++) api.frames[i](dt, now / 1000);

      // Two staggered pulses on the active place; the pin itself swells a little.
      var t = now / 1000;
      for (var r = 0; r < rings.length; r++) {
        var on = r === api.active;
        var ph1 = (t % 2.0) / 2.0, ph2 = ((t + 1.0) % 2.0) / 2.0;
        rings[r].scale.setScalar(1 + ph1 * 3.0);
        rings[r].material.opacity = on ? 0.85 * (1 - ph1) * (1 - ph1) : 0;
        rings2[r].scale.setScalar(1 + ph2 * 3.0);
        rings2[r].material.opacity = on ? 0.85 * (1 - ph2) * (1 - ph2) : 0;
        var s = on ? 1.35 : 1;
        pins[r].scale.setScalar(s);
        halos[r].scale.setScalar(s);
      }

      applyView();
      for (var j = 0; j < api.after.length; j++) api.after[j](dt, t);
      renderer.render(scene, camera);
    }
    applyView();
    requestAnimationFrame(loop);

    api.destroy = function () { dead = true; renderer.dispose(); };
    return api;
  }

  window.Globe = Globe;
})();
