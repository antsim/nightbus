# T00 – Projektin ohjeet Claude Codelle (CLAUDE.md)

> **Käyttö:** kopioi tämän tiedoston "CLAUDE.md-sisältö"-osio repon juureen nimellä `CLAUDE.md` ennen ensimmäistä taskia. Claude Code lukee sen automaattisesti joka sessiossa.

## Taskien järjestys (vaihe 1: "Älä nuku ohi" -MVP)

| # | Task | Riippuu |
|---|------|---------|
| T01 | Projektipohja (Vite + TypeScript + Phaser 4) | – |
| T02 | Pelin ydin: tila, mittarit, kello, tapahtumat | T01 |
| T03 | Reittidata ja RouteProvider | T02 |
| T04 | Bussinäkymä ja matkan eteneminen | T02, T03 |
| T05 | Väsymys ja silmäluomimekaniikka | T04 |
| T06 | Kuulutukset ja pysähdysnappi | T04, T05 |
| T07 | Loppuraportti ja pelikierroksen kulku | T06 |
| T08 | PWA-tuki: asennettava ja offline-peli | T07 |

## Vaihe 1.5: bussimatkasta haastava

Pelitestin perusteella bussimatka oli liian helppo (silmät auki rytmillä) ja tylsä (ei päätöksiä, tieto liian selkeää).

| # | Task | Riippuu |
|---|------|---------|
| T09 | Silmien avaaminen vaatii ajoitusta + tasapainobotit ja -mittarit | T08 |
| T10 | Pahoinvointi vs. uni | T09 |
| T11 | Pysähdykset vain pyynnöstä ja muut matkustajat | T09 |

T10 ja T11 ovat toisistaan riippumattomia, mutta molemmat käyttävät T09:n botteja ja `balance.test.ts`-mittareita.

Anna Claude Codelle yksi task kerrallaan: *"Lue CLAUDE.md ja docs/tasks/T0X-….md ja toteuta task. Aja testit ennen kuin sanot valmis."*

---

## CLAUDE.md-sisältö

```markdown
# Viimeinen yöbussi

Humoristinen 2D-selainpeli: pelaaja yrittää päästä baarista kotiin oikealla reitillä
ja oikeilla aikatauluilla. Koko peli = 4 vaihetta: Baari → Kävely → Bussi → Kotiinpääsy
(+ Selviytyminen, jos myöhästyy tai nukkuu ohi). Vaihe 1 (MVP) toteuttaa vain Bussin
ja loppuraportin, mutta arkkitehtuurin pitää kantaa koko peli.

## Teknologia
- TypeScript (strict), Vite, Phaser 4.x, Vitest, zod (datan validointi)
- PWA: vite-plugin-pwa (T08). Fontit paketoidaan projektiin (@fontsource), ei CDN-latauksia,
  jotta peli toimii offline.
- Ei muita ajonaikaisia riippuvuuksia ilman perustelua.
- Phaser 4: tarkista API dokumentaatiosta (https://docs.phaser.io). Älä oleta Phaser 3 -API:a
  erityisesti renderöinnin, efektien (filters/FX) ja pipelinejen osalta.

## Arkkitehtuuri
- `src/core/`   – puhdas pelilogiikka. EI Phaser-importteja. Kaikki testattavissa Vitestillä.
- `src/data/`   – reittidata (JSON), tekstit (`strings.fi.ts`), tasapainotusarvot (`balance.ts`).
- `src/scenes/` – Phaser-scenet. Ohuita: lukevat tilaa corelta, piirtävät, välittävät syötteen.
- `src/ui/`     – uudelleenkäytettävät Phaser-komponentit (mittaripalkki, tekstitys, nappi).
- `src/services/` – ulkoiset lähteet (RouteProvider-toteutukset jne.).
- Yksi `GameSession` omistaa pelikierroksen tilan (`RunState`) ja kulkee scenejen välillä.
- Scenet kommunikoivat tyypitetyn tapahtumaväylän (`EventBus`) kautta, eivät suoraan toisiaan kutsumalla.

## Säännöt
- Kaikki pelaajalle näkyvä teksti `src/data/strings.fi.ts`:ssä, ei kovakoodattuna sceneihin.
- Kaikki tasapainotusluvut (nopeudet, kertoimet) `src/data/balance.ts`:ssä.
- Satunnaisuus vain `core/rng.ts`:n siemennetyn RNG:n kautta (toistettavuus + testit).
- Pelilogiikka etenee pelikellon (`GameClock`) mukaan, ei ruudunpäivitysnopeuden mukaan.
- Placeholder-grafiikka (värilliset suorakulmiot, teksti) on ok. Assetit avaimilla `assets/manifest.ts`:n kautta,
  jotta oikeat kuvat voi vaihtaa myöhemmin koskematta koodiin.
- Koodi, tunnisteet ja commit-viestit englanniksi; pelin tekstit suomeksi.

## Komennot
- `npm run dev` – kehityspalvelin
- `npm test` – Vitest
- `npm run build` – tuotantobuild
- `npm run lint` – ESLint + tsc --noEmit

## Valmiin määritelmä
- `npm run lint` ja `npm test` menevät läpi.
- Uudelle core-logiikalle on yksikkötestit.
- Taskin hyväksymiskriteerit on käyty läpi ja raportoitu.
- Debug-näkymä (F1) näyttää uudet mittarit/tilat, jos task lisää niitä.
```
