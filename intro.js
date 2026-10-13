/* Opening animation: a slow flight over the globe through the places of my
   university years, then the page with the portrait. */
(function () {
  "use strict";

  var intro = document.getElementById("intro");

  function reveal() { document.body.classList.add("ready"); }
  function drop() { if (intro && intro.parentNode) intro.parentNode.removeChild(intro); }

  var seen = false;
  try { seen = sessionStorage.getItem("introSeen") === "1"; } catch (e) {}
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!intro || reduce || seen || !window.THREE || !window.Globe || !window.PLACES) {
    drop();
    reveal();
    return;
  }

  // Only the university years: high school is left out.
  var P = window.PLACES.filter(function (p) { return !p.school; });

  var canvas = document.getElementById("intro-canvas");
  var g = window.Globe(canvas, { places: P, lat: 18, lon: -40, z: 5.1 });
  if (!g) { drop(); reveal(); return; }

  document.body.classList.add("intro-on");

  var pop = document.getElementById("pop");
  var elCity = pop.querySelector(".pop-city");
  var elTitle = pop.querySelector(".pop-title");
  var elNote = pop.querySelector(".pop-note");
  var title = document.getElementById("intro-title");
  var dotsBox = document.getElementById("intro-dots");

  var dotEls = P.map(function () {
    var d = document.createElement("span");
    dotsBox.appendChild(d);
    return d;
  });

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpLon(a, b, t) { var d = ((b - a + 540) % 360) - 180; return a + d * t; }
  function dist(a, b) {
    var p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180, dl = (b.lon - a.lon) * Math.PI / 180;
    var c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
    return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI;
  }

  // Timeline: hold on the whole globe, then travel and dwell for each place, then pull back.
  var start = { lat: 18, lon: -40, z: 5.1 };
  var segs = [{ type: "hold", dur: 3.4, view: start, first: true }];
  var prev = start;
  P.forEach(function (p, i) {
    var to = { lat: p.lat, lon: p.lon, z: p.z || 2.8 };
    segs.push({ type: "travel", i: i, from: prev, to: to, dur: p.travel, lift: i === 0 ? 0.6 : Math.min(1.3, dist(prev, to) / 45) });
    segs.push({ type: "dwell", i: i, dur: p.dwell, view: to });
    prev = to;
  });
  var endView = { lat: 30, lon: -50, z: 4.8 };
  segs.push({ type: "travel", i: -1, from: prev, to: endView, dur: 3.4, lift: 0 });
  segs.push({ type: "hold", dur: 2.6, view: endView });

  var total = 0;
  segs.forEach(function (s) { s.t0 = total; total += s.dur; });

  var t = 0, finished = false, shown = -1;

  function showPop(i) {
    var p = P[i];
    elCity.textContent = p.city;
    elTitle.textContent = p.title;
    elNote.textContent = p.note;
    var im = pop.querySelector(".pop-img"); if (im) { if (p.img) { im.src = p.img; im.hidden = false; } else im.hidden = true; }
    pop.classList.add("is-on");
    shown = i;
  }
  function hidePop() { pop.classList.remove("is-on"); shown = -1; }

  function place(i) {
    var s = g.pinScreen(i);
    if (!s || !s.visible) { pop.style.visibility = "hidden"; return; }
    pop.style.visibility = "visible";
    var w = pop.offsetWidth, h = pop.offsetHeight, gap = 24;
    var x = s.x + gap, y = s.y - h - gap;
    if (x + w > window.innerWidth - 16) x = s.x - gap - w;
    if (x < 16) x = 16;
    if (y < 72) y = s.y + gap;
    pop.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  function finish() {
    if (finished) return;
    finished = true;
    try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
    hidePop();
    intro.classList.add("is-done");
    document.body.classList.remove("intro-on");
    reveal();
    setTimeout(function () { g.destroy(); drop(); }, 1100);
  }

  document.getElementById("intro-skip").addEventListener("click", finish);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") finish(); });

  // Title card on the opening hold.
  requestAnimationFrame(function () { title.classList.add("is-on"); });

  var seg = 0, lastDot = -2;
  g.onFrame(function (dt) {
    if (finished) return;
    t += dt;
    if (t >= total) { finish(); return; }
    while (seg < segs.length - 1 && t >= segs[seg].t0 + segs[seg].dur) seg++;
    var s = segs[seg];
    var u = Math.min(1, Math.max(0, (t - s.t0) / s.dur));
    var v = g.view;

    if (seg > 0) title.classList.remove("is-on");

    if (s.type === "travel") {
      var e = ease(u);
      v.lat = lerp(s.from.lat, s.to.lat, e);
      v.lon = lerpLon(s.from.lon, s.to.lon, e);
      v.z = lerp(s.from.z, s.to.z, e) + s.lift * Math.sin(Math.PI * u);
      if (shown !== -1) hidePop();
      g.setActive(-1);
      if (s.i > 0) g.setArc(s.i - 1, e);
    } else {
      v.lat = s.view.lat;
      v.lon = s.view.lon - (s.first ? 10 * (1 - u) : 0);
      v.z = s.view.z - (s.type === "dwell" ? 0.05 * u : 0);
      if (s.type === "dwell") {
        g.setVisited(s.i, true);
        g.setActive(s.i);
        if (s.i > 0) g.setArc(s.i - 1, 1);
        if (shown !== s.i && u > 0.12) showPop(s.i);
        if (u > 0.92) pop.classList.remove("is-on");
        if (lastDot !== s.i) {
          lastDot = s.i;
          dotEls.forEach(function (d, k) {
            d.className = k < s.i ? "done" : (k === s.i ? "on" : "");
          });
        }
      } else {
        g.setActive(-1);
      }
    }
  });

  g.onAfter(function () {
    if (shown !== -1) place(shown);
  });
})();
