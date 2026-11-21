// Steht am Ende jedes Berichts in discoveries/<sprache>/<id>.html.
//
// Wird der Bericht von atlas.html in einem unsichtbaren Rahmen geladen,
// schickt dieses Skript seinen Inhalt an die Seite zurück. So lassen sich die
// Berichte auch ohne Webserver (file://) nachladen, wo fetch() gesperrt ist.
// Direkt im Browser geöffnet ist der Bericht eine normale kleine Seite.

(function () {
  'use strict';
  if (window.parent === window) return;
  const article = document.querySelector('.exo-story');
  if (!article) return;
  const copy = article.cloneNode(true);
  // Adressen von Bildern und Links gelten relativ zu dieser Datei; die
  // einbettende Seite liegt woanders, deshalb vollständig ausschreiben.
  const originals = article.querySelectorAll('img[src], a[href]');
  copy.querySelectorAll('img[src], a[href]').forEach(function (node, i) {
    if (node.tagName === 'IMG') node.setAttribute('src', originals[i].src);
    else node.setAttribute('href', originals[i].href);
  });
  copy.querySelectorAll('script').forEach(function (node) { node.remove(); });
  window.parent.postMessage({ exoSnippet: true, id: article.getAttribute('data-id'), html: copy.innerHTML }, '*');
})();
