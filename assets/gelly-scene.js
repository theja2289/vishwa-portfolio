// Gelly start-up scene: the detether cell drawn top down, with the station camera's side view.
// Written by Vishwa Theja Pokala for the Gelly Engine launcher; reused here as the portfolio's opening.
window.makeGellyScene = function (canvasId, reduceMotion) {
  var $ = function (id) { return document.getElementById(id); };
  var scene = (function () {
    var canvas = $(canvasId), ctx = canvas.getContext('2d');
    var W = 1000, H = 660;                     // the scene's own units; fitted into the canvas
    var C = {
      text: 'rgba(200,210,220,0.55)', dim: 'rgba(200,210,220,0.32)', accent: '#4CC2FF', teal: '#00A2B1', ok: '#6CCB5F',
      yellow: '#F4CE14', yellowHi: '#FFE45C', yellowLo: '#C9A300', led: '#FFC768', pcb: '#0D4A2C',
      slideTray: '#1AA3C2', slideTrayHi: '#47C6DF', slideTrayLo: '#0F7F98', steel: '#A7B0B8', black: '#121417',
      gangLight: '#D9B45A', gangMid: '#A27E34', gangDark: '#4A3818', tubeGreen: '#3FCB5A'
    };
    var scale = 1, ox = 0, oy = 0, dpr = 1, compact = false, failed = false, finishing = 0;
    var bg = document.createElement('canvas'), bgDirty = true;   // the still parts of the deck, drawn once per size

    // ---- the deck's layout (scene units)
    var TW = 130, TH = 140;
    var IN = [{ x: 40, y: 96 }, { x: 194, y: 96 }, { x: 40, y: 258 }, { x: 194, y: 258 }];
    var OUT = [{ x: 676, y: 96 }, { x: 830, y: 96 }, { x: 676, y: 258 }, { x: 830, y: 258 }];
    var STATION = { x: 400, y: 96, w: 200, h: 296 };
    // The gang in the nest: its gangbar along the left (jaw) side, its row of springs to the right. The side camera
    // looks along the gang's length, so its picture runs left to right: jaws and gangbar, tethers, springs.
    var NEST = { x: 500, y: 214 };
    var SLIDE_AT = { x: 512.85, y: 214 };        // a slide's centre at first contact: its gel's edge over the tether necks
    var OFFSET = 1.5;                            // the offset move forward, away from the jaws: the gel's edge clears the necks
    // The gangbar's eject path on the deck: the magnet beside the jaws, the comb down from it, the chamber below the nest
    // and the tube from the chamber out of the station. MAG_AT is the gangbar's place on the magnet (the gang's centre).
    var MAGNET = { x: 461, y: 190, w: 12, h: 48 }, MAG_AT = { x: 476.8, y: NEST.y };
    var COMB = { x: 463, y0: 246, y1: 300 };
    var CHAMBER = { x: 500, y: 346, w: 72, h: 40 };
    var TUBE = [{ x: 464, y: 356 }, { x: 432, y: 356 }, { x: 432, y: 402 }];
    var STATION_CAM = { x: 578, y: 122 };
    var INSET = { x: 300, y: 412, w: 400, h: 150 };
    var PARK = { x: 500, y: 70 };
    // The head's tools, from its centre: down camera above, gang spindle in the middle, slide pick on a side arm.
    var CAM = { x: 0, y: -28 }, SPN = { x: 0, y: 0 }, SLD = { x: 38, y: 8 };
    var GANGS_IN = [[1, 1, 0, 1, 1, 1], [1, 1, 1, 0, 1, 1], [0, 1, 1, 1, 0, 1], [1, 0, 1, 1, 1, 0]];

    var gangs = [], slides = [], trays = [], sparks = [], sideSparks = [], marks = [];
    var head = { x: PARK.x, y: PARK.y, z: 0, vac: 0, carry: null, slide: null };
    // The station on the deck: the gang in the nest, its gangbar (bar: 1 while there), the lower jaw's clamp (0 open,
    // 1 clamped), the jaws' stroke (-1 down .. 1 up), the gel-contact glow, and the eject: the magnet's pull (mag), the
    // gangbar's centre, size and opacity on its way to the chamber (bx, by, bs, ba), the air puff (0..1) and the
    // gangbar's run along the tube (slug, 0..1; -1 while it is not in the tube).
    var station = { gang: null, bar: 0, jaw: 0, stroke: 0, pulse: 0, mag: 0, bx: 0, by: 0, bs: 1, ba: 1, puff: 0, slug: -1 };
    // The station camera's side view: the gang's height above its seat (gangY, negative while it is lowered in), the
    // pick needle (rod), the slide's pose (left edge of its gel, angle), the tethers broken, the jaws (clamp, stroke, open for
    // the eject), whether the springs now ride on the gel, the gel-contact glow, and the eject: the gangbar's move from
    // the jaws (ejX, ejY), gone once it is out through the tube, the magnet's pull, the air puff and the camera's zoom
    // out to show the chamber (0 on the jaws .. 1 out).
    var side = { gang: false, gangY: 0, rod: 0, slide: null, broken: 0, jaw: 0, stroke: 0, open: 0, onGel: false, contact: 0, active: 0, phase: '',
      ejX: 0, ejY: 0, barGone: false, mag: 0, puff: 0, zoom: 0 };
    var scanFx = null, readFx = null, reticle = null;
    var action = 'HOME', clock = 0, slideNo = 1931, done = 0, fade = 1;

    // Small deterministic random numbers, so every start looks the same and the layout never jitters.
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    function reset() {
      seed = 7;
      gangs = []; slides = []; trays = []; marks = [];
      var n = 0;
      IN.forEach(function (t, ti) {
        trays.push({ scanned: false });
        for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
          var cell = cellCentre(t, r, c), ang = (rnd() - 0.5) * 0.7, dx = (rnd() - 0.5) * 10;
          if (GANGS_IN[ti][r * 3 + c]) gangs.push({ tray: ti, r: r, c: c, x: cell.x + dx, y: cell.y, ang: ang, n: ++n, picked: false, seen: 0 });
        }
      });
      OUT.forEach(function (t, ti) {
        for (var k = 0; k < 3; k++) slides.push({ tray: ti, k: k, x: t.x + 22 + k * 43, y: t.y + 70, id: 'G00' + (slideNo + slides.length), out: false, mark: false });
      });
      station.gang = null; station.bar = 0; station.jaw = 0; station.stroke = 0; station.pulse = 0;
      side.gang = false; side.slide = null; side.onGel = false; side.broken = 0; side.jaw = 0; side.stroke = 0; side.open = 0;
      resetEject();
    }
    // The eject's parts back at rest: the gangbar in the jaws, the magnet off, no puff, the camera on the jaws.
    function resetEject() {
      station.mag = 0; station.bx = NEST.x; station.by = NEST.y; station.bs = 1; station.ba = 1; station.puff = 0; station.slug = -1;
      side.ejX = 0; side.ejY = 0; side.barGone = false; side.mag = 0; side.puff = 0; side.zoom = 0;
    }
    function cellCentre(t, r, c) { return { x: t.x + 7 + c * 40 + 18, y: t.y + 7 + r * 65 + 30.5 }; }
    function pad(n) { return ('0' + n).slice(-2); }

    // ---- motion: generator steps fed the frame time (s)
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function* tween(dur, fn) { var t = 0; fn(0); while (t < dur) { t += yield; fn(ease(Math.min(1, t / dur))); } }
    function* wait(s) { var t = 0; while (t < s) t += yield; }
    function* moveTo(x, y) {
      var sx = head.x, sy = head.y, d = Math.hypot(x - sx, y - sy);
      yield* tween(0.18 + d / 1400, function (k) { head.x = lerp(sx, x, k); head.y = lerp(sy, y, k); });
    }
    function* moveTool(tool, x, y) { yield* moveTo(x - tool.x, y - tool.y); }
    function* zTo(z) { var s = head.z; yield* tween(0.17, function (k) { head.z = lerp(s, z, k); }); }
    // Several steps at once (the slide moving while the jaws stroke, say): done when all are.
    function* all() {
      var gens = Array.prototype.slice.call(arguments), live = gens.slice();
      live.forEach(function (g) { g.next(); });
      while (live.length) { var dt = yield; live = live.filter(function (g) { return !g.next(dt).done; }); }
    }
    function* later(s, gen) { yield* wait(s); yield* gen; }

    function burst(list, x, y, n, speed, life, colour) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
        list.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: life, max: life, c: colour });
      }
    }

    // The camera sweeps the tray once, marking each gang as the scan line passes it.
    function* scanTray(ti) {
      var t = IN[ti], y = t.y + TH / 2, x0 = t.x + 10, x1 = t.x + TW - 10;
      yield* moveTool(CAM, x0, y);
      scanFx = { tray: ti, x: x0 };
      yield* tween(1.0, function (k) {
        var x = lerp(x0, x1, k);
        head.x = x - CAM.x; scanFx.x = x;
        gangs.forEach(function (g) { if (g.tray === ti && !g.seen && x >= g.x) g.seen = clock; });
      });
      scanFx = null;
      trays[ti].scanned = true;
    }

    // The slide in the side view: pose = left edge of its gel strip (lx, ly: the gel's underside) and its angle a.
    function pose(a, b, k) { return { lx: lerp(a.lx, b.lx, k), ly: lerp(a.ly, b.ly, k), a: lerp(a.a, b.a, k) }; }
    // The side camera looks along the gang's length, so its picture is across the slide (25 mm; 10 side units a mm):
    // the jaws holding the gangbar, the tether necks, the 5 mm row of springs on the nest, and over them the slide with
    // its 10 mm gel strip along the jaw-side edge. First contact puts the gel's edge at the jaws (over the necks); the
    // offset moves it 1.5 mm forward (right, away from the jaws) so the gel holds the springs only and the necks and gangbar are free.
    // The slide comes straight down from above for first contact, then its only sideways move is the offset FORWARD
    // (to the right, away from the jaws); after the detether it lifts straight up and away.
    var P_OUT = { lx: 153, ly: -40, a: 0 }, P_NEAR = { lx: 153, ly: 92, a: 0 }, P_CONTACT = { lx: 153, ly: 106.2, a: 0 },
      P_RAISE = { lx: 153, ly: 99, a: 0 }, P_SHIFT = { lx: 168, ly: 99, a: 0 }, P_SET = { lx: 168, ly: 106.2, a: 0 },
      P_LIFT = { lx: 168, ly: 88, a: 0 }, P_AWAY = { lx: 168, ly: -40, a: 0 };
    // The side view's parts (its units): gangbar (a thin bar; its 0.65 mm drawn a little wider to read), the necks,
    // the springs' row, the nest's top face, the jaws and the stroke. The camera looks a little down along the row,
    // so the springs farther away sit a little higher and to the right (DEPTH).
    var SV = { bar0: 146, bar1: 152.5, barTop: 107.5, neck1: 157, spring1: 207, base: 112, jaw0: 128, stroke: 6, front: 111.4 };
    var DEPTH = { x: 6, y: 5 };
    // The eject path in the side view, left of the jaws: the magnet (red) above it, the comb's row of teeth under the
    // magnet, the chamber past the comb's end with its funnel and the tube going down out of the picture, and the air
    // nozzle on the chamber's wall. EJ holds the gangbar's moves from the jaws: out to the magnet, across the comb to
    // over the chamber, its rest in the chamber's throat, and down the tube.
    var SMAG = { x: 92, y: 89, w: 32, h: 16.5 };
    var SCOMB = { x0: 111, x1: 127, tip: 110, base: 115, pitch: 2.6 };
    var SCH = { x0: 83, x1: 111, top: 112, neck: 124, t0: 93, t1: 103, throat: 131 };
    var EJ = { magX: -17, combX: -51, lift: -2, restY: 17, outY: 64 };
    // The camera's two framings (translate, scale): on the jaws and springs, and zoomed out to the eject chamber.
    var CAM_NEAR = { x: -300, y: -218, s: 2.7 }, CAM_FAR = { x: -126, y: -130, s: 2.0 };
    // The springs: SPRINGS on the real gang, drawn as ROWS lines (each stands for SPRINGS / ROWS). Each jaw stroke
    // breaks one and a half rows; ORDER scatters the breaks along the row, as on the tool.
    var SPRINGS = 96, ROWS = 12, ORDER = [5, 10, 1, 8, 3, 11, 7, 0, 9, 2, 6, 4], STROKES = 8;
    function rowBroken(j) { return ORDER.indexOf(j) < side.broken / (SPRINGS / ROWS); }
    // A row's place: its depth (0 front .. 1 back) shifts it right and up.
    function rowAt(j) { var d = j / (ROWS - 1); return { dx: d * DEPTH.x, y: SV.front - d * DEPTH.y }; }
    // The gangbar's height now: the jaws' stroke (up is toward smaller y) and the gang's lowering into the nest.
    function barDy() { return -side.stroke * SV.stroke + side.gangY; }
    // One jaw stroke has ended: two more rows of tethers break, a few small sparks at their necks (side view and deck).
    function breakTethers() {
      var before = side.broken;
      side.broken = Math.min(SPRINGS, side.broken + SPRINGS / STROKES);
      for (var j = 0; j < ROWS; j++) {
        var rank = ORDER.indexOf(j), per = SPRINGS / ROWS;
        if (rank >= before / per && rank < side.broken / per) {
          var r = rowAt(j);
          burst(sideSparks, SV.bar1 + 2.5 + r.dx, r.y + barDy(), 5, 22, 0.35, 'rgba(255,226,242,A)');
        }
      }
      burst(sparks, NEST.x - 2.4, NEST.y + (Math.random() - 0.5) * 36, 3, 28, 0.35, 'rgba(255,220,236,A)');
    }

    // A point k (0..1) of the way along the deck's eject tube, by length.
    function tubePoint(k) {
      var lens = [], total = 0;
      for (var i = 1; i < TUBE.length; i++) { var l = Math.hypot(TUBE[i].x - TUBE[i - 1].x, TUBE[i].y - TUBE[i - 1].y); lens.push(l); total += l; }
      var d = k * total;
      for (var j = 0; j < lens.length; j++) {
        if (d <= lens[j] || j === lens.length - 1) {
          var f = Math.min(1, d / lens[j]);
          return { x: lerp(TUBE[j].x, TUBE[j + 1].x, f), y: lerp(TUBE[j].y, TUBE[j + 1].y, f) };
        }
        d -= lens[j];
      }
    }

    // The eject, step by step, on the deck and in the side view together.
    function* ejectGangbar() {
      action = 'EJECT GANGBAR';
      // MAGNET: the jaws open, the magnet comes on and draws the gangbar out of them toward itself; the camera zooms out.
      side.phase = 'MAGNET';
      yield* tween(0.25, function (k) { side.open = k; side.jaw = 1 - k; station.jaw = 1 - k; side.mag = k; station.mag = k; side.zoom = k * 0.5; });
      yield* tween(0.4, function (k) {
        side.ejX = EJ.magX * k; side.ejY = EJ.lift * k; side.zoom = 0.5 + k * 0.5;
        station.bx = lerp(NEST.x, MAG_AT.x, k);
      });
      // COMB: on along the comb, the gangbar riding its teeth (a small tick at each), stripped free of the neck stubs.
      side.phase = 'COMB';
      var tooth = SCOMB.x1;
      yield* tween(0.5, function (k) {
        side.ejX = lerp(EJ.magX, EJ.combX, k);
        var left = SV.bar0 + side.ejX, over = left < SCOMB.x1 && left + (SV.bar1 - SV.bar0) > SCOMB.x0;
        side.ejY = EJ.lift + (over ? -0.35 * Math.abs(Math.sin((left - SCOMB.x0) / SCOMB.pitch * Math.PI)) : 0);
        while (tooth > SCOMB.x0 && left < tooth) {
          burst(sideSparks, tooth, SCOMB.tip, 2, 14, 0.25, 'rgba(255,236,200,A)');
          tooth -= SCOMB.pitch * 2;
        }
        station.by = lerp(NEST.y, CHAMBER.y - 20, k);
      });
      // CHAMBER: the magnet lets go and the gangbar drops into the chamber below.
      side.phase = 'CHAMBER';
      var y0 = side.ejY, by0 = station.by;
      yield* tween(0.35, function (k) {
        side.mag = station.mag = 1 - k;
        side.ejY = lerp(y0, EJ.restY, k);
        station.by = lerp(by0, CHAMBER.y, k); station.bs = 1 - 0.3 * k; station.ba = 1 - 0.35 * k;
      });
      yield* wait(0.05);
      // AIR PUFF: a short burst of air from the nozzle and the gangbar shoots out through the tube.
      side.phase = 'AIR PUFF  EJECT';
      burst(sideSparks, SCH.x1 - 3, SCH.top + 4, 8, 30, 0.3, 'rgba(210,250,255,A)');
      burst(sparks, CHAMBER.x + CHAMBER.w / 2 - 8, CHAMBER.y - 6, 6, 26, 0.3, 'rgba(210,250,255,A)');
      var ba0 = station.ba;
      yield* tween(0.45, function (k) {
        side.puff = k; station.puff = k;
        side.ejY = lerp(EJ.restY, EJ.outY, Math.max(0, (k - 0.15) / 0.85));
        station.ba = ba0 * Math.max(0, 1 - k * 4);
        station.slug = k;
      });
      burst(sparks, TUBE[TUBE.length - 1].x, TUBE[TUBE.length - 1].y, 5, 22, 0.3, 'rgba(210,250,255,A)');
      side.barGone = true; station.bar = 0; station.slug = -1;
      yield* tween(0.15, function (k) { side.open = 1 - k; side.puff = 0; station.puff = 0; });
    }

    function* cycle() {
      for (;;) {
        reset();
        yield* tween(0.5, function (k) { fade = k; });
        for (var i = 0; i < slides.length; i++) {
          var g = gangs[i], s = slides[i], label = 'GANG ' + pad(g.n);
          if (!trays[g.tray].scanned) { action = 'SCAN  TRAY ' + (g.tray + 1); yield* scanTray(g.tray); }

          // Pick the gang: the spindle comes down, vacuum on, up; the gang turns square on the way to the station.
          action = 'PICK  ' + label + '  TRAY ' + (g.tray + 1) + ' R' + (g.r + 1) + 'C' + (g.c + 1);
          reticle = { x: g.x, y: g.y, t: clock };
          yield* moveTool(SPN, g.x, g.y);
          yield* zTo(1);
          head.vac = 1; yield* wait(0.1);
          g.picked = true; head.carry = g; reticle = null;
          yield* zTo(0);
          action = 'PLACE  ' + label + '  DETETHER STATION';
          var a0 = g.ang;
          yield* all(moveTool(SPN, NEST.x, NEST.y), tween(0.55, function (k) { g.ang = a0 * (1 - k); }));
          // Into the nest: the springs on the nest, the gangbar between the open jaws, the tethers whole.
          side.gang = true; side.rod = 1; side.onGel = false; side.open = 0; side.jaw = 0; side.stroke = 0; resetEject();
          side.broken = 0; side.contact = 0;
          yield* all(zTo(1), tween(0.25, function (k) { side.gangY = -70 * (1 - k); }));
          head.vac = 0; head.carry = null; station.gang = g; station.bar = 1;
          yield* all(zTo(0), tween(0.25, function (k) { side.rod = 1 - k; }));

          // The slide: its label read, then picked gel side down and carried to the station.
          action = 'READ  SLIDE ' + s.id;
          yield* moveTool(CAM, s.x - 6, s.y + 37.5);
          readFx = { x: s.x - 6, y: s.y + 37.5, t: clock, id: s.id };
          yield* wait(0.35);
          action = 'PICK  SLIDE ' + s.id + '  TRAY ' + (s.tray + 1) + ' S' + (s.k + 1);
          yield* moveTool(SLD, s.x, s.y);
          yield* zTo(1);
          head.vac = 2; yield* wait(0.08);
          s.out = true; head.slide = s; readFx = null;
          yield* zTo(0);
          action = 'LOAD  SLIDE ' + s.id;
          yield* moveTool(SLD, SLIDE_AT.x, SLIDE_AT.y);

          // DETETHER, in the tool's order: contact, offset, clamp, jaw strokes, eject the gangbar, lift.
          action = 'DETETHER  ' + label + '  >  ' + s.id;
          side.slide = pose(P_OUT, P_OUT, 0);
          yield* tween(0.25, function (k) { side.active = Math.max(side.active, k); });
          side.phase = 'APPROACH';
          yield* all(zTo(0.7), tween(0.5, function (k) { side.slide = pose(P_OUT, P_NEAR, k); }));
          // First contact: the gel comes down onto the springs, its edge at the jaws (over the tether necks).
          side.phase = 'CONTACT';
          yield* all(zTo(1), tween(0.4, function (k) { side.slide = pose(P_NEAR, P_CONTACT, k); }));
          yield* tween(0.4, function (k) { side.contact = Math.sin(k * Math.PI); station.pulse = k; });
          station.pulse = 0;
          // Offset: up a little, 1.5 mm forward (to the right, away from the jaws), down again; the gel now holds the springs only.
          side.phase = 'OFFSET';
          yield* all(zTo(0.85), tween(0.25, function (k) { side.slide = pose(P_CONTACT, P_RAISE, k); }));
          yield* all(moveTool(SLD, SLIDE_AT.x + OFFSET, SLIDE_AT.y), tween(0.4, function (k) { side.slide = pose(P_RAISE, P_SHIFT, k); }));
          yield* all(zTo(1), tween(0.25, function (k) { side.slide = pose(P_SHIFT, P_SET, k); }));
          yield* tween(0.25, function (k) { side.contact = Math.sin(k * Math.PI) * 0.7; });
          // The lower jaw comes up and clamps the gangbar against the upper jaw.
          action = 'JAWS  BREAK TETHERS';
          side.phase = 'CLAMP';
          yield* tween(0.3, function (k) { side.jaw = k; station.jaw = k; });
          // Jaw strokes, up and down: the necks bend; at the end of each stroke more of them break.
          side.phase = 'BREAK TETHERS';
          var from = 0;
          for (var b = 0; b < STROKES; b++) {
            var to = b % 2 === 0 ? 1 : -1;
            yield* tween(b === 0 ? 0.18 : 0.23, function (k) { side.stroke = lerp(from, to, k); station.stroke = side.stroke; });
            from = to;
            breakTethers();
          }
          yield* tween(0.15, function (k) { side.stroke = lerp(from, 0, k); station.stroke = side.stroke; });
          // Eject the empty gangbar (the springs stay on the gel): the jaws open and the magnet captures it, draws it out
          // and across the comb, whose teeth strip it free; it drops down into the chamber and an air puff blows it out
          // through the tube. The side camera zooms out to follow it.
          yield* ejectGangbar();
          // Lift: the slide comes up with the springs on its gel; the side camera closes in again.
          action = 'LIFT  SLIDE ' + s.id;
          side.phase = 'LIFT';
          side.onGel = true; station.gang = null; s.mark = true;
          yield* all(zTo(0.3), tween(0.5, function (k) { side.slide = pose(P_SET, P_LIFT, k); side.zoom = 1 - k; }));
          side.phase = 'DETETHERED';
          yield* wait(0.2);

          // Home with the slide, the springs now on its gel.
          action = 'RETURN SLIDE';
          yield* all(
            (function* () {
              yield* all(zTo(0), tween(0.4, function (k) { side.slide = pose(P_LIFT, P_AWAY, k); }));
              side.slide = null; side.gang = false;
              yield* moveTool(SLD, s.x, s.y);
              yield* zTo(1);
              head.vac = 0; s.out = false; head.slide = null;
              yield* zTo(0);
            })(),
            later(0.5, tween(0.5, function (k) { side.active = Math.min(side.active, 1 - k); })));
          side.phase = '';
          done++;
        }
        action = 'TRAYS DONE  ' + slides.length + ' SLIDES';
        yield* moveTo(PARK.x, PARK.y);
        yield* wait(1.4);
        yield* tween(0.5, function (k) { fade = 1 - k; });
        slideNo += slides.length;
        done = 0;
      }
    }

    var job = cycle();
    job.next();

    // ---- drawing helpers
    function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function mono(size, bold) { return (bold ? '600 ' : '') + size + 'px "Cascadia Mono", Consolas, monospace'; }
    function grad(x0, y0, x1, y1, stops) { var g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); }); return g; }
    function brackets(x, y, w, h, l) {
      ctx.beginPath();
      ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y);
      ctx.moveTo(x + w - l, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + l);
      ctx.moveTo(x + w, y + h - l); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - l, y + h);
      ctx.moveTo(x + l, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - l);
      ctx.stroke();
    }
    // A 2D (Data Matrix style) code: an L finder, a dotted clock edge and fixed data cells, as one path of 1-unit squares.
    var CODE = (function () {
      var p = new Path2D(), bits = [0x5A, 0x2D, 0x76, 0x1B, 0x6C, 0x35];
      for (var i = 0; i < 8; i++) { p.rect(0, i, 1, 1); p.rect(i, 7, 1, 1); if (i % 2 === 0) { p.rect(i, 0, 1, 1); p.rect(7, i + 1, 1, 1); } }
      for (var r = 0; r < 6; r++) for (var c = 0; c < 6; c++) if (bits[r] >> c & 1) p.rect(c + 1, r + 1, 1, 1);
      return p;
    })();
    function code(x, y, size, colour) { ctx.save(); ctx.translate(x, y); ctx.scale(size / 8, size / 8); ctx.fillStyle = colour; ctx.fill(CODE); ctx.restore(); }

    // ---- the still deck (cached): bed, rails, LED boards and gang trays, slide trays, the station
    function drawBed() {
      rrect(20, 20, 960, 550, 16); ctx.fillStyle = grad(0, 20, 0, 570, ['#1A1F24', '#111518']); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); rrect(20, 20, 960, 550, 16); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.beginPath();
      for (var x = 40; x < 980; x += 40) { ctx.moveTo(x, 20); ctx.lineTo(x, 570); }
      for (var y = 40; y < 570; y += 40) { ctx.moveTo(20, y); ctx.lineTo(980, y); }
      ctx.stroke(); ctx.restore();
      // The gantry's X rails along the back of the deck, with the encoder scale.
      ctx.fillStyle = grad(0, 32, 0, 60, ['#2A3138', '#1A1F24']); ctx.fillRect(30, 32, 940, 26);
      ctx.strokeStyle = 'rgba(170,185,200,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30, 37); ctx.lineTo(970, 37); ctx.moveTo(30, 53); ctx.lineTo(970, 53); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(170,185,200,0.22)'; ctx.beginPath();
      for (var t = 40; t <= 960; t += 10) { var l = t % 100 === 40 ? 6 : 3; ctx.moveTo(t, 53); ctx.lineTo(t, 53 - l); }
      ctx.stroke();
      // Tray holders: pinned black plates with their position numbers, as on the tool.
      IN.concat(OUT).forEach(function (t, i) {
        rrect(t.x - 12, t.y - 12, TW + 24, TH + 24, 8); ctx.fillStyle = '#0B0D0F'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.stroke();
      });
    }

    function drawLedBoard(t) {
      var x = t.x - 10, y = t.y - 10, w = TW + 20, h = TH + 20;
      ctx.fillStyle = C.pcb; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(120,220,160,0.12)'; ctx.lineWidth = 0.6; ctx.beginPath();
      for (var i = 0; i < 8; i++) { ctx.moveTo(x, y + 15 + i * 21); ctx.lineTo(x + w, y + 15 + i * 21); }
      ctx.stroke();
      ctx.save(); ctx.shadowColor = 'rgba(255,170,60,0.9)'; ctx.shadowBlur = 6; ctx.fillStyle = C.led;
      for (var r = 0; r < 8; r++) for (var c = 0; c < 7; c++) ctx.fillRect(x + 4 + c * 23.5, y + 3 + r * 21.5, 5, 5);
      ctx.restore();
    }

    function drawGangTray(t, i) {
      drawLedBoard(t);
      // A warm halo of the backlight around the tray.
      ctx.save(); ctx.shadowColor = 'rgba(255,175,70,0.55)'; ctx.shadowBlur = 18;
      rrect(t.x, t.y, TW, TH, 4); ctx.fillStyle = C.yellow; ctx.fill(); ctx.restore();
      rrect(t.x, t.y, TW, TH, 4); ctx.fillStyle = grad(t.x, t.y, t.x + TW, t.y + TH, ['#FFE14A', C.yellow, '#E9BE0C']); ctx.fill();
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
        var cx = t.x + 7 + c * 40, cy = t.y + 7 + r * 65;
        // The cell floor: the yellow plastic lit from below, the LEDs showing through as soft warm spots.
        rrect(cx, cy, 36, 61, 2); ctx.fillStyle = '#F7D52A'; ctx.fill();
        ctx.save(); rrect(cx, cy, 36, 61, 2); ctx.clip();
        for (var ly = 0; ly < 3; ly++) for (var lx = 0; lx < 2; lx++) {
          var px = cx + 9 + lx * 18, py = cy + 10 + ly * 21, g = ctx.createRadialGradient(px, py, 0, px, py, 13);
          g.addColorStop(0, 'rgba(255,248,214,0.55)'); g.addColorStop(1, 'rgba(255,248,214,0)');
          ctx.fillStyle = g; ctx.fillRect(px - 13, py - 13, 26, 26);
        }
        ctx.fillStyle = grad(cx, cy, cx, cy + 6, ['rgba(150,110,0,0.35)', 'rgba(150,110,0,0)']); ctx.fillRect(cx, cy, 36, 6);
        ctx.restore();
        ctx.strokeStyle = 'rgba(160,120,0,0.5)'; ctx.lineWidth = 1; rrect(cx, cy, 36, 61, 2); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,248,200,0.6)'; ctx.lineWidth = 1; rrect(t.x + 0.5, t.y + 0.5, TW - 1, TH - 1, 4); ctx.stroke();
      // The tray's barcode label, as on the real trays ("T002 612").
      ctx.fillStyle = '#F4F5F2'; ctx.fillRect(t.x + 6, t.y + TH - 1, 46, 11);
      code(t.x + 8, t.y + TH + 0.5, 8, '#1B1E21');
      ctx.fillStyle = '#2A2E33'; ctx.font = mono(6); ctx.fillText('T002 ' + (612 + i), t.x + 19, t.y + TH + 7);
    }

    function drawSlideTray(t) {
      ctx.fillStyle = 'rgba(160,190,205,0.10)'; ctx.fillRect(t.x - 10, t.y - 10, TW + 20, TH + 20);   // the glass box under it
      ctx.strokeStyle = 'rgba(200,225,235,0.14)'; ctx.lineWidth = 1; ctx.strokeRect(t.x - 9.5, t.y - 9.5, TW + 19, TH + 19);
      rrect(t.x, t.y, TW, TH, 5); ctx.fillStyle = grad(t.x, t.y, t.x + TW, t.y + TH, [C.slideTrayHi, C.slideTray, '#168FAE']); ctx.fill();
      ctx.strokeStyle = 'rgba(210,245,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      for (var k = 0; k < 3; k++) {
        var px = t.x + 5 + k * 43;
        rrect(px, t.y + 18, 34, 104, 3); ctx.fillStyle = grad(px, 0, px + 34, 0, ['#0A5367', '#0D6A80', '#0A5367']); ctx.fill();
        ctx.fillStyle = 'rgba(0,40,55,0.35)'; ctx.fillRect(px, t.y + 18, 34, 4);
        ctx.fillStyle = 'rgba(0,50,65,0.55)'; ctx.fillRect(px + 13, t.y + 14, 8, 6);   // the finger notch
      }
    }

    function drawStationBase() {
      var s = STATION;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
      rrect(s.x, s.y, s.w, s.h, 10); ctx.fillStyle = C.black; ctx.fill(); ctx.restore();
      rrect(s.x, s.y, s.w, s.h, 10); ctx.fillStyle = grad(s.x, s.y, s.x, s.y + s.h, ['#1E2226', '#121417']); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(200,210,220,0.45)'; ctx.font = mono(10); ctx.textAlign = 'center';
      ctx.fillText('DETETHER STATION', s.x + s.w / 2, s.y + s.h - 10); ctx.textAlign = 'left';
      [[s.x + 12, s.y + 12], [s.x + s.w - 12, s.y + 12], [s.x + 12, s.y + s.h - 12], [s.x + s.w - 12, s.y + s.h - 12]].forEach(function (p) {
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2); ctx.fillStyle = '#3A4148'; ctx.fill();
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.3, 0, Math.PI * 2); ctx.fillStyle = '#16191C'; ctx.fill();
      });
      // The X-Y stage: a machined aluminium plate, the gang's nest in its middle.
      rrect(458, 132, 92, 172, 5); ctx.fillStyle = grad(458, 132, 550, 304, ['#B9C1C8', '#8D969E', '#A3ACB4']); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath();
      for (var y = 138; y < 300; y += 6) { ctx.moveTo(460, y); ctx.lineTo(548, y); }
      ctx.stroke();
      rrect(NEST.x - 7, NEST.y - 27, 14, 54, 2); ctx.fillStyle = '#2B3036'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
      // The gangbar's eject path: the red magnet beside the jaws, the comb's teeth down from it, the eject chamber below
      // the nest (chevrons pointing down into it) and the tube from the chamber out of the station.
      rrect(MAGNET.x, MAGNET.y, MAGNET.w, MAGNET.h, 2); ctx.fillStyle = grad(MAGNET.x, 0, MAGNET.x + MAGNET.w, 0, ['#8E2A31', '#C23B44', '#7A2229']); ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,148,0.55)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(MAGNET.x + 2, MAGNET.y + 3, 1.5, MAGNET.h - 6);
      ctx.fillStyle = '#3A4148'; ctx.fillRect(COMB.x, COMB.y0, 3, COMB.y1 - COMB.y0);
      ctx.strokeStyle = '#59636C'; ctx.lineWidth = 1; ctx.beginPath();
      for (var ty = COMB.y0 + 2; ty < COMB.y1; ty += 4) { ctx.moveTo(COMB.x + 3, ty); ctx.lineTo(COMB.x + 9, ty); }
      ctx.stroke();
      var ch = CHAMBER, cl = ch.x - ch.w / 2, ct = ch.y - ch.h / 2;
      ctx.strokeStyle = '#3A4148'; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.beginPath();
      TUBE.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.stroke();
      ctx.strokeStyle = '#07090A'; ctx.lineWidth = 4; ctx.stroke(); ctx.lineJoin = 'miter';
      rrect(cl, ct, ch.w, ch.h, 6); ctx.fillStyle = '#07090A'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(242,198,97,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (var c = 0; c < 2; c++) { ctx.moveTo(ch.x + 8, ct + 8 + c * 7); ctx.lineTo(ch.x + 16, ct + 14 + c * 7); ctx.lineTo(ch.x + 24, ct + 8 + c * 7); }
      ctx.stroke();
      // The air nozzle on the chamber's right wall.
      ctx.fillStyle = '#59636C'; ctx.fillRect(cl + ch.w - 3, ch.y - 9, 5, 6);
      ctx.fillStyle = 'rgba(242,198,97,0.55)'; ctx.font = mono(8); ctx.textAlign = 'center'; ctx.fillText('EJECT', ch.x + 16, ct + ch.h - 7); ctx.textAlign = 'left';
      // The station camera, looking at the nest from the side.
      rrect(STATION_CAM.x - 11, STATION_CAM.y - 9, 22, 18, 3); ctx.fillStyle = '#23282D'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(STATION_CAM.x - 11, STATION_CAM.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#0A0D10'; ctx.fill(); ctx.strokeStyle = '#59636C'; ctx.stroke();
    }

    function drawBandLabels() {
      ctx.font = mono(11);
      ctx.fillStyle = C.yellow; ctx.fillRect(40, 426, 9, 9);
      ctx.fillStyle = C.text; ctx.fillText('INPUT  GANG TRAYS', 56, 435);
      ctx.fillStyle = C.slideTray; ctx.fillRect(951, 426, 9, 9);
      ctx.textAlign = 'right'; ctx.fillStyle = C.text; ctx.fillText('OUTPUT  SLIDE TRAYS', 944, 435); ctx.textAlign = 'left';
    }

    function drawStatic() {
      drawBed();
      IN.forEach(drawGangTray);
      OUT.forEach(drawSlideTray);
      drawStationBase();
      drawBandLabels();
      // Position numbers on the holders' corner tabs, as engraved on the tool.
      IN.concat(OUT).forEach(function (t, i) {
        rrect(t.x - 14, t.y - 14, 15, 15, 3); ctx.fillStyle = '#0B0D0F'; ctx.fill();
        ctx.fillStyle = 'rgba(210,218,226,0.6)'; ctx.font = mono(10); ctx.fillText(String(i % 4 + 1), t.x - 10, t.y - 3);
      });
    }

    // ---- the moving parts
    // A gang, top down, its centre at (x, y): 35 mm long (y), 5.5 mm wide. Along its left side the gangbar (0.65 mm,
    // drawn a little wider to read) with its row of holes; from it, on tiny tether necks, the dense row of S-shaped
    // springs. parts: GANG_SPRINGS, GANG_BAR or both (the default).
    var GANG_SPRINGS = 1, GANG_BAR = 2, GL = 45.5, G_BAR0 = -3.8, G_BAR1 = -2.2, G_NECK = -1.6, G_END = 3.6;
    function drawGang(x, y, ang, a, lift, parts) {
      if (a <= 0) return;
      parts = parts || GANG_SPRINGS | GANG_BAR;
      var h = GL / 2;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(ang);
      if (lift) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(G_BAR0 + lift * 4, -h + lift * 5, G_END - G_BAR0, GL); }
      if (parts & GANG_SPRINGS) {
        ctx.fillStyle = 'rgba(162,126,52,0.55)'; ctx.fillRect(G_NECK, -h, G_END - G_NECK, GL);
        ctx.strokeStyle = C.gangLight; ctx.lineWidth = 0.42; ctx.beginPath();
        for (var sy = -h + 0.7; sy < h; sy += 1.25) {
          ctx.moveTo(G_NECK, sy); ctx.bezierCurveTo(0, sy - 0.9, 1.4, sy + 0.9, G_END, sy);
        }
        ctx.stroke();
      }
      if (parts & GANG_BAR) {
        ctx.fillStyle = grad(G_BAR0, 0, G_BAR1, 0, [C.gangDark, C.gangMid, C.gangDark]); ctx.fillRect(G_BAR0, -h - 1.5, G_BAR1 - G_BAR0, GL + 3);
        ctx.fillStyle = 'rgba(20,14,4,0.75)';
        for (var hy = -h; hy < h + 1; hy += 2.6) ctx.fillRect(G_BAR0 + 0.45, hy - 0.35, 0.7, 0.7);
        if (parts & GANG_SPRINGS) { ctx.fillStyle = 'rgba(255,170,210,0.55)'; ctx.fillRect(G_BAR1, -h, G_NECK - G_BAR1, GL); }
      }
      ctx.restore();
    }

    // A glass lab slide (25 x 75 mm), centre (x, y): clear glass, the 10 x 40 mm gel strip along its left (jaw-side)
    // edge and centred along its length, the white label at the near end (clear of the gel) with its 2D code and text.
    // A detethered slide carries the gang's springs on its gel.
    var SL_W = 32.5, SL_H = 97.5, GEL = { x: 0.8, y: 22.75, w: 13, h: 52 }, LABEL = { y: 77, h: 18.5 };
    // Where the springs sit on a detethered slide's gel (from its top left), as the station set them down: on the
    // middle of the gel, so a slide at the station (SLIDE_AT) has its gel centred on the gang in the nest.
    var GEL_GANG = { x: 2.4, y: SL_H / 2 };
    function drawSlide(x, y, s, lift) {
      var l = x - SL_W / 2, t = y - SL_H / 2;
      if (lift) { ctx.fillStyle = 'rgba(0,0,0,' + (0.18 + lift * 0.2).toFixed(3) + ')'; rrect(l + 3 + lift * 7, t + 4 + lift * 9, SL_W, SL_H, 2); ctx.fill(); }
      rrect(l, t, SL_W, SL_H, 2); ctx.fillStyle = 'rgba(225,242,248,0.22)'; ctx.fill();
      ctx.strokeStyle = 'rgba(240,252,255,0.9)'; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(l + SL_W - 3.2, t + 2, 1.2, SL_H - 4);
      var gx = l + GEL.x, gy = t + GEL.y;
      rrect(gx, gy, GEL.w, GEL.h, 3); ctx.fillStyle = grad(gx, gy, gx + GEL.w, gy + GEL.h, ['rgba(120,235,240,0.6)', 'rgba(0,162,177,0.5)', 'rgba(0,140,155,0.62)']); ctx.fill();
      ctx.strokeStyle = 'rgba(150,240,248,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
      if (s.mark) {
        // The gang's springs, now on the gel (the gangbar went out through the eject tube).
        drawGang(l + GEL_GANG.x, t + GEL_GANG.y, 0, 1, 0, GANG_SPRINGS);
        ctx.strokeStyle = 'rgba(160,240,250,0.55)'; ctx.lineWidth = 0.7; ctx.strokeRect(l + GEL_GANG.x + G_NECK - 1, t + GEL_GANG.y - GL / 2 - 1, G_END - G_NECK + 2, GL + 2);
      }
      var ly = t + LABEL.y;
      ctx.fillStyle = '#ECEFF1'; ctx.fillRect(l + 2, ly, SL_W - 4, LABEL.h);
      code(l + 5, ly + 3.75, 11, '#1B1E21');
      ctx.fillStyle = '#7C858D'; ctx.fillRect(l + 18, ly + 4, 10, 1.5); ctx.fillRect(l + 18, ly + 8, 7, 1.5); ctx.fillRect(l + 18, ly + 12, 9, 1.5);
    }

    function drawTraysLive() {
      ctx.save(); ctx.globalAlpha = fade;
      gangs.forEach(function (g) {
        if (g.picked) return;
        drawGang(g.x, g.y, g.ang, 1, 0);
        if (g.seen) {
          // Found by the camera: green corner brackets, bright for a moment, then quiet.
          var k = Math.min(1, (clock - g.seen) / 0.25), a = k * (0.45 + 0.55 * Math.max(0, 1 - (clock - g.seen - 0.6) / 0.8));
          ctx.save(); ctx.globalAlpha *= a; ctx.translate(g.x, g.y); ctx.rotate(g.ang);
          ctx.strokeStyle = C.ok; ctx.lineWidth = 1.2; brackets(-8, -25, 16, 50, 5);
          ctx.restore();
        }
      });
      slides.forEach(function (s) { if (!s.out) drawSlide(s.x, s.y, s, 0); });
      ctx.restore();
      if (reticle) {
        var p = (clock - reticle.t) % 0.8 / 0.8;
        ctx.strokeStyle = 'rgba(76,194,255,' + (0.9 - p * 0.6).toFixed(3) + ')'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(reticle.x, reticle.y, 9 + p * 10, 0, Math.PI * 2); ctx.stroke();
      }
      if (readFx) {
        // The label read: a box over the 2D code and the slide id it decoded.
        var k = Math.min(1, (clock - readFx.t) / 0.2);
        ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = C.accent; ctx.lineWidth = 1.4; brackets(readFx.x - 14, readFx.y - 14, 28, 28, 6);
        rrect(readFx.x - 32, readFx.y + 18, 64, 15, 3); ctx.fillStyle = 'rgba(8,20,30,0.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(76,194,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#BFE9FF'; ctx.font = mono(9); ctx.textAlign = 'center'; ctx.fillText(readFx.id, readFx.x, readFx.y + 29); ctx.textAlign = 'left';
        ctx.restore();
      }
    }

    function drawStationLive() {
      // The gang in the nest: its springs (they leave on the slide's gel) and its gangbar, which goes to the chute
      // once the tethers are broken.
      if (station.gang) drawGang(NEST.x, NEST.y, 0, 1, 0, GANG_SPRINGS);
      if (station.mag > 0) {
        // The magnet on: a red glow around it and its field reaching for the gangbar.
        ctx.save(); ctx.globalAlpha = station.mag;
        ctx.shadowColor = 'rgba(255,80,90,0.9)'; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(255,120,128,0.85)'; ctx.lineWidth = 1.2;
        rrect(MAGNET.x - 1, MAGNET.y - 1, MAGNET.w + 2, MAGNET.h + 2, 3); ctx.stroke();
        ctx.shadowBlur = 0; ctx.setLineDash([2, 2.5]); ctx.lineDashOffset = -clock * 12; ctx.strokeStyle = 'rgba(255,150,158,0.6)'; ctx.lineWidth = 0.8;
        var fx = MAGNET.x + MAGNET.w, bx = station.bx - 3.8;
        if (bx > fx + 1) {
          ctx.beginPath();
          [-14, 0, 14].forEach(function (d) { ctx.moveTo(fx, station.by + d); ctx.quadraticCurveTo((fx + bx) / 2, station.by + d * 1.4, bx, station.by + d); });
          ctx.stroke();
        }
        ctx.restore();
      }
      if (station.bar && station.ba > 0) {
        ctx.save(); ctx.translate(station.bx, station.by); ctx.scale(station.bs, station.bs);
        // On its way out the thin gangbar gets a warm glow, so it reads at deck scale.
        if (station.bx !== NEST.x) { ctx.shadowColor = 'rgba(255,214,120,0.9)'; ctx.shadowBlur = 6; }
        drawGang(0, 0, 0, station.ba, 0, GANG_BAR);
        ctx.restore();
      }
      if (station.slug >= 0) {
        // The gangbar blown along the tube: a bright slug with a short trail.
        for (var tr = 0; tr < 4; tr++) {
          var tp = tubePoint(Math.max(0, station.slug - tr * 0.05));
          ctx.beginPath(); ctx.arc(tp.x, tp.y, 2.4 - tr * 0.4, 0, Math.PI * 2); ctx.fillStyle = tr ? 'rgba(217,180,90,' + (0.5 - tr * 0.12).toFixed(3) + ')' : C.gangLight; ctx.fill();
        }
      }
      if (station.puff > 0 && station.puff < 1) {
        // The air puff: short white-cyan lines from the nozzle across the chamber.
        var pk = station.puff, nx0 = CHAMBER.x + CHAMBER.w / 2 - 4, ny0 = CHAMBER.y - 6;
        ctx.save(); ctx.globalAlpha = Math.sin(pk * Math.PI); ctx.strokeStyle = 'rgba(215,250,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath();
        [-5, 0, 5].forEach(function (d) { var x0 = nx0 - 4 - pk * 18, y0 = ny0 + d * (0.6 + pk); ctx.moveTo(x0, y0); ctx.lineTo(x0 - 8 - pk * 10, y0 + d * 0.3); });
        ctx.stroke(); ctx.restore();
      }
      // The upper jaw over the gangbar, the length of the gang: it moves in as the lower jaw clamps, back to let the
      // gangbar go, and its strokes show as it rising (bigger, longer shadow) and dropping.
      var jx = NEST.x + G_BAR1 - 0.6 - (1 - station.jaw) * 4, up = station.stroke * 0.5;
      ctx.save(); ctx.translate(jx - 7, NEST.y); ctx.scale(1 + up * 0.06, 1 + up * 0.03);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-7 + 2 + up * 2, -28 + 2 + up * 2, 14, 56);
      rrect(-7, -28, 14, 56, 2); ctx.fillStyle = grad(-7, 0, 7, 0, ['#1A1D21', '#3A4048', '#24282D']); ctx.fill();
      ctx.strokeStyle = 'rgba(154,140,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#AEB6BD'; ctx.fillRect(4.5, -25, 2.5, 50);
      ctx.restore();
      if (station.pulse > 0) {
        // First contact: a teal glow spreading from the nest as the gel meets the springs.
        var p = station.pulse;
        ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI);
        var rg = ctx.createRadialGradient(NEST.x, NEST.y, 2, NEST.x, NEST.y, 30 + p * 30);
        rg.addColorStop(0, 'rgba(0,162,177,0.55)'); rg.addColorStop(1, 'rgba(0,162,177,0)');
        ctx.fillStyle = rg; ctx.fillRect(NEST.x - 70, NEST.y - 70, 140, 140); ctx.restore();
      }
    }

    // The slide on the slide pick (under the head), its shadow growing as it rises.
    function drawCarriedSlide() {
      if (head.slide) drawSlide(head.x + SLD.x, head.y + SLD.y, head.slide, 0.25 + (1 - head.z) * 0.75);
    }

    // The gantry: the Y arm hanging from the rail carriage, vacuum tubes along it, the head with its three tools.
    function drawHead() {
      var x = head.x, y = head.y, z = head.z, up = 1 - z;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 12 + 6, 60, 24, y - 100);
      ctx.fillStyle = grad(x - 12, 0, x + 12, 0, ['#1C2228', '#2C343C', '#1A1F24']); ctx.fillRect(x - 12, 40, 24, y - 80);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 12, 40); ctx.lineTo(x - 12, y - 40); ctx.moveTo(x + 12, 40); ctx.lineTo(x + 12, y - 40); ctx.stroke();
      rrect(x - 26, 29, 52, 32, 5); ctx.fillStyle = '#262D34'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
      // Green and white vacuum tubes down the arm to the spindle.
      [[C.tubeGreen, 16], ['#E6E8EA', 20]].forEach(function (tb) {
        ctx.strokeStyle = tb[0]; ctx.lineWidth = 2.2; ctx.beginPath();
        ctx.moveTo(x + 10, 46); ctx.bezierCurveTo(x + tb[1] + 6, 80, x + tb[1], y - 60, x + 6, y - 12); ctx.stroke();
      });
      // The head, a little larger (nearer the eye) and casting a wider shadow when it is up.
      ctx.save(); ctx.translate(x, y); var sc = 1 + up * 0.05; ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrect(-21 + 5 + up * 6, -47 + 6 + up * 8, 42, 92, 8); ctx.fill();
      rrect(-21, -47, 42, 92, 8); ctx.fillStyle = grad(-21, 0, 21, 0, ['#14171A', '#22272C', '#121417']); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();
      // Down camera: ring light and lens; the ring lights up while the camera looks.
      var looking = !!(scanFx || readFx);
      ctx.beginPath(); ctx.arc(CAM.x, CAM.y, 13, 0, Math.PI * 2); ctx.fillStyle = '#0D0F11'; ctx.fill();
      ctx.save(); if (looking) { ctx.shadowColor = '#E8F7FF'; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(CAM.x, CAM.y, 11, 0, Math.PI * 2); ctx.strokeStyle = looking ? '#F2FBFF' : '#9AA3AA'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(CAM.x, CAM.y, 6.5, 0, Math.PI * 2); ctx.fillStyle = grad(-6, CAM.y - 6, 6, CAM.y + 6, ['#25445C', '#081018']); ctx.fill();
      ctx.beginPath(); ctx.arc(CAM.x - 2, CAM.y - 2, 1.8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(180,225,255,0.7)'; ctx.fill();
      // Gang pick spindle: collet and needle; a teal vacuum ring while it holds.
      ctx.beginPath(); ctx.arc(SPN.x, SPN.y, 8, 0, Math.PI * 2); ctx.fillStyle = grad(-8, -8, 8, 8, ['#D7DDE2', '#7E878F']); ctx.fill();
      ctx.beginPath(); ctx.arc(SPN.x, SPN.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#2A2F34'; ctx.fill();
      // Slide pick: a side arm out to a pad with two vacuum cups.
      ctx.fillStyle = grad(0, SLD.y - 5, 0, SLD.y + 5, ['#2C3339', '#1A1E22']); ctx.fillRect(18, SLD.y - 5, SLD.x - 18, 10);
      rrect(SLD.x - 8, SLD.y - 14, 16, 28, 3); ctx.fillStyle = '#2E353C'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.stroke();
      [-7, 7].forEach(function (d) { ctx.beginPath(); ctx.arc(SLD.x, SLD.y + d, 3.6, 0, Math.PI * 2); ctx.fillStyle = head.vac === 2 ? C.teal : '#5C666F'; ctx.fill(); });
      ctx.restore();
      if (head.carry) drawGang(x + SPN.x, y + SPN.y, head.carry.ang, 0.95, up);
      if (head.vac) {
        var tool = head.vac === 2 ? SLD : SPN, r = (head.vac === 2 ? 15 : 11) + Math.sin(clock * 12) * 1.5;
        ctx.beginPath(); ctx.arc(x + tool.x, y + tool.y, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,162,177,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.beginPath(); ctx.arc(x + tool.x, y + tool.y, r + 5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,162,177,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    // The camera's scan across a tray: the band it has looked at and its bright line (light, so over the head too).
    function drawScan() {
      if (!scanFx) return;
      var t = IN[scanFx.tray];
      var b = ctx.createLinearGradient(t.x, 0, scanFx.x, 0);
      b.addColorStop(0, 'rgba(40,150,255,0)'); b.addColorStop(1, 'rgba(40,150,255,0.38)');
      ctx.fillStyle = b; ctx.fillRect(t.x - 4, t.y - 6, scanFx.x - t.x + 4, TH + 12);
      ctx.save(); ctx.shadowColor = C.accent; ctx.shadowBlur = 10; ctx.strokeStyle = '#C8EEFF'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(scanFx.x, t.y - 8); ctx.lineTo(scanFx.x, t.y + TH + 8); ctx.stroke(); ctx.restore();
    }

    // Sparks as small squares; size in the current units (the side view is zoomed, so its sparks are drawn smaller).
    function drawSparks(list, size) {
      var d = size || 1.8;
      list.forEach(function (s) {
        ctx.fillStyle = s.c.replace('A', (s.life / s.max).toFixed(3));
        ctx.fillRect(s.x - d / 2, s.y - d / 2, d, d);
      });
    }

    // ---- the station camera: a side view of the nest under the deck, live through the whole cycle
    function slidePoint(sl, lx, ly) {   // a point in the slide's frame (x along the gel from its left end, y down) to the view
      var c = Math.cos(sl.a), s = Math.sin(sl.a);
      return { x: sl.lx + lx * c + ly * s, y: sl.ly - lx * s + ly * c };
    }
    function drawInset() {
      var I = INSET, act = side.active;
      ctx.save(); ctx.translate(I.x, I.y);
      // Frame, glowing teal while the detether runs.
      ctx.save(); ctx.shadowColor = 'rgba(0,162,177,' + (0.7 * act).toFixed(3) + ')'; ctx.shadowBlur = 18 * act;
      rrect(0, 0, I.w, I.h, 10); ctx.fillStyle = '#0A0D10'; ctx.fill(); ctx.restore();
      ctx.save(); rrect(0, 0, I.w, I.h, 10); ctx.clip();
      ctx.fillStyle = grad(0, 0, 0, I.h, ['#181E23', '#0E1215']); ctx.fillRect(0, 0, I.w, I.h);
      // The camera's zoom: the side view's own units at 2.7 x on the jaws, necks and springs (the slide runs out of the
      // picture to the right); for the eject it zooms out to take in the magnet, comb and chamber left of the jaws.
      var zk = ease(Math.min(1, Math.max(0, side.zoom)));
      ctx.save(); ctx.translate(lerp(CAM_NEAR.x, CAM_FAR.x, zk), lerp(CAM_NEAR.y, CAM_FAR.y, zk)); ctx.scale(lerp(CAM_NEAR.s, CAM_FAR.s, zk), lerp(CAM_NEAR.s, CAM_FAR.s, zk));
      // Behind the nest: dark machine parts, softly out of focus.
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(196, 76, 30, 24); ctx.fillRect(232, 82, 24, 20);
      // The nest (aluminium) under the springs, and its two screws.
      ctx.fillStyle = grad(0, SV.base, 0, SV.base + 40, ['#B8C0C7', '#7D868E', '#5E666D']); ctx.fillRect(SV.neck1 - 1, SV.base, 260, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(SV.neck1 - 1, SV.base, 260, 1);
      [222, 246].forEach(function (sx) {
        ctx.beginPath(); ctx.arc(sx, 126, 5, 0, Math.PI * 2); ctx.fillStyle = '#9AA3AB'; ctx.fill(); ctx.strokeStyle = '#5A6168'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.beginPath(); ctx.arc(sx, 126, 1.6, 0, Math.PI * 2); ctx.fillStyle = '#3B4147'; ctx.fill();
      });
      // Left of the jaws, the eject path: the station body with the chamber cut into it (its funnel and the tube going
      // down out of the picture), the air nozzle on the chamber's wall, the comb's row of teeth and the magnet over them.
      ctx.fillStyle = grad(0, SCOMB.base, 0, SCOMB.base + 45, ['#2A3036', '#161A1E']); ctx.fillRect(40, SCOMB.base, SCOMB.x1 - 40, 45);
      ctx.beginPath();
      ctx.moveTo(SCH.x0, SCH.top); ctx.lineTo(SCH.x0, SCH.neck); ctx.lineTo(SCH.t0, SCH.throat); ctx.lineTo(SCH.t0, 170);
      ctx.lineTo(SCH.t1, 170); ctx.lineTo(SCH.t1, SCH.throat); ctx.lineTo(SCH.x1, SCH.neck); ctx.lineTo(SCH.x1, SCH.top);
      ctx.fillStyle = '#06080A'; ctx.fill(); ctx.strokeStyle = 'rgba(170,185,200,0.45)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = '#59636C'; ctx.fillRect(SCH.x1 - 3.5, SCH.top + 2, 3.5, 2.6);
      ctx.fillStyle = '#7D868E'; ctx.fillRect(SCOMB.x0, SCOMB.base, SCOMB.x1 - SCOMB.x0, 1.6);
      ctx.beginPath();
      for (var cx = SCOMB.x0; cx + SCOMB.pitch <= SCOMB.x1 + 0.01; cx += SCOMB.pitch) {
        ctx.moveTo(cx, SCOMB.base); ctx.lineTo(cx + SCOMB.pitch / 2, SCOMB.tip); ctx.lineTo(cx + SCOMB.pitch, SCOMB.base);
      }
      ctx.fillStyle = '#A7B0B8'; ctx.fill();
      ctx.save();
      if (side.mag > 0) { ctx.shadowColor = 'rgba(255,70,80,' + (0.9 * side.mag).toFixed(3) + ')'; ctx.shadowBlur = 8 * side.mag; }
      rrect(SMAG.x, SMAG.y, SMAG.w, SMAG.h, 2); ctx.fillStyle = grad(SMAG.x, SMAG.y, SMAG.x, SMAG.y + SMAG.h, ['#B0343D', '#6A2328', '#3E1417']); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(232,96,104,' + (0.55 + 0.45 * side.mag).toFixed(3) + ')'; ctx.lineWidth = 1; rrect(SMAG.x, SMAG.y, SMAG.w, SMAG.h, 2); ctx.stroke();
      var dy = barDy(), sl = side.slide;
      // A point that rides with the slide once the springs are on its gel (relative to where it set down).
      function onSlide(x, y) { return side.onGel && sl ? slidePoint(sl, x - P_SET.lx, y - P_SET.ly) : { x: x, y: y }; }
      // A spring's S shape from (x0, y0) to (x1, y1), seen a little from above (the S flattened).
      function sCurve(x0, y0, x1, y1) { ctx.bezierCurveTo(lerp(x0, x1, 0.35), lerp(y0, y1, 0.35) - 0.8, lerp(x0, x1, 0.65), lerp(y0, y1, 0.65) + 0.8, x1, y1); }
      if (side.gang) {
        // The gangbar's move on the eject (out to the magnet, across the comb, down the chamber and tube); the comb's
        // teeth strip the broken neck stubs off it as it crosses them.
        var ex = side.ejX, ey = side.ejY, stubs = !side.barGone && SV.bar0 + ex > SCOMB.x1;
        // The springs, back rows first. The gel holds every spring flat and still (clamped down hard); only the gangbar
        // moves with the jaw strokes, so only the tiny tether necks flex between the moving bar and the still spring
        // until they fatigue and break. A broken neck leaves a small stub on the bar.
        for (var j = ROWS - 1; j >= 0; j--) {
          var r = rowAt(j), y = r.y + side.gangY, broken = rowBroken(j), shade = 0.55 + 0.45 * (1 - j / (ROWS - 1));
          // nx, ny: the neck's end on the gangbar (it moves with the bar); sx: the spring's root, which never moves.
          var sx = SV.bar1 + r.dx, nx = sx + ex, ny = r.y + dy + ey, e = onSlide(SV.spring1 + r.dx, y);
          var springColour = 'rgba(232,196,110,' + shade.toFixed(3) + ')', neckColour = 'rgba(255,150,205,' + (0.5 + 0.5 * shade).toFixed(3) + ')';
          ctx.lineWidth = 0.42;
          if (!broken) {
            // The spring itself never moves: from its root just past the neck to its far end.
            var root = onSlide(sx + 2.5, y);
            ctx.strokeStyle = springColour; ctx.beginPath(); ctx.moveTo(root.x, root.y); sCurve(root.x, root.y, e.x, e.y); ctx.stroke();
            // The neck: from the moving gangbar to the still spring root, so it alone tilts with each stroke.
            ctx.lineWidth = 0.7; ctx.strokeStyle = neckColour; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(root.x, root.y); ctx.stroke();
          } else {
            var a0 = onSlide(sx + 2.2, y);
            ctx.strokeStyle = springColour; ctx.beginPath(); ctx.moveTo(a0.x, a0.y); sCurve(a0.x, a0.y, e.x, e.y); ctx.stroke();
            if (stubs) { ctx.strokeStyle = neckColour; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + 1.1, ny + 0.4); ctx.stroke(); }
          }
        }
        // The gangbar: a thin bar along the gang (seen end on), held between the jaws until the magnet takes it.
        if (!side.barGone) {
          var bx = SV.bar0 + ex, by = SV.barTop + dy + ey, bw = SV.bar1 - SV.bar0, bh = SV.base - SV.barTop;
          if (side.mag > 0.02) {
            // The magnet's pull: while the gangbar is still away from it, a few soft field lines arc from the magnet's
            // face to the bar, drifting toward the magnet; once it holds the bar, a red glow where they meet.
            ctx.save(); ctx.globalAlpha = side.mag;
            var face = SMAG.x + SMAG.w;
            if (bx > face - 2) {
              ctx.setLineDash([1.6, 1.4]); ctx.lineDashOffset = clock * 6;
              ctx.strokeStyle = 'rgba(255,150,160,0.95)'; ctx.lineWidth = 0.55; ctx.beginPath();
              [0.3, 0.6, 0.9].forEach(function (f, i) {
                var y0 = SMAG.y + SMAG.h * f, x1 = bx + bw / 2, y1 = by + bh * (0.15 + 0.35 * i);
                ctx.moveTo(face, y0); ctx.quadraticCurveTo((face + x1) / 2, Math.min(y0, y1) - 3 + i * 3.5, x1, y1);
              });
              ctx.stroke();
            }
            ctx.shadowColor = 'rgba(255,70,80,0.9)'; ctx.shadowBlur = 6; ctx.fillStyle = 'rgba(255,120,130,0.55)';
            if (bx < face) ctx.fillRect(Math.max(bx, SMAG.x), by - 0.6, Math.min(bx + bw, face) - Math.max(bx, SMAG.x), 0.6);
            ctx.restore();
          }
          ctx.fillStyle = grad(0, by, 0, by + bh, [C.gangLight, C.gangMid, C.gangDark]);
          ctx.fillRect(bx, by, bw, bh);
        }
        if (side.puff > 0 && side.puff < 1) {
          // The air puff: short white-cyan lines from the nozzle down across the chamber after the gangbar.
          var pk = side.puff;
          ctx.save(); ctx.globalAlpha = Math.sin(pk * Math.PI); ctx.strokeStyle = 'rgba(215,250,255,0.95)'; ctx.lineWidth = 0.5; ctx.beginPath();
          [-2.2, 0, 2.2].forEach(function (d) {
            var x0 = SCH.x1 - 4 - pk * 6 + d * 0.5, y0 = SCH.top + 5 + pk * 8 + d;
            ctx.moveTo(x0, y0); ctx.lineTo(x0 - 4 - pk * 3, y0 + 3 + pk * 3);
          });
          ctx.stroke(); ctx.restore();
        }

        if (side.rod > 0) {
          // The pick needle holding the gang while it lowers it into the nest.
          ctx.fillStyle = grad(176, 0, 188, 0, ['#8C959C', '#E1E6EA', '#8C959C']); ctx.fillRect(177, 20, 10, 87 + side.gangY - (1 - side.rod) * 40);
        }
      }
      // The jaws: upper over the gangbar, lower under it (it comes up to clamp); clamped, they stroke together.
      var jdy = side.jaw > 0 ? -side.stroke * SV.stroke : 0;
      var uy = SV.barTop + jdy - side.open * 8, ly2 = SV.base + jdy + (1 - side.jaw) * 16;
      function jaw(y0, y1, edge) {
        ctx.fillStyle = grad(0, y0, 0, y1, ['#2E333A', '#121417']); ctx.fillRect(SV.jaw0, y0, SV.bar1 - SV.jaw0, y1 - y0);
        ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.strokeRect(SV.jaw0 + 0.5, y0 + 0.5, SV.bar1 - SV.jaw0 - 1, y1 - y0 - 1);
      }
      jaw(uy - 16, uy, 'rgba(154,140,255,0.6)');
      jaw(ly2, ly2 + 13, 'rgba(76,141,255,0.6)');
      // The slide: glass (1 mm thick, 25 mm across) with its 10 mm gel strip under the jaw-side edge.
      if (sl) {
        ctx.save(); ctx.translate(sl.lx, sl.ly); ctx.rotate(-sl.a);
        ctx.fillStyle = grad(0, -4, 0, 0, ['rgba(60,220,232,0.95)', 'rgba(0,150,165,0.95)']); ctx.fillRect(0, -4, 100, 4);
        ctx.fillStyle = grad(0, -14, 0, -4, ['rgba(225,245,252,0.45)', 'rgba(170,215,230,0.22)']); ctx.fillRect(0, -14, 250, 10);
        ctx.strokeStyle = 'rgba(240,252,255,0.9)'; ctx.lineWidth = 0.8; ctx.strokeRect(0, -14, 250, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(0, -13, 250, 0.8);
        ctx.restore();
        if (side.contact > 0) {
          // Gel meets springs: a teal line along the contact.
          var cx0 = Math.max(sl.lx, SV.bar1 + 1);
          ctx.save(); ctx.globalAlpha = side.contact; ctx.shadowColor = C.teal; ctx.shadowBlur = 10;
          ctx.fillStyle = '#5FE6F2'; ctx.fillRect(cx0, sl.ly - 0.6, SV.spring1 + DEPTH.x - cx0, 1.4); ctx.restore();
        }
      }
      drawSparks(sideSparks, 0.75);
      ctx.restore();
      // Vignette and camera text.
      var v = ctx.createRadialGradient(I.w / 2, I.h / 2, I.h * 0.4, I.w / 2, I.h / 2, I.w * 0.62);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, I.w, I.h);
      // Camera text on small dark plates, so it reads over the slide as it passes.
      function plate(x, y, w) { rrect(x, y, w, 15, 3); ctx.fillStyle = 'rgba(6,9,12,0.72)'; ctx.fill(); }
      plate(6, 6, 116);
      ctx.font = mono(10); ctx.fillStyle = 'rgba(220,230,238,0.75)'; ctx.fillText('STATION CAM  SIDE', 12, 17);
      if (act > 0.01) {
        ctx.globalAlpha = act;
        plate(I.w - 84, 6, 50);
        if (side.phase) { ctx.font = mono(12, true); plate(6, 24, ctx.measureText(side.phase).width + 12); }
        if (Math.floor(clock * 2) % 2 === 0) { ctx.beginPath(); ctx.arc(I.w - 76, 13.5, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#FF5A64'; ctx.fill(); }
        ctx.font = mono(10); ctx.fillStyle = 'rgba(255,200,205,0.85)'; ctx.fillText('LIVE', I.w - 68, 17);
        if (side.phase) {
          ctx.font = mono(12, true); ctx.fillStyle = side.phase === 'DETETHERED' ? C.ok : '#7FE3EC';
          ctx.fillText(side.phase, 12, 36);
        }
        if (side.gang) {
          var txt = 'TETHERS BROKEN ' + side.broken + '/' + SPRINGS;
          // Bottom right, clear of the eject chamber on the left.
          ctx.font = mono(10); var tw = ctx.measureText(txt).width;
          plate(I.w - tw - 18, I.h - 22, tw + 12);
          ctx.fillStyle = side.broken >= SPRINGS ? C.ok : 'rgba(255,214,234,0.92)'; ctx.fillText(txt, I.w - tw - 12, I.h - 11);
        }
        // The jaws' stroke: a short track, its marker at the jaws' height while they clamp.
        if (side.jaw > 0.01) {
          ctx.globalAlpha = act * side.jaw;
          ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(I.w - 19, 34, 4, 56);
          ctx.fillStyle = '#9A8CFF'; ctx.fillRect(I.w - 23, 60 - side.stroke * 24, 12, 4);
          ctx.font = mono(9); ctx.fillStyle = 'rgba(220,230,238,0.6)'; ctx.fillText('JAW', I.w - 27, 104);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      rrect(0.5, 0.5, I.w - 1, I.h - 1, 10); ctx.strokeStyle = act > 0.01 ? 'rgba(0,162,177,' + (0.25 + 0.65 * act).toFixed(3) + ')' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
      // While it runs, a line from the station's camera to its picture.
      if (act > 0.01) {
        ctx.save(); ctx.globalAlpha = act * 0.6; ctx.setLineDash([3, 4]); ctx.strokeStyle = C.teal; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(STATION_CAM.x, STATION_CAM.y + 9); ctx.lineTo(STATION_CAM.x, INSET.y); ctx.stroke();
        ctx.restore();
      }
    }

    // Axis readout and the current action, as the tool's DRO would show them: a strip under the deck. On a narrow
    // screen (a phone) the action is larger and the axes go on a second line, so both stay readable.
    function drawReadout() {
      var X = (head.x - 46) * 0.32, Y = (566 - head.y) * 0.32, Z = -head.z * 12.5;
      rrect(20, 584, 960, 64, 10); ctx.fillStyle = 'rgba(10,13,16,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(44, compact ? 604 : 616, compact ? 7 : 4, 0, Math.PI * 2); ctx.fillStyle = finishing ? C.ok : C.accent; ctx.fill();
      var axes = [['X', X], ['Y', Y], ['Z', Z]];
      if (compact) {
        ctx.font = mono(24, true); ctx.fillStyle = '#E2EAF0'; ctx.fillText(action, 62, 612);
        axes.forEach(function (a, i) {
          var tx = 62 + i * 250;
          ctx.font = mono(19); ctx.fillStyle = C.accent; ctx.fillText(a[0], tx, 640);
          ctx.fillStyle = '#C9D3DB'; ctx.fillText((a[1] < 0 ? '' : ' ') + a[1].toFixed(2), tx + 18, 640);
        });
        return;
      }
      ctx.font = mono(13); ctx.fillStyle = '#C9D3DB'; ctx.fillText(action, 60, 621);
      axes.forEach(function (a, i) {
        var tx = 556 + i * 140;
        ctx.font = mono(12); ctx.fillStyle = C.accent; ctx.fillText(a[0], tx, 621);
        ctx.font = mono(19); ctx.fillStyle = '#E8EEF2'; ctx.fillText((a[1] < 0 ? '' : ' ') + a[1].toFixed(3), tx + 14, 622);
      });
      ctx.font = mono(10); ctx.fillStyle = C.text; ctx.fillText('mm', 958 - 14, 621);
    }

    function drawCounters() {
      ctx.font = mono(10); ctx.fillStyle = C.dim;
      var left = gangs.filter(function (g) { return !g.picked; }).length;
      ctx.fillText('GANGS LEFT ' + pad(left), 56, 452);
      ctx.textAlign = 'right'; ctx.fillText('DETETHERED ' + pad(done) + '/' + slides.length, 944, 452); ctx.textAlign = 'left';
    }

    // ---- frame
    function resize() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      scale = Math.min(r.width / W, r.height / H) * 0.96;
      ox = (r.width - W * scale) / 2;
      oy = (r.height - H * scale) / 2;
      compact = scale < 0.62;
      bgDirty = true;
      if (reduceMotion) draw();
    }
    function sceneTransform(c) { c.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy); }

    function draw() {
      if (bgDirty) {
        bg.width = canvas.width; bg.height = canvas.height;
        var main = ctx;
        ctx = bg.getContext('2d');
        sceneTransform(ctx);
        drawStatic();
        ctx = main;
        bgDirty = false;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bg, 0, 0);
      sceneTransform(ctx);
      drawTraysLive();
      drawStationLive();
      drawCounters();
      drawInset();
      drawCarriedSlide();
      drawHead();
      drawScan();
      drawSparks(sparks);
      drawReadout();
      if (finishing) {
        // Ready: a soft green pulse around the station.
        var a = Math.max(0, 1 - (clock - finishing) / 0.9);
        rrect(STATION.x - 4, STATION.y - 4, STATION.w + 8, STATION.h + 8, 12);
        ctx.strokeStyle = 'rgba(108,203,95,' + (0.8 * a).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.stroke();
      }
    }

    function stepSparks(list, dt) {
      for (var i = list.length - 1; i >= 0; i--) {
        var s = list[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt; s.vx *= 0.94;
        if (s.life <= 0) list.splice(i, 1);
      }
    }

    function step(dt) {
      clock += dt;
      job.next(dt);
      stepSparks(sparks, dt);
      stepSparks(sideSparks, dt);
    }

    var last = 0;
    function frame(t) {
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      if (!failed) step(dt);
      draw();
      requestAnimationFrame(frame);
    }

    // Reduced motion: one still frame of the tool mid-run (the second gang's jaws mid-stroke, some tethers broken).
    function still() {
      for (var n = 0; n < 12000; n++) {
        step(1 / 60);
        if (done >= 1 && side.phase === 'BREAK TETHERS' && side.broken >= SPRINGS / 2 && side.stroke > 0.9) break;
      }
    }

    window.addEventListener('resize', resize);
    resize();
    if (reduceMotion) { still(); draw(); }
    else requestAnimationFrame(frame);

    return {
      setFailed: function (f) { failed = f; if (reduceMotion) draw(); },
      finish: function () { finishing = clock || 0.001; action = 'READY'; if (reduceMotion) draw(); }
    };
  })();

  return scene;
};
