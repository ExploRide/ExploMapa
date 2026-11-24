# Synchronizacja opcji mapy w Firestore

W projekcie Firebase `exploridemap` dodaj poniższy blok wewnątrz
istniejącego `match /databases/{database}/documents`. Opublikuj połączone
reguły. Pozostałe kolekcje nadal korzystają z ich dotychczasowych reguł.

```firestore
match /mapOptions/{uid} {
  allow get, create, update: if request.auth != null && request.auth.uid == uid;
}
```

Dostęp do `mapOptions` powinien ograniczać się do dokumentu właściciela.
Firestore dopuszcza żądanie, jeśli zezwoli na nie dowolna pasująca reguła.
Sprawdź więc również reguły z wieloznacznikiem obejmujące tę kolekcję.
W symulatorze reguł sprawdź, czy użytkownik może odczytać i zapisać własny
dokument oraz czy odczyt i zapis dokumentu innego użytkownika są odrzucane.

Po wdrożeniu klienta sprawdź synchronizację na tym samym koncie w dwóch
przeglądarkach. W oknie „Opcje mapy” zmień skalę pinezek i potwierdź zmianę
na drugim urządzeniu. Pierwsza sesja, która zastanie pusty dokument i ma
lokalnie zapisane opcje, przenosi je do Firestore. Istniejący dokument
konta ma pierwszeństwo przed ustawieniami zapisanymi wcześniej lokalnie.
