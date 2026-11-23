// Maus und Finger auf der Zeichenfläche: Ziehen, Zoomen mit Rad oder zwei Fingern, Klicken und der Ort des
// Mauszeigers. Was daraus folgt, entscheiden die übergebenen Funktionen.
(function (Disk) {
'use strict';

class PointerInput {
  // canvas: die Zeichenfläche. handlers: { drag(dx, dy), zoom(factor), click(clientX, clientY) }
  constructor(canvas, handlers) {
    this.pointers = new Map();
    this.pinch = 0;
    this.hover = null;   // [clientX, clientY] der Maus über der Fläche, sonst null

    canvas.addEventListener('pointerdown', e => {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* kein echter Zeiger, etwa bei künstlichen Ereignissen */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, drag: false });
      this.pinch = 0;
    });
    canvas.addEventListener('pointermove', e => {
      this.hover = e.pointerType === 'mouse' ? [e.clientX, e.clientY] : null;
      const p = this.pointers.get(e.pointerId); if (!p) return;
      if (!p.drag && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 4) return;   // noch ein Klick, kein Ziehen
      const dx = p.drag ? e.clientX - p.x : 0, dy = p.drag ? e.clientY - p.y : 0;
      p.drag = true; p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 1) handlers.drag(dx, dy);
      else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) handlers.zoom(this.pinch / d);
        this.pinch = d;
      }
    });
    canvas.addEventListener('pointerup', e => {
      const p = this.pointers.get(e.pointerId);
      if (p && !p.drag && this.pointers.size === 1) handlers.click(e.clientX, e.clientY);
      this.pointers.delete(e.pointerId); this.pinch = 0;
    });
    canvas.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this.pinch = 0; });
    canvas.addEventListener('pointerleave', () => { this.hover = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); handlers.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  }

  // Liegt gerade eine Maustaste oder ein Finger auf der Fläche?
  get active() { return this.pointers.size > 0; }
}

Disk.PointerInput = PointerInput;
})(globalThis.Disk = globalThis.Disk || {});
