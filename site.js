(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EMAIL = "francesco.pisacane@mail.polimi.it";
  var GITHUB = "https://github.com/FrancescoPisacane";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Footer year ---------- */
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- Toast ---------- */
  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2200);
  }

  /* ---------- Copy email ---------- */
  function copyEmail() {
    var done = function () { toast("Email copied: " + EMAIL); };
    try {
      navigator.clipboard.writeText(EMAIL).then(done, function () { fallbackCopy(done); });
    } catch (e) { fallbackCopy(done); }
  }
  function fallbackCopy(done) {
    var ta = document.createElement("textarea");
    ta.value = EMAIL; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0;left:-999px";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    toast(ok ? "Email copied: " + EMAIL : "My email: " + EMAIL);
    if (ok && done) { /* already toasted */ }
  }
  $$("[data-copy-email]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); copyEmail(); });
  });

  /* ---------- Replay the intro ---------- */
  function replay() {
    try { sessionStorage.removeItem("introSeen"); } catch (e) {}
    if (/index\.html$|\/$/.test(window.location.pathname) && $("#intro")) window.location.reload();
    else window.location.href = "index.html";
  }
  $$("[data-replay]").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); replay(); });
  });

  /* ---------- Spotlight: press / or Ctrl+K to jump anywhere ---------- */
  var ITEMS = [
    { group: "Pages", label: "Home", hint: "Portrait", go: "index.html" },
    { group: "Pages", label: "Projects", hint: "Research and university work", go: "projects.html" },
    { group: "Pages", label: "Academy", hint: "Universities, honours, skills", go: "academics.html" },
    { group: "Pages", label: "CV", hint: "CV, transcript, contacts", go: "downloads.html" },
    { group: "Pages", label: "Life", hint: "Drones, photos, trails", go: "life.html" },
    { group: "Pages", label: "Control lab", hint: "Inverted pendulum, PID and NMPC", go: "projects.html#lab" },
    { group: "Projects", label: "Distributed planetary vehicles", hint: "Master's thesis, NASA JPL", go: "projects.html" },
    { group: "Projects", label: "Active wavefront control", hint: "Segmented telescope, IRIS", go: "projects.html" },
    { group: "Projects", label: "Multi-agent reinforcement learning", hint: "Pacman Capture the Flag", ext: GITHUB + "/Multi-Agent-Reinforcement-Learning-Pacman" },
    { group: "Projects", label: "SLAM and vision for object search", hint: "TurtleBot 4, ROS 2, YOLOv8", ext: GITHUB + "/SLAM-and-Computer-Vision-for-Autonomous-Object-Search" },
    { group: "Projects", label: "Bayesian optimisation for PID tuning", hint: "7-joint robot arm", ext: GITHUB + "/Bayesian-Optimization-for-PID-tuning-in-a-robotic-arm" },
    { group: "Projects", label: "Model order reduction with POD-NN", hint: "Leak detection surrogate", ext: GITHUB + "/Data-Driven-Model-Order-Reduction-with-POD-NN" },
    { group: "Projects", label: "PPO for battery optimisation", hint: "Reinforcement learning", ext: GITHUB + "/PPO-Reinforcement-Learning-for-Electric-Battery-Optimization" },
    { group: "Projects", label: "LLM for robot arm control", hint: "SayCan-style zero-shot planner", ext: GITHUB + "/LLM-for-robotic-arm-control" },
    { group: "Projects", label: "Experimental modal analysis", hint: "FEM and a metal plate", ext: GITHUB + "/Experimental-Modal-Analysis" },
    { group: "Actions", label: "Copy my email", hint: EMAIL, run: copyEmail },
    { group: "Actions", label: "Open GitHub", hint: "github.com/FrancescoPisacane", ext: GITHUB },
    { group: "Actions", label: "Replay the journey", hint: "The globe animation", run: replay }
  ];

  var spot, input, list, shown = [], sel = 0, lastFocus = null;

  function buildSpot() {
    spot = document.createElement("div");
    spot.className = "spot";
    spot.hidden = true;
    spot.innerHTML =
      '<div class="spot-card" role="dialog" aria-modal="true" aria-label="Search the site">' +
      '<div class="spot-field">' +
      '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '<input id="spot-input" type="text" placeholder="Search pages, projects, actions" autocomplete="off" spellcheck="false" aria-controls="spot-list">' +
      '<kbd>Esc</kbd></div>' +
      '<ul id="spot-list" role="listbox"></ul></div>';
    document.body.appendChild(spot);
    input = $("#spot-input", spot);
    list = $("#spot-list", spot);

    spot.addEventListener("mousedown", function (e) { if (e.target === spot) closeSpot(); });
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); run(shown[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); closeSpot(); }
      else if (e.key === "Tab") { e.preventDefault(); }
    });
  }

  function render() {
    var q = input.value.trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    shown = ITEMS.filter(function (it) {
      var hay = (it.label + " " + it.hint + " " + it.group).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    });
    sel = 0;
    list.innerHTML = "";
    if (!shown.length) {
      var empty = document.createElement("li");
      empty.className = "spot-empty";
      empty.textContent = "Nothing matches. Try a project name or a page.";
      list.appendChild(empty);
      return;
    }
    var group = "";
    shown.forEach(function (it, i) {
      if (it.group !== group) {
        group = it.group;
        var h = document.createElement("li");
        h.className = "spot-group"; h.setAttribute("role", "presentation");
        h.textContent = group;
        list.appendChild(h);
      }
      var li = document.createElement("li");
      li.className = "spot-item"; li.setAttribute("role", "option"); li.id = "spot-opt-" + i;
      li.innerHTML = "<span></span><small></small>";
      li.firstChild.textContent = it.label;
      li.lastChild.textContent = it.hint;
      li.addEventListener("mousemove", function () { sel = i; mark(); });
      li.addEventListener("click", function () { run(it); });
      list.appendChild(li);
    });
    mark();
  }

  function mark() {
    $$(".spot-item", list).forEach(function (li, i) {
      var on = i === sel;
      li.classList.toggle("is-sel", on);
      li.setAttribute("aria-selected", on ? "true" : "false");
      if (on) li.scrollIntoView({ block: "nearest" });
    });
    input.setAttribute("aria-activedescendant", "spot-opt-" + sel);
  }
  function move(d) { if (!shown.length) return; sel = (sel + d + shown.length) % shown.length; mark(); }

  function run(it) {
    if (!it) return;
    closeSpot();
    if (it.run) { it.run(); return; }
    if (it.ext) {
      var a = document.createElement("a");
      a.href = it.ext; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return;
    }
    if (it.go) window.location.href = it.go;
  }

  function openSpot() {
    if (!spot) buildSpot();
    lastFocus = document.activeElement;
    spot.hidden = false;
    document.body.classList.add("spot-open");
    input.value = "";
    render();
    setTimeout(function () { input.focus(); }, 0);
  }
  function closeSpot() {
    if (!spot || spot.hidden) return;
    spot.hidden = true;
    document.body.classList.remove("spot-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable);
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openSpot(); }
    else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !document.body.classList.contains("intro-on")) { e.preventDefault(); openSpot(); }
  });
  $$("[data-open-search]").forEach(function (b) { b.addEventListener("click", openSpot); });

  /* ---------- Home: portrait fallback, tilt and glare ---------- */
  var fig = document.getElementById("portrait");
  if (fig) {
    var img = $("img", fig);
    var fail = function () { fig.classList.add("no-photo"); };
    if (img) {
      if (img.complete && img.naturalWidth === 0) fail();
      img.addEventListener("error", fail);
    }
    if (!reduce) {
      var stage = document.getElementById("home");
      stage.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        var x = e.clientX / window.innerWidth - 0.5;
        var y = e.clientY / window.innerHeight - 0.5;
        fig.style.setProperty("--ry", (x * 16).toFixed(2) + "deg");
        fig.style.setProperty("--rx", (-y * 12).toFixed(2) + "deg");
        fig.style.setProperty("--gx", (50 + x * 90).toFixed(1) + "%");
        fig.style.setProperty("--gy", (30 + y * 90).toFixed(1) + "%");
      });
      stage.addEventListener("pointerleave", function () {
        fig.style.setProperty("--ry", "0deg");
        fig.style.setProperty("--rx", "0deg");
        fig.style.setProperty("--gx", "50%");
        fig.style.setProperty("--gy", "30%");
      });
    }
  }

  /* ---------- Soft light that follows the pointer on tiles and links ---------- */
  if (!reduce) {
    $$(".tile, .home-nav a, .lab").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        el.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      });
    });
  }

  /* ---------- Project filters ---------- */
  var chips = $$(".chip");
  var items = $$(".proj");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var f = chip.getAttribute("data-filter");
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      items.forEach(function (it) {
        var cats = (it.getAttribute("data-cat") || "").split(" ");
        it.classList.toggle("is-hidden", f !== "all" && cats.indexOf(f) === -1);
      });
    });
  });

  /* ---------- Life page: use a photo only if the file exists ---------- */
  $$("[data-photo]").forEach(function (el) {
    var im = new Image();
    im.onload = function () {
      el.style.backgroundImage = 'url("' + el.getAttribute("data-photo") + '")';
      el.classList.add("has-photo");
    };
    im.src = el.getAttribute("data-photo");
  });

  /* ---------- Gentle lift as blocks enter the viewport ----------
     Content is always visible; only a small offset is removed. */
  var lifts = $$(".rv");
  if ("IntersectionObserver" in window && !reduce && lifts.length) {
    document.documentElement.classList.add("has-rv");
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    lifts.forEach(function (el) { io.observe(el); });
  }

  /* ---------- World clocks ---------- */
  var clocks = $$("[data-tz]");
  function tick() {
    clocks.forEach(function (el) {
      try {
        el.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: el.getAttribute("data-tz") }).format(new Date());
      } catch (e) { el.textContent = "--:--"; }
    });
  }
  if (clocks.length) { tick(); setInterval(tick, 15000); }

  /* ---------- Association badges: show the logo file if it exists, else the monogram ---------- */
  $$("[data-logo]").forEach(function (b) {
    var img = new Image();
    img.alt = "";
    img.onload = function () { b.appendChild(img); };
    img.src = b.getAttribute("data-logo");
  });

  /* ---------- Small nods for control people: type a word anywhere ---------- */
  var EGGS = {
    pid: "Kp, Ki, Kd. Pick two and pray.",
    lqr: "u = −Kx, with K from the Riccati equation. Nice.",
    mpc: "min J(u) over the next 2 s, then do it again 33 ms later.",
    bode: "Gain margin: comfortable. Phase margin: also comfortable.",
    laplace: "s = σ + jω. Everything is easier in the s-domain.",
    kalman: "x̂ = x̂⁻ + K (y − H x̂⁻). Trust the model, but verify.",
    hinf: "min ‖T‖∞. Robust, and a bit paranoid.",
    simulink: "Please don't draw the algebraic loop."
  };
  var typed = "";
  window.addEventListener("keydown", function (e) {
    var tg = e.target && e.target.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-10);
    Object.keys(EGGS).forEach(function (k) {
      if (typed.slice(-k.length) === k) { toast(EGGS[k]); typed = ""; }
    });
  });
  try { console.log("%cẋ = Ax + Bu%c\nLooking at the source? Try typing pid, lqr, mpc, bode or kalman on the page.", "font:600 16px monospace;color:#2f6bff", "font:12px monospace;color:#6e6e73"); } catch (e) {}

  /* ---------- Smooth page transitions ---------- */
  var leaving = false;
  function pageGo(href) {
    if (leaving) return; leaving = true;
    document.documentElement.classList.add("leaving");
    setTimeout(function () { window.location.href = href; }, 320);
  }
  window.pageGo = pageGo;
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute("data-replay")) return;
    var h = a.getAttribute("href");
    if (!h || h.charAt(0) === "#" || /^(https?:|mailto:|tel:)/.test(h) || !/\.html/.test(h)) return;
    e.preventDefault(); pageGo(h);
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) { leaving = false; document.documentElement.classList.remove("leaving"); } });
})();

(function () {
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-copy"), w = b.getAttribute("data-what") || "Text";
      var done = function () { if (window.toast) window.toast(w + " copied: " + v); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, done); else done();
    });
  });
})();

(function () {
  var card = document.getElementById("reach-card"); if (!card) return;
  var D = {
    email: { v: "francesco.pisacane@mail.polimi.it", c: "francesco.pisacane@mail.polimi.it", w: "Email" },
    phone: { v: "+39 333 315 0472", c: "+393333150472", w: "Phone number" },
    linkedin: { v: "linkedin.com/in/francesco-pisacane", c: "https://www.linkedin.com/in/francesco-pisacane", w: "LinkedIn link", open: "https://www.linkedin.com/in/francesco-pisacane" }
  };
  var vEl = document.getElementById("rc-v"), cp = document.getElementById("rc-copy"), op = document.getElementById("rc-open"), cur = null;
  var btns = Array.prototype.slice.call(document.querySelectorAll("[data-reach]"));
  btns.forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var k = b.getAttribute("data-reach");
      if (cur === k) { card.hidden = true; cur = null; b.classList.remove("is-on"); return; }
      cur = k; var d = D[k];
      vEl.textContent = d.v; if (d.open) { op.href = d.open; op.hidden = false; } else op.hidden = true;
      card.hidden = false; cp.textContent = "Copy";
      btns.forEach(function (x) { x.classList.toggle("is-on", x === b); });
    });
  });
  cp.addEventListener("click", function () {
    var d = D[cur]; if (!d) return;
    var done = function () { cp.textContent = "Copied"; };
    var fb = function () { var ta = document.createElement("textarea"); ta.value = d.c; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); done(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.c).then(done, fb); else fb();
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".reach")) { card.hidden = true; cur = null; btns.forEach(function (x) { x.classList.remove("is-on"); }); } });
})();
