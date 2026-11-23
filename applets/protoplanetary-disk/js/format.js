// Zahlen in deutscher Schreibweise mit fester Stellenzahl, für alle Anzeigen
(function (Disk) {
'use strict';

Disk.fmt = (x, digits) => x.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
})(globalThis.Disk = globalThis.Disk || {});
