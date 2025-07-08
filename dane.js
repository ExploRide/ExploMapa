const warstwy = {};
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}
function dodajPinezke(warstwa, wsp, nazwa, opis) {
  if (!warstwy[warstwa]) {
    warstwy[warstwa] = { grupa: L.layerGroup().addTo(map), pinezki: [] };
  }
  let lat = wsp[0], lon = wsp[1];
  const latStr = lat.toFixed(6);
  const lonStr = lon.toFixed(6);
  const gmap = `https://maps.google.com/?q=${latStr},${lonStr}`;
  const popup = `<b>${escapeHtml(nazwa)}</b><br>${escapeHtml(opis)}<br><br><b>GPS:</b> ${latStr}, ${lonStr}<br><a href='${gmap}' target='_blank'>📍 Otwórz w Google Maps</a>`;
  const marker = L.marker([lat, lon]).bindPopup(popup);
  marker.addTo(warstwy[warstwa].grupa);
  warstwy[warstwa].pinezki.push({ marker, nazwa });
}
dodajPinezke("Zakończone", [49.739767, 20.868944], "RAJD 1: Browar", "Zwiedzony ✔");
dodajPinezke("Zakończone", [49.74829, 20.095134], "RAJD 2: Elektrociepłownia", "Zwiedzona ✔");
dodajPinezke("Planowane", [49.81123, 20.26457], "RAJD 3: Zamek", "W planach 🏰");
dodajPinezke("Planowane", [49.85271, 20.123451], "RAJD 4: Fabryka", "W planach 🏭");
const sidebar = document.getElementById('sidebar');
Object.keys(warstwy).forEach(warstwa => {
  const div = document.createElement('div');
  div.className = 'warstwa';
  const naglowek = document.createElement('h3');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = true;
  toggle.addEventListener('change', () => {
    if (toggle.checked) { map.addLayer(warstwy[warstwa].grupa); }
    else { map.removeLayer(warstwy[warstwa].grupa); }
  });
  naglowek.textContent = warstwa;
  naglowek.prepend(toggle);
  div.appendChild(naglowek);
  const lista = document.createElement('div');
  lista.className = 'pinezki-lista';
  warstwy[warstwa].pinezki.forEach(p => {
    const el = document.createElement('div');
    el.className = 'pinezka';
    el.textContent = p.nazwa;
    el.addEventListener('click', () => p.marker.openPopup());
    lista.appendChild(el);
  });
  div.appendChild(lista);
  sidebar.appendChild(div);
});