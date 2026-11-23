// Einblendung über dem Bild: Bezugsradius mit erwarteter Drehgeschwindigkeit, Vorschau unter dem Mauszeiger,
// Markierung des verfolgten Körpers und ein Hinweistext. Bekommt alles, was zu zeichnen ist, als Szene übergeben.
(function (Disk) {
'use strict';

const FONT = '12.5px "Avenir Next", "Segoe UI", "Noto Sans", "DejaVu Sans", system-ui, sans-serif';
const ICE = '127,212,255', INK = '233,230,223';

class Hud {
  // canvas: 2D-Zeichenfläche, die deckungsgleich über dem Bild liegt
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = null;
  }

  // scene:
  //   project(p)        Punkt im Raum → Bildpunkt oder null
  //   up                Richtung, die im Bild oben ist
  //   plane             { e1, e2 }, zwei Achsen in der Scheibenebene
  //   turnPerSecond(r)  Winkel, um den sich die Scheibe bei Radius r in einer Sekunde Echtzeit dreht
  //   above             true in der Draufsicht (dann wirken Klicks auf die Scheibe)
  //   co                gewählter Bezugsradius, 0 = aus
  //   follow            null oder { spot, earth, rank }: Ort, Masse und Rang nach Masse des verfolgten Körpers
  //   bodies            die gelisteten Körper als { index, spot, radius }: Nummer, Ort und Scheibenradius in Bildpunkten
  //   pointed           null oder { x, y, radius, rank, earth }: der gewachsene Körper unter dem Mauszeiger
  //   hover             null oder { x, y, radius }: Mauszeiger und der Radius darunter
  draw(scene) {
    const canvas = this.canvas, ctx = this.ctx, fmt = Disk.fmt;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.scene = scene;

    for (const b of scene.bodies) {   // Nummern aus der Liste der schwersten Körper
      const q = scene.project(b.spot);
      if (!q) continue;
      const off = b.radius * 0.71 + 9;
      ctx.fillStyle = `rgb(${INK})`;
      this.label(String(b.index), q[0] + off, q[1] - off, 'center');
    }
    if (scene.pointed) {   // Rang und Masse des Körpers unter dem Mauszeiger
      const b = scene.pointed;
      ctx.setLineDash([]); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${INK},0.9)`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 5, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillStyle = `rgb(${INK})`;
      this.label(`Rang ${b.rank} nach Masse · ${fmt(b.earth, b.earth < 10 ? 1 : 0)} Erdmassen`, b.x + b.radius + 12, b.y + b.radius + 14, 'left');
    }
    if (scene.follow) {   // der Körper, mit dem die Kamera umläuft
      const q = scene.project(scene.follow.spot);
      if (q) {
        ctx.setLineDash([]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#7fd4ff';
        ctx.beginPath(); ctx.arc(q[0], q[1], 14, 0, 2 * Math.PI); ctx.stroke();
        ctx.fillStyle = '#7fd4ff';
        this.label(`${scene.follow.rank ? 'Rang ' + scene.follow.rank + ' nach Masse · ' : ''}${fmt(scene.follow.earth, 0)} Erdmassen · die Kamera läuft mit`, q[0] + 22, q[1], 'left');
      }
    } else if (scene.co > 0) this.ring(scene.co, true, null);
    if (!scene.above) return;
    if (scene.hover) this.ring(scene.hover.radius, false, [scene.hover.x, scene.hover.y]);   // Vorschau unter dem Mauszeiger
    ctx.fillStyle = 'rgba(163,167,180,0.95)';
    this.label(scene.follow ? 'Die Kamera läuft mit einem Körper um. Ein Klick auf die Scheibe wählt stattdessen einen Radius.'
               : scene.co > 0 ? 'Klick auf die Scheibe wählt einen anderen Radius, Klick auf den Stern beendet das Mitdrehen.'
                              : 'Klick auf die Scheibe: Die Kamera dreht mit der Umlaufgeschwindigkeit dieses Radius mit.',
               W / 2, W < 760 ? 66 : 30, 'center');
  }

  ringPoint(r, a) { const { e1, e2 } = this.scene.plane; return [0, 1, 2].map(i => r * (e1[i] * Math.cos(a) + e2[i] * Math.sin(a))); }

  // Bogen in der Scheibenebene beim Radius r von Winkel a0 bis a1
  arc(r, a0, a1) {
    const ctx = this.ctx, n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 0.04));
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= n; i++) {
      const q = this.scene.project(this.ringPoint(r, a0 + (a1 - a0) * i / n));
      if (!q) { pen = false; continue; }
      if (pen) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
      pen = true;
    }
    ctx.stroke();
  }

  speedText(r) {
    const turns = this.scene.turnPerSecond(r) / (2 * Math.PI);
    return turns >= 1 ? `${Disk.fmt(turns, 1)} Umläufe je Sekunde` : `ein Umlauf in ${Disk.fmt(1 / turns, 1)} s`;
  }

  // Text mit dunklem Rand, damit er vor den Teilchen lesbar bleibt
  label(text, x, y, align) {
    const ctx = this.ctx;
    ctx.font = FONT; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(4,6,12,0.85)'; ctx.setLineDash([]);
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  // Ring beim Radius r. Der dicke Bogen zeigt, wie weit sich die Scheibe dort in einer Sekunde dreht, die Spitze die Richtung.
  ring(r, chosen, labelAt) {
    const ctx = this.ctx, scene = this.scene, { dot } = Disk.vec;
    const color = chosen ? ICE : INK;
    ctx.lineCap = 'round';
    ctx.setLineDash(chosen ? [] : [3, 6]); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${color},${chosen ? 0.5 : 0.55})`;
    this.arc(r, 0, 2 * Math.PI);

    const start = Math.atan2(dot(scene.up, scene.plane.e2), dot(scene.up, scene.plane.e1));   // Bogen beginnt am oberen Bildrand des Rings
    const sweep = Math.min(scene.turnPerSecond(r), 1.85 * Math.PI);
    ctx.setLineDash([]); ctx.lineWidth = chosen ? 3.5 : 2.5; ctx.strokeStyle = `rgba(${color},0.95)`;
    this.arc(r, start, start + sweep);
    const tip = scene.project(this.ringPoint(r, start + sweep)), before = scene.project(this.ringPoint(r, start + sweep - 0.03));
    if (tip && before) {
      const ang = Math.atan2(tip[1] - before[1], tip[0] - before[0]), size = chosen ? 9 : 7;
      ctx.fillStyle = `rgba(${color},0.95)`;
      ctx.beginPath();
      ctx.moveTo(tip[0] + Math.cos(ang) * size, tip[1] + Math.sin(ang) * size);
      ctx.lineTo(tip[0] + Math.cos(ang + 2.4) * size, tip[1] + Math.sin(ang + 2.4) * size);
      ctx.lineTo(tip[0] + Math.cos(ang - 2.4) * size, tip[1] + Math.sin(ang - 2.4) * size);
      ctx.fill();
    }
    const text = `Radius ${Disk.fmt(r, 2)} · ${this.speedText(r)}`;
    ctx.fillStyle = `rgb(${color})`;
    if (labelAt) this.label(text, labelAt[0] + 16, labelAt[1] + 18, 'left');
    else { const top = scene.project(this.ringPoint(r, start)); if (top) this.label(text, top[0], top[1] - 14, 'center'); }
  }
}

Disk.Hud = Hud;
})(globalThis.Disk = globalThis.Disk || {});
