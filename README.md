# Viimeinen yöbussi

Humoristinen 2D-selainpeli (TypeScript, Vite, Phaser 4).

```bash
npm install
npm run dev      # kehityspalvelin
npm test         # Vitest
npm run lint     # ESLint + tsc --noEmit
npm run build    # tuotantobuild (base /nightbus/ GitHub Pagesia varten)
```

`main`-haara julkaistaan GitHub Pagesiin `.github/workflows/ci.yml`:n kautta.

Pelaa: https://antsim.github.io/nightbus/

## Asennettava peli (PWA)

Peli on asennettava PWA (`vite-plugin-pwa`). Asennettuna se aukeaa koko ruudulle ja toimii ilman verkkoyhteyttä.

- **Android / Chrome / Edge:** aloitusruudun "Asenna peli" -nappi.
- **iPhone / iPad:** Safari → Jaa → Lisää Koti-valikkoon.
- **Päivitykset:** uusi versio ladataan taustalla, ja aloitusruutu näyttää ilmoituksen "Uusi versio saatavilla – päivitä". Päivitys ei käynnisty koskaan kesken bussimatkan.
- **Tallennukset iOS:llä:** asennetun pelin `localStorage` on erillinen Safarin `localStorage`sta, joten selaimessa saatu paras tulos ei näy asennetussa pelissä (eikä päinvastoin).

### Testaus

Service worker toimii vain tuotantobuildissa:

```bash
npm run build && npm run preview   # http://localhost:4173/nightbus/
```

Chrome DevTools → Application näyttää manifestin, service workerin ja välimuistin. Network-välilehdeltä voi kytkeä offline-tilan päälle. Asennus kannattaa lopuksi testata oikealla iPhonella ja Android-puhelimella.

Ikonit generoidaan ilman riippuvuuksia: `node scripts/generate-icons.mjs` (tulos `public/icons/`).
