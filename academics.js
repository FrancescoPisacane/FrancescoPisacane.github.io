/* Academic path: a draggable globe that turns to the place of the entry you are reading.
   Click a pin to jump to its entry. */
(function () {
  "use strict";

  var canvas = document.getElementById("map-canvas");
  if (!canvas || !window.Globe || !window.PLACES) return;

  var P = window.PLACES;
  var index = {};
  P.forEach(function (p, i) { index[p.id] = i; });

  var entries = Array.prototype.slice.call(document.querySelectorAll("[data-place]"));

  function setCurrent(el) {
    entries.forEach(function (x) { x.classList.toggle("is-current", x === el); });
  }

  var g = window.Globe(canvas, {
    places: P, lat: 35, lon: -30, z: 4.6, smooth: 0.045, showAll: true, drag: true, wheel: true, atmosphere: false,
    onPin: function (i) {
      var el = entries.filter(function (e) { return e.getAttribute("data-place") === P[i].id; })[0];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      focus(P[i].id);
    }
  });
  if (!g) { canvas.parentNode.classList.add("no-webgl"); return; }

  for (var i = 0; i < P.length - 1; i++) g.setArc(i, 1);
  g.target = { lat: 35, lon: -30, z: 4.6 };

  var pop = document.getElementById("map-pop");
  var popFor = -1;
  function focus(id, z) {
    var k = index[id];
    if (k == null) return;
    var p = P[k];
    g.focus(p.lat, p.lon, z || 4.0);
    g.setActive(k);
  }
  function showPop(id) {
    var k = index[id];
    if (k == null || !pop) return;
    pop.querySelector(".pop-city").textContent = P[k].city;
    pop.querySelector(".pop-title").textContent = P[k].title;
    pop.querySelector(".pop-note").textContent = P[k].note;
    var im = pop.querySelector(".pop-img"); if (im) { if (P[k].img) { im.src = P[k].img; im.hidden = false; } else im.hidden = true; }
    popFor = k;
    pop.classList.add("is-on");
  }
  function hidePop() { popFor = -1; if (pop) pop.classList.remove("is-on"); }
  g.onAfter(function () {
    if (popFor < 0 || !pop) return;
    var s = g.pinScreen(popFor);
    var box = pop.parentNode.getBoundingClientRect();
    if (!s || !s.visible) { pop.style.opacity = "0"; return; }
    pop.style.opacity = "";
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var x = Math.max(8, Math.min(box.width - w - 8, s.x - w / 2));
    var y = Math.max(8, s.y - h - 24);
    pop.style.transform = "translate(" + x + "px," + y + "px)";
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (e) {
        if (e.isIntersecting) {
          setCurrent(e.target);
          focus(e.target.getAttribute("data-place"));
        }
      });
    }, { rootMargin: "-38% 0px -50% 0px" });
    entries.forEach(function (e) { io.observe(e); });
  }
  // Hover (or tap) a title: the globe zooms in on the place and a short label appears on it.
  entries.forEach(function (e) {
    var id = e.getAttribute("data-place");
    e.addEventListener("mouseenter", function () { focus(id, 2.5); showPop(id); });
    e.addEventListener("mouseleave", function () { focus(id, 4.0); hidePop(); });
    e.addEventListener("click", function () { focus(id, 2.5); showPop(id); });
  });
})();
