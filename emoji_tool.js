// emoji_tool.js
// Script for Emoji Tool modal

// ====== Konfiguracja (podaj tylko jeśli Twoja strona NIE inicjalizuje Firebase gdzie indziej) ======
const firebaseConfig = {
  apiKey: "AIzaSyBj8xPy81NaxFwHmBL3ni_UVjYKFZflyv0",
  authDomain: "exploridemap.firebaseapp.com",
  projectId: "exploridemap",
  storageBucket: "exploridemap.firebasestorage.app",
  messagingSenderId: "1074659589759",
  appId: "1:1074659589759:web:f8bdffc15d41d47ac8094a",
  measurementId: "G-2JHQZ6HXTM"
};

// ====== Loader modułów Firebase (v10) ======
import {
  initializeApp, getApps
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ====== Init (użyj istniejącej app jeśli jest; w przeciwnym razie zinicjalizuj) ======
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// ====== Mini CSS (namespacing, żeby nie gryźć się z Twoją stroną) ======
const css = `
  .expe-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:saturate(0.9) blur(2px);z-index:2147483000;display:none}
  .expe-modal{position:fixed;right:24px;bottom:24px;width:680px;max-width:calc(100vw - 32px);max-height:80vh;overflow:hidden;border-radius:16px;background:#151821;border:1px solid #202635;box-shadow:0 24px 60px rgba(0,0,0,.45)}
  .expe-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #1e2430}
  .expe-hdr h3{margin:0;font:600 15px/1.2 system-ui,-apple-system,Segoe UI,Roboto}
  .expe-hdr .expe-close{background:transparent;color:#9aa3b2;border:none;font-size:20px;cursor:pointer}
  .expe-wrap{display:grid;grid-template-columns:320px 1fr;gap:12px;padding:12px}
  .expe-card{background:#0f131b;border:1px solid #222a39;border-radius:12px;padding:10px}
  .expe-lbl{display:block;font:500 12px/1.2 system-ui;color:#9aa3b2;margin:6px 0}
  .expe-inp{width:100%;background:#0b0f16;border:1px solid #1d2330;border-radius:10px;color:#e6e8eb;padding:10px 12px;font-size:14px;outline:none}
  .expe-inp:focus{border-color:#2b88ff}
  .expe-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .expe-btn{background:#7aa2f7;color:#0c1020;border:none;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}
  .expe-btn[disabled]{opacity:.55;cursor:not-allowed}
  .expe-pill{background:#0f131b;border:1px solid #222a39;border-radius:999px;padding:6px 10px;font-size:12px;color:#cbd5e1}
  .expe-pill.ok{color:#3ddc97;border-color:#284c3f}
  .expe-pill.bad{color:#ff6b6b;border-color:#4c2b2b}
  .expe-log{height:48vh;min-height:260px;overflow:auto;background:#0b0f16;border:1px solid #1d2330;border-radius:10px;padding:10px;white-space:pre-wrap;font:12px ui-monospace,Consolas,Menlo}
  .expe-hint{font:12px/1.3 system-ui;color:#9aa3b2;margin-top:6px}
  @media (max-width:820px){.expe-wrap{grid-template-columns:1fr}}
`;
const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

// ====== UI injection ======
const backdrop = document.createElement('div');
backdrop.className = 'expe-modal-backdrop';
backdrop.innerHTML = `
    <div class="expe-modal" role="dialog" aria-modal="true" aria-label="Emoji tool">
      <div class="expe-hdr">
        <h3>🔧 Masowa edycja pola <code>emoji</code> w <code>pinezki2</code></h3>
        <button class="expe-close" title="Zamknij">×</button>
      </div>
      <div class="expe-wrap">
        <section class="expe-card">
          <label class="expe-lbl">Słowa kluczowe (oddzielone przecinkami)</label>
          <input id="expe-kw" class="expe-inp" placeholder="np. fabryka, cementownia, kopalnia, pałac">

          <label class="expe-lbl" style="margin-top:10px">Wartość do wpisania w polu <code>emoji</code></label>
          <input id="expe-emoji" class="expe-inp" placeholder="np. 📌 lub URL SVG" />

          <div style="height:1px;background:#1e2430;margin:10px 0"></div>

          <label class="expe-row"><input type="checkbox" id="expe-preview" checked> <span class="expe-lbl" style="margin:0">Podgląd (bez zmian)</span></label>
          <label class="expe-row" style="margin-top:6px"><input type="checkbox" id="expe-whole"> <span class="expe-lbl" style="margin:0">Dopasowanie całych słów</span></label>
          <label class="expe-row" style="margin-top:6px"><input type="checkbox" id="expe-case"> <span class="expe-lbl" style="margin:0">Rozróżniaj wielkość liter</span></label>
          <label class="expe-row" style="margin-top:6px"><input type="checkbox" id="expe-onlyempty"> <span class="expe-lbl" style="margin:0">Aktualizuj tylko, gdy <code>emoji</code> jest puste</span></label>

          <div style="height:1px;background:#1e2430;margin:10px 0"></div>

          <div class="expe-row">
            <button id="expe-start" class="expe-btn">Start</button>
            <button id="expe-stop" class="expe-btn" style="background:#3b4059;color:#cbd5e1" disabled>Stop</button>
          </div>

          <div class="expe-row" style="gap:8px;margin-top:8px">
            <span class="expe-pill">Znaleziono: <b id="expe-found">0</b></span>
            <span class="expe-pill ok">Zmieniono: <b id="expe-ok">0</b></span>
            <span class="expe-pill bad">Błędy: <b id="expe-bad">0</b></span>
            <span class="expe-pill">Pominięto: <b id="expe-skip">0</b></span>
          </div>

          <div class="expe-hint">Tip: najpierw użyj „Podgląd (bez zmian)”, potem odznacz i uruchom ponownie.</div>
        </section>

        <section class="expe-card">
          <strong style="display:block;margin-bottom:6px">Log</strong>
          <pre id="expe-log" class="expe-log" aria-live="polite"></pre>
        </section>
      </div>
    </div>`;
document.body.appendChild(backdrop);

// ====== helpers ======
const $ = (sel, root=document) => root.querySelector(sel);
const logEl = $('#expe-log');
let abortFlag = false;
const els = {
  kw: $('#expe-kw'), emoji: $('#expe-emoji'),
  preview: $('#expe-preview'), whole: $('#expe-whole'),
  kase: $('#expe-case'), onlyempty: $('#expe-onlyempty'),
  start: $('#expe-start'), stop: $('#expe-stop'),
  found: $('#expe-found'), ok: $('#expe-ok'), bad: $('#expe-bad'), skip: $('#expe-skip'),
  close: $('.expe-close'), modal: $('.expe-modal')
};

function log(msg){
  const t = new Date().toLocaleTimeString();
  logEl.textContent += `[${t}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}
function setCounters({found, ok, bad, skip}){
  if (found != null) els.found.textContent = found;
  if (ok != null) els.ok.textContent = ok;
  if (bad != null) els.bad.textContent = bad;
  if (skip != null) els.skip.textContent = skip;
}
function buildMatcher(keywords, {caseSensitive, wholeWord}){
  const parts = keywords.map(k=>k.trim()).filter(Boolean).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if (!parts.length) return null;
  const boundary = wholeWord ? '\\b' : '';
  try { return new RegExp(`${boundary}(${parts.join('|')})${boundary}`, caseSensitive ? '' : 'i'); }
  catch(e){ log(`❌ Błąd regex: ${e.message}`); return null; }
}

// ====== core ======
async function runUpdate(){
  abortFlag = false;
  els.start.disabled = true; els.stop.disabled = false;
  setCounters({found:0, ok:0, bad:0, skip:0});
  log('— START —');

  const keywords = (els.kw.value || '').split(',').map(s=>s.trim()).filter(Boolean);
  const emojiVal = els.emoji.value || '';
  const preview = els.preview.checked;
  const whole = els.whole.checked;
  const kase = els.kase.checked;
  const onlyEmpty = els.onlyempty.checked;

  if (!keywords.length){ log('⚠️ Brak słów kluczowych.'); resetButtons(); return; }
  if (!emojiVal && !preview){ log('⚠️ Puste pole emoji (a tryb NIE jest podglądem). Przerywam.'); resetButtons(); return; }

  const matcher = buildMatcher(keywords, {caseSensitive:kase, wholeWord:whole});
  if (!matcher){ resetButtons(); return; }

  log('Szukam w "pinezki2"…');
  try{
    const snap = await getDocs(collection(db, 'pinezki2'));
    const matched = [];
    snap.forEach(docSnap=>{
      const data = docSnap.data() || {};
      const nazwa = (data.nazwa ?? '').toString();
      if (matcher.test(nazwa)){
        matched.push({ id: docSnap.id, ref: docSnap.ref, nazwa, currentEmoji: data.emoji });
      }
    });

    setCounters({found: matched.length});
    log(`Znaleziono ${matched.length} dokumentów.`);

    if (preview){
      for (const m of matched){
        log(`🔎 [${m.id}] "${m.nazwa}" | emoji: ${JSON.stringify(m.currentEmoji)}`);
        if (abortFlag) break;
      }
      log('✅ Tryb podglądu – brak zapisów.');
      resetButtons(); return;
    }

    const BATCH_LIMIT = 500;
    let ok = 0, bad = 0, skip = 0;

    for (let i=0; i<matched.length && !abortFlag; i+=BATCH_LIMIT){
      const slice = matched.slice(i, i+BATCH_LIMIT);
      const batch = writeBatch(db);
      let writes = 0;

      for (const m of slice){
        if (onlyEmpty){
          const isEmpty = (m.currentEmoji === undefined || m.currentEmoji === null || m.currentEmoji === '');
          if (!isEmpty){ skip++; setCounters({skip}); continue; }
        }
        batch.update(m.ref, { emoji: emojiVal });
        writes++;
        log(`✏️ [${m.id}] "${m.nazwa}" → emoji = ${JSON.stringify(emojiVal)}`);
      }

      if (writes === 0){ continue; }
      try{
        await batch.commit();
        ok += writes; setCounters({ok});
        log(`✅ Zapisano batch ${writes}. Postęp: ${Math.min(i+BATCH_LIMIT, matched.length)}/${matched.length}`);
      }catch(e){
        bad += writes; setCounters({bad});
        log(`❌ Błąd commit batch: ${e.message}`);
      }
    }

    log('— PODSUMOWANIE —');
    log(`Zmieniono: ${ok} | Pominięto: ${skip} | Błędy: ${bad}`);
    if (abortFlag) log('⏹️ Przerwano przez użytkownika.');

  }catch(e){
    log(`❌ Błąd: ${e.message}`);
  }finally{
    resetButtons();
  }
}

function resetButtons(){ els.start.disabled = false; els.stop.disabled = true; abortFlag = false; }

// ====== interactions ======
const openBtn = document.getElementById('emojiToolBtn');
if (openBtn) openBtn.addEventListener('click', ()=>{ backdrop.style.display = 'block'; });
els.close.addEventListener('click', ()=>{ backdrop.style.display = 'none'; });
backdrop.addEventListener('click', (e)=>{ if(e.target === backdrop) backdrop.style.display='none'; });
els.start.addEventListener('click', runUpdate);
els.stop.addEventListener('click', ()=>{ abortFlag = true; els.stop.disabled = true; log('🛑 Żądanie przerwania…'); });
els.kw.addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey) runUpdate(); });
els.emoji.addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey) runUpdate(); });
