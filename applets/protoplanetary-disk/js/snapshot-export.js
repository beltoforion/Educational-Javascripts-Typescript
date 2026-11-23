// Datenabzug: speichert den Zustand der Simulation als JSON-Datei, etwa um einen Fehler nachzuvollziehen.
// Die Datei enthält alle Körper, die Kennzahlen, die Liste der schwersten Körper, die Kamera und ein Bild.
(function (Disk) {
'use strict';

// Gleitkommafeld → gewöhnliches Feld mit acht gültigen Stellen (mehr trägt eine 32-Bit-Zahl nicht)
Disk.roundedArray = typed => Array.from(typed, x => +x.toPrecision(8));

// data: beliebige Angaben, die JSON darstellen kann. layers: Zeichenflächen, die übereinander das sichtbare Bild ergeben.
// Muss im selben Durchlauf wie das Zeichnen aufgerufen werden, sonst ist die WebGL-Fläche schon geleert.
Disk.saveDump = function (data, layers) {
  const picture = document.createElement('canvas');
  picture.width = layers[0].width; picture.height = layers[0].height;
  const ctx = picture.getContext('2d');
  for (const layer of layers) ctx.drawImage(layer, 0, 0, picture.width, picture.height);
  data.bild = picture.toDataURL('image/jpeg', 0.85);

  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  link.download = `scheibe-datenabzug-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
};
})(globalThis.Disk = globalThis.Disk || {});
