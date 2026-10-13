/* Cart-pole core: plant, PID, nonlinear MPC and linear analysis. No DOM, so it can be tested in Node.

   Plant (th = 0 upright, l = half pole length, small pivot damping):
     temp = (F + m l thd^2 sin th) / (M + m)
     thdd = (g sin th - cos th * temp) / (l (4/3 - m cos^2 th / (M + m)))
     xdd  = temp - m l thdd cos th / (M + m)

   PID   u = Kp th + Ki int(th) + Kd thd + c (4.5 x + 7.2 xd), active only close to the top
         (a linear law is only valid there, so it cannot swing the pole up).
   NMPC  receding horizon, 2 s in 40 steps of 50 ms, |u| <= 25 N, rail limit.
         Far from the top a sampling-based optimiser (MPPI, smooth noise) finds the swing-up.
         Close to the top iLQR (Gauss-Newton on the nonlinear model) takes over, with the
         Riccati solution of the linearised model as terminal cost. Solved at 30 Hz. */
(function (root) {
  "use strict";
  var g = 9.8, M = 1.0, m = 0.1, l = 0.5, BD = 0.03;
  var UMAX = 25, XMAX = 3.0, DT = 1 / 240;
  var TWO_PI = Math.PI * 2;
  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  /* ---------- Dynamics ---------- */
  function f(s, F, out, damp) {
    var th = s[2], w = s[3], c = Math.cos(th), sn = Math.sin(th);
    var t = (F + m * l * w * w * sn) / (M + m);
    var a = (g * sn - c * t) / (l * (4 / 3 - (m * c * c) / (M + m)));
    out[0] = s[1]; out[1] = t - (m * l * a * c) / (M + m); out[2] = w; out[3] = a - damp * w;
  }
  var k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0], tmp = [0, 0, 0, 0];
  function rk4(s, F, h, o, damp) {
    var i;
    f(s, F, k1, damp);
    for (i = 0; i < 4; i++) tmp[i] = s[i] + (h / 2) * k1[i];
    f(tmp, F, k2, damp);
    for (i = 0; i < 4; i++) tmp[i] = s[i] + (h / 2) * k2[i];
    f(tmp, F, k3, damp);
    for (i = 0; i < 4; i++) tmp[i] = s[i] + h * k3[i];
    f(tmp, F, k4, damp);
    for (i = 0; i < 4; i++) o[i] = s[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }

  /* ---------- NMPC ---------- */
  var NH = 40, DTH = 0.05, KS = 500;
  var QD = [2.0, 1.2, 30, 1.0], RR = 0.2, WALL = 2.4;
  var PT = [[3.4469, 2.3704, 7.5787, 2.0124], [2.3704, 3.3119, 11.0492, 2.9528], [7.5787, 11.0492, 59.0873, 13.8591], [2.0124, 2.9528, 13.8591, 3.6062]];
  var KL = [-3.162, -5.45, -47.509, -11.983];
  var U = new Float64Array(NH);
  var mpcMode = "m";

  function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v); }
  function clampU(u) { return Math.max(-UMAX, Math.min(UMAX, u)); }

  function quadP(s) {
    var z = [s[0], s[1], wrap(s[2]), s[3]], r = 0, i, j;
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) r += z[i] * PT[i][j] * z[j];
    return r;
  }
  function stageS(s, u) {
    var th = wrap(s[2]), c = Math.max(0, Math.cos(th));
    var wl = Math.max(0, Math.abs(s[0]) - WALL);
    return 0.5 * s[1] * s[1] + s[0] * s[0] + 26 * (1 - Math.cos(th)) +
      (0.04 + 2 * c * c) * s[3] * s[3] + 0.02 * u * u + 400 * wl * wl;
  }
  function termS(s) { return Math.min(quadP(s), 80) + 100 * (1 - Math.cos(s[2])); }

  var costs = new Float64Array(KS), noise = new Float64Array(KS * NH), wts = new Float64Array(KS);
  var st = [0, 0, 0, 0], nx = [0, 0, 0, 0];
  var RHO = 0.85, SQ = Math.sqrt(1 - 0.85 * 0.85);
  function mppi(s0) {
    var k, i, sig = 7;
    for (k = 0; k < KS; k++) {
      st[0] = s0[0]; st[1] = s0[1]; st[2] = s0[2]; st[3] = s0[3];
      var J = 0, prev = 0;
      for (i = 0; i < NH; i++) {
        var e = k === 0 ? 0 : (prev = RHO * prev + SQ * gauss() * sig);
        noise[k * NH + i] = e;
        var u = clampU(U[i] + e);
        J += stageS(st, u) * DTH;
        rk4(st, u, DTH, nx, 0);
        st[0] = nx[0]; st[1] = nx[1]; st[2] = nx[2]; st[3] = nx[3];
      }
      costs[k] = J + termS(st);
    }
    var mn = 1e18, sum = 0;
    for (k = 0; k < KS; k++) { if (costs[k] < mn) mn = costs[k]; sum += costs[k]; }
    var lam = Math.max(0.05, 0.03 * (sum / KS - mn)), ws = 0;
    for (k = 0; k < KS; k++) { wts[k] = Math.exp(-(costs[k] - mn) / lam); ws += wts[k]; }
    for (i = 0; i < NH; i++) {
      var d = 0;
      for (k = 0; k < KS; k++) d += wts[k] * noise[k * NH + i];
      U[i] = clampU(U[i] + d / ws);
    }
    // smooth the sequence (3-tap) so the commanded force is not jittery
    var Us = new Float64Array(NH);
    for (i = 0; i < NH; i++) Us[i] = 0.25 * U[Math.max(0, i - 1)] + 0.5 * U[i] + 0.25 * U[Math.min(NH - 1, i + 1)];
    for (i = 0; i < NH; i++) U[i] = Us[i];
  }

  /* iLQR on the nonlinear model (finite-difference Jacobians, quadratic cost, input clipping) */
  var Xs = [], As = [], Bs = [], Ks = [], ks = new Float64Array(NH), ii;
  for (ii = 0; ii <= NH; ii++) Xs.push([0, 0, 0, 0]);
  for (ii = 0; ii < NH; ii++) { As.push(new Float64Array(16)); Bs.push(new Float64Array(4)); Ks.push(new Float64Array(4)); }

  function rollCost(s0, Uc) {
    var s = s0.slice(), J = 0, o = [0, 0, 0, 0], i, j;
    for (i = 0; i < NH; i++) {
      for (j = 0; j < 4; j++) J += QD[j] * s[j] * s[j] * DTH;
      J += RR * Uc[i] * Uc[i] * DTH;
      var w = Math.max(0, Math.abs(s[0]) - WALL);
      J += 300 * w * w * DTH;
      rk4(s, Uc[i], DTH, o, 0); s = o.slice();
    }
    var q = 0;
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) q += s[i] * PT[i][j] * s[j];
    return J + q;
  }

  function ilqr(s0, iters) {
    var mu = 1e-6, it, i, j, r, c, k, o = [0, 0, 0, 0];
    for (it = 0; it < iters; it++) {
      Xs[0] = s0.slice();
      for (i = 0; i < NH; i++) { rk4(Xs[i], U[i], DTH, o, 0); Xs[i + 1] = o.slice(); }
      var e = 1e-4;
      for (i = 0; i < NH; i++) {
        var x = Xs[i], A = As[i], B = Bs[i];
        for (j = 0; j < 4; j++) {
          var xp = x.slice(), xm = x.slice(), op = [0, 0, 0, 0], om = [0, 0, 0, 0];
          xp[j] += e; xm[j] -= e;
          rk4(xp, U[i], DTH, op, 0); rk4(xm, U[i], DTH, om, 0);
          for (r = 0; r < 4; r++) A[r * 4 + j] = (op[r] - om[r]) / (2 * e);
        }
        var o2 = [0, 0, 0, 0], o3 = [0, 0, 0, 0];
        rk4(x, U[i] + e, DTH, o2, 0); rk4(x, U[i] - e, DTH, o3, 0);
        for (r = 0; r < 4; r++) B[r] = (o2[r] - o3[r]) / (2 * e);
      }
      var eN = Xs[NH], Vx = [0, 0, 0, 0], Vxx = new Float64Array(16);
      for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) { Vxx[i * 4 + j] = 2 * PT[i][j]; Vx[i] += 2 * PT[i][j] * eN[j]; }
      var ok = true;
      for (i = NH - 1; i >= 0; i--) {
        var A2 = As[i], B2 = Bs[i], ex = Xs[i];
        var lx = [0, 0, 0, 0], lxx = [0, 0, 0, 0];
        for (j = 0; j < 4; j++) { lx[j] = 2 * QD[j] * ex[j] * DTH; lxx[j] = 2 * QD[j] * DTH; }
        var wv = Math.abs(ex[0]) - WALL;
        if (wv > 0) { lx[0] += 600 * wv * DTH * (ex[0] > 0 ? 1 : -1); lxx[0] += 600 * DTH; }
        var Qx = [0, 0, 0, 0], Qxx = new Float64Array(16), Qu = 2 * RR * U[i] * DTH, Quu = 2 * RR * DTH, Qux = [0, 0, 0, 0];
        var VA = new Float64Array(16), VB = [0, 0, 0, 0];
        for (r = 0; r < 4; r++) {
          for (c = 0; c < 4; c++) { var sm = 0; for (k = 0; k < 4; k++) sm += Vxx[r * 4 + k] * A2[k * 4 + c]; VA[r * 4 + c] = sm; }
          var sb = 0; for (k = 0; k < 4; k++) sb += Vxx[r * 4 + k] * B2[k]; VB[r] = sb;
        }
        for (r = 0; r < 4; r++) {
          var q = lx[r]; for (k = 0; k < 4; k++) q += A2[k * 4 + r] * Vx[k]; Qx[r] = q;
          for (c = 0; c < 4; c++) { var t = 0; for (k = 0; k < 4; k++) t += A2[k * 4 + r] * VA[k * 4 + c]; Qxx[r * 4 + c] = t + (r === c ? lxx[r] : 0); }
        }
        for (k = 0; k < 4; k++) { Qu += B2[k] * Vx[k]; Quu += B2[k] * VB[k]; }
        for (c = 0; c < 4; c++) { var tq = 0; for (k = 0; k < 4; k++) tq += B2[k] * VA[k * 4 + c]; Qux[c] = tq; }
        var Qr = Quu + mu;
        if (Qr <= 1e-9) { ok = false; break; }
        var kk = -Qu / Qr, Kg = Ks[i];
        for (c = 0; c < 4; c++) Kg[c] = -Qux[c] / Qr;
        ks[i] = kk;
        var nVx = [0, 0, 0, 0], nVxx = new Float64Array(16);
        for (r = 0; r < 4; r++) nVx[r] = Qx[r] + Kg[r] * Quu * kk + Kg[r] * Qu + Qux[r] * kk;
        for (r = 0; r < 4; r++) for (c = 0; c < 4; c++) nVxx[r * 4 + c] = Qxx[r * 4 + c] + Kg[r] * Quu * Kg[c] + Kg[r] * Qux[c] + Qux[r] * Kg[c];
        for (r = 0; r < 4; r++) for (c = r + 1; c < 4; c++) { var av = 0.5 * (nVxx[r * 4 + c] + nVxx[c * 4 + r]); nVxx[r * 4 + c] = av; nVxx[c * 4 + r] = av; }
        Vx = nVx; Vxx = nVxx;
      }
      if (!ok) { mu *= 10; continue; }
      var J0 = rollCost(s0, U), best = null, Jb = J0, alphas = [1, 0.5, 0.25, 0.1];
      for (var ai = 0; ai < alphas.length; ai++) {
        var al = alphas[ai], s = s0.slice(), Un = new Float64Array(NH);
        for (i = 0; i < NH; i++) {
          var u = U[i] + al * ks[i];
          for (j = 0; j < 4; j++) u += Ks[i][j] * (s[j] - Xs[i][j]);
          u = clampU(u); Un[i] = u;
          rk4(s, u, DTH, o, 0); s = o.slice();
        }
        var Jn = rollCost(s0, Un);
        if (Jn < Jb) { Jb = Jn; best = Un; }
      }
      if (best) { U.set(best); mu = Math.max(1e-7, mu * 0.3); } else mu *= 10;
    }
  }

  function lqrInit(s0) {
    var s = [s0[0], s0[1], wrap(s0[2]), s0[3]], o = [0, 0, 0, 0], i;
    for (i = 0; i < NH; i++) {
      var u = clampU(-(KL[0] * s[0] + KL[1] * s[1] + KL[2] * s[2] + KL[3] * s[3]));
      U[i] = u; rk4(s, u, DTH, o, 0); s = o.slice();
    }
  }
  function catchable(s0) {
    var s = [s0[0], s0[1], wrap(s0[2]), s0[3]], o = [0, 0, 0, 0], mt = 0, mx = 0, i;
    for (i = 0; i < 60; i++) {
      var u = clampU(-(KL[0] * s[0] + KL[1] * s[1] + KL[2] * s[2] + KL[3] * s[3]));
      rk4(s, u, 0.04, o, 0); s = o.slice();
      mt = Math.max(mt, Math.abs(s[2])); mx = Math.max(mx, Math.abs(s[0]));
    }
    return Math.abs(s[2]) < 0.03 && mt < 1.2 && mx < 2.6 && Math.abs(wrap(s0[2])) < 0.5;
  }
  var lastSolveMs = 0;
  // plan of the last solve, replayed at the plant rate: u(t) = u_nom(t) + K (x - x_nom(t))
  var plan = { u0: 0, u1: 0, x0: [0, 0, 0, 0], x1: [0, 0, 0, 0], K: [0, 0, 0, 0], fb: false };
  function nmpc(s) {
    var t0 = performance.now(), i, o = [0, 0, 0, 0];
    if ((mpcMode === "i" && Math.abs(wrap(s[2])) < 0.6) || catchable(s)) {
      if (mpcMode === "m") { lqrInit(s); mpcMode = "i"; }
      var s0 = [s[0], s[1], wrap(s[2]), s[3]];
      ilqr(s0, 3);
      plan.fb = true;
      for (i = 0; i < 4; i++) plan.K[i] = Ks[0][i];
      plan.x0 = s0.slice();
    } else {
      mppi(s); mpcMode = "m";
      plan.fb = false;
      plan.x0 = [s[0], s[1], wrap(s[2]), s[3]];
    }
    plan.u0 = U[0]; plan.u1 = U[1];
    rk4(plan.x0, U[0], DTH, o, 0);
    plan.x1 = o.slice();
    for (i = 0; i < NH - 1; i++) U[i] = U[i + 1];
    U[NH - 1] = U[NH - 2];
    lastSolveMs = performance.now() - t0;
  }
  var BLEND0 = 0.35;
  function planU(s, tau) {
    var a = Math.min(1, tau / DTH), u = plan.u0 + (plan.u1 - plan.u0) * a;
    if (plan.fb) {
      var dx = [s[0] - (plan.x0[0] + (plan.x1[0] - plan.x0[0]) * a), s[1] - (plan.x0[1] + (plan.x1[1] - plan.x0[1]) * a),
                wrap(s[2]) - (plan.x0[2] + (plan.x1[2] - plan.x0[2]) * a), s[3] - (plan.x0[3] + (plan.x1[3] - plan.x0[3]) * a)];
      u += plan.K[0] * dx[0] + plan.K[1] * dx[1] + plan.K[2] * dx[2] + plan.K[3] * dx[3];
      // Safeguard near the top: blend in the terminal LQR law (the one the MPC cost is built on), more strongly as the pole tilts,
      // so a hard push is caught as reliably as by the PID and the cart is always pulled back to the centre.
      var th = wrap(s[2]), ul = -(KL[0] * s[0] + KL[1] * s[1] + KL[2] * th + KL[3] * s[3]);
      var wb = Math.max(BLEND0, Math.min(1, (Math.abs(th) - 0.08) / 0.2));
      u = (1 - wb) * u + wb * ul;
    }
    return clampU(u);
  }

  /* ---------- Linear analysis ---------- */
  function linearise() {
    var e = 1e-6, A = [], B = [0, 0, 0, 0], z = [0, 0, 0, 0], i, j, r;
    for (r = 0; r < 4; r++) A.push([0, 0, 0, 0]);
    for (j = 0; j < 4; j++) {
      var xp = z.slice(), xm = z.slice(), op = [0, 0, 0, 0], om = [0, 0, 0, 0];
      xp[j] = e; xm[j] = -e;
      f(xp, 0, op, BD); f(xm, 0, om, BD);
      for (r = 0; r < 4; r++) A[r][j] = (op[r] - om[r]) / (2 * e);
    }
    var o1 = [0, 0, 0, 0], o2 = [0, 0, 0, 0];
    f(z, e, o1, BD); f(z, -e, o2, BD);
    for (i = 0; i < 4; i++) B[i] = (o1[i] - o2[i]) / (2 * e);
    return { A: A, B: B };
  }
  var LIN = linearise();

  // Eigenvalues of a small real matrix: characteristic polynomial (Faddeev-LeVerrier), then Durand-Kerner.
  function eigenvalues(A) {
    var n = A.length, i, j, k, c = new Array(n + 1), Mk = [], I = [], tr;
    for (i = 0; i < n; i++) { Mk.push(new Array(n).fill(0)); I.push(new Array(n).fill(0)); I[i][i] = 1; }
    c[n] = 1;
    for (k = 1; k <= n; k++) {
      var N = [];
      for (i = 0; i < n; i++) {
        N.push([]);
        for (j = 0; j < n; j++) {
          var sm = 0, q;
          for (q = 0; q < n; q++) sm += A[i][q] * Mk[q][j];
          N[i].push(sm + (i === j ? c[n - k + 1] : 0));
        }
      }
      Mk = N; tr = 0;
      for (i = 0; i < n; i++) { var d = 0, q2; for (q2 = 0; q2 < n; q2++) d += A[i][q2] * Mk[q2][i]; tr += d; }
      c[n - k] = -tr / k;
    }
    // polynomial: sum c[i] s^i, monic
    var re = [], im = [];
    for (i = 0; i < n; i++) { var ang = 0.4 + (TWO_PI * i) / n, rad = 1 + Math.abs(c[0]) ** (1 / n); re.push(rad * Math.cos(ang)); im.push(rad * Math.sin(ang)); }
    function evalP(xr, xi) {
      var pr = 1, pi = 0, t;
      for (var d2 = n - 1; d2 >= 0; d2--) { t = pr * xr - pi * xi + c[d2]; pi = pr * xi + pi * xr; pr = t; }
      return [pr, pi];
    }
    for (var it = 0; it < 200; it++) {
      var delta = 0;
      for (i = 0; i < n; i++) {
        var p = evalP(re[i], im[i]), dr = 1, di = 0;
        for (j = 0; j < n; j++) {
          if (j === i) continue;
          var ar = re[i] - re[j], ai = im[i] - im[j], t2 = dr * ar - di * ai;
          di = dr * ai + di * ar; dr = t2;
        }
        var den = dr * dr + di * di || 1e-30;
        var qr = (p[0] * dr + p[1] * di) / den, qi = (p[1] * dr - p[0] * di) / den;
        re[i] -= qr; im[i] -= qi; delta += Math.abs(qr) + Math.abs(qi);
      }
      if (delta < 1e-10) break;
    }
    var out = [];
    for (i = 0; i < n; i++) out.push({ re: re[i], im: Math.abs(im[i]) < 1e-6 ? 0 : im[i] });
    return out;
  }

  // Closed-loop poles of the linearised plant with the PID (+ cart centring) law.
  function pidPoles(gn) {
    var A = LIN.A, B = LIN.B, K = [10, 12, gn.kp, gn.kd], Ac = [], i, j;
    for (i = 0; i < 5; i++) Ac.push([0, 0, 0, 0, 0]);
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) Ac[i][j] = A[i][j] + B[i] * K[j];
      Ac[i][4] = B[i] * gn.ki;
    }
    Ac[4][2] = 1;
    return eigenvalues(Ac);
  }
  // Closed-loop poles of the LQR law that the NMPC converges to near the top.
  function lqrPoles() {
    var A = LIN.A, B = LIN.B, Ac = [], i, j;
    for (i = 0; i < 4; i++) { Ac.push([]); for (j = 0; j < 4; j++) Ac[i].push(A[i][j] - B[i] * KL[j]); }
    return eigenvalues(Ac);
  }
  function openPoles() { return eigenvalues(LIN.A); }

  /* ---------- Simulation object ---------- */
  var PID_RANGE = 0.6;      // rad: the linear law is only applied inside this cone
  var TAU_ACT = 0.012;      // s: first-order actuator lag
  var ALPHA = 1;

  function Sim() {
    this.mode = "pid";
    this.gains = { kp: 70, ki: 5, kd: 18 };
    this.pointer = null;
    this.resetUpright();
  }
  Sim.prototype.resetUpright = function () { this.s = [0, 0, 0.05, 0]; this._reset(); };
  Sim.prototype.resetHanging = function () { this.s = [0, 0, Math.PI + 0.02, 0]; this._reset(); };
  Sim.prototype._reset = function () { this.u = 0; this.uCmd = 0; this.integ = 0; this.tick = 0; this.tau = 0; this.pointer = null; mpcMode = "m"; U.fill(0); this.t = 0; };
  Sim.prototype.setMode = function (mm) { this.mode = mm; this.tick = 0; this.integ = 0; mpcMode = "m"; U.fill(0); };
  Sim.prototype.pidActive = function () { return Math.abs(wrap(this.s[2])) < PID_RANGE; };
  Sim.prototype.phase = function () {
    if (this.mode === "nmpc") return mpcMode === "i" ? "balance" : (Math.abs(wrap(this.s[2])) < 1.2 ? "catch" : "swing");
    return "";
  };
  var o4 = [0, 0, 0, 0];
  Sim.prototype.step = function () {
    var s = this.s, d = 0, gn = this.gains;
    if (this.pointer !== null) {
      var tipX = s[0] + 2 * l * Math.sin(s[2]);
      d = Math.max(-9, Math.min(9, 16 * (this.pointer - tipX)));
    }
    if (this.mode === "pid") {
      if (this.pidActive()) {
        var th = wrap(s[2]);
        this.integ = Math.max(-0.5, Math.min(0.5, this.integ + th * DT));
        this.uCmd = clampU(gn.kp * th + gn.ki * this.integ + gn.kd * s[3] + (10 * s[0] + 12 * s[1]));
      } else { this.uCmd = 0; this.integ = 0; }
    } else if (this.mode === "nmpc") {
      if (this.tick <= 0) { nmpc(s); this.tick = 8; this.tau = 0; }
      this.tick--; this.uCmd = planU(s, this.tau); this.tau += DT;
    } else this.uCmd = 0;
    this.u += (this.uCmd - this.u) * ALPHA;
    rk4(s, this.u, DT, o4, BD);
    s[0] = o4[0]; s[1] = o4[1]; s[2] = o4[2]; s[3] = o4[3] + d * DT;
    if (s[2] > 50 || s[2] < -50) s[2] = wrap(s[2]);
    if (s[0] > XMAX) { s[0] = XMAX; s[1] = Math.min(0, s[1]); }
    if (s[0] < -XMAX) { s[0] = -XMAX; s[1] = Math.max(0, s[1]); }
    this.t += DT;
  };

  var api = { Sim: Sim, wrap: wrap, XMAX: XMAX, DT: DT, UMAX: UMAX, pidPoles: pidPoles, lqrPoles: lqrPoles, openPoles: openPoles,
              lastSolveMs: function () { return lastSolveMs; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PendCore = api;
})(typeof window !== "undefined" ? window : globalThis);
