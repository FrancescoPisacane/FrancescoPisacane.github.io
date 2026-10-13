/* Life page: my life outside the lab as a ROS graph. I publish, the rest subscribes.
   Ellipses are nodes, rectangles are topics: hover (or tap) a topic and it grows to tell you more. */
(function () {
  "use strict";
  var box = document.getElementById("rg");
  if (!box) return;
  // Nodes (ellipses) are processes, topics (rectangles) are the data between them. Every edge goes node -> topic -> node.
  var VW = 1300, VH = 620;
  var N = {
    me: { x: 70, y: 310, t: "/francesco", me: true },
    student: { x: 410, y: 25, t: "student" }, tutor: { x: 790, y: 75, t: "tutor" },
    video: { x: 410, y: 140, t: "video_maker_editor" }, photographer: { x: 410, y: 210, t: "photographer" },
    athlete: { x: 410, y: 360, t: "athlete" }, coach: { x: 790, y: 310, t: "football_coach" }, lifeguard: { x: 790, y: 410, t: "lifeguard" },
    jobs: { x: 1160, y: 180, t: "side_jobs" },
    maker: { x: 410, y: 510, t: "maker" }
  };
  var T = {
    studies: { x: 235, y: 55, t: "/studies", m: "Engineering at Politecnico di Milano." },
    drone: { x: 235, y: 140, t: "/drone", m: "A real passion of mine: drones, and flying them." },
    hiking: { x: 235, y: 285, t: "/hiking", m: "Long days on the trail, camera in the bag." },
    sport: { x: 235, y: 420, t: "/sport", m: "Football and swimming, since I was a kid." },
    making: { x: 235, y: 510, t: "/making", m: "Whenever I have an idea for some hardware, I try to build it, for example the fun smart alarm.", img: "assets/smart-alarm.jpg", link: "https://github.com/FrancescoPisacane/Smart-Alarm-with-Secure-Wake-Up-Challenge" },
    lessons: { x: 960, y: 60, t: "/lessons", m: "Private tutoring for other students." },
    estate: { x: 960, y: 130, t: "/real_estate", m: "Aerial video shooting and editing for real estate agencies." },
    coaching: { x: 960, y: 230, t: "/coaching", m: "From the pitch to the bench: I coach youth players." },
    shifts: { x: 960, y: 310, t: "/shifts", m: "Lifeguard shifts, plus pizza delivery on the side, to pay my way through university." },
    photos: { x: 600, y: 210, t: "/photography", m: "Landscapes and travel, from the air and from the ground." },
    football: { x: 600, y: 310, w: 190, t: "/competitive_football", m: "Played football up to the first division, Prima Categoria." },
    swimming: { x: 600, y: 410, t: "/swimming", m: "Years in the pool, which later became a job." }
  };
  var E = [
    ["me", "studies"], ["studies", "student"], ["studies", "tutor"], ["tutor", "lessons"], ["lessons", "jobs"],
    ["me", "drone"], ["drone", "video"], ["video", "estate"], ["estate", "jobs"], ["drone", "photographer"],
    ["me", "hiking"], ["hiking", "photographer"], ["hiking", "athlete"], ["photographer", "photos"],
    ["me", "sport"], ["sport", "athlete"], ["athlete", "football"], ["football", "coach"], ["coach", "coaching"], ["coaching", "jobs"],
    ["athlete", "swimming"], ["swimming", "lifeguard"], ["lifeguard", "shifts"], ["shifts", "jobs"],
    ["me", "making"], ["making", "maker"]
  ];
  function el(id) { return N[id] || T[id]; }
  function half(id) { return N[id] ? (N[id].me ? 62 : 8 + N[id].t.length * 4.3 + 14) : (T[id].w || 128) / 2; }
  var svg = '<svg class="rg-svg" viewBox="0 0 ' + VW + " " + VH + '" aria-hidden="true">';
  E.forEach(function (e, i) {
    var a = el(e[0]), b = el(e[1]), back = a.x > b.x, x1, x2;
    if (back) { x1 = a.x - half(e[0]) * 0.4; x2 = b.x + half(e[1]) * 0.4; svg += '<path class="rg-e" data-e="' + e[0] + " " + e[1] + '" id="e' + i + '" d="M' + x1 + " " + (a.y + 14) + " C" + x1 + " " + (a.y + 70) + " " + x2 + " " + (b.y + 70) + " " + x2 + " " + (b.y + 14) + '"/>'; }
    else {
      x1 = a.x + half(e[0]); x2 = b.x - half(e[1]); var mx = (x1 + x2) / 2;
      svg += '<path class="rg-e" data-e="' + e[0] + " " + e[1] + '" id="e' + i + '" d="M' + x1 + " " + a.y + " C" + mx + " " + a.y + " " + mx + " " + b.y + " " + x2 + " " + b.y + '"/>';
    }
  });
  svg += "</svg>";
  var html = svg;
  Object.keys(N).forEach(function (k) { var n = N[k]; html += '<div class="rgn' + (n.me ? " me" : "") + '" data-id="' + k + '" style="left:' + (n.x / VW * 100) + "%;top:" + (n.y / VH * 100) + '%">' + n.t + "</div>"; });
  Object.keys(T).forEach(function (k) {
    var t = T[k];
    html += '<div class="rgt" tabindex="0" data-id="' + k + '" style="' + (t.w ? '--w:' + t.w + 'px;' : '') + 'left:' + (t.x / VW * 100) + "%;top:" + (t.y / VH * 100) + '%"><span class="nm">' + t.t + '</span><span class="more">' + t.m + (t.img ? '<img src="' + t.img + '" alt="" loading="lazy" onerror="this.remove()">' : "") + (t.link ? '<a class="rl" href="' + t.link + '" target="_blank" rel="noopener">View on GitHub</a>' : "") + "</span></div>";
  });
  box.innerHTML = html;
  var wrap = box.parentNode;
  function fit() { var z = Math.max(0.6, Math.min(1, wrap.clientWidth / VW)); box.style.zoom = z; wrap.style.overflowX = wrap.clientWidth < VW * 0.6 ? "auto" : "hidden"; wrap.style.overflowY = "hidden"; }
  fit(); window.addEventListener("resize", fit);

  // highlight what a topic connects to
  function hot(id, on) {
    box.classList.toggle("has-hot", on);
    var ids = {}; ids[id] = 1;
    // follow the graph both ways, one hop each side of the topic, plus the publisher chain back to /francesco
    E.forEach(function (e) { if (e[0] === id || e[1] === id) { ids[e[0]] = 1; ids[e[1]] = 1; } });
    Array.prototype.forEach.call(box.querySelectorAll(".rg-e"), function (p) {
      var d = p.getAttribute("data-e").split(" "); p.classList.toggle("is-hot", on && ids[d[0]] && ids[d[1]] && (d[0] === id || d[1] === id));
    });
    Array.prototype.forEach.call(box.querySelectorAll(".rgn"), function (n) { n.classList.toggle("is-hot", on && !!ids[n.getAttribute("data-id")]); });
  }
  Array.prototype.forEach.call(box.querySelectorAll(".rgt"), function (t) {
    var id = t.getAttribute("data-id");
    t.addEventListener("mouseenter", function () { hot(id, true); });
    t.addEventListener("mouseleave", function () { hot(id, false); t.classList.remove("is-open"); });
    t.addEventListener("focus", function () { hot(id, true); });
    t.addEventListener("blur", function () { hot(id, false); });
    t.addEventListener("click", function (e) {
      var open = !t.classList.contains("is-open");
      Array.prototype.forEach.call(box.querySelectorAll(".rgt.is-open"), function (o) { o.classList.remove("is-open"); });
      t.classList.toggle("is-open", open); hot(id, open); e.stopPropagation();
    });
  });
  document.addEventListener("click", function () { Array.prototype.forEach.call(box.querySelectorAll(".rgt.is-open"), function (o) { o.classList.remove("is-open"); }); hot("", false); });

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var NS = "http://www.w3.org/2000/svg", s = box.querySelector("svg"), dots = [];
  E.forEach(function (e, i) {
    var p = document.getElementById("e" + i), c = document.createElementNS(NS, "circle");
    c.setAttribute("r", "3.2"); c.setAttribute("class", "rg-msg"); s.appendChild(c);
    dots.push({ p: p, c: c, len: p.getTotalLength(), off: (i * 0.137) % 1 });
  });
  var t0 = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    var t = (now - t0) / 3200;
    dots.forEach(function (d) {
      var f = (t + d.off) % 1, pt = d.p.getPointAtLength(d.len * f);
      d.c.setAttribute("cx", pt.x); d.c.setAttribute("cy", pt.y);
      d.c.style.opacity = f < 0.06 || f > 0.94 ? 0 : 1;
    });
  })(t0);
})();
