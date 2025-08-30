const emojiList = window.emojiList = [
  { id: "emoji1", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e0.svg" }, // 🏠 Dom
  { id: "emoji2", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e1.svg" }, // 🏡 Dom z ogrodem
  { id: "emoji3", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e2.svg" }, // 🏢 Biurowiec
  { id: "emoji4", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e3.svg" }, // 🏣 Poczta japońska
  { id: "emoji5", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e4.svg" }, // 🏤 Poczta europejska
  { id: "emoji6", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e5.svg" }, // 🏥 Szpital
  { id: "emoji7", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e6.svg" }, // 🏦 Bank
  { id: "emoji8", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e8.svg" }, // 🏨 Hotel
  { id: "emoji9", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3e9.svg" }, // 🏩 Love hotel
  { id: "emoji10", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3ea.svg" }, // 🏪 Sklep nocny
  { id: "emoji11", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3eb.svg" }, // 🏫 Szkoła
  { id: "emoji12", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3ec.svg" }, // 🏬 Centrum handlowe
  { id: "emoji13", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3ed.svg" }, // 🏭 Fabryka
  { id: "emoji14", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3f0.svg" }, // 🏰 Zamek europejski
  { id: "emoji15", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3db.svg" }, // 🏛️ Budynek klasyczny
  { id: "emoji16", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3da.svg" }, // 🏚️ Opuszczony dom
  { id: "emoji17", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3df.svg" }, // 🏟️ Stadion
  { id: "emoji18", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3d7.svg" }, // 🏗️ Dźwig budowlany
  { id: "emoji19", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3d8.svg" }, // 🏘️ Osiedle domków
  { id: "emoji20", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f5fc.svg" }, // 🗼 Wieża (Tokyo Tower)
  { id: "emoji21", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3a1.svg" }, // 🎡 Diabelski młyn
  { id: "emoji22", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f682.svg" }, // 🚂 Lokomotywa
  { id: "emoji23", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f693.svg" }, // 🚓 Radiowóz
  { id: "emoji24", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f697.svg" }, // 🚗 Samochód
  { id: "emoji25", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/26fd.svg" }, // ⛽ Stacja
  { id: "emoji26", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/2708.svg" }, // ✈️ Samolot
  { id: "emoji27", url: "https://cdn-icons-png.freepik.com/512/2492/2492016.png?ga=GA1.1.2137604307.1753910010" }, // komin
  { id: "emoji28", url: "https://cdn-icons-png.freepik.com/512/4331/4331490.png?ga=GA1.1.2137604307.1753910010" }, // wiatrak
  { id: "emoji29", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/26ea.svg" }, // ⛪ Kościół
  { id: "emoji30", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f54d.svg" }, // 🕍 Synagoga
  { id: "emoji31", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/26f4.svg" }, // ⛴️ Prom
  { id: "emoji32", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f3ac.svg" }, // 🎬 Klaps
  { id: "emoji33", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f6ab.svg" }, // 🚫 Zakaz
  { id: "emoji34", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f510.svg" }, // 🔐 Zamek
  { id: "emoji35", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1faa9.svg" }, // 🪩 Kula
  { id: "emoji36", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/2620.svg" }, // ☠️ Skull
  { id: "emoji37", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f47b.svg" }, // 👻 Ghost
  { id: "emoji38", url: "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png" }, // red pin
  { id: "emoji39", url: "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png" }, // blue pin
  { id: "emoji40", url: "https://maps.gstatic.com/mapfiles/ms2/micons/orange-dot.png" }, // orange pin
  { id: "emoji41", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/2139.svg" }, // ℹ️ info
  { id: "emoji42", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/2754.svg" }, // ❔ białe ?
  { id: "emoji43", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/2753.svg" }, // ❓ czerwone ?
  { id: "emoji44", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/2755.svg" }, // ❕ białe !
  { id: "emoji45", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/2757.svg" }, // ❗ czerwone !
  { id: "emoji46", url: "https://www.svgrepo.com/show/475670/pinterest-color.svg" }, // pinterest
  { id: "emoji47", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f69c.svg" }, // 🚜 traktor
{ id: "emoji48", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/2692.svg" }, // ⚒️ kopalnia
  { id: "emoji49", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1fa96.svg" }, // 🪖 hełm
    { id: "emoji50", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/26e9.svg" } // ⛩️ chiński most

];
