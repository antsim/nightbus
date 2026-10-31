# T01 – Projektipohja

## Tavoite
Toimiva tyhjä peliprojekti, joka käynnistyy selaimessa, jossa on testit, lint ja automaattinen julkaisu. Kaikki myöhemmät taskit rakentuvat tämän rakenteen päälle.

## Vaatimukset
1. Vite + TypeScript (strict) + Phaser 4.x (uusin 4.x npm:stä).
2. Kansiorakenne:
   ```
   src/
     core/        # puhdas logiikka, ei Phaseria
     data/        # balance.ts, strings.fi.ts, routes/*.json
     scenes/      # BootScene, BusScene (tyhjä), ResultScene (tyhjä)
     ui/
     services/
     assets/manifest.ts
     main.ts
   tests/         # tai *.test.ts core-tiedostojen vieressä
   docs/tasks/    # nämä task-dokumentit
   ```
3. `BootScene` lataa assetit manifestista ja siirtyy `BusScene`en, joka näyttää tekstin "Bussi tulossa…".
4. Skriptit: `dev`, `build`, `preview`, `test` (Vitest), `lint` (ESLint + `tsc --noEmit`).
5. GitHub Actions: lint + test jokaisessa pushissa; `main`-haaran build julkaistaan GitHub Pagesiin.
6. Tyhjät pohjat: `src/data/balance.ts` (export const BALANCE = {…}), `src/data/strings.fi.ts` (export const STR = {…}).

## Tekniset vinkit
- **Pelin koko ja skaalaus:** kiinteä loogiset mitat, esim. 960×540 (16:9), ja `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }`. Toimii työpöydällä ja puhelimessa, ja kaikki koordinaatit pysyvät ennustettavina.
- **Pikselitaide vai ei:** jos grafiikasta tulee pikselitaidetta, aseta `pixelArt: true` jo nyt, jottei skaalaus sumenna kuvia myöhemmin.
- **Vite base path:** GitHub Pagesia varten `base: '/<repo-nimi>/'` `vite.config.ts`:ssä, muuten assetit eivät lataudu.
- **Assettimanifesti:** `export const ASSETS = { busInterior: { key: 'bus-interior', url: '…' } } as const`. Scenet viittaavat vain avaimiin. Placeholderit voi generoida koodissa `this.add.rectangle`-kutsuilla, kunnes kuvat ovat olemassa.
- **Scene-rekisteri:** listaa scenet yhdessä paikassa (`src/scenes/index.ts`), koska myöhemmin tulevat BarScene, WalkScene ja SurvivalScene.
- **Vitest ilman Phaseria:** core-testit eivät saa importata Phaseria (se vaatii selainympäristön). Pidä `src/core` erillään, niin testit ovat nopeita ja toimivat Node-ympäristössä.
- **ESLint-sääntö:** lisää `no-restricted-imports`, joka kieltää `phaser`-importin `src/core/**`-polussa. Arkkitehtuuri pysyy kunnossa automaattisesti.

## Hyväksymiskriteerit
- [ ] `npm run dev` avaa pelin, joka näyttää BusScene-tekstin.
- [ ] `npm test` ajaa vähintään yhden esimerkkitestin `src/core`:ssa.
- [ ] `npm run lint` menee läpi, ja Phaser-import `src/core`:ssa aiheuttaa lint-virheen.
- [ ] GitHub Actions -workflow on olemassa (lint + test + Pages-deploy).

## Ei tässä taskissa
Pelilogiikkaa, grafiikkaa tai dataa.
