// Atlas der Exoplaneten: die Ansicht "Entdeckungsmethoden".
//
// Das Skript meldet beim Atlas eine Ansicht an (siehe "Ansichten der Titelzeile" in atlas.js): In der
// Mitte läuft das Applet zu einem Nachweisverfahren, rechts steht eine Kachel je Verfahren (der
// Doppler-Effekt ist kein Verfahren und fehlt deshalb); ein linkes Panel hat die Ansicht nicht. Ein
// Klick auf eine Kachel wechselt das Verfahren. Die Applets selbst liegen außerhalb des Atlas (im
// Repository unter applets/<name>, der gemeinsame Baukasten unter shared/exo-kit); ihre Skripte
// werden erst beim ersten Öffnen geladen.
//
// Wo sie liegen, sagt die Einstellung "methods" des Atlas (siehe Kopf von atlas.js), alle Angaben optional:
//   kit      Ordner des Baukastens, mit js/ und exo-kit.css   (Vorgabe: ../../shared/exo-kit/)
//   sprites  Ordner der Bilder der Applets                     (Vorgabe: <kit>assets/sprites/)
//   applets  { "transit": Ordner, "radial-velocity": …, "pulsar-timing": …, "microlensing": … }
//            jeweils der Ordner, in dem js/ des Applets liegt   (Vorgabe: ../exoplanet-transit/ usw.)
//   version  Kennung, die als "?v=…" an die Adressen der nachgeladenen Skripte gehängt wird, damit ein
//            Server mit langer Zwischenspeicherung neue Fassungen ausliefert (Vorgabe: keine)
// Die Vorschaubilder der Kacheln gehören zum Atlas: atlas/images/methods/<id>.jpg.
(function (global) {
  'use strict';

  // Skripte des Baukastens und der Applets, in Ladereihenfolge (wie in den index.html der Applets;
  // test/methods.test.js prüft, dass beides übereinstimmt).
  const KIT_SCRIPTS = ['kit', 'frame-loop', 'sprites', 'scrub-input', 'draw', 'chart', 'observatory', 'shell'];
  const APPLETS = [
    { id: 'transit', namespace: 'Transit', folder: '../exoplanet-transit/',
      scripts: ['config', 'texts', 'transit-model', 'scene-view', 'app'] },
    { id: 'radial-velocity', namespace: 'RadialVelocity', folder: '../exoplanet-radial-velocity/',
      scripts: ['config', 'texts', 'orbit-model', 'scene-view', 'app'] },
    { id: 'pulsar-timing', namespace: 'PulsarTiming', folder: '../exoplanet-pulsar-timing/',
      scripts: ['config', 'texts', 'pulsar-model', 'scene-view', 'app'] },
    { id: 'microlensing', namespace: 'Microlensing', folder: '../exoplanet-microlensing/',
      scripts: ['config', 'texts', 'lens-system', 'image-brightness', 'light-curve', 'layout', 'sky-raster', 'ray-tracer',
        'backdrop', 'scene-view', 'chart-view', 'stage', 'playback', 'app'] },
  ];
  const DEFAULT_KIT = '../../shared/exo-kit/';

  const TEXT = {
    de: {
      button: 'Entdeckungsmethoden',
      hint: 'Wie Exoplaneten gefunden werden: vier Verfahren als bewegte Schemata.',
      title: 'Entdeckungsmethoden',
      intro: 'Wie findet man Planeten fremder Sterne? Ein Klick zeigt das Verfahren in Bewegung.',
      close: 'Zurück zum Diagramm',
      previous: 'Vorheriges Verfahren',
      next: 'Nächstes Verfahren',
      loading: 'Das Applet wird geladen …',
      failed: 'Das Applet konnte nicht geladen werden.',
      applets: {
        'transit': { title: 'Transitmethode',
          text: 'Ein Planet zieht vor seinem Stern vorbei und verdeckt einen Teil der Scheibe. Die Helligkeit sinkt für kurze Zeit.' },
        'radial-velocity': { title: 'Radialgeschwindigkeit',
          text: 'Stern und Planet umkreisen ihren gemeinsamen Schwerpunkt. Die Bewegung des Sterns verschiebt die Linien seines Spektrums.' },
        'pulsar-timing': { title: 'Pulsar-Timing',
          text: 'Ein Planet zieht seinen Pulsar um den gemeinsamen Schwerpunkt. Dessen Pulse treffen dadurch leicht verschoben ein.' },
        'microlensing': { title: 'Mikrolinsenereignisse',
          text: 'Ein Stern mit Planet zieht vor einem Hintergrundstern vorbei und bündelt dessen Licht. Der Planet hinterlässt zwei kurze Spitzen.' },
      },
    },
    en: {
      button: 'Detection methods',
      hint: 'How exoplanets are found: four methods as animated diagrams.',
      title: 'Detection methods',
      intro: 'How are planets of other stars found? Click a method to see it in motion.',
      close: 'Back to the diagram',
      previous: 'Previous method',
      next: 'Next method',
      loading: 'Loading the applet …',
      failed: 'The applet could not be loaded.',
      applets: {
        'transit': { title: 'Transit method',
          text: 'A planet passes in front of its star and covers part of the disk. The brightness drops for a short time.' },
        'radial-velocity': { title: 'Radial velocity',
          text: 'Star and planet orbit their common center of mass. The motion of the star shifts the lines of its spectrum.' },
        'pulsar-timing': { title: 'Pulsar timing',
          text: 'A planet pulls its pulsar around their common center of mass, so its pulses arrive slightly shifted.' },
        'microlensing': { title: 'Microlensing',
          text: 'A star with a planet passes in front of a background star and focuses its light. The planet leaves two brief spikes.' },
      },
    },
  };

  const withSlash = (path) => (path && !path.endsWith('/') ? path + '/' : path);

  // Lädt Skripte der Reihe nach, jedes nur einmal.
  const loaded = new Map();
  function loadScript(url) {
    if (!loaded.has(url)) {
      loaded.set(url, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => { loaded.delete(url); reject(new Error(url)); };
        document.head.appendChild(script);
      }));
    }
    return loaded.get(url);
  }
  function loadScripts(urls) {
    return urls.reduce((chain, url) => chain.then(() => loadScript(url)), Promise.resolve());
  }
  function loadStyle(url) {
    if (document.querySelector('link[data-atlas-methods]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-atlas-methods', '');
    document.head.appendChild(link);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Baut die Ansicht für das Gerüst des Atlas.
  // context: { lang, config (Einstellungen des Atlas), assets (Ordner des Atlas), back(), update() }
  function createPage(context) {
    const paths = (context.config && context.config.methods) || {};
    const kit = withSlash(paths.kit || DEFAULT_KIT);
    const sprites = withSlash(paths.sprites || kit + 'assets/sprites/');
    const images = context.assets + 'atlas/images/methods/';
    const folderOf = (applet) => withSlash((paths.applets && paths.applets[applet.id]) || applet.folder);
    const versioned = (url) => (paths.version ? url + '?v=' + encodeURIComponent(paths.version) : url);

    let lang = TEXT[context.lang] ? context.lang : 'de';
    let current = null;        // das laufende Applet (Eintrag aus APPLETS); null, solange die Ansicht nicht zu sehen ist
    let last = APPLETS[0];     // das zuletzt gezeigte Verfahren: damit beginnt die Ansicht beim nächsten Öffnen
    let mounted = null;        // { api, root }
    let token = 0;             // verwirft Ladevorgänge, die von einem neueren überholt wurden

    // Mitte: oben der Name des Verfahrens und der Knopf zurück zum Diagramm, darunter das Applet.
    // Die Pfeile blättern durch die Verfahren; sie sind nur auf schmalen Bildschirmen zu sehen, wo die
    // Kacheln nicht neben dem Applet stehen (atlas.css).
    const box = el('section', 'atlas-methods-stage');
    const name = el('h2', 'atlas-methods-name');
    const stepButton = (delta, glyph) => {
      const b = el('button', 'atlas-methods-step', glyph);
      b.type = 'button';
      b.addEventListener('click', () => run(APPLETS[(APPLETS.indexOf(current) + delta + APPLETS.length) % APPLETS.length]));
      return b;
    };
    const prevBtn = stepButton(-1, '‹'), nextBtn = stepButton(1, '›');
    const title = el('div', 'atlas-methods-title');
    title.append(prevBtn, name, nextBtn);
    const closeBtn = el('button', 'atlas-methods-close');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const closeText = el('span');
    closeBtn.appendChild(closeText);
    closeBtn.addEventListener('click', () => context.back());
    const bar = el('div', 'atlas-methods-bar');
    bar.append(title, closeBtn);
    const body = el('div', 'atlas-methods-applet');
    box.append(bar, body);

    // Rechts: Überschrift, ein Satz und eine Kachel je Verfahren.
    const panel = el('div', 'atlas-methods-panel');

    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (resize) resize.observe(body);

    function tx() { return TEXT[lang]; }

    // Das Applet so breit wie möglich, aber so, dass Zeichenfläche und Bedienleiste in die Höhe passen.
    function fit() {
      if (!mounted) return;
      const view = global[current.namespace].config.view;
      const controls = 60;                                     // Bedienleiste des Applets
      const width = Math.min(body.clientWidth, (body.clientHeight - controls) * view.width / view.height);
      mounted.root.style.maxWidth = Math.max(280, Math.floor(width)) + 'px';
    }

    function unmount() {
      if (mounted) mounted.api.destroy();
      mounted = null;
      token++;
      body.replaceChildren();
    }

    // Lädt die Skripte des Applets nach und startet es.
    function mount(applet) {
      const t = tx(), mine = token;
      body.replaceChildren(el('p', 'atlas-methods-note', t.loading));
      loadStyle(versioned(kit + 'exo-kit.css'));
      const urls = KIT_SCRIPTS.map((script) => kit + 'js/' + script + '.js')
        .concat(applet.scripts.map((script) => folderOf(applet) + 'js/' + script + '.js')).map(versioned);
      loadScripts(urls).then(() => {
        if (mine !== token || current !== applet) return;
        const root = el('div');
        body.replaceChildren(root);
        mounted = { root: root, api: global[applet.namespace].mount(root, { lang: lang, assetPath: sprites }) };
        fit();
      }).catch(() => {
        if (mine === token) body.replaceChildren(el('p', 'atlas-methods-note', t.failed));
      });
    }

    // Füllt das rechte Panel. Die Kachel des laufenden Verfahrens ist hervorgehoben.
    function renderPanel() {
      const t = tx();
      const list = el('div', 'atlas-methods-list');
      for (const applet of APPLETS) {
        const tile = el('button', 'atlas-methods-tile');
        tile.type = 'button';
        tile.setAttribute('aria-pressed', String(current === applet));
        const image = el('img');
        image.src = images + applet.id + '.jpg';
        image.alt = '';
        const text = el('span', 'atlas-methods-tile-text');
        text.append(el('strong', '', t.applets[applet.id].title), el('span', '', t.applets[applet.id].text));
        tile.append(image, text);
        tile.addEventListener('click', () => run(applet));
        list.appendChild(tile);
      }
      panel.replaceChildren(el('h2', 'atlas-guide-title', t.title), el('p', 'atlas-methods-intro', t.intro), list);
    }

    // Zeigt ein Verfahren (Eintrag aus APPLETS).
    function run(applet) {
      unmount();
      current = last = applet;
      const t = tx();
      name.textContent = t.applets[applet.id].title;
      closeText.textContent = t.close;
      prevBtn.title = t.previous; prevBtn.setAttribute('aria-label', t.previous);
      nextBtn.title = t.next; nextBtn.setAttribute('aria-label', t.next);
      mount(applet);
      renderPanel();
    }

    return {
      id: 'methods',
      label: () => tx().button,
      hint: () => tx().hint,
      center: box,
      right: panel,
      // id: Kennung eines Verfahrens wie in APPLETS; ohne geht es beim zuletzt gezeigten weiter.
      open(id) {
        const applet = APPLETS.find((a) => a.id === id) || current || last;
        if (applet !== current) run(applet);
      },
      leave() { unmount(); current = null; },
      setLang(next) {
        lang = TEXT[next] ? next : 'de';
        if (current) run(current);          // das laufende Applet in der neuen Sprache neu starten
      },
      // Esc führt zurück zur vorherigen Ansicht.
      handleKey(event) {
        if (event.key !== 'Escape') return false;
        context.back();
        return true;
      },
    };
  }

  (global.ExoAtlasPages = global.ExoAtlasPages || []).push(createPage);
  global.ExoAtlasMethods = { createPage: createPage, applets: APPLETS, kitScripts: KIT_SCRIPTS, texts: TEXT };
})(typeof window !== 'undefined' ? window : globalThis);
