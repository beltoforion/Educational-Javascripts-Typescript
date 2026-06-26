<?php include ("pagebuilder.php");

	$page->page_title = 'Sandbox';
	$page->subtitle = 'Subtitle of the Sandbox page';
	$page->vgwort_counter = '';
	$page->id = 'de-sandbox';
	$page->last_modified = '2026-05-20';
?>


<!DOCTYPE HTML>
<!--
	Editorial by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
-->
<html lang="de">
	<head>
		<?php echo '<title>'.$page->page_title.' - '.$page->subtitle.'</title>'; ?>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
		<?php
			// Note: previous <link rel="alternate" ...> was missing the hreflang attribute — fixed in migration.
			$page->build_meta([
				'description' => 'Sandbox',
				'keywords'    => 'sandbox',
				'og_image'    => 'https://beltoforion.de/images/title_l/magpend.webp',
				'og_image_width'  => 1200,
				'og_image_height' => 630,
				'canonical'   => 'https://beltoforion.de/de/sandbox',
				'type'        => 'article',
			]);
			$page->include_dependencies('../..');
		?>
	</head>

	<?php $page->build_body_and_header('https://github.com/beltoforion/Magnetic-Pendulum'); ?>		

<section>
	<header id="idStart" class="main">
		<h1>Sandbox</h1>
	</header>
	<p>Spielwiese für die GPU-Applets der Artikelseiten.</p>
</section>

<link rel="stylesheet" href="../../assets/css/applet.css"/>
<script src="../../assets/js/applet.js"></script>
<style>
/* .corner-tl-Regeln stehen in assets/css/applet.css (shared). */
/* Parameter-Panel unten links statt oben links. */
.applet-fit .applet-controls.left.bottom {
	top: auto;
	bottom: 14px;
}
/* Haupt-Controls unten rechts statt unten zentriert. */
.applet-fit .applet-controls.bottom-right {
	left: auto;
	right: 14px;
	bottom: 14px;
	transform: none;
}
</style>

<section>
	<h2 id="idMagPend" class="clear">Magnetisches Pendel</h2>

	<span class="applet-fit" style="--applet-w:1600; --applet-h:900;">
		<span id='cv'><span class="applet-controls">
			<span class="ac-row">
				<b>Weniger Reibung</b>
				<input id="sliderFriction" type="range" min="0" max="100" onchange="updateSlider(this.value)"/>
				<b>Mehr Reibung</b>
				<button type="button" onclick="resetSimulation()">Reset</button>
			</span>
		</span>
		<span class="applet-controls corner-tl">
			<span class="ac-row">
				<button class="ac-icon" type="button" title="Vollbild" aria-label="Vollbild" onclick="toggleFullscreen(this)">⛶</button>
				<button class="ac-icon" type="button" title="Steuerung ein/aus" aria-label="Steuerung ein/aus" onclick="toggleAppletControls(this)">⚙</button>
			</span>
		</span></span>
	</span>

	<script src="./scripts/MagPendGPU.js"></script>
	<script>
	var magpend = new MagPendGPU({ cvid   : 'cv',
	                               font   : "17px Arial",
	                               width  : 1600,
	                               height : 900 });

	function updateSlider(v) {
	  let friction = Math.pow(10, -3.5 + (v/100) * 1.5);
	  magpend.setFriction(friction);
	}
	function resetSimulation() {
	  // friction default 0.001 corresponds to slider position ≈ 33 via
	  // 10^(-3.5 + 0.015·v) = 0.001 → v = 33.33
	  document.getElementById('sliderFriction').value = 33;
	  magpend.resetToInitialState();
	}
	</script>
</section>

<section>
	<h2 id="idWator" class="clear">Wa-Tor</h2>

	<span class="applet-fit" style="--applet-w:1600; --applet-h:900;">
		<span id='cvWator'><span class="applet-controls top">
			<span class="ac-row">
				<b>Pixel Size</b><input type="number" id="watorPix"   min="1" max="20"  onchange="updateWator('pixSize',this.value,true)"/>
				<b>Prey Breed Time</b><input type="number" id="watorBreed" min="1" max="200" onchange="updateWator('breedTime',this.value)"/>
				<b>Energy per Prey</b><input type="number" id="watorEpp" min="1" max="500" onchange="updateWator('energyPerPrey',this.value)"/>
			</span>
			<span class="ac-row">
				<b>Min shark spawn energy</b><input type="number" id="watorEmin"   min="1" max="1000" onchange="updateWator('energyMin',this.value)"/>
				<span hidden><b>Chart Skip</b><input type="number" id="watorChartSkip" min="1" max="5" onchange="updateWator('chartSkip',this.value)"/></span>
				<label><input type="checkbox" id="watorPhase" onchange="wator.showPhase = this.checked"/> Phasenraum</label>
				<button type="button" onclick="wator.reset()">Reset</button>
			</span>
		</span>
		<span class="applet-controls corner-tl">
			<span class="ac-row">
				<button class="ac-icon" type="button" title="Vollbild" aria-label="Vollbild" onclick="toggleFullscreen(this)">⛶</button>
				<button class="ac-icon" type="button" title="Steuerung ein/aus" aria-label="Steuerung ein/aus" onclick="toggleAppletControls(this)">⚙</button>
			</span>
		</span></span>
	</span>

	<script src="./scripts/WatorGPU.js"></script>
	<script>
	var wator = new WatorGPU({ cvid          : 'cvWator',
	                           width         : 1600,
	                           height        : 900,
	                           texPath       : './scripts/assets/',
	                           pixSize       : 2,
	                           breedTime     : 15,
	                           energyPerPrey : 40,
	                           energyMin     : 90,
	                           chartSkip     : 4,
	                           showStat      : true,
	                           showFps       : false,
	                           showParam     : false });

	// Sync inputs to the simulation's current parameters (single source of truth).
	document.getElementById('watorPix').value       = wator.pixSize;
	document.getElementById('watorBreed').value     = wator.breedTime;
	document.getElementById('watorEpp').value       = wator.energyPerPrey;
	document.getElementById('watorEmin').value      = wator.energyMin;
	document.getElementById('watorChartSkip').value = wator.chartSkip;
	document.getElementById('watorPhase').checked   = wator.showPhase;

	function updateWator(prop, val, resetField) {
	  var v = parseInt(val, 10);
	  if (!v || v < 1) v = 1;
	  wator[prop] = v;
	  if (resetField) wator.reset();
	}
	</script>
</section>

<section>
	<h2 id="idDisk" class="clear">Planetenscheibe — Lagrange-Punkte & Trojaner</h2>
	<p>WebGL2-Tracer-Simulation einer Staubscheibe um die Sonne, gestört durch Erde und Jupiter. Co-Rotation lässt L4/L5 sichtbar werden, das Exzentrizitäts-Gate filtert exzentrische Bahnen, Strahlungsdruck (Poynting-Robertson) lässt kleine Körner spiralig in die Sonne fallen.</p>

	<span class="applet-fit" style="--applet-w:1600; --applet-h:900;">
		<span id='cvDisk'><span class="applet-controls">
			<span class="ac-row">
				<b>Exzentrizitäts-Gate</b>
				<input id="diskEcc" type="range" min="0" max="0.95" step="0.01" value="0.75" oninput="updateDiskEcc(this.value)"/>
				<span id="diskEccVal" style="min-width:7em; display:inline-block;">0.75 (e≈0.14)</span>
				<b>Strahlungsdruck</b>
				<input id="diskPr" type="range" min="0" max="2000" step="1" value="0" oninput="updateDiskPr(this.value)"/>
				<span id="diskPrVal" style="min-width:4em; display:inline-block;">aus</span>
			</span>
			<span class="ac-row">
				<button type="button" title="Tastenkürzel: +" onclick="disk.zoom(1.2)">Zoom +</button>
				<button type="button" title="Tastenkürzel: −" onclick="disk.zoom(1/1.2)">Zoom −</button>
				<button type="button" title="Tastenkürzel: S" onclick="disk.toggleSolarSystem()">Sonnensystem</button>
				<button type="button" title="Tastenkürzel: T" onclick="disk.cycleCoRotate()">Co-Rotation</button>
				<button type="button" title="Tastenkürzel: C" onclick="disk.toggleContSource()">Dauerquelle</button>
				<button type="button" title="Tastenkürzel: R" onclick="disk.reset()">Reset</button>
			</span>
			<span class="ac-row">
				<b>Fokus:</b>
				<button type="button" title="Tastenkürzel: 1" onclick="disk.setCenter(0)">Sonne</button>
				<button type="button" title="Tastenkürzel: 2" onclick="disk.setCenter(1)">Erde</button>
				<button type="button" title="Tastenkürzel: 3" onclick="disk.setCenter(2)">Jupiter</button>
				<b>Resonanz:</b>
				<button type="button" title="Tastenkürzel: F1" onclick="disk.toggleResonance(0)">Sonne</button>
				<button type="button" title="Tastenkürzel: F2" onclick="disk.toggleResonance(1)">Erde</button>
				<button type="button" title="Tastenkürzel: F3" onclick="disk.toggleResonance(2)">Jupiter</button>
				<b>Schritte/Frame:</b>
				<button type="button" title="Tastenkürzel: [" onclick="disk.bumpStepsPerFrame(-1)">−</button>
				<button type="button" title="Tastenkürzel: ]" onclick="disk.bumpStepsPerFrame(+1)">+</button>
			</span>
		</span>
		<span class="applet-controls corner-tl">
			<span class="ac-row">
				<button class="ac-icon" type="button" title="Vollbild" aria-label="Vollbild" onclick="toggleFullscreen(this)">⛶</button>
				<button class="ac-icon" type="button" title="Steuerung ein/aus" aria-label="Steuerung ein/aus" onclick="toggleAppletControls(this)">⚙</button>
			</span>
		</span></span>
	</span>

	<script src="./scripts/PlanetaryDiskGPU.js"></script>
	<script>
	var disk = new PlanetaryDiskGPU({ cvid: 'cvDisk', width: 1600, height: 900 });

	function updateDiskEcc(v) {
	  var x = parseFloat(v);
	  disk.setEccGate(x);
	  var e = (1 - x) / (1 + x);
	  document.getElementById('diskEccVal').textContent =
	    (x === 0) ? '0.00 (aus)' : x.toFixed(2) + ' (e≈' + e.toFixed(2) + ')';
	}
	function updateDiskPr(v) {
	  var x = parseFloat(v);
	  disk.setPrScale(x);
	  document.getElementById('diskPrVal').textContent = (x === 0) ? 'aus' : x.toFixed(0);
	}
	</script>
</section>

<section>
	<h2 id="idEvo" class="clear">Simulierte Evolution</h2>
	<p>Mikroben mit einem achtteiligen Bewegungs-Genom (acht relative Drehrichtungen) suchen Nahrung in einer toroidalen Welt. Hartes Lenken kostet Energie, scharfe Umkehrungen sind besonders teuer — über Generationen passen sich die Strategien an das jeweilige Nahrungs-Spawnmuster an. Die genauen Regeln stehen unterhalb des Applets.</p>

	<span class="applet-fit" style="--applet-w:1600; --applet-h:900;">
		<span id='cvEvo'>
			<span id="evoControls" class="applet-controls bottom-right">
				<span class="ac-row">
					<b>Welt:</b>
					<select id="evoSpawn" style="min-width:150px" onchange="evo.setSpawnStrategy(parseInt(this.value, 10))">
						<option value="0">Gleichverteilt</option>
						<option value="1">Linien</option>
						<option value="2">Rechteck</option>
						<option value="3">Wandernder Kreis</option>
						<option value="4">Punktquellen</option>
						<option value="5">Mix</option>
					</select>
					<b>Farbe:</b>
					<select id="evoColMode" style="min-width:100px" onchange="evo.setColorMode(parseInt(this.value, 10))">
						<option value="0">Genom</option>
						<option value="1">Alter</option>
						<option value="2">Energie</option>
					</select>
					<b>Ticks/Frame</b>
					<select id="evoTpf" onchange="evo.ticksPerFrame = parseInt(this.value, 10)">
						<option value="1">1</option>
						<option value="2">2</option>
						<option value="5">5</option>
						<option value="10">10</option>
						<option value="20">20</option>
						<option value="50">50</option>
						<option value="100">100</option>
						<option value="200">200</option>
					</select>
					<button type="button" onclick="evo.reset()">Reset</button>
				</span>
				<span class="ac-row">
					<b>Pause:</b>
					<button id="evoPause" class="ac-icon" type="button" onclick="evoTogglePause()" title="Pause / Weiter">⏸</button>
					<button class="ac-icon" type="button" onclick="evoStep()" title="Einzelschritt">▶❙</button>
					<b>Auswahl:</b>
					<button class="ac-icon" type="button" onclick="evoSelect(-1)" title="vorherige Mikrobe (←/↑)">◀</button>
					<button class="ac-icon" type="button" onclick="evoSelect(+1)" title="nächste Mikrobe (→/↓)">▶</button>
					<button type="button" onclick="evoSelectOldest()">Älteste</button>
					<button type="button" onclick="evoDeselect()">Aufheben</button>
				</span>
			</span>
			<span class="applet-controls corner-tl">
				<span class="ac-row">
					<button class="ac-icon" type="button" title="Vollbild" aria-label="Vollbild" onclick="toggleFullscreen(this)">⛶</button>
					<button id="evoGear" class="ac-icon" type="button" title="Parameter und Steuerung ein/aus" aria-label="Parameter und Steuerung ein/aus" onclick="evoToggleParams()">⚙</button>
				</span>
			</span>
			<span id="evoParams" class="applet-controls left bottom">
				<span class="ac-row"><b>Energie pro Nahrung</b>
					<input id="evoEpf" type="number" min="1" max="500" step="1" onchange="evo.energyPerFood = Math.max(1, parseInt(this.value, 10) || 1)"/>
				</span>
				<span class="ac-row"><b>Max. Energie</b>
					<input id="evoEmax" type="number" min="10" max="100000" step="10" onchange="evo.energyMax = Math.max(10, parseInt(this.value, 10) || 10)"/>
				</span>
				<span class="ac-row"><b>Reproduktions-Schwelle</b>
					<input id="evoEtr" type="number" min="10" max="100000" step="10" onchange="evo.energyToReproduce = Math.max(10, parseInt(this.value, 10) || 10)"/>
				</span>
				<span class="ac-row"><b>Energie pro Tick</b>
					<input id="evoEpt" type="number" min="0" max="100" step="1" onchange="evo.energyPerTick = Math.max(0, parseInt(this.value, 10) || 0)"/>
				</span>
				<span class="ac-row"><b>Nahrungs-Wachstum</b>
					<input id="evoFgr" type="number" min="1" max="1.05" step="0.001" onchange="evo.foodGrowthFactor = Math.max(1, Math.min(1.05, parseFloat(this.value) || 1))"/>
				</span>
				<span class="ac-row" style="display:none"><b>Toxizität Ring</b>
					<input id="evoTox" type="number" min="0" max="255" step="1" onchange="evo.ringHostility = Math.max(0, Math.min(255, parseInt(this.value, 10) || 0))"/>
				</span>
			</span>
		</span>
	</span>

	<script src="./scripts/SimulatedEvolutionGPU.js"></script>
	<script>
	var evo = new SimulatedEvolutionGPU({ cvid         : 'cvEvo',
	                                      width        : 1600,
	                                      height       : 900,
	                                      cellPx       : 2,   // px per cell
	                                      microbeCells : 3 }); // microbe sprite = N×N cells
	document.getElementById('evoTpf').value     = evo.ticksPerFrame;
	document.getElementById('evoSpawn').value   = evo.spawnStrategy;
	document.getElementById('evoColMode').value = evo.colorMode;
	document.getElementById('evoEpf').value  = evo.energyPerFood;
	document.getElementById('evoEmax').value = evo.energyMax;
	document.getElementById('evoEtr').value  = evo.energyToReproduce;
	document.getElementById('evoEpt').value  = evo.energyPerTick;
	document.getElementById('evoFgr').value  = evo.foodGrowthFactor;
	document.getElementById('evoTox').value  = evo.ringHostility;

	function evoSyncPauseLabel() {
		document.getElementById('evoPause').textContent = evo.paused ? '⏵' : '⏸';
	}
	evo.setOnPauseChange(evoSyncPauseLabel);
	// Hand focus back to the applet container so arrow keys reach the
	// keydown handler instead of getting eaten by the just-clicked button.
	function evoRefocus() { document.getElementById('cvEvo').focus(); }
	function evoTogglePause() {
		evo.togglePause();
		evoSyncPauseLabel();
		evoRefocus();
	}
	function evoStep() {
		evo.stepOnce();
		evoSyncPauseLabel();
		evoRefocus();
	}
	function evoSelect(dir) {
		evo.selectNext(dir);
		evoRefocus();
	}
	function evoSelectOldest() {
		evo.selectOldest();
		evoRefocus();
	}
	function evoDeselect() {
		evo.deselect();
		evoRefocus();
	}
	function evoToggleParams() {
		var ctrls = document.getElementById('evoControls');
		var prms  = document.getElementById('evoParams');
		var hide  = (ctrls.style.display !== 'none');
		ctrls.style.display = hide ? 'none' : '';
		prms.style.display  = hide ? 'none' : '';
		evoRefocus();
	}
	</script>

	<h3>Regeln der Simulation</h3>

	<h4>Welt</h4>
	<ul>
		<li>Diskretes 2D-Zellgitter (Default 800×450 Zellen, je 2×2 Pixel) mit toroidalen Rändern — Zellen am rechten Rand grenzen an die am linken, oben an unten.</li>
		<li>Pro Zelle gilt: ein <i>akkumulierender</i> Nahrungsvorrat zwischen 0 und einer harten Obergrenze von 255 Energieeinheiten, dazu beliebig viele Mikroben. Mehrere Mikroben auf derselben Zelle teilen sich den dortigen Nahrungsvorrat (wer im Tick-Loop früher dran ist, beißt zuerst).</li>
	</ul>

	<h4>Mikrobe</h4>
	<ul>
		<li>Eigenschaften: Position, letzte Bewegungsrichtung (eine von acht: N, NO, O, SO, S, SW, W, NW), Energie und ein <b>8-dimensionales Genom</b>.</li>
		<li>Die acht Gene sind Wahrscheinlichkeiten für eine <i>relative Drehung</i> gegenüber der aktuellen Bewegungsrichtung (0° geradeaus, +45°, +90°, +135°, 180° = Umkehr, –135°, –90°, –45°). Die Summe aller acht Werte ist 1.</li>
		<li>Die Farbe einer Mikrobe codiert ihr Genom: aus den sieben <i>Drehgenen</i> (alle außer „Geradeaus") wird ein 2D-Drift-Vektor gebildet, normiert auf die Summe dieser Gene. Sein Winkel bestimmt den Farbton, seine Länge die Sättigung. Das Geradeaus-Gen wird ausgeblendet, weil es bei nahezu allen Mikroben dominiert — Selektion zeigt sich erst in den feineren Dreh-Präferenzen, die so direkt sichtbar werden. Ein 1 Pixel breiter Rand in der RGB-Komplementärfarbe trennt benachbarte Mikroben und hält auch graue (isotrope) Mikroben sichtbar.</li>
	</ul>

	<h4>Ablauf pro Tick</h4>
	<ol>
		<li>Bewegung um eine Zelle in der zuletzt gewählten Richtung. Belegung der Zielzelle spielt keine Rolle — mehrere Mikroben dürfen sich eine Zelle teilen.</li>
		<li>Liegt Nahrung auf der aktuellen Zelle und die Energie ist unter dem Maximum, wird ein Biss genommen: maximal <code>energyPerFood</code> Einheiten pro Tick, höchstens so viel wie noch in den Energiespeicher passt, und höchstens so viel wie tatsächlich auf der Zelle liegt. Der Rest bleibt für spätere Ticks oder andere Mikroben liegen. Satte Mikroben (Energie = Max) fressen nichts.</li>
		<li>Aus dem Genom wird per Roulette-Wahl die nächste relative Drehung gezogen — eine der acht Aktionen von „Geradeaus" bis „Umkehr".</li>
		<li>Die Aktion verursacht Lenkungskosten (siehe Tabelle).</li>
		<li>Sinkt die Energie unter 0, stirbt die Mikrobe. Übersteigt sie die Reproduktions-Schwelle, wird eine Tochter erzeugt (siehe Reproduktion).</li>
	</ol>

	<h4>Lenkungskosten</h4>
	<table class="applet-params">
		<tr><th>Aktion</th><th>Energiekosten</th></tr>
		<tr><td>Geradeaus (0°)</td><td>0</td></tr>
		<tr><td>±45°</td><td>1</td></tr>
		<tr><td>±90°</td><td>2</td></tr>
		<tr><td>±135°</td><td>4</td></tr>
		<tr><td>180° (Umkehr)</td><td>8</td></tr>
	</table>

	<h4>Reproduktion</h4>
	<ul>
		<li>Übersteigt die Energie einer Mikrobe die Reproduktions-Schwelle, wird eine Tochter <b>direkt auf der Zelle der Mutter</b> platziert. Mutter und Tochter teilen sich danach Zelle und Nahrungsvorrat und konkurrieren um die dortigen Ressourcen.</li>
		<li>Bei der Teilung wird die Elternenergie halbiert; die Tochter erhält die andere Hälfte als Startenergie.</li>
		<li>Die Tochter erbt das Genom der Mutter mit einer Mutation: ein zufällig ausgewähltes der acht Gene wird um einen Wert aus [-0.5, +0.5] verschoben (auf ≥ 0 begrenzt) und das gesamte Genom anschließend renormiert.</li>
	</ul>

	<h4>Nahrung</h4>
	<p>Jeder Spawn legt <code>energyPerFood</code> Einheiten auf eine Zielzelle ab. Trifft der Spawn eine bereits gefüllte Zelle, addiert sich der neue Beitrag zum bestehenden Vorrat (bis Cap 255). Zusätzlich wird zu Beginn jedes Ticks der Vorrat <i>jeder</i> nicht-leeren Zelle exponentiell multipliziert (Default-Faktor 1.001/Tick) — auch eine Zelle, die seit Generationen keinen Spawn mehr abbekommen hat, wächst aus sich heraus weiter, sofern dort noch etwas liegt. Wegen der Uint8-Quantisierung wird der Bruchteil pro Zelle in einem Akkumulator mitgeführt, damit auch kleine Vorräte zuverlässig wachsen statt zu stagnieren.</p>
	<p>Erreicht eine Zelle die Obergrenze 255 und produziert weiter, fließt der überschüssige Zuwachs als <i>Spill-over</i> an eine zufällig gewählte nicht-volle 8-Nachbarzelle ab — die Masse bleibt also erhalten, und gesättigte Kerne dehnen sich nach und nach in ihre Nachbarschaft aus. Sind alle acht Nachbarn ebenfalls voll (Klumpen-Inneres), wird der Überschuss verworfen.</p>
	<p>Die Spawn-Muster bestimmen, <i>wo</i> neue Nahrung in die Welt eingebracht wird:</p>
	<ul>
		<li><b>Gleichverteilt</b>: kleine Nahrungsmenge pro Tick zufällig über das gesamte Feld gestreut.</li>
		<li><b>Punktquellen</b>: wie „Gleichverteilt", aber jeden Tick wird zusätzlich an 1000 festen Quell-Punkten Nahrung deponiert (jeweils <code>energyPerFood</code> Einheiten, Uint8-gedeckelt bei 255). Jeder „Punkt" besteht aus <b>zwei direkt benachbarten Zellen</b> (insgesamt also 2000 Spawn-Zellen) — diese Paar-Geometrie ist der eigentliche Selektionsdruck auf das Umkehr-Gen: eine Mikrobe, die mit ±180° zwischen den beiden Quell-Zellen hin- und herpendelt, sitzt dauerhaft im vollen Nahrungsstrom; Umweg- und Schlangenlinien-Strategien laufen schnell aus dem Quellpaar heraus. Das Quell-Layout wird bei jedem Reset neu gewürfelt.</li>
		<li><b>Linien</b>: ein 5×5-Raster langer waagerechter und senkrechter Streifen plus leichter gleichmäßiger Hintergrund-Sprenkel.</li>
		<li><b>Rechteck</b>: Nahrung erscheint primär innerhalb eines stationären Rechtecks im Zentrum. Zusätzlich ein dünner gleichverteilter Hintergrund-Sprenkel über das gesamte Feld mit 1/10 der Box-Spawn-Rate, damit Mikroben außerhalb des Rechtecks nicht völlig ohne Nahrungsquelle sind.</li>
		<li><b>Wandernder Kreis</b>: ein kleines kreisförmiges Spawn-Feld (Radius ≈ 0,375 × Referenzkante) pendelt diagonal durch die Welt mit Toroidal-Wrap. Die Geschwindigkeit startet beim Reset bei 0 und steigt linear über ca. 20 000 Ticks auf den Zielwert (≈ 0,28 c/t Magnitude). Alle 600 Ticks dreht der Patch seine Driftrichtung um 180°. Im Patch-Inneren wird Nahrung zufällig deponiert (20-fache Spawn-Rate gegenüber den anderen Modi); ein kleines Quadrat um den Patch entfernt jede überschüssige Nahrung außerhalb. Links und rechts der Patch-Bahn (im perpendikularen Abstand zur Pfad-Linie) liegen zwei statische toxische Bänder. Die Bänder reichen vom Patch-Radius bis zur Referenzkante und stoßen damit gerade noch nicht in die Bewegungszone des Kreises hinein. In Band-Zellen ist der Eintrag in der Lebensfeindlichkeits-Map konstant gleich „Toxizität Ring" (Default 10); Mikroben verlieren beim Betreten zusätzlich zur normalen Stoffwechsel-Energie diese Menge pro Tick. — Hinweis: dieser Modus war als Demo für die Selektion des Umkehr-Gens gedacht, hat in der Praxis aber nicht wie erwartet funktioniert; in der Beobachtung setzen sich überwiegend „cheap turn"-Strategien (mehrere kleine Drehungen) durch, nicht die teure 180°-Umkehr. Die saubere Reverse-Demo ist <b>Punktquellen</b>. Der Kreis-Modus bleibt zum Experimentieren erhalten.</li>
		<li><b>Mix</b>: kombiniert drei der anderen Welten in einem Feld als visueller Vergleich der Spawn-Geometrien. Horizontaler 50/50-Split: linke Hälfte trägt ein quadratisches Linien-Gitter (Spacing so gewählt, dass die Maschen visuell quadratisch sind), oben rechts liegt ein zentriertes Nahrungsquadrat im Stil von „Rechteck" (auf den Quadranten skaliert), unten rechts pumpen 1000 Paar-Punktquellen wie in „Punktquellen", aber auf den unteren rechten Quadranten beschränkt. Dazu ein leichter gleichmäßiger Sprenkel über das gesamte Feld, damit Totzonen nicht völlig nahrungsfrei sind. Punkt-Quellen-Nachbarn werden hier an den Quadrantenrand geklemmt statt toroidal gewickelt, damit „Bottom-Right"-Quellen nicht in die Linien- oder Box-Zone springen.</li>
	</ul>

	<h4>Anzeige des mittleren Genoms</h4>
	<ul>
		<li>Die acht radialen Balken zeigen die Bevölkerungs-Mittelwerte der Drehgene relativ zur Bewegungsrichtung der Mikrobe (Balken nach oben = „geradeaus", nach unten = „Umkehr", usw.).</li>
		<li>Der gestrichelte Kreis markiert <b>1/8 = 0.125</b> — den Erwartungswert bei rein zufälligem Verhalten. Balken darüber bedeuten Bevorzugung dieser Richtung, darunter Vermeidung.</li>
		<li>In der Mitte wird ein vergrößertes Sprite der „mittleren Mikrobe" gezeichnet — in der Farbe, die sich aus dem Genom-Durchschnitt der ausgewerteten Population ergibt (gleiche HSV-Abbildung wie bei den lebenden Mikroben). Direkt unter der Radial-Grafik steht der Stats-Streifen mit Ø Energie, Ø Alter und Max. Alter.</li>
	</ul>

	<h4>Inspektion einzelner Mikroben</h4>
	<ul>
		<li><b>Pause / Einzelschritt:</b> ⏸ hält die Simulation an (Render läuft weiter, Sim-Ticks pausieren), ▶❙ rückt im Pause-Modus exakt einen Tick vor. Auch per Leertaste, wenn der Applet-Container den Fokus hat.</li>
		<li><b>Klick</b> in die Welt wählt die nächstgelegene lebende Mikrobe aus. Im Genom-Panel werden dann ihre individuellen Gene gezeigt, im Stats-Streifen Energie, Alter und aktuelle Bewegungsrichtung. Ein Fadenkreuz markiert ihre Position; stirbt sie, wird die Auswahl automatisch gelöscht.</li>
		<li><b>Pfeiltasten / ◀ ▶ Buttons</b> iterieren durch die lebenden Mikroben in Slot-Reihenfolge. <b>Älteste</b> springt direkt auf die älteste Mikrobe; <b>Aufheben</b> löscht jede Auswahl.</li>
		<li><b>Rubberband-Mehrfachauswahl:</b> Maus mit gedrückter linker Taste über die Welt ziehen. Beim Loslassen werden alle lebenden Mikroben innerhalb des Rechtecks ausgewählt (Snapshot — die Auswahl folgt anschließend den Mikroben, wandert aber nicht mit dem Rechteck mit). Das Genom-Panel zeigt dann den Durchschnitt der Auswahl, der Stats-Streifen Ø Energie / Ø Alter / Max. Alter <i>nur dieser</i> Mikroben. Ein neuer Drag ersetzt die Auswahl, ein einfacher Klick fällt auf Einzelauswahl zurück.</li>
		<li><b>Zoom &amp; Pan:</b> Mausrad zoomt auf die aktuelle Cursorposition (Faktor 1 bis 16). <b>Shift + Linksdrag</b> pannt im hineingezoomten Zustand. Linksdrag ohne Shift bleibt das Rubberband-Selektions-Rechteck, der Shift-Modifier am Anfang des Drags entscheidet, welche Geste gestartet wird. Reset setzt sowohl die Simulation als auch die Ansicht zurück.</li>
	</ul>
</section>

<?php $page->build_html_bottom(__FILE__); ?>