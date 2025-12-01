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

window.addPinOffline = async function({ lat, lng, name, opis, warstwa, emoji }){
  const now = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection('pinezki2').add({
    lat,
    lng,
    nazwa: name,
    opis,
    warstwa,
    emoji,
    createdAt: now,
    updatedAt: now
  });
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

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js');
    });
  }

window.addEventListener('offline', () => {
  showOfflineBar(true);
  showBanner('Offline', 'error');
});
window.addEventListener('online', () => {
  showOfflineBar(false);
  showBanner('Połączono – synchronizuję…', 'info');
  flushQueuedUploads({}).then(() => {
    showBanner('Zsynchronizowano', 'success');
  }).catch(() => {
    showBanner('Błąd synchronizacji – spróbuj ponownie', 'error');
  });
});

const syncBtn = document.getElementById('syncBtn');
if (syncBtn) {
  syncBtn.addEventListener('click', async () => {
    showBanner('Synchronizuję…', 'info');
    try {
      await flushQueuedUploads({});
      showBanner('Zsynchronizowano', 'success');
    } catch (e) {
      showBanner('Błąd synchronizacji – spróbuj ponownie', 'error');
    }
  });
}
