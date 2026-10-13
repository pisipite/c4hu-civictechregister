# Arculat és képernyőképek

A gyűjtemény a felhasználó kérésére a Code for Hungary közösség arculatát használja. Az eredeti márkák és weboldalak tartalmai a jogosultjaikhoz tartoznak; a katalógus nem állítja, hogy minden felsorolt kezdeményezést a Code for Hungary üzemeltet.

## Code for Hungary

- Logó: https://code4.hu/wp-content/uploads/2022/06/cropped-LogoC4H-pozitiv-300szeles.png → `dist/assets/code-for-hungary.png` (változatlan eredeti).
- Színek és betű: https://code4.hu/wp-content/uploads/elementor/css/post-34.css és a https://code4.hu/ főoldal stílusai. Eredeti türkiz: `#5CC3BA` (címsoroknál `#5CC3BB`); grafit: `#1C2E32`; betűcsalád: Raleway. A katalógus szöveges türkizkiemelései olvashatóságért sötétebbek (`#287B75`).
- A közösség bemutatása és nyilvános címe (`hello@code4.hu`): https://code4.hu/ és https://github.com/Code-for-Hungary.
- A favicon saját, az arculat szögletes zárójel-motívumára épülő SVG. A fejlécben és láblécben az eredeti logó látható.

## Betűkészlet

A Raleway 400–800 változó betűkészlet latin és latin-ext WOFF2 fájljai a Google Fonts hivatalos https://fonts.googleapis.com/css2?family=Raleway:wght@400..800&display=swap stíluslapján hivatkozott forrásokból származnak. Helyük: `dist/assets/fonts/`.

Licenc: SIL Open Font License 1.1, helyi másolat: `dist/assets/fonts/OFL.txt`. Forrás: https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/OFL.txt.

## Valódi képernyőképek

A képek 2026. október 11-én böngészőben készültek a projektek nyilvános oldalairól. A Járókelő sütiablakát a nem szükséges sütik elutasítása után zártuk be. Nem szerkesztett illusztrációk és nem élő beágyazások.

| Helyi fájl a `dist/assets/screenshots/` alatt | Megnyitott forrás |
| --- | --- |
| `nerhotel.jpg` | https://nerhotel.hu/hu/ |
| `kimittud.jpg` | https://kimittud.hu/ |
| `koltsegvetes-live.jpg` | https://kozertheto.k-monitor.hu/ |
| `figyusz.jpg` | https://figyusz.k-monitor.hu/ |
| `parlamonitor.jpg` | https://parlamonitor.k-monitor.hu/ |
| `jarokelo.jpg` | https://jarokelo.hu/ |

A Közérthető Költségvetés képe és hivatkozása a Mintaváros demóoldalát mutatja; ezt a kártya is jelöli. A régi `parlament.k-monitor.hu` cím helyett az aktuális Parlamonitor szerepel.

### Az öt új rekord képei

A következő valódi képernyőképek 2026. október 12-én készültek a nyilvános oldalakról, a tartalmat kitakaró tájékoztató- és hírlevélablakok bezárása után. A Facebook-archívum képe a betöltött Adatbázis nézetet mutatja. A fájlokat a `dist/downloads/civic-tech-uj-kezdemenyezesek.csv` hivatkozza.

| Helyi fájl a `dist/assets/screenshots/` alatt | Megnyitott forrás |
| --- | --- |
| `kormanyfigyelo.jpg` | https://kormanytagok.hu/ |
| `holakomment.jpg` | https://holakomment.hu/ |
| `fb-politika-archivum.jpg` | https://ferenci-tamas.github.io/fb-politika-archivum/ |
| `nka-tamogatasok.jpg` | https://kormany.hu/atlathato/nkatamogatasok |
| `ertitek.jpg` | https://ertitek.hu/ |

Az NKA-adatlap hivatalos kormányzati adatközlés; ezt a rekord megjegyzése is jelöli. A Facebook-archívum repositoryjának licence [GPL-3.0](https://github.com/ferenci-tamas/fb-politika-archivum/blob/main/LICENSE); ez nem jelenti az archivált Facebook-tartalmak újralicencelését. A másik négy új rekord esetében nyilvános forráskód és nyílt licenc nem volt igazolható, ezért státuszuk „nem ismert”. A készítőkre és elérhetőségekre vonatkozó elsődleges források az új CSV **Forrás** oszlopában találhatók.

A projektek céljának, készítőinek és kapcsolatainak elsődleges forrásai a mintaexcel és a minta CSV **Forrás** oszlopában, illetve a weboldal részletes projektadatlapjain szerepelnek. Ahol személy szerinti fejlesztőnév nem volt igazolható, az igazolt szervezet vagy fejlesztői közösség neve szerepel. Az élő katalógus a `dist/config.js` fájlban beállított Google Sheets CSV-ből tölti az adatokat.

### 2026. október 13-i képernyőképek

| Helyi fájl a `dist/assets/screenshots/` alatt | Megnyitott forrás |
| --- | --- |
| `ut-a-bortonbe.jpg` | https://utaborton.be/ |
| `tisztitotuz.jpg` | https://apps.apple.com/us/app/tiszt%C3%ADt%C3%B3t%C5%B1z/id6786331840 |
| `hirspektrum.jpg` | https://hirspektrum.hu/ |

A képek valódi böngészős felvételek. Az Út a börtönbe analitikai sütijeit elutasítottuk. A Tisztítótűz felvétele az App Store nyilvános termékoldaláról készült, az alkalmazáson belüli használatot nem teszteltük. A kapcsolódó rekordok a `civic-tech-kezdemenyezesek-2026-10-13.xlsx` és `.csv` fájlokban találhatók; a szöveges adatok forrásai a **Forrás** oszlopban szerepelnek.

## Repositoryk és licencek a mintaadatokban

Ellenőrzés: 2026. október 12. A licenc a hivatkozott repositoryra vonatkozik.

| Kezdeményezés | Repository | Licenc forrása |
| --- | --- | --- |
| NER Hotel | [Code-for-Hungary/nerhotel](https://github.com/Code-for-Hungary/nerhotel) | [GPL-3.0](https://github.com/Code-for-Hungary/nerhotel/blob/master/LICENSE.txt) |
| KiMitTud alapszoftvere | [mysociety/alaveteli](https://github.com/mysociety/alaveteli) | [AGPL-3.0-or-later](https://github.com/mysociety/alaveteli/blob/develop/LICENSE.txt) |
| Közérthető Költségvetés | [k-monitor/onkormanyzati-koltsegvetes-v2](https://github.com/k-monitor/onkormanyzati-koltsegvetes-v2) | [GPL-3.0](https://github.com/k-monitor/onkormanyzati-koltsegvetes-v2/blob/master/LICENSE) |
| Figyusz! frontend | [Code-for-Hungary/bmm-frontend](https://github.com/Code-for-Hungary/bmm-frontend) | [GPL-3.0](https://github.com/Code-for-Hungary/bmm-frontend/blob/master/LICENSE) |
| Parlamonitor | [k-monitor/parlament](https://github.com/k-monitor/parlament) | [AGPL-3.0-or-later](https://github.com/k-monitor/parlament/blob/main/LICENSE) |
| Járókelő korábbi változata | [jarokelo/jarokelo](https://github.com/jarokelo/jarokelo) | [GPL-3.0](https://github.com/jarokelo/jarokelo/blob/main/LICENSE) |

A KiMitTud a nyílt Alaveteli szoftvert használja; a link az alapszoftverhez vezet. A Járókelő repositoryja 2021-ben frissült utoljára; a jelenlegi éles oldal forráskódjával való egyezése nem igazolt, ezért a minta aktuális státusza **nem ismert**. A Parlamonitor nevét a [repository README-je](https://github.com/k-monitor/parlament/blob/main/README.md) is igazolja.
