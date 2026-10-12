# Code for Hungary · civic-tech katalógus

Reszponzív, magyar nyelvű gyűjtőoldal a közügyek átláthatóságát segítő digitális kezdeményezésekhez. A teljes weboldal a `dist/` könyvtárban található; nincs fordítási lépés, csomagfüggőség vagy háttérszerver.

## Helyi indítás

Node.js 20 vagy újabb szükséges. A projekt könyvtárában:

```sh
npm start
```

Az oldal címe: [http://127.0.0.1:4173/](http://127.0.0.1:4173/). A szerver csak a saját gépről érhető el. Leállítás: `Ctrl+C`.

Másik port használata:

```sh
npm start -- --port 4174
```

JavaScript-szintaxis és CSV-feldolgozás ellenőrzése:

```sh
npm run check
npm test
```

`npm install` nem szükséges. A szerver kizárólag a `dist/` fájljait szolgálja ki; könyvtárlistát nem mutat.

## Tartalom szerkesztése

- `dist/index.html`: az oldal szerkezete és állandó szövegei.
- `dist/styles.css`: arculat, töréspontok és elrendezés.
- `dist/config.js`: a publikált CSV címe, a beküldési e-mail-cím és a betöltési időkorlát.
- `dist/csv.js`: CSV-feldolgozás és az adatok ellenőrzése.
- `dist/app.js`: adatbetöltés, keresés, szűrés és interakciók.
- `dist/downloads/civic-tech-minta.xlsx`: kitöltött mintaadatbázis és magyar útmutató.
- `dist/downloads/civic-tech-minta.csv`: ugyanannak a hat mintaadatnak az importálható CSV-változata.
- `dist/assets/`: logó, képernyőképek és egyéb helyi vizuális fájlok.

A beküldés egy előre kitöltött e-mailt nyit meg a látogató levelezőprogramjában. Nem küld automatikusan levelet és nem tárol beküldött adatokat. A cím a `dist/config.js` `submissionEmail` mezőjében állítható (alapértéke a közösség nyilvános címe: `hello@code4.hu`). Az előre kitöltött levél szövege a `dist/app.js` `mailBody` változójában szerkeszthető; a forráskód állapotát, GitHub-címét és licencét is bekéri. Az `index.html` alapértelmezett `mailto:` hivatkozásait is érdemes frissíteni a JavaScript nélküli megjelenítéshez.

## Google Sheets adatforrás és mintaexcel

Az oldal minden megnyitáskor közvetlenül a `dist/config.js` `csvUrl` mezőjében megadott, nyilvánosan publikált CSV-t tölti be. A **Frissítés** gomb újra lekéri az adatokat. Az alapértelmezett cím a felhasználó által megadott [Google Sheets CSV-export](https://docs.google.com/spreadsheets/d/e/2PACX-1vTu0zyHCCrXFWwK2CEhAbR7YgfmDZZ4wL099wPk34obxC2dvAf2VxBbDSl3yXHeGg7sg2NM4ComjHBA/pub?output=csv).

**A publikált CSV 2026. október 12-én elérhető volt, de üres választ adott.** Az oldal ezt külön jelzi. A **Mintaadatok megtekintése** gomb a helyi CSV hat kitöltött kezdeményezését mutatja meg, jól látható mintaadat-jelzéssel. Ez a gomb nem ír a Google Sheetsbe, és a következő oldalbetöltés ismét az élő adatforrást használja.

1. Nyisd meg a `dist/downloads/civic-tech-minta.xlsx` fájlt Excelben vagy importáld Google Sheetsbe.
2. Másold a **Kezdeményezések** munkalap teljes A1:R7 tartományát, a fejlécet is beleértve, a már publikált Google Sheets-munkalapra. Az **Útmutató** lapot ne másold az adatok közé. Alternatívaként importáld a mellékelt CSV-t.
3. Ha új Google-táblázatot használsz, a **Fájl → Megosztás → Közzététel az interneten** menüben csak a kezdeményezéseket tartalmazó munkalapot publikáld **CSV** formátumban. Az új exporthivatkozást írd a `csvUrl` mezőbe. A sima szerkesztési vagy megosztási link nem CSV-export.
4. A Google közzétett változatának frissülése után az oldalon kattints a **Frissítés**, illetve **Vissza a Google Sheets-adatokhoz** gombra.

A további kezdeményezéseket új sorokként add a Google Sheetshez. Az adatok frissítéséhez nem kell újra telepíteni a weboldalt. A képfájlok hozzáadásához viszont a weboldal fájljait is frissíteni kell, ha helyi képutat használsz.

### Oszlopok

Az első sor az oszlopneveket tartalmazza, egy további sor egy kezdeményezés. Az oszlopok sorrendje tetszőleges; az alábbi magyar fejlécek használhatók. Az öt kötelező mező az aktív sorokban nem lehet üres.

| Oszlop | Tartalom |
| --- | --- |
| Azonosító | Ajánlott egyedi, állandó azonosító, pl. `nerhotel`. Üresen a névből készül. |
| Név | **Kötelező.** A kezdeményezés neve. |
| Weboldal | **Kötelező.** Teljes HTTP(S)-cím. |
| Cél | **Kötelező.** Milyen közügyi célt szolgál? |
| Címke 1, Címke 2 | Egy-egy rövid tematikus címke. |
| Témakörök | `atlathatosag`, `kozpenzek`, `nyilt-adatok`, `reszvetel`, `onkormanyzatok`; többet `\|` választ el. |
| Képernyőkép | Nyilvános HTTPS-képcím vagy `./assets/screenshots/valami.jpg`. Üres vagy nem elérhető képnél helyőrző jelenik meg. |
| Fejlesztők | **Kötelező.** Egy vagy több név, `\|` jellel elválasztva. A projektgazdai vagy más szerepet pontosítsd a névben. |
| Kapcsolatok | **Kötelező.** E-mail vagy HTTP(S)-cím. Nevenként egy kapcsolat azonos sorrendben, vagy egyetlen közös kapcsolat. |
| Nyílt forráskód | `igen`, `nem`, `nem ismert`; üresen ismeretlen. |
| GitHub repository | `https://github.com/tulajdonos/repository` alakú hivatkozás. |
| Licenc | A hivatkozott repository licence, pl. `GPL-3.0`. A részletes adatlapon látható. |
| Forrás | Az adatokat alátámasztó HTTP(S)-hivatkozások, `\|` jellel elválasztva. |
| Ellenőrizve | Valós dátum `YYYY-MM-DD` alakban, vagy üres. |
| Kép dátuma | A screenshot dátuma `YYYY-MM-DD` alakban, vagy üres. |
| Megjegyzés | Például demóoldal, alapszoftver vagy archív repository pontosítása. |
| Aktív | `igen` vagy üres: megjelenik; `nem`: rejtve marad. |

A kártyák külön jelzik a nyílt, nem nyílt és ismeretlen forráskód-állapotot. A nyilvános GitHub-link önmagában nem állítja nyílt forráskódúnak az oldalt. Az `igen` értékhez érvényes repository-hivatkozás szükséges; enélkül az állapot ismeretlen lesz és figyelmeztetés jelenik meg. A Járókelő mintasora egy régi nyílt repositoryt hivatkozik, de a jelenlegi oldal egyezése nem igazolt; ezt a megjegyzés és az ismeretlen státusz jelzi. A KiMitTud repositoryja az Alaveteli alapszoftveré.

A feldolgozó kezeli az idézőjeleket, a cellán belüli vesszőket és sortöréseket, a Windows-sortörést és az UTF-8 BOM-ot. A hibás sorokat sorszámmal jelzi; a többi érvényes sor megjelenik. Hibás fejléc, hibás CSV-szerkezet vagy kizárólag hibás aktív sorok esetén hibaüzenet jelenik meg. A maximális CSV-méret 2 MB, a letöltési időkorlát alapértelmezésben 15 másodperc. Betöltési hiba esetén nincs automatikus mintaadat-helyettesítés.

Az ékezetfüggetlen keresés a névben, leírásban, címkékben és készítőkben keres. A keresés, szűrő és rendezés URL-paraméterekben is megmarad, így egy szűrt nézet linkje megosztható. A `/` billentyű a keresőre ugrik, az `Esc` bezárja a részletes adatlapot.

## GitHub Pages publikálás

Az előkészített munkafolyamat csak akkor fut a GitHubon, ha a projektet egy GitHub-tárba feltöltöd. A helyi indítás nem publikálja az oldalt.

1. Hozz létre egy GitHub repositoryt, és töltsd fel a projekt fájljait a `main` vagy `master` ágra.
2. A repository **Settings → Pages → Build and deployment → Source** beállításánál válaszd a **GitHub Actions** lehetőséget.
3. Az **Actions** lapon indítsd el a **Publish GitHub Pages** munkafolyamatot a **Run workflow** gombbal. Később a `main` vagy `master` ágra küldött változtatások automatikusan frissítik az oldalt.
4. A sikeres futás után a közzétett oldal hivatkozása megjelenik a Pages beállításainál és a munkafolyamat `github-pages` környezetében.

A `.github/workflows/pages.yml` közvetlenül a `dist/` tartalmát tölti fel. A weboldal fájljai relatív elérési utakat használnak, ezért repositoryhoz tartozó Pages alkönyvtárban is működnek. Egyedi domain később a repository Pages beállításaiban adható meg.

A workflow az [egyedi GitHub Pages munkafolyamatok hivatalos útmutatóját](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) követi: `checkout@v6`, `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`.

## Arculat és források

A közösség bemutatkozásának és arculatának forrása a [Code for Hungary hivatalos oldala](https://code4.hu/). A kezdeményezések saját oldalaira vezető hivatkozások a katalógusban találhatók. A tartalmakat és elérhetőségeket érdemes időről időre felülvizsgálni.

A részletes kép-, betűkészlet- és repository-források az [ASSETS.md](./ASSETS.md) fájlban találhatók. A logó, a betűkészlet és mind a hat mintaképernyőkép helyben található. Az élő katalógus internetkapcsolatot és a publikált Google Sheets CSV elérhetőségét igényli. Új sorok külső képcímeket is használhatnak. Az oldal nem használ analitikát vagy sütiket.

## Ellenőrzés

2026. október 12-én az `npm run check` és mind a 16 `npm test` teszt sikeres. Az automatizált CSV-tesztek lefedik az idézőjeles mezőket, hibás fejléceket és sorokat, érvénytelen hivatkozásokat, dátumokat, aktív státuszt és a nyílt forráskód jelölését. A minta CSV hat rekordot ad vissza figyelmeztetés nélkül.

A helyi böngészőben ellenőrizve az élő üres adatforrás, a mintaelőnézet, az ékezetfüggetlen keresés, az A–Z rendezés, a témaszűrés, a részletes adatlap és a GitHub-/licencadatok. A 390 px-es nézetben nincs vízszintes túllógás; a böngésző nem jelzett konzolhibát. Az XLSX és CSV letöltése HTTP 200 választ és megfelelő fájltípust ad. A mentett Excelben ellenőrizve a két munkalap, a szűrhető adattábla, a rögzített első sor/első két oszlop és a státuszlisták. A GitHub Pages-publikálás elő van készítve, de nem történt meg.
