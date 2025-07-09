// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBj8xPy81NaxFwHmBL3ni_UVjYKFZflyv0",
  authDomain: "exploridemap.firebaseapp.com",
  projectId: "exploridemap",
  storageBucket: "exploridemap.firebasestorage.app",
  messagingSenderId: "1074659589759",
  appId: "1:1074659589759:web:f8bdffc15d41d47ac8094a"
};

// Inicjalizacja Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
