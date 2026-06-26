# Change History — Sandbox-Applets

Pro Applet werden hier die Abweichungen vom jeweiligen Original-/Referenzstand
festgehalten — vor allem solche, die das **Simulationsverhalten** verändern
(Rendering- und UI-Details nur, wenn sie für die Diskussion der Mechanik
relevant sind).

---

## SimulatedEvolutionGPU.js

**Referenzstand:** `de/simulierte-evolution/javascript_samples/simulated_evolution.js`
(8 Gene, binäre Nahrung 0/1, keine Zell-Belegung, verkettete Liste, Canvas2D).

### Welt / Geometrie
- Default-Grid 800×450 statt 400×300; `cellPx` und `cellsX/Y` konfigurierbar.
- `foodSpawnPerTick` skaliert mit Grid-Größe (Baseline 6 bei 400×300; Original
  hatte fest 2 pro Tick).
- `initialFood` jetzt 33 % der Zellen (Original: 40000 absolut).

### Mikroben-Genom
- **Genom wieder 8-dim wie im Original** (Stand 2026-05-18). Das zwischenzeitlich
  eingeführte 9. „Stand-Still"-Gen samt `mStanding`, `mIdleAcc` und
  `energyIdleFactor` ist komplett ausgebaut. Begründung: das Stand-Gen hat
  das Reverse-Gen selektionstechnisch maskiert. Im Szenario „Wanderndes
  Rechteck" (eigens dafür gedacht, den Nutzen von Reverse zu demonstrieren —
  Mikroben können sich in der persistenten Wake halten, indem sie regelmäßig
  umkehren) war Sitzenbleiben mit 0.1-Stoffwechsel einfach billiger als die
  Reverse-Kosten von 8: stehende Mikroben fressen die Wake leer, bevor
  Reverse-Mutanten überhaupt selektiert werden können. Ohne Stand-Gen muss
  „in der Wake bleiben" über Bewegung passieren, und Hin-und-Her-Pendeln
  via Reverse wird zur einzigen verfügbaren Strategie.
- **Bewegungstabelle `MOTION` jetzt rotatorisch (CW ab N)** statt Scan-
  Reihenfolge. Original-Bug: `STEERING_COST` ist symmetrisch um Index 4 =
  Umkehr; in Scan-Reihenfolge passte Gen-Index nicht zum Kostenindex.

### Zell-Belegung / Kollision
- **Mehrfachbelegung pro Zelle wieder erlaubt** (Stand 2026-05-17): das
  `occ`-Grid und der Free-Neighbour-Suche-Helper `_findFreeNeighborFidx`
  sind komplett entfernt; Bewegung wird nicht mehr durch andere Mikroben
  blockiert, Reproduktion kann nicht mehr an fehlendem Nachbar scheitern.
  Tochter wird auf der Zelle der Mutter platziert (wie im Original),
  beide konkurrieren danach um den dortigen Nahrungsvorrat: wer im
  Slot-Loop früher dran ist, beißt zuerst.
  Ziel des Rollbacks war Vereinfachung *und* Eindämmung der Park-
  Pathologie (siehe unten) — Park-Mikroben blockieren keine Reproduktion
  ihrer Nachbarn mehr, und Töchter stapeln sich auf der Parker-Zelle, was
  den Nahrungsfluss dort schneller leersaugt.

### Nahrung
- Pro Zelle akkumulierender Vorrat 0…255 (Uint8) statt binär 0/1.
- Spawn ist additiv (`+= energyPerFood`, gedeckelt bei 255) statt Set auf 1.
- **Exponentielles Wachstum pro Tick** mit Faktor `foodGrowthFactor`
  (Default 1.001) auf jeder nicht-leeren Zelle; Float-Akkumulator `foodGrowAcc`
  überbrückt die Uint8-Quantisierung.
- **Spill-over**: gesättigte Zellen geben Überschuss an zufällig gewählten
  nicht-vollen 8-Nachbarn (massenerhaltend); fällt weg, wenn alle 8 voll.
- Biss pro Tick auf `energyPerFood` UND Energie-Headroom gedeckelt; Rest bleibt
  liegen. Original: Mikrobe nahm volle Portion, Zelle wurde auf 0 gesetzt.

### Spawn-Strategien
- **Vierte Strategie "Wanderndes Rechteck"** — Quellblock driftet diagonal
  mit toroidalem Wrap; Spawn-Rate verdoppelt.
  - 2026-05-18: Kantenlänge um 32% vergrößert (round(min(cellsX,cellsY)/16 × 1.32);
    in zwei Schritten: zuerst +20%, dann nochmal +10%).
  - 2026-05-18: **Lösch-Ring um den Spawn-Block** — Annulus mit halfIn = side/2,
    halfOut = side (Ring ist also eine Spawn-Kante breit auf jeder Seite, äußere
    Kantenlänge 2×side). Pro Tick werden `food[i]` und `foodGrowAcc[i]` für alle
    Ring-Zellen auf 0 gesetzt. Konsequenz: Nahrung kann ausschließlich im
    wandernden Spawn-Block existieren, die Wake wird innerhalb von
    ~ring-width/|v| Ticks gescrubbt. Ziel ist die Vorbereitung einer Selektion
    auf das Reverse-Gen — Mikroben müssen im Block bleiben oder per Pendeln
    nachverfolgen, sonst verhungern sie in der Wüste.
  - 2026-05-18: **Spawn-Rate im Block auf 20× global** (`foodSpawnPerTick * 20`,
    statt vorher *2). Randomisiertes Deponieren wie zuvor — die Voll-Oase
    (alle Block-Zellen auf 255) war zwischenzeitlich gebaut, dann wieder
    zurückgenommen, weil sie zu viel war.
  - 2026-05-18: **Driftgeschwindigkeit von 0.4 → 0.15 c/t pro Achse** (Magnitude
    0.566 → 0.21 c/t). Bei 0.4 starb die gesamte Population: die Patch-
    Geschwindigkeit lag zu nah an der Mikroben-Maximalgeschwindigkeit (1 c/t),
    so dass nur ein winziger Bruchteil der zufälligen Initialgenome im Patch
    bleiben konnte; nach Verbrauch der Initialnahrung außerhalb gab es kein
    Überlebenshalten. Bei 0.15 ist die Patch-Drift langsam genug, dass eine
    breite Bandbreite an Drift-Genomen mithalten kann.
  - 2026-05-18: **Geschwindigkeits-Rampe** statt fester Drift. Beim Reset
    starten `movRectVx`/`Vy` bei 0; pro Tick im Moving-Rect-Modus wird
    linear bis zum Zielwert `movRectTargetVx`/`Vy` (0.4 c/t pro Achse,
    Magnitude 0.566) über `movRectRampTicks` Ticks (Default 30 000)
    hochgefahren. Idee: Die Population kann sich auf den stehenden Patch
    setzen, vermehren und an die Drift-Richtung adaptieren, bevor die
    eigentliche Selektion einsetzt. Die zwischenzeitliche Senkung auf
    0.15 als Endwert ist mit der Rampe wieder zurückgenommen — das Endziel
    ist erneut die volle 0.4.
  - 2026-05-18: Rampendauer 30 000 → 60 000 Ticks (≈ 2 → 4 Min real bei
    4 Ticks/Frame, 60 FPS), dann auf 45 000 zurück (3 Min) — 60 000 war
    zu langsam, 30 000 zu schnell.
  - 2026-05-18: Neue Defaults: `energyPerFood` 40 → 150,
    `energyPerTick` 1 → 4. Macht Stoffwechsel teurer und Nahrungsbissen
    nahrhafter — verschärft den Druck, die teuren Steuerungs-Aktionen
    nur dann zu wählen, wenn sie sich wirklich auszahlen (Reverse-Test).
  - 2026-05-18: **Max-Geschwindigkeit halbiert** (`movRectTargetVx/Vy`
    0.4 → 0.2, Magnitude 0.566 → 0.283 c/t) und Rampe verkürzt
    (45 000 → 20 000 Ticks ≈ 1.4 Min real). Anlass: Reverse wurde immer
    noch nicht selektiert; mit langsamerem Patch sind die alternativen
    „cheap turn"-Strategien (z.B. E/S-Alternation) weniger wettbewerbsfähig
    gegenüber der SE/NW-Reverse-Mischung, weil die billigeren Mischungen
    weiterhin perpendikulare Drift erzeugen und damit in die Bänder
    geraten.
  - 2026-05-18: **Patch ist jetzt ein Kreis**, kein Quadrat mehr. Spawn per
    Rejection-Sampling im Einheits-Kreis, skaliert mit `rIn`. Erase per
    `dx²+dy²`-Test (`rIn² < d² ≤ rOut²`). UI-Label „Wanderndes Rechteck"
    → „Wandernder Kreis". Funktionsname `_spawnFoodMovingRect` und alle
    `movRect*`-Felder bleiben aus Diff-Minimierung erhalten.
  - 2026-05-18: **Radius-Rampe parallel zur Geschwindigkeits-Rampe**.
    Beim Reset ist `rIn = side` (Durchmesser 2×side, doppelt so groß wie
    die alte Referenzkante); am Ende der Rampe `rIn = 0.375×side`
    (Durchmesser 0.75×side, 75 % der Referenzkante). Lösch-Ring-
    Außenradius `rOut = 2×rIn` skaliert mit. Idee: Anfangs ein großer,
    ruhender „Inkubator", der schrittweise zur kleinen, driftenden
    Selektionsbühne wird.
  - 2026-05-18: **Cost-Map als generischer Mechanismus** — neue Uint8-Map
    `costMap` (cellsX × cellsY), Default 0. Pro Tick zieht jede Mikrobe
    `costMap[fidx]` zusätzlich von ihrer Energie ab. Lebensfeindlichkeits-
    Map analog zur `food`-Map. Anwendung im Moving-Circle-Mode: der frühere
    Lösch-Ring wird zur **toxischen Zone** umgebaut. Spawn-Loop bleibt;
    statt `food[i]=0, acc[i]=0` schreibt der Ring `ringHostility` (Default
    10) in `costMap[i]`. Inneres des Spawn-Kreises bekommt 0, Ring-Cells
    bekommen 10. Beim Verlassen des Mode 3 (`setSpawnStrategy`) wird die
    Map auf 0 zurückgesetzt, damit andere Modi unverändert laufen.
    - **rOut konstant auf `side`** statt `2×rIn`. Damit ist die Ring-
      Breite am Rampen-Anfang = 0 (rIn = rOut = side, kein toxischer Bereich)
      und am Rampen-Ende = 0.625×side — der Druck zur Reverse-Selektion
      wächst rein durch die Ring-*Fläche*, nicht durch die per-Zelle-Toxizität.
    - **Visualisierung**: zweite R8-Textur `costTex`, jeden Frame neu hochgeladen.
      Food-Shader mischt rote Tönung in Zellen mit `cost > 0`.
    - **UI-Input** "Toxizität Ring" (`evoTox`, 0..255) zur Laufzeit-Tunung.
    - 2026-05-18: Food-Erase außerhalb des Spawn-Rings wieder eingebaut
      (war beim Umbau von Erase- auf Toxic-Ring versehentlich abgeschaltet).
      Jetzt: Cells im Box-Loop mit `d² > rIn²` bekommen `food=0, acc=0`
      zusätzlich zum Toxic-Wert. Damit ist die Welt außerhalb des Spawn-
      Kreises wieder klar (kein Rest-Food in der Wake, das den
      Selektionsdruck verwässert).
  - 2026-05-18: **Beweglicher Toxic-Ring → statische Bänder am Pfad**.
    Bisher bestrafte der bewegliche Ring auch Mikroben, die das richtige
    Drift-Gen hatten und in Pfad-Richtung wanderten — sie wurden vom
    Ring „überrollt", obwohl sie sich genetisch korrekt verhielten. Neuer
    Aufbau:
    - `_initPathDistMap()` berechnet einmalig beim Allocate die perpendikulare
      Distanz jeder Zelle zur Pfad-Linie durch das Domain-Zentrum mit
      Richtung (movRectTargetVx, movRectTargetVy). Toroidaler shorter-wrap.
    - `_writeBandsToCostMap()` schreibt `ringHostility` in Zellen mit
      pathDist ∈ `(rIn, rOut]`, 0 sonst. Aufgerufen beim Reset, beim
      Wechsel in Mode 3 und alle 64 Ticks (für Live-UI-Tweaks von
      ringHostility).
    - rIn jetzt **konstant** = 0.375 × side (keine Radius-Schrumpfung mehr —
      „beginne gleich mit dem kleinen Kreis"). rOut konstant = side.
      Band-Breite konstant 0.625 × side. Die Bänder reichen genau bis an
      die Bewegungszone des Patches heran, ohne sie zu schneiden.
    - Box-Loop um den Patch macht jetzt nur noch Food-Clear außerhalb des
      Spawn-Kreises; die Cost-Map wird nicht mehr per Box verändert
      (Static-Bänder dürfen lokale Werte nicht verlieren).
    - Selektion: Mikroben mit Drift entlang der Pfad-Richtung sind sicher,
      egal wo sie auf dem Pfad sind. Perpendikulare Drift bringt sie in
      die Bänder. Reverse-Gen wird bei Patch-Richtungswechseln (alle 600
      Ticks) selektiert, weil nur eine 1-Tick-Wende dem Patch nachsetzen
      kann, ohne perpendikulare Drift in die Bänder zu produzieren.
  - 2026-05-18: **Periodische Driftrichtungs-Umkehr** alle
    `movRectReversePeriod = 600` Ticks (volle 180°). Ohne Umkehr wurde
    Reverse nie selektiert, weil jede graduelle Mehrfach-Wende billiger
    war als die 8-er-Strafe — Zeit spielte keine Rolle, nur Energie.
    Mit periodischer Umkehr entsteht echter Zeitdruck: nach jedem Flip
    driftet der Patch in der neuen Richtung weg, und eine Mikrobe muss
    ihre Bewegungsrichtung umkehren. Reverse braucht dafür 1 Tick (Kosten
    8), die billigen Alternativen 2×±90° = 2 Ticks (Kosten 4) oder
    4×±45° = 4 Ticks (Kosten 4). In den verlorenen 1–3 Ticks driftet der
    Patch ~0.6–1.7 Zellen weiter — bei `rIn ≈ 14` am Rampen-Ende ist
    das der Unterschied zwischen „im Patch bleiben" und „vom Lösch-Ring
    erwischt". Implementiert als Sign-Flip von `movRectDirSign`
    (multiplikativ auf vx/vy).
- "Linien" neu gestaltet: 5er-Raster über das gesamte Feld (10/30/50/70/90 %
  je Achse). Original: fest zentriert bei cy±0/±50/±100.
- "Rechteck" neu gestaltet: rein zentrierter Block. Original: zentraler Block
  plus Off-Center-Sprenkel mit Sperrzone um die Mitte.
  - 2026-05-20: **Hintergrund-Sprenkel wieder eingeführt**, allerdings rein
    gleichverteilt über das gesamte Feld mit 1/10 der Box-Spawn-Rate
    (`foodSpawnPerTick * 0.1` zusätzliche `_putFood`-Aufrufe pro Tick).
    Ziel: Mikroben, die das zentrale Rechteck verlassen oder nie hineinkommen,
    haben eine dünne Hintergrund-Nahrung statt sofortigem Verhungern. Keine
    Sperrzone um die Mitte (anders als im Original), keine Off-Center-
    Konzentration — nur ein flacher Bias.
- **Fünfte Strategie "Punktquellen"** (Spawn-Strategy 4): Basis-Sprenkel
  wie „Gleichverteilt", zusätzlich pro Tick 1000 fest gewürfelte Paar-
  Quellen (insgesamt 2000 Zellen), jede bekommt `_putFood`. Layout wird
  bei `reset()` per `_initPointSources()` neu generiert; Punkte sind im
  Lauf konstant. Original hatte das nicht — kommt als Test für Reverse-
  Selektion in einer Welt mit lokalen, dauerhaften Nahrungs-Fontänen.
- **Sechste Strategie "Mix"** (Spawn-Strategy 5): kombiniert drei der
  anderen Welten in einem Feld. Horizontaler 50/50-Split: linke Hälfte
  trägt ein quadratisches Linien-Gitter (Spacing so gewählt, dass die
  Maschen visuell quadratisch sind), oben rechts liegt ein zentriertes
  Nahrungsquadrat im Stil von „Rechteck" (skaliert auf den Quadranten),
  unten rechts pumpen 1000 Paar-Punktquellen wie in „Punktquellen", aber
  auf den unteren rechten Quadranten beschränkt. Eigene
  `mixPointSourcesX/Y`-Arrays werden in `_initMixPointSources()` bei
  jedem `reset()` neu erzeugt, damit Strategy 4 und 5 unabhängig
  deterministisch bleiben. Nachbarn der Paar-Quellen werden hier *nicht*
  toroidal gewickelt sondern an den Quadrantenrand geklemmt, sonst
  würden einzelne „Bottom-Right"-Quellen toroidal in die Linien- oder
  Box-Zone springen.

### Visualisierung / Overlay
- **Drei Farbschemen** für die Mikroben-Sprites: `Genom` (Default, bestehend),
  `Alter` (jung → blau, alt → rot; normiert gegen das aktuelle Maximalalter),
  `Energie` (leer → rot, voll → blau; normiert gegen `energyMax`). Umschaltbar
  über `setColorMode(0|1|2)` bzw. die neuen UI-Buttons. Im Original gab es nur
  Genom-Färbung (über `microbe_color`). Der komplementärfarbige 1-px-Rand
  wird in Alter/Energie-Modus weggelassen (`uShowBorder` im Microbe-Shader),
  weil er bei kleinen Sprites den Farbverlauf optisch zersägt.
- **Populations-Stats im Overlay**: zusätzliche Anzeige von Ø Alter und
  Max Alter unter Ø Energie. Pro Frame in `_computeStats` einmal akkumuliert.
  Original-Applet hatte keinerlei Alters-Auswertung.
- Genom-Panel-Höhe 320 px (Original-Applet hatte gar kein Panel). Layout:
  Radial-Chart oben, Stats-Streifen (Ø Energie / Ø Alter / Max Alter, bei
  Selektion: Energie / Alter / Richtung) unten. Der frühere separate
  Stand-Balken am unteren Panelrand entfällt mit dem Stand-Gen.
- **Rubberband-Mehrfachauswahl** (2026-05-19): Drag mit linker Maustaste am
  Canvas zieht ein gestricheltes Auswahl-Rechteck; bei Loslassen werden alle
  lebenden Mikroben darin als Auswahl markiert (Snapshot — die Selektion
  folgt anschließend den Mikroben, wandert aber nicht mit dem Rechteck mit).
  Klick ohne Drag (Threshold 4 CSS-Px) bleibt wie bisher Einzelauswahl der
  nächstgelegenen Mikrobe. Selection-State liegt jetzt in einer Uint8Array-
  Bitmap pro Slot (`selected[]` + `selectedCount`) statt im früheren skalaren
  `selectedIdx`; `_freeSlot` räumt tote Selektierte automatisch ab,
  `_growPool` skaliert das Bitmap mit. Statistik-Panel oben rechts hat
  jetzt drei Modi: `count === 0` Population-Average wie bisher,
  `count === 1` Einzel-Mikrobe (Gene + E/A/Richtung) wie bisher, `count > 1`
  Aggregat über die Auswahl (Titel „Auswahl: n Mikroben", Radial-Chart =
  Gen-Mittelwert der Auswahl, Stats-Strip = Ø Energie / Ø Alter / Max Alter
  nur der Selektion). Sichtbarkeits-Markierung: bei 1 das vollständige
  Fadenkreuz wie zuvor, ab 2 nur ein kleiner Doppel-Ring (schwarz+weiß) um
  jedes selektierte Sprite. Implementiert via Pointer-Events + `setPointer
  Capture` damit Move/Up-Events auch außerhalb des Canvas ankommen; funktion
  iert sowohl live als auch im Pause-Modus (überlebt damit auch Schritt-
  weises Vorrücken). Bewusst **nicht** additiv (kein Shift-Drag) — neuer
  Drag ersetzt die Selektion komplett.
- **Pause + Einzel-Mikroben-Inspektion**: `setPaused`/`togglePause` halten die
  Simulation an (`_frame` überspringt `_tick`). Per Pfeiltasten oder
  ◀/▶-Buttons lässt sich durch die lebenden Mikroben iterieren — auch
  während die Sim läuft. Ein weiterer Button springt direkt auf die älteste,
  ein vierter hebt die Auswahl auf (`deselect`). `selectNearest(cx, cy)`
  greift bei Klick in die Sim und wählt die räumlich nächstgelegene lebende
  Mikrobe (Listener auf dem WebGL-Canvas, da das Overlay
  `pointer-events:none` ist). Stirbt die selektierte Mikrobe, räumt
  `_freeSlot` sie automatisch ab.
  Selektion wird durch Fadenkreuz + Live-Labels (`E:`, `A:`) markiert; das
  Genom-Panel zeigt Gene + Energie/Alter/Status der aktiven Mikrobe statt
  Population-Average. Im Original gab es weder Pause noch Einzelinspektion.
  *(Der frühere Auto-Pause-Breakpoint bei Energie ≤ 1 der selektierten
  Mikrobe ist 2026-05-18 entfernt — er war im Alltag mehr störend als
  hilfreich, da er die laufende Sim ohne Vorwarnung stoppte.)*

### Mikroben-Pool
- Flacher Typed-Array-Pool mit Free-Stack statt verketteter Liste; Auto-Grow
  bis zur harten Obergrenze `cellsX·cellsY` (jetzt nur noch grobe Skalen-
  Schranke, keine Per-Zell-Regel mehr, da Mehrfachbelegung erlaubt ist).
- `mBornThisTick`-Flag verhindert, dass eine frisch geborene Tochter im selben
  Tick schon mitläuft. (Im Original ergab sich derselbe Effekt zufällig durch
  Insert-at-Head + zwischengespeichertes `next`.)

### View-Transform (Zoom + Pan)
- 2026-05-20: **Mausrad-Zoom auf Cursorposition + Shift+Linksdrag-Pan**.
  Neue State-Felder: `viewZoom` (1..16, Default 1), `viewCenterX/Y` (World-UV
  0..1, Default 0.5). Food-FS und Microbe-VS erhalten Uniforms `uViewCenter`
  und `uViewZoom`; UV-Sampling im Food-Pass wird über `uv = center + (vUV - 0.5) / zoom`
  remapped, Mikroben-NDC entsprechend skaliert und translatet, `gl_PointSize`
  wird mit `uViewZoom` multipliziert, damit Sprites mit dem Zoom mitwachsen.
  `_clampView()` hält das Sichtfenster innerhalb der Welt; bei zoom=1 fällt
  viewCenter zwangsweise auf (0.5, 0.5) zurück (kein Pan möglich, da Welt
  vollständig sichtbar). Wheel-Handler verankert den Welt-Punkt unter dem
  Cursor (Anchor-Welt-UV vor und nach Zoom-Änderung gleichsetzen,
  viewCenter entsprechend korrigieren).
- Konflikt mit der Rubberband-Selektion gelöst über einen
  Modus-Switch am `pointerdown`: `e.shiftKey` zum Down-Zeitpunkt schaltet
  den Drag auf `dragMode = 'pan'`, sonst Standard-Rubberband. Modus wird
  während des Drags nicht mehr gewechselt (sonst würde Halb-Selektion +
  Halb-Pan entstehen). Space bleibt Pause-Toggle.
- Overlay-Primitive (Rubberband, Crosshair, Multi-Select-Ringe) gehen jetzt
  über `_cellToPx(cx, cy)` durch die View-Transform; Sprite-Radius im
  Overlay wird mit `viewZoom` skaliert, damit Ringe und Outline ums Sprite
  bei jedem Zoom passend sitzen. Crosshair-Strichlängen bleiben fix in
  CSS-Px, damit sie auf hohem Zoom nicht unangenehm groß werden.
- `reset()` setzt View auf Default zurück — UI-Zustand gehört zu einer
  frischen Simulation logisch dazu.

### Bekannte Probleme (noch offen)
- _Keine offenen Punkte._ Die Park-Pathologie ist mit dem Ausbau des
  Stand-Gens (2026-05-18) per Konstruktion erledigt: ohne Stand-Aktion
  kann es keine sitzenbleibenden Parker mehr geben.

---

## WatorGPU.js

**Referenzstand:** unbekannt — kein Original im Repo gefunden. Solange keine
Referenz existiert, werden hier nur prospektiv neue Änderungen ab dem heutigen
Stand notiert.

_Noch keine Änderungen eingetragen._

---

## MagPendGPU.js

**Referenzstand:** unbekannt — Original-Quelle nicht im Repo. Prospektive
Änderungs-Historie ab heutigem Stand.

_Noch keine Änderungen eingetragen._

---

## PlanetaryDiskGPU.js

**Referenzstand:** unbekannt — Original-Quelle nicht im Repo. Prospektive
Änderungs-Historie ab heutigem Stand.

_Noch keine Änderungen eingetragen._
