# Geokodowanie importowanych pinezek

Import KML, CSV z GPS i precyzyjnych linków Maps działa w przeglądarce. Do ustalania brakujących pozycji służy Worker. Przeglądarka wysyła identyfikatory CID do wyszukania w Wikidata, a przy braku wyniku przekazuje do Geoapify nazwę i adres. Notatki, tagi i oryginalne linki pozostają w aplikacji. Wyszukiwanie po samej nazwie i środek widoku z linku `@lat,lng` wymagają zatwierdzenia.

## Konfiguracja

1. Załóż projekt w Geoapify i utwórz klucz dla Geocoding API. Wybierz plan i ustaw limity kredytów odpowiednie dla tego projektu.
2. W `wrangler.toml` ustaw dokładny origin strony, bez ścieżki i końcowego ukośnika. Jeśli wdrażasz własną wersję aplikacji, ustaw aktualny kontakt w `WIKIDATA_USER_AGENT`.
3. Zaloguj się do Cloudflare przez Wrangler. Uruchom poniższe polecenia z katalogu `geocoding/`. Podaj klucz Geoapify jako `GEOAPIFY_KEY`, klucz API tego samego projektu Firebase co aplikacja jako `FIREBASE_API_KEY` oraz listę UID uprawnionych edytorów rozdzielonych przecinkami jako `ALLOWED_UIDS`. UID znajdziesz w Firebase Console w sekcji Authentication → Users.

   ```sh
   npx wrangler deploy
   npx wrangler secret put GEOAPIFY_KEY
   npx wrangler secret put FIREBASE_API_KEY
   npx wrangler secret put ALLOWED_UIDS
   ```

4. W `index.html` wpisz adres HTTPS wdrożonego Workera jako `data-geocoder-url` w elemencie `pinImportScript`. To publiczny adres usługi. Klucze dostawców pozostają w konfiguracji Workera. Przy publikowaniu zwiększ `BUILD_VERSION`, aby odświeżyć pamięć usługi offline.

Worker weryfikuje token zalogowanego użytkownika przez Firebase. Dostęp wymaga zgodności originu i UID z konfiguracją.

## Limity i źródła

- Geoapify rozlicza zwykłe zapytanie geokodowania jako jeden kredyt. Plan bezpłatny podaje 3000 kredytów dziennie. 106 nowych rekordów bez GPS i poprawnego wyniku CID oznacza do 106 zapytań w typowym przebiegu. Ponowienia mogą zwiększyć tę liczbę. Aktualny limit projektu obowiązuje niezależnie od ograniczeń Workera. [Cennik Geoapify](https://www.geoapify.com/pricing-details/)
- Kolejka wysyła do Geoapify najwyżej jedno żądanie co 1,1 s w jednej karcie. Worker dodatkowo ogranicza wywołania do 60 na minutę na lokalizację Cloudflare, oddzielnie dla każdego dostawcy. Żądania geokodowania po błędzie przejściowym są ponawiane do dwóch razy z opóźnieniem i z uwzględnieniem `Retry-After`. Sugestie Geoapify są przechowywane w pamięci karty. [Limity Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) · [Dokumentacja Geoapify](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/)
- CID i jego zapis szesnastkowy są dopasowywane w Wikidata przez P3749. Jedno zapytanie obejmuje do 50 CID. Pokrycie zależy od danych Wikidata, a niedostępność usługi przełącza kolejkę na wyszukiwanie po nazwie i adresie. Google Place ID można otworzyć przez oficjalny link Google Maps w podglądzie. Geoapify nie rozwiązuje identyfikatorów Google. [Wikidata P3749](https://www.wikidata.org/wiki/Property:P3749) · [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)

## Testy

Uruchom `node --test tests/pin-import.test.mjs` z katalogu głównego. Aby włączyć test pliku z zadania, ustaw `PIN_IMPORT_TEST_CSV` na ścieżkę do załączonego eksportu Google Takeout. Testy klienta i Workera używają kontrolowanych odpowiedzi dostawców.

## Opcjonalne dokładne rozpoznawanie linków Google Maps

Jeśli chcesz skorzystać z Google zamiast wyszukiwania nazwą, włącz w projekcie Google Cloud **Maps Experience agent tools API** oraz **Places API (New)**, włącz rozliczenia i skonfiguruj limity kosztów. Dodaj do Workera sekret `GOOGLE_MAPS_API_KEY` (klucz serwerowy z dostępem tylko do tych API) poleceniem `npx wrangler secret put GOOGLE_MAPS_API_KEY --name explomapa-geocoding`. Wdróż nową wersję Workera poleceniem `npx wrangler deploy --name explomapa-geocoding` w katalogu `geocoding`. Bez klucza importer nadal działa z Geoapify. Google Resolution API zwraca Place ID, a Places API (New) udostępnia współrzędne. Wynik pochodzący z linku Google Maps jest automatycznie przyjmowany tylko wtedy, gdy także nazwa miejsca jest mocno zgodna; inne wyniki wymagają ręcznej weryfikacji. API może naliczać opłaty i nie wszystkie linki będą obsługiwane.


## Minimalizacja kosztów Google Places

Worker żąda od Places API (New) tylko `id,location`. To **Place Details Essentials**, nie Pro. Zapytania do `resolveMapsUrls` pozostają bezpłatne. Rozpoznany, jednoznaczny link miejsca identyfikuje konkretny Place ID; nazwa pinezki jest zachowywana z oryginalnego CSV. Gdy Google nie rozpoznaje linku, działa wcześniejszy fallback Geoapify i ręczna weryfikacja.

Dla dodatkowej ochrony ustaw w Google Cloud Console → APIs & Services → Enabled APIs & services → Places API (New) → Quotas **dzienny limit zapytań** na poziomie np. 100–200 żądań/dzień, jeśli dostępny jest odpowiedni limit. Osobno ustaw alert budżetowy (alert nie zatrzymuje rozliczeń). Konta rozliczeniowe współdzielą limit darmowego użycia; poziom darmowy nie jest gwarancją zerowego rachunku. Nie ustawiaj restrykcji HTTP referrer dla klucza przechowywanego po stronie Workera.

Aby zaktualizować kod wdrożonego Workera, pobierz aktualne repozytorium i w katalogu `geocoding` uruchom `npx wrangler deploy --name explomapa-geocoding`. Sekrety Cloudflare powinny pozostać zachowane; sprawdzisz je przez `npx wrangler secret list --name explomapa-geocoding`.
