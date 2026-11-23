# A közös 👍 számláló bekötése Google Apps Script segítségével

A weboldal továbbra is GitHub Pages-en fut. A tetszéseket egy saját Google-fiókból futó Apps Script fogadja, és egy **külön, privát Google-táblázatban** tárolja. A katalógus meglévő, publikált CSV-jét csak olvassa. A látogatóknak nem kell bejelentkezniük.

A helyi kód elkészült és automatizált tesztekkel ellenőrzött. A saját Google-fiókodban történő telepítés és az utána végzett böngészős próba szükséges az éles bekötéshez.

## 1. Másold be a szkriptet

1. Nyisd meg a [Google Apps Scriptet](https://script.google.com/), és válaszd az **Új projekt / New project** lehetőséget. Nevezd el például „C4HU – tetszések”-nek.
2. A szerkesztőben nyisd meg a `Code.gs` fájlt, és cseréld le a teljes tartalmát a mellékelt [Code.gs](./Code.gs) tartalmára. Mentsd el.
3. A **Projektbeállítások / Project Settings** oldalon kapcsold be az **appsscript.json manifestfájl megjelenítését a szerkesztőben**. A szerkesztőbe visszatérve cseréld le az `appsscript.json` tartalmát a mellékelt [appsscript.json](./appsscript.json) tartalmára, és mentsd el. Ez beállítja a budapesti időzónát és a szükséges Google-jogosultságokat.

## 2. Hozd létre a privát szavazattáblázatot

A szerkesztő felső függvényválasztójában válaszd a **setup** függvényt, majd kattints a **Futtatás / Run** gombra. Az első futáskor a saját Google-fiókoddal engedélyezd a szkript számára a táblázatok kezelését és a külső adatforrás lekérését.

A sikeres futás létrehoz egy **Code for Hungary – tetszések (privát)** nevű táblázatot. A linkje a végrehajtási naplóban jelenik meg, és a Google Drive-odban is megtalálod. **Ezt a táblázatot ne publikáld CSV-ként és ne oszd meg a látogatókkal.** A `setup` újrafuttatása a meglévő táblázatot használja, nem törli a tetszéseket.

A `setup` a táblázat azonosítóját és az azonosítók lenyomatához használt véletlen értéket a szkript saját tulajdonságai közé menti. Ezeket nem kell a weboldalba másolni.

## 3. Tedd közzé webalkalmazásként

1. **Telepítés / Deploy → Új telepítés / New deployment.**
2. A típusválasztó fogaskeréknél válaszd a **Webalkalmazás / Web app** típust.
3. **Futtatás a következőként / Execute as: Én / Me** — a saját fiókod.
4. **Ki férhet hozzá / Who has access: Bárki / Anyone** — a Google-fiók nélküli látogatók is. A „bárki Google-fiókkal” beállítás nem megfelelő ehhez a bejelentkezés nélküli oldalhoz.
5. Kattints a **Telepítés / Deploy** gombra, és másold ki a **Webalkalmazás URL / Web app URL** mezőt.

A szükséges URL alakja:

```text
https://script.google.com/macros/s/SAJAT_TELEPITES_AZONOSITO/exec
```

A `/exec` végű címet használd, ne a `/dev` tesztcímet, a telepítési azonosítót vagy a Google-táblázat linkjét. A beállítások hátterét a [Google webalkalmazás-útmutatója](https://developers.google.com/apps-script/guides/web) és a [hozzáférési módok leírása](https://developers.google.com/apps-script/manifest/web-app-api-executable) ismerteti.

## 4. Kösd be a weboldalba, majd próbáld ki

A projekt [dist/config.js](../../dist/config.js) fájljában ezt a sort:

```js
likesApiUrl: '',
```

cseréld le a saját webalkalmazásod címével kitöltve:

```js
likesApiUrl: 'https://script.google.com/macros/s/SAJAT_TELEPITES_AZONOSITO/exec',
```

Ez nyilvános szolgáltatáscím, belekerülhet a GitHub repositoryba. A táblázat azonosítóját, a szkript tulajdonságait vagy Google-hozzáférési kulcsot ne másolj mellé.

Indítsd a helyi oldalt `npm start` paranccsal, és nyisd meg a [helyi előnézetet](http://127.0.0.1:4173/#kezdemenyezesek). Ha már fut, elég újratölteni. **A megadott Google URL mellett a helyi oldal is a közös, éles szavazatokkal dolgozik.** Üres URL mellett csak a helyi próbaszámláló működik.

Ellenőrizd a következőket:

- A számlálók betöltődnek, és elérhető a **Legtöbb tetszés** / **Legkevesebb tetszés** rendezés.
- Egy 👍 kattintás eggyel növeli a számot. Oldalfrissítés után is megmarad a saját jelölés. Egy újabb kattintás visszavonja.
- Egy másik böngészőben ugyanaz az összesített szám látszik, de ott még nincs saját jelölés.
- A privát táblázatban megjelenik a tesztszavazat sora; visszavonás után eltűnik. A próba végén vond vissza a tesztszavazatokat.

A `/exec` URL közvetlen megnyitására egy rövid JSON-válasz érkezik. Ez az elérhetőséget jelzi; a teljes működést a weboldalon végzett fenti próba igazolja.

## 5. Frissítsd a GitHub Pages-oldalt

A helyi próba után PowerShellben, a projekt könyvtárából:

```powershell
Set-Location 'C:\Users\juhas\Desktop\a\py\vkr'
npm run check
npm test
git add dist scripts tests backend README.md package.json
git commit -m "Add project likes with Google Apps Script"
git pull --rebase origin main
git push origin main
```

Csak sikeres ellenőrzések és hibamentes `pull` után lépj tovább. Ha a Git ütközést jelez, előbb azt kell rendezni. A szokásos Pages-munkafolyamat a `dist/` változásait teszi közzé. A helyi `.local/likes.json` próbaszavazatai nem kerülnek a repositoryba.

**A Git-push nem telepíti a Google-szkriptet.** Későbbi `Code.gs` módosításkor a Google-szerkesztőben is frissítsd a kódot, majd **Deploy → Manage deployments → ceruza / Edit → New version → Deploy**. Ezzel a meglévő webalkalmazás URL-je megtartható. A puszta mentés nem frissíti a már közzétett verziót.

## Működés és adatkezelés

- Projektenként egy aktív tetszés tartozhat egy böngészőazonosítóhoz. A szerver ugyanannak a kérésnek az ismétlését nem számolja új szavazatnak, és zárolással védi az egyidejű mentéseket.
- A véletlen böngészőazonosító az első tetszéskor kerül a böngésző `localStorage` tárolójába. A privát táblázat a projektazonosítót, a böngészőazonosító sózott SHA-256 lenyomatát és az időpontot tartalmazza. A kód nem kér nevet, e-mailt vagy Google-belépést a látogatóktól.
- A böngésző csak összesített számokat és a saját jelöléseit kapja vissza; nem kapja meg a táblázat nyers sorait. Az oldal megnyitásakor, adatfrissítéskor és a saját tetszés módosításakor kér adatot, folyamatos lekérdezés nincs.
- A böngészőadatok törlésével, inkognitóablakkal vagy másik böngészővel új azonosító szerezhető. Ez egyszerű közösségi visszajelzés; a böngészőnkénti korlát nem jelent személyenkénti hitelesítést.
- A katalógus **Azonosító** mezőit töltsd ki egyedi, állandó értékkel. Azonosítóváltás új projektet jelent a számláló számára. Törölt projektek szavazatai megmaradnak a privát táblázatban, de az oldal nem mutatja őket.
- A szkript csak az aktív katalógusban szereplő projektekhez fogad szavazatot. A lista legfeljebb egy percig gyorsítótárazott; új sor felvétele után ennyi késés előfordulhat. Ha a katalógus CSV-címe megváltozik, a `dist/config.js` mellett a `Code.gs` `CATALOG_CSV_URL` értékét is frissítsd, és telepíts új szkriptverziót.
- Lekérésenként legfeljebb 500 projekt támogatott. Egy böngészőazonosító percenként legfeljebb 30 tényleges módosítást végezhet; az ismételt, változást nem okozó kérés nem fogyasztja ezt a keretet. A Google saját szolgáltatási korlátai ezen felül érvényesek.

## Ha nem töltődnek be a tetszések

| Jelenség | Ellenőrzés |
| --- | --- |
| Helyben „Helyi próba” felirat látszik | A `likesApiUrl` még üres, vagy a böngésző a régi konfigurációt használja. |
| A Pages-oldalon `–` látszik | Ellenőrizd, hogy a saját `/exec` URL bekerült a `dist/config.js` fájlba, és a Pages-frissítés befejeződött. |
| „A szavazás még nincs beállítva” | Futtasd a `setup` függvényt a Google-szerkesztőben. |
| Bejelentkezést kér vagy a böngésző CORS-hibát jelez | Ellenőrizd a „Me” + „Anyone” telepítési beállítást, a `/exec` címet és az aktuális telepített verziót. Az endpointot kijelentkezett ablakban is el kell érni. |
| Nem választható az anonim „Anyone” hozzáférés | A fiók vagy szervezet szabályai korlátozhatják. Olyan saját Google-fiókkal telepíts, ahol ez a beállítás engedélyezett. |
| Egy frissen felvett projektre még nem lehet szavazni | Ellenőrizd az állandó Azonosító és Aktív mezőt, majd a CSV közzétételének frissülése után várj egy percet. |
| Átmeneti szolgáltatáshiba vagy foglaltság | Használd az oldal „Újrapróbálom” gombját; a Google-szerkesztő „Végrehajtások / Executions” lapja mutatja a szerverhibát. A katalógus ettől tovább használható. |

A kliens egyszerű űrlapként küldi a kéréseket, és követi a [Google Content Service átirányítását](https://developers.google.com/apps-script/guides/content#redirects). Ne állítsd a `fetch` kérését `no-cors` módra: abban a módban a weboldal nem tudja kiolvasni a számláló válaszát.
