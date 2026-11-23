# Code for Hungary · civic-tech katalógus

Reszponzív, magyar nyelvű gyűjtőoldal a közügyek átláthatóságát segítő digitális kezdeményezésekhez. A teljes weboldal a `dist/` könyvtárban található; nincs fordítási lépés vagy csomagfüggőség. A közös tetszésszámlálóhoz külön szavazási API szükséges; a katalógus továbbra is statikus GitHub Pages-oldal.

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

JavaScript-szintaxis, CSV-feldolgozás és szavazás ellenőrzése:

```sh
npm run check
npm test
```

`npm install` nem szükséges. A szerver a `dist/` fájljait és a helyi `/api/likes` próbaszolgáltatást szolgálja ki; könyvtárlistát nem mutat.

## Tetszések és népszerűség szerinti sorrend

A kártyák alsó sorában a 👍 gomb mellett az összes tetszés száma látszik. Újabb kattintás visszavonja a saját tetszést. A **Legtöbb tetszés** és **Legkevesebb tetszés** rendezés a teljes betöltött gyűjteményre vonatkozik; azonos számlálónál magyar névsor dönt. A tetszés küldése nem zárja vissza a már kibontott kártyákat 12 darabra.

**Az éles tetszésszámlálóhoz Google Apps Script + Google Sheets készült.** A másolható kód és a lépésenkénti bekötés a [Google-beállítási útmutatóban](./backend/google-apps-script/README.md) található. A `setup()` külön, privát szavazattáblázatot hoz létre; a katalógus nyilvános adatlapját nem módosítja. A saját Google-fiókban közzétett webalkalmazás `/exec` végű URL-jét a `dist/config.js` `likesApiUrl` mezőjébe kell írni. A Google-telepítés és az éles kapcsolat ellenőrzése még hátravan.

Üres `likesApiUrl` mellett az `npm start` a helyi `/api/likes` próbaszolgáltatást használja; ezt a felületen is jelöljük. A helyi szavazatok a Gitből kizárt `.local/likes.json` fájlba kerülnek, így külön böngészők ugyanazokat az összesített számokat látják, újraindításkor is. Ezek nem kerülnek az éles oldalra. A helyi fájlos tároló egyetlen előnézeti szerverhez készült. **Ha megadod a Google URL-jét, a helyi előnézet is az éles szavazatokat használja.**

A GitHub Pages önmagában nem tudja fogadni és tárolni a szavazatokat. Bekötés nélkül az éles oldalon a szavazás és a népszerűségi rendezés nem aktív; a számlálók `–` jelet mutatnak. A katalógus ettől tovább működik. API-hibánál az utolsó igazolt szám vagy `–` látszik, az újrapróbálás elérhető. A mintaadatok előnézetében nem lehet szavazni. Az összesített számok oldalbetöltéskor, adatfrissítéskor és a saját tetszés módosításakor frissülnek; nincs folyamatos háttérlekérdezés.

A böngésző az első tetszéskor hoz létre véletlenszerű azonosítót a `localStorage`-ban (`c4hu-voter-v1`); puszta megtekintéskor nem. Ezzel lehet megjegyezni, mely projektekre szavazott. Nincs bejelentkezés, név vagy e-mail-cím. A helyi tároló az azonosító SHA-256 lenyomatát menti, a Google-változat ehhez a szkriptben tárolt véletlen sót is használ. A privát szavazattáblázat csak a projektazonosítót, ezt a lenyomatot és az időpontot tárolja. Böngészőadatok törlésével vagy másik böngészővel újabb szavazat adható: ez közösségi visszajelzés, nem személyazonossággal hitelesített szavazás. A projektek táblázatbeli **Azonosító** mezőjét töltsd ki, és tartsd állandónak, mert ehhez kapcsolódnak a szavazatok.

### API-szerződés az éles bekötéshez

Mindkét művelet URL-kódolt űrlapként küldött `POST`, sütik és felhasználói fiók nélkül. A válasz JSON. A kliens követi a Google Content Service átirányítását, és nem küld egyedi HTTP-fejléceket. A Google webalkalmazást anonim látogatók számára is hozzáférhetően kell közzétenni; a pontos beállítások az útmutatóban szerepelnek.

- Lekérés: `action=list`, `projectIds` = legfeljebb 500 egyedi projektazonosító JSON-tömbje, `voterId` = a böngésző UUID-ja vagy üres.
- Mentés: `action=set`, `projectId`, `voterId`, `liked=true` vagy `liked=false`. A mentés idempotens: ugyanaz a kérés ismételve nem növeli újra a számlálót.
- Siker: `{"ok":true,"projects":[{"id":"nerhotel","count":1,"liked":true}]}`. Lekéréskor minden kért projekthez kell bejegyzés, nulla szavazatnál is; mentéskor az érintett projekthez.
- Hiba: `{"ok":false,"error":"Felhasználónak szánt hibaüzenet."}`. A kliens időtúllépése 20 másodperc.

A mellékelt Apps Script szerveroldalon ellenőrzi az aktív projektazonosítókat, zárolással védi az egyidejű műveleteket, és megakadályozza az azonos böngészőazonosítóval küldött ismételt szavazatok duplázását. A látogatótól nem fogad összesített szavazatszámot. A frontendben nincs adatbázis-adminisztrátori kulcs.

## Tartalom szerkesztése

- `dist/index.html`: az oldal szerkezete és állandó szövegei.
- `dist/styles.css`: arculat, töréspontok és elrendezés.
- `dist/config.js`: a publikált CSV és a szavazási API címe, a beküldési e-mail-cím és a betöltési időkorlát.
- `dist/likes.js`: a szavazási API kliense és a népszerűségi rendezés.
- `backend/google-apps-script/`: az éles szavazási szolgáltatás kódja és telepítési útmutatója.
- `dist/csv.js`: CSV-feldolgozás és az adatok ellenőrzése.
- `dist/app.js`: adatbetöltés, keresés, szűrés és interakciók.
- `dist/downloads/civic-tech-minta.xlsx`: kitöltött mintaadatbázis és magyar útmutató.
- `dist/downloads/civic-tech-minta.csv`: ugyanannak a hat mintaadatnak az importálható CSV-változata.
- `dist/assets/`: logó, képernyőképek és egyéb helyi vizuális fájlok.

A beküldés egy előre kitöltött e-mailt nyit meg a látogató levelezőprogramjában. Nem küld automatikusan levelet és nem tárol beküldött adatokat. A cím a `dist/config.js` `submissionEmail` mezőjében állítható (alapértéke a közösség nyilvános címe: `hello@code4.hu`). Az előre kitöltött levél szövege a `dist/app.js` `mailBody` változójában szerkeszthető; a forráskód állapotát, GitHub-címét és licencét is bekéri. Az `index.html` alapértelmezett `mailto:` hivatkozásait is érdemes frissíteni a JavaScript nélküli megjelenítéshez.

## Google Sheets adatforrás és mintaexcel

Az **Ismersz egy jó kezdeményezést?** doboz alatt az alapból zárt **Adatbázis részletei** gomb nyitja meg az adatforrás állapotát és hivatkozását, a **Frissítés** gombot, az esetleges adatfigyelmeztetéseket, valamint az Excel- és CSV-minta letöltését.

Az oldal minden megnyitáskor közvetlenül a `dist/config.js` `csvUrl` mezőjében megadott, nyilvánosan publikált CSV-t tölti be. A **Frissítés** gomb újra lekéri az adatokat. Az alapértelmezett cím a felhasználó által megadott [Google Sheets CSV-export](https://docs.google.com/spreadsheets/d/e/2PACX-1vTu0zyHCCrXFWwK2CEhAbR7YgfmDZZ4wL099wPk34obxC2dvAf2VxBbDSl3yXHeGg7sg2NM4ComjHBA/pub?output=csv).

**A publikált CSV 2026. október 12-én elérhető volt, de üres választ adott.** Az oldal ezt külön jelzi. A **Mintaadatok megtekintése** gomb a helyi CSV hat kitöltött kezdeményezését mutatja meg, jól látható mintaadat-jelzéssel. Ez a gomb nem ír a Google Sheetsbe, és a következő oldalbetöltés ismét az élő adatforrást használja.

1. Nyisd meg a `dist/downloads/civic-tech-minta.xlsx` fájlt Excelben vagy importáld Google Sheetsbe.
2. Másold a **Kezdeményezések** munkalap teljes A1:R7 tartományát, a fejlécet is beleértve, a már publikált Google Sheets-munkalapra. Az **Útmutató** lapot ne másold az adatok közé. Alternatívaként importáld a mellékelt CSV-t.
3. Ha új Google-táblázatot használsz, a **Fájl → Megosztás → Közzététel az interneten** menüben csak a kezdeményezéseket tartalmazó munkalapot publikáld **CSV** formátumban. Az új exporthivatkozást írd a `csvUrl` mezőbe. A sima szerkesztési vagy megosztási link nem CSV-export.
4. A Google közzétett változatának frissülése után az oldalon kattints a **Frissítés**, illetve **Vissza a Google Sheets-adatokhoz** gombra.

A további kezdeményezéseket új sorokként add a Google Sheetshez. Az adatok frissítéséhez nem kell újra telepíteni a weboldalt. A képfájlok hozzáadásához viszont a weboldal fájljait is frissíteni kell, ha helyi képutat használsz.

### Öt új kezdeményezés importálása

A [civic-tech-uj-kezdemenyezesek.csv](./dist/downloads/civic-tech-uj-kezdemenyezesek.csv) a minta pontos oszlopsorrendjében tartalmaz öt további, 2026. október 12-én ellenőrzött rekordot: Kormányfigyelő, Hol a komment?, Magyar politikai Facebook-archívum, NKA-támogatások és értitek. UTF-8 kódolású, vesszővel elválasztott fájl; az idézőjelezés megőrzi a szövegen belüli vesszőket.

Importáld a fájlt egy külön munkalapra, majd az **A2:R6** tartományt másold a már publikált adatlap utolsó adatsora alá. A fejlécet ne másold be még egyszer. Üres adatlap esetén az **A1:R6** tartományt másold át a fejléccel együtt. A fájl nem tartalmazza a korábbi hat mintarekordot, és nem módosítja automatikusan a Google-táblázatot.

A képek a `dist/assets/screenshots/` mappában találhatók: `kormanyfigyelo.jpg`, `holakomment.jpg`, `fb-politika-archivum.jpg`, `nka-tamogatasok.jpg`, `ertitek.jpg`. Ezeket a fájlokat is töltsd fel a repositoryba a GitHub Pages frissítéséhez. A CSV képutai ezekre a helyi fájlokra mutatnak.

A Facebook-archívum nyílt forráskódját és GPL-3.0 licencét ellenőriztük; a másik négy rekord státusza **nem ismert**. Az üzemeltetői, adatkezelői és projektgazdai szerepeket a nevek mellett külön feltüntettük. Az adatokat igazoló hivatkozások a **Forrás** oszlopban szerepelnek. Az oldal saját CSV-feldolgozója mind az öt új sort, illetve a hat mintasorral egyesített tizenegy rekordot figyelmeztetés nélkül fogadja el.

### Új adatgyűjtés: 2026. október 13.

A [kitöltött Excel](./dist/downloads/civic-tech-kezdemenyezesek-2026-10-13.xlsx) és a [CSV-változat](./dist/downloads/civic-tech-kezdemenyezesek-2026-10-13.csv) az **Út a börtönbe**, a **Tisztítótűz** és a **HírSpektrum** adatait tartalmazza. A 18 oszlop sorrendje megegyezik a mintával. Az Excel **Kezdeményezések** lapjáról az **A2:R4** tartományt másold a publikált adatlap végére; a fejlécet ne ismételd meg. Üres adatlapra az A1:R4 tartományt másold.

A hozzájuk tartozó képek: `ut-a-bortonbe.jpg`, `tisztitotuz.jpg`, `hirspektrum.jpg` a `dist/assets/screenshots/` alatt. A Tisztítótűz képe az App Store-adatlapot mutatja. Az új adatok importálása nem történik meg a GitHubra feltöltéstől.

Mindhárom projekt nyílt forráskódú státusza **nem ismert**. Az Út a börtönbe készítőjének személyneve nem igazolt; a nyilvános projekt-email szerepel. A K-Monitor-adatbázis használatát a beküldő közléseként jelöltük. A Tisztítótűzhöz közvetlen e-mailt nem találtunk: a kapcsolat a fejlesztő igazolt App Store-profiljára vezet, és ezt a megjegyzés jelzi. A feltételek a beküldött tippek szerkesztői ellenőrzését igazolják, a teljes hírfolyam kézi kurálását nem.

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

A **Sorrend** menüben az alapértelmezett válogatás és a névsor mellett az **Ellenőrizve** dátum szerint is rendezhető a lista, a legújabb vagy a legrégebbi dátummal kezdve. A dátum nélküli kezdeményezések mindkét esetben a lista végére kerülnek.

A fejléc **Legutóbbi adatellenőrzés** dátuma az összes betöltött, aktív és érvényes kezdeményezés **Ellenőrizve** mezőjének legnagyobb értéke; a keresés, szűrés és lapozás nem módosítja. Ez a táblázatban megadott ellenőrzési dátum: a publikált Google Sheets CSV nem közli a munkafüzet utolsó szerkesztési idejét. Új ellenőrzés után az érintett sor **Ellenőrizve** mezőjét is frissítsd. Mintaelőnézetnél a felirat **Mintaadatok ellenőrizve**, dátum nélkül **nincs megadva**; betöltés közben vagy hiba esetén a dátum nem jelenik meg.

Elsőre legfeljebb 12 kártya jelenik meg. A lista alján a **Még több betöltése** gomb további legfeljebb 12 kártyát mutat, és eltűnik, amikor minden találat látható. Keresés, témaszűrés, rendezés vagy adatfrissítés után ismét az első 12 találat jelenik meg; a keresés és rendezés mindig a teljes betöltött adatállományra vonatkozik.

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
