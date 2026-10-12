// Segmented mirror: 19 hexagons that start misaligned and settle into place.
(function () {
  "use strict";

  var group = document.getElementById("segments");
  if (!group) return;

  var NS = "http://www.w3.org/2000/svg";
  var R = 48;            // hexagon circumradius
  var GAP = 5;           // visible gap between segments
  var fills = ["url(#seg-a)", "url(#seg-b)", "url(#seg-c)"];

  // Axial coordinates for a hex grid of radius 2 (19 cells).
  var cells = [];
  for (var q = -2; q <= 2; q++) {
    for (var r = -2; r <= 2; r++) {
      if (Math.abs(q + r) <= 2) cells.push({ q: q, r: r });
    }
  }

  function hexPoints(radius) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = (Math.PI / 180) * (60 * i); // flat-top hexagon
      pts.push((radius * Math.cos(a)).toFixed(2) + "," + (radius * Math.sin(a)).toFixed(2));
    }
    return pts.join(" ");
  }

  // Deterministic pseudo-random so the intro looks the same on every visit.
  var seed = 7;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  var size = R + GAP / 2;
  var segs = [];

  cells.forEach(function (c, i) {
    var x = size * 1.5 * c.q * (R / size);
    var y = size * Math.sqrt(3) * (c.r + c.q / 2) * (R / size);
    // spread cells slightly so the gap is visible
    x *= 1.0 + GAP / (R * 2);
    y *= 1.0 + GAP / (R * 2);

    var g = document.createElementNS(NS, "g");
    g.setAttribute("transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")");

    var poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", hexPoints(R - GAP / 2));
    poly.setAttribute("fill", fills[(c.q - c.r + 6) % 3]);
    poly.setAttribute("fill-opacity", (0.72 + 0.28 * rnd()).toFixed(2));
    poly.setAttribute("stroke", "rgba(255,255,255,0.85)");
    poly.setAttribute("stroke-width", "1.5");
    poly.classList.add("seg", "is-off");

    var dist = Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
    poly.style.setProperty("--dx", ((rnd() - 0.5) * 70).toFixed(1) + "px");
    poly.style.setProperty("--dy", ((rnd() - 0.5) * 70).toFixed(1) + "px");
    poly.style.setProperty("--rot", ((rnd() - 0.5) * 40).toFixed(1) + "deg");
    // Centre segments settle first, outer ring last.
    poly.style.setProperty("--d", (0.15 + dist * 0.18 + rnd() * 0.12).toFixed(2) + "s");

    g.appendChild(poly);
    group.appendChild(g);
    segs.push(poly);
  });

  // One orchestrated moment: the segments align themselves.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      segs.forEach(function (s) { s.classList.remove("is-off"); });
    });
  });

  // Footer year
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
