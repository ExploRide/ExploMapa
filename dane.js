const warstwy = {};

function dodajPinezke(warstwa, wsp, nazwa, opis) {
  if (!warstwy[warstwa]) {
    warstwy[warstwa] = L.layerGroup().addTo(map);
  }
  const marker = L.marker(wsp).bindPopup(`<b>${nazwa}</b><br>${opis}`);
  warstwy[warstwa].addLayer(marker);
}

// PINEZKI Z PLIKU KML
dodajPinezke("Urban Climbing", [52.226611, 20.976278], "komin treningowy", "od Szymona.");
dodajPinezke("Urban Climbing", [52.269925, 21.06357], "Stary Komin dawny ZAKŁAD PRZEMYSŁU TŁUSZCZOWEGO", "");
dodajPinezke("Opuszczone Polska", [52.09534, 21.343449], "Opuszczony dom porwanej kobiety", "DO nowej serii");
dodajPinezke("Opuszczone Polska", [52.233463, 20.984064], "kamienica i morderstwo", "<a href=\"https://tvn24.pl/tvnwarszawa/najnowsze/warszawa-na-pradze-poludnie-znaleziono-cialo-mezczyzny-ra1128809\" target=\"_blank\">https://tvn24.pl/tvnwarszawa/najnowsze/warszawa-na-pradze-poludnie-znaleziono-cialo-mezczyzny</a>");
dodajPinezke("Opuszczone Polska", [51.93345, 21.910499], "do testa", "");

L.control.layers(null, warstwy).addTo(map);
