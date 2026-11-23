// Startdatei: baut die Teile zusammen, führt die Zeichenschleife und stellt die Konsolen-Schnittstelle window.sim bereit.
// Gerechnet wird nicht hier: Den Takt der Simulation gibt sim-driver.js vor, unabhängig vom Zeichnen.
// Neben controls.js die einzige Datei, die Elemente der Seite beim Namen kennt.
(function (Disk) {
'use strict';

const $ = id => document.getElementById(id);

function fail(msg) { $('failText').textContent = msg; $('fail').hidden = false; }

function start() {
  const canvas = $('view'), hudCanvas = $('hud');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) { fail('Dieser Browser stellt kein WebGL2 bereit. Öffne die Datei in einer aktuellen Version von Firefox, Chrome, Edge oder Safari.'); return; }
  if (!gl.getExtension('EXT_color_buffer_float')) { fail('Die Grafikkarte kann nicht in Gleitkomma-Texturen rechnen (EXT_color_buffer_float fehlt). Ohne sie lässt sich die Physik nicht auf der GPU ausführen.'); return; }

  const C = Disk.constants;
  const P = Disk.createParams(location.search);

  // Der Kern rechnet und misst in seinem eigenen Takt, auch ganz ohne Darstellung. Alles Weitere hier hängt sich
  // an ihn an und zeigt nur, was er liefert.
  let run, renderer;
  try {
    run = new Disk.Experiment(gl, P, {
      onReset: () => {
        readout.showCloudSpin(run.cloudSpin);
        tracker.release();
        history.clear();
        camera.auto = true;
        renderer.invalidate();
      },
      onSnapshot: snap => { renderer.setAxis(axis, diagnostics.plane); tracker.sync(snap); },   // Kamera nachführen
      onCompact: moved => tracker.remap(moved),
      onMeasured: (stats, record) => { if (record) history.push(sim.time, stats); },
      onStop: () => controls.showPaused(true),
    });
    renderer = new Disk.Renderer(gl, canvas);
  } catch (err) {
    console.error(err);
    fail('Die Shader ließen sich auf dieser Grafikkarte nicht übersetzen. Einzelheiten stehen in der Browserkonsole.');
    return;
  }
  const sim = run.sim, diagnostics = run.diagnostics, driver = run.driver;
  const axis = diagnostics.axis;                     // Richtung der Scheibenachse, von der Auswertung fortgeschrieben
  const camera = new Disk.Camera();
  const tracker = new Disk.BodyTracker(camera, axis);
  const hud = new Disk.Hud(hudCanvas);
  const history = new Disk.HistoryChart($('chart'));
  const orbitChart = new Disk.OrbitChart($('orbits'), $('tip'), $('bodiesNote'), toggleFollow);
  const readout = new Disk.Readout({
    inc: $('rInc'), ecc: $('rEcc'), hr: $('rHr'), bodies: $('rBodies'), slots: $('rSlots'), planets: $('rPlanets'),
    biggest: $('rBig'), L: $('rL'), accreted: $('rAcc'), orbits: $('rOrb'), fps: $('rFps'), rate: $('rRate'),
    time: $('rTime'), dt: $('rDt'), steps: $('rSteps'),
    spinNote: $('spinNote'), bodiesEmpty: $('bodiesEmpty'), bodiesFull: $('bodiesFull'), bodyList: $('bodyList'), bodiesPanel: $('bodies'),
  }, history, orbitChart, toggleFollow);
  if (innerWidth < 760) $('bodies').open = false;
  const controls = new Disk.Controls(P, {
    restart: resume => { reset(); if (resume) setPaused(false); },
    togglePause: () => setPaused(!run.paused),
    viewFromAbove,
    invalidateTrails: () => renderer.invalidate(),
    releaseFollow: () => tracker.release(),
    saveDump: () => { dumpRequested = true; },   // gespeichert wird nach dem nächsten Bild, solange es noch auf der Zeichenfläche steht
  });
  const pointer = new Disk.PointerInput(canvas, {
    drag: (dx, dy) => { camera.drag(dx, dy); renderer.invalidate(); },
    zoom: factor => { camera.zoom(factor); renderer.invalidate(); },
    click: (x, y) => { const hit = grownAt(x, y); if (hit) toggleFollow(hit.body); else pickRadius(x, y); },
  });

  let fpsSmooth = 60, dumpRequested = false;
  let lastRate = 60;    // zuletzt gemessenes Tempo der Simulation in Schritten je Sekunde, für die Einblendung
  let cameraTime = 0;   // Simulationszeit des gezeigten Bildes. Bis dahin ist auch die Kamera mitgedreht
  let drawnStep = 0;    // Schrittzahl der Simulation beim gezeigten Bild

  // ───────────── Abläufe, die mehrere Teile betreffen ─────────────

  // Neue Startwolke. Mit seed lässt sich eine Wolke wiederholen, sonst ist sie zufällig.
  function reset(seed) {
    run.reset(seed);
    cameraTime = sim.time;
  }

  function setPaused(p) { run.paused = p; controls.showPaused(p); }

  // Stellt die Kamera auf die gemessene Drehimpulsachse, also senkrecht über die Scheibe
  function viewFromAbove() {
    controls.stopSpin();   // sonst kreist die Kamera gleich wieder weg
    camera.lookFrom(axis, !matchMedia('(prefers-reduced-motion: reduce)').matches);
    renderer.invalidate();
  }

  const followedSlot = () => tracker.current ? tracker.current.slot : -1;

  // Ein Folge-Knopf oder ein Punkt der Grafik: Die Kamera läuft mit diesem Körper um, oder löst sich wieder
  function toggleFollow(body) {
    if (tracker.toggle(body, cameraTime, diagnostics.time)) controls.setCoRadius(0);
    readout.updateBodies(diagnostics.top, followedSlot());
  }

  // Abstand vom Stern, bei dem der Sehstrahl durch einen Punkt des Fensters die Scheibenebene trifft
  function radiusAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return camera.planeRadius((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2, axis);
  }

  // Klick in der Draufsicht: Die Kamera dreht ab jetzt mit dem angeklickten Radius mit. Klick auf den Stern schaltet ab.
  function pickRadius(clientX, clientY) {
    if (!camera.isAbove(axis)) return;
    const r = radiusAt(clientX, clientY);
    if (r !== null) { tracker.release(); controls.setCoRadius(r < 0.08 ? 0 : r); }
  }

  // Datenabzug zum Nachvollziehen von Fehlern: frische Orte und Geschwindigkeiten aller Körper, dazu Kennzahlen,
  // Liste und Kamera so, wie sie gerade angezeigt werden. Ausgewertet oder umgepackt wird dabei nichts.
  function saveDump() {
    const snap = sim.readback();
    Disk.saveDump({
      format: 'scheibe-datenabzug-1', quelle: 'knopf',
      zeit: sim.time, gemessenBei: diagnostics.time, angehalten: run.paused,
      P, stats: run.stats, axis: axis.slice(), top: diagnostics.top, follow: tracker.current,
      cam: { dir: camera.dir, up: camera.up, dist: camera.dist },
      liste: [...document.querySelectorAll('button.body')].filter(b => !b.hidden).map(b => b.innerText),
      teilchenBeimStart: snap.count0, feld: snap.size, sternmasse: snap.starMass, teilchenmasse: snap.particleMass,
      koerperradius: sim.unitRadius, verschluckt: snap.swallowed, sternDrehimpuls: snap.sinkL.slice(),
      pos: Disk.roundedArray(snap.pos), vel: Disk.roundedArray(snap.vel),
    }, [canvas, hudCanvas]);
  }

  // Der gewachsene Körper an einem Punkt des Fensters, großzügig getroffen, oder null.
  // Gerechnet wird mit den Orten zum Zeitpunkt des gezeigten Bildes: von der letzten Messung aus auf der Bahn weitergedreht.
  function grownAt(clientX, clientY) {
    const w = hudCanvas.clientWidth, h = hudCanvas.clientHeight, sinceMeasure = cameraTime - diagnostics.time;
    let hit = null, best = Infinity;
    for (const b of diagnostics.grown) {
      const spot = Disk.vec.rot(b.p, axis, tracker.spinRate(b.p, b.v) * sinceMeasure), q = camera.project(spot, w, h);
      if (!q) continue;
      const radius = renderer.spriteRadius(b.w, camera.pixelsPerUnit(spot, h), sim.count0);
      const d = Math.hypot(q[0] - clientX, q[1] - clientY);
      if (d < Math.max(radius + 12, 22) && d < best) { best = d; hit = { body: b, x: q[0], y: q[1], radius }; }
    }
    return hit;
  }
  const rankOf = slot => { const b = diagnostics.grown.find(g => g.slot === slot); return b ? b.rank : 0; };

  function showReadout() {
    if (driver.rate > 0) lastRate = driver.rate;
    readout.update({ stats: run.stats, time: sim.time, dt: C.DT, steps: driver.steps, starMass: sim.starMass, fps: fpsSmooth, simRate: run.paused ? 0 : driver.rate, top: diagnostics.top, followedSlot: followedSlot() });
  }

  function drawHud() {
    const above = camera.isAbove(axis), w = hudCanvas.clientWidth, h = hudCanvas.clientHeight;
    canvas.classList.toggle('pick', above);
    const f = tracker.current, sinceMeasure = cameraTime - diagnostics.time;
    // Orte der gelisteten Körper zum Zeitpunkt des gezeigten Bildes
    const bodies = diagnostics.top.map(b => {
      const spot = Disk.vec.rot(b.p, axis, tracker.spinRate(b.p, b.v) * sinceMeasure);
      return { index: b.index, spot, radius: renderer.spriteRadius(b.w, camera.pixelsPerUnit(spot, h), sim.count0) };
    });
    // Der gewachsene Körper unter dem Mauszeiger, falls einer dort ist
    let pointed = null;
    if (pointer.hover && !pointer.active) {
      const hit = grownAt(pointer.hover[0], pointer.hover[1]);
      if (hit) pointed = { x: hit.x, y: hit.y, radius: hit.radius, rank: hit.body.rank, earth: hit.body.earth };
    }
    // Vorschau des Bezugsradius unter dem Mauszeiger. Entfällt über einem Körper, denn dort folgt ein Klick dem Körper.
    let hover = null;
    if (above && !pointed && pointer.hover && !pointer.active) {
      const r = radiusAt(pointer.hover[0], pointer.hover[1]);
      if (r !== null && r >= 0.08 && r <= C.CO_MAX && Math.abs(r - P.co) > 0.005) hover = { x: pointer.hover[0], y: pointer.hover[1], radius: r };
    }
    hud.draw({
      project: p => camera.project(p, w, h),
      up: camera.up,
      plane: diagnostics.plane,
      // Winkel, um den sich die Scheibe bei Radius r in einer Sekunde Echtzeit dreht (beim tatsächlichen Tempo)
      turnPerSecond: r => diagnostics.orbitRate(r) * C.DT * lastRate,
      above,
      co: P.co,
      follow: f ? { spot: tracker.spot(cameraTime), earth: f.w * sim.particleMass / C.EARTH, rank: rankOf(f.slot) } : null,
      bodies,
      pointed,
      hover,
    });
  }

  // ───────────── Zeichenschleife: zeigt den Zustand der Simulation, rechnet aber nicht ─────────────
  let last = performance.now(), frameNo = 0;

  // Zeichnet die Szene mit dem jetzigen Stand der Simulation neu
  function drawScene(now) {
    const ms = Math.min(500, now - last); last = now;
    fpsSmooth += (1000 / Math.max(ms, 1) - fpsSmooth) * 0.05;

    // Kamera mitdrehen, mit einem Körper oder mit der Kreisbahn beim gewählten Radius:
    // um den Winkel, den die Simulation seit dem letzten Bild weitergelaufen ist
    if (tracker.current) tracker.advanceTo(sim.time);
    else if (P.co > 0) camera.turn(axis, diagnostics.orbitRate(P.co) * (sim.time - cameraTime));
    cameraTime = sim.time;
    drawnStep = driver.steps;

    if (!tracker.current && P.co === 0 && P.spin && !pointer.active) camera.turn([0, 1, 0], ms * 0.00006);
    if (camera.travel(ms)) renderer.invalidate();   // während der Fahrt keine verschmierten Bahnspuren
    if (run.stats) camera.frameDisc(run.stats.r90, ms);

    renderer.resize();
    camera.updateView(renderer.aspect);
    renderer.draw(sim, camera, P, axis);
    if (dumpRequested) { dumpRequested = false; saveDump(); }
  }

  function frame(now) {
    // Bei „jeden Schritt“ wird zu jedem Bildschirmbild gezeichnet, sonst erst, wenn die Simulation die gewählte
    // Zahl von Schritten weiter ist. Wer dreht, zoomt oder etwas an der Darstellung ändert, bekommt sofort ein neues Bild.
    const touched = pointer.active || camera.goal !== null || renderer.dirty || dumpRequested;
    const stepped = driver.steps < drawnStep || driver.steps - drawnStep >= P.drawEvery;
    if (P.drawEvery <= 1 || touched || stepped) drawScene(now);
    drawHud();   // Einblendung zu jedem Bildschirmbild, passend zum gezeigten Stand
    if (frameNo % 10 === 0) showReadout();
    frameNo++;
    requestAnimationFrame(frame);
  }

  addEventListener('resize', () => renderer.invalidate());
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('Die Grafikkarte hat den Kontext verloren. Lade die Seite neu.'); });

  try { reset(); } catch (err) { console.error(err); fail('Die Simulation ließ sich nicht starten: ' + err.message); return; }
  run.start();
  requestAnimationFrame(frame);

  // Für Experimente in der Konsole: sim.step(1000); sim.diagnose()
  window.sim = {
    P, cam: camera, reset, setPaused,
    step: (n = 1) => sim.run(n),
    diagnose: () => run.measure(false),
    get stats() { return run.stats; },
    checksum: () => run.checksum(),
    get follow() { return tracker.current; },
    get top() { return diagnostics.top; },
    get raw() { return { pos: sim.pos, vel: sim.vel }; },
    get axis() { return axis.slice(); },
    get cloudSpin() { return run.cloudSpin; },
    get time() { return sim.time; },
    get steps() { return driver.steps; },            // Zeitschritte seit dem Start der Wolke, die der Taktgeber gerechnet hat
    get rate() { return driver.rate; },              // gemessenes Tempo in Schritten je Sekunde
    pauseAtStep: n => { driver.stopAt = n; },        // hält an, sobald der Taktgeber diese Schrittzahl erreicht hat
  };
}

start();
})(globalThis.Disk = globalThis.Disk || {});
