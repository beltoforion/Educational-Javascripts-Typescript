/*
 * Educational-Javascript-Typescript
 * https://github.com/beltoforion/Educational-Javascripts-Typescript
 *
 * Copyright (c) 2026, Ingo Berg
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the “Software”), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
// Lokaler Ersatz für assets/js/applet.js der Website.
// Stellt die vier Globals bereit, die die GPU-Applets bzw. die Seiten-Buttons
// erwarten: startAppletLoop, observeAppletVisibility, toggleFullscreen,
// toggleAppletControls.
(function () {
	'use strict';

	// Ruft onShow/onHide, sobald das Applet in den Viewport scrollt bzw. ihn
	// verlässt oder der Browser-Tab in den Hintergrund geht.
	function observeAppletVisibility(el, onShow, onHide) {
		var inView  = true;
		var tabLive = !document.hidden;
		var shown   = null;

		function sync() {
			var want = inView && tabLive;
			if (want === shown) return;
			shown = want;
			if (want) { if (onShow) onShow(); }
			else      { if (onHide) onHide(); }
		}

		if (el && typeof IntersectionObserver === 'function') {
			var io = new IntersectionObserver(function (entries) {
				for (var i = 0; i < entries.length; ++i) inView = entries[i].isIntersecting;
				sync();
			}, { threshold: 0 });
			io.observe(el);
			// Startzustand, bis der Observer das erste Mal feuert.
			var r = el.getBoundingClientRect();
			inView = r.bottom > 0 && r.top < (window.innerHeight || 0);
		}

		document.addEventListener('visibilitychange', function () {
			tabLive = !document.hidden;
			sync();
		});

		sync();
		return {
			pause:  function () { inView = false; sync(); },
			resume: function () { inView = true;  sync(); }
		};
	}

	// requestAnimationFrame-Schleife, die nur läuft, solange das Applet
	// sichtbar ist. frame() wird einmal pro Bild aufgerufen.
	function startAppletLoop(el, frame) {
		var running = false;
		var rafId   = 0;

		function tick() {
			if (!running) return;
			rafId = window.requestAnimationFrame(tick);
			frame();
		}
		function start() {
			if (running) return;
			running = true;
			rafId = window.requestAnimationFrame(tick);
		}
		function stop() {
			running = false;
			if (rafId) window.cancelAnimationFrame(rafId);
			rafId = 0;
		}

		observeAppletVisibility(el, start, stop);
		return { start: start, stop: stop };
	}

	function appletRoot(node) {
		return (node && node.closest) ? (node.closest('.applet-fit') || node.parentElement) : null;
	}

	// Vollbild für die gesamte Applet-Box (inkl. Bedienelemente).
	function toggleFullscreen(btn) {
		var root = appletRoot(btn);
		if (!root) return;

		var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
		if (fsEl) {
			if (document.exitFullscreen)            document.exitFullscreen();
			else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
			return;
		}
		if (root.requestFullscreen)            root.requestFullscreen();
		else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
	}

	// Blendet alle Bedienpanels aus/ein — außer der Ecke oben links, in der
	// dieser Knopf selbst sitzt.
	function toggleAppletControls(btn) {
		var root = appletRoot(btn);
		if (!root) return;

		var panels = root.querySelectorAll('.applet-controls:not(.corner-tl)');
		for (var i = 0; i < panels.length; ++i) {
			var p = panels[i];
			p.style.display = (p.style.display === 'none') ? '' : 'none';
		}
	}

	window.observeAppletVisibility = observeAppletVisibility;
	window.startAppletLoop         = startAppletLoop;
	window.toggleFullscreen        = toggleFullscreen;
	window.toggleAppletControls    = toggleAppletControls;
})();
