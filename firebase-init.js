// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBj8xPy81NaxFwHmBL3ni_UVjYKFZflyv0",
  authDomain: "exploridemap.firebaseapp.com",
  projectId: "exploridemap",
  storageBucket: "exploridemap.firebasestorage.app",
  messagingSenderId: "1074659589759",
  appId: "1:1074659589759:web:f8bdffc15d41d47ac8094a",
  measurementId: "G-2JHQZ6HXTM"
};

// Inicjalizacja Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
// Udostępnij instancje innym skryptom
if (typeof window !== 'undefined') {
  window.db = db;
  window.storage = storage;
}

if (typeof module !== 'undefined') {
  module.exports = { db, storage };
}

console.log("Firebase test!", firebaseConfig);
