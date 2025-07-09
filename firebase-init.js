// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: "TWOJ_API_KEY",
  authDomain: "exploridemap.firebaseapp.com",
  projectId: "exploridemap",
  storageBucket: "exploridemap.appspot.com",
  messagingSenderId: "TWOJ_SENDER_ID",
  appId: "TWOJ_APP_ID"
};

// Inicjalizacja Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();