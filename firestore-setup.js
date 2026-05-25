// Firebase and PWA setup
// Replace placeholders with real Firebase config before deployment
const firebaseConfig = {
  apiKey: "AIzaSyBj8xPy81NaxFwHmBL3ni_UVjYKFZflyv0",
  authDomain: "exploridemap.firebaseapp.com",
  projectId: "exploridemap",
  storageBucket: "exploridemap.firebasestorage.app",
  messagingSenderId: "1074659589759",
  appId: "1:1074659589759:web:f8bdffc15d41d47ac8094a",
  measurementId: "G-2JHQZ6HXTM"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// expose for existing scripts
window.db = db;
window.auth = auth;
window.storage = storage;

if (db.enablePersistence) {
  db.enablePersistence({ synchronizeTabs: true }).catch(console.error);
}
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

const provider = new firebase.auth.GoogleAuthProvider();
window.signInWithGoogle = () => auth.signInWithPopup(provider);

auth.onAuthStateChanged(user => {
  if (user && user.email !== 'eksplorajder@gmail.com') {
    alert('Brak dostępu dla ' + user.email);
  }
});

window.addPinOffline = async function({ lat, lng, name, opis, warstwa, emoji, kategoriaGlowna = 'URBEX' }){
  const payload = {
    lat,
    lng,
    nazwa: name,
    opis,
    warstwa,
    kategoriaGlowna: kategoriaGlowna === 'TURYSTYCZNE' ? 'TURYSTYCZNE' : 'URBEX',
    emoji,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!navigator.onLine && window.upsertQueueOperation) {
    const queueEntry = await window.upsertQueueOperation({
      operation: 'createPin',
      payload,
      syncStatus: 'pending'
    });
    window.dispatchEvent(new CustomEvent('offline-pin-created', { detail: { ...payload, localId: queueEntry.localId, offline: true } }));
    return { id: queueEntry.localId, offline: true };
  }

  return db.collection('pinezki2').add(payload);
};

window.getCurrentPositionOnce = function() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Brak geolokalizacji'));
    navigator.geolocation.getCurrentPosition(pos => {
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, reject);
  });
};

window.renderSyncQueueCount = function(count){
  const el = document.getElementById('syncCount');
  if (el) el.textContent = count;
  const btnEl = document.getElementById('syncCountBtn');
  if (btnEl) btnEl.textContent = count;
};

window.updateSyncStatus = function(status){
  const el = document.getElementById('syncStatusText');
  if (el) el.textContent = status;
};

window.updateConnectionState = function(){
  const el = document.getElementById('connectionState');
  if (el) el.textContent = navigator.onLine ? 'online' : 'offline';
};

window.renderOfflinePinsList = function(items){
  const el = document.getElementById('offlinePinsList');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<li>Brak niezsynchronizowanych pinezek</li>';
    return;
  }
  el.innerHTML = items.map(item => {
    const p = item.payload || {};
    const name = p.nazwa || p.name || 'bez nazwy';
    const warstwa = p.warstwa || '-';
    const err = item.errorMessage ? ` | błąd: ${item.errorMessage}` : '';
    return `<li>⏳ ${name} [${warstwa}] — ${item.syncStatus}${err}</li>`;
  }).join('');
};

window.showBanner = function(text, type='info'){
  const el = document.getElementById('banner');
  if (!el) return;
  el.textContent = text;
  el.className = 'banner ' + type;
  el.style.display = 'block';
};

window.showOfflineBar = function(show){
  const el = document.getElementById('offlineBar');
  if (el) el.style.display = show ? 'block' : 'none';
};

window.addEventListener('offline', () => {
  updateConnectionState();
  updateSyncStatus('offline');
  showOfflineBar(true);
  showBanner('Offline', 'error');
});
window.addEventListener('online', () => {
  updateConnectionState();
  showOfflineBar(false);
  showBanner('Połączono – synchronizuję…', 'info');
  (window.syncOfflineQueue ? window.syncOfflineQueue() : Promise.resolve())
    .then((result) => {
      if (result && result.failed) throw new Error('sync fail');
      showBanner('Zsynchronizowano', 'success');
    })
    .catch(() => {
      showBanner('Błąd synchronizacji – spróbuj ponownie', 'error');
    });
});

const syncBtn = document.getElementById('syncBtn');
if (syncBtn) {
  syncBtn.addEventListener('click', async () => {
    showBanner('Synchronizuję…', 'info');
    try {
      if (window.syncOfflineQueue) await window.syncOfflineQueue();
      else await flushQueuedUploads({});
      showBanner('Zsynchronizowano', 'success');
    } catch (e) {
      showBanner('Błąd synchronizacji – spróbuj ponownie', 'error');
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  updateConnectionState();
  if (navigator.onLine) {
    if (window.syncOfflineQueue) window.syncOfflineQueue().catch(()=>{});
    else updateSyncStatus('zsynchronizowano');
  } else {
    updateSyncStatus('offline');
  }
});
