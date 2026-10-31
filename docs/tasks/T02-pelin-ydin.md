# T02 – Pelin ydin: tila, mittarit, kello ja tapahtumat

## Tavoite
Phaserista riippumaton pelilogiikan ydin, jota kaikki vaiheet (baari, kävely, bussi, selviytyminen) käyttävät. Tämä on koko pelin tärkein arkkitehtuuripäätös, joten se tehdään ennen yhtään näkymää.

## Vaatimukset
1. **Mittarit** (`core/meters.ts`): `intoxication`, `fatigue`, `cold` (0–1) sekä `money` (euroina, sentteinä kokonaislukuna) ja pelikello.
   - Meter-tyyppi: arvo, min/max ja clamp.
   - Mittariin voi lisätä **modifierin**: esim. `{ id: 'coffee', meter: 'fatigue', ratePerMin: -0.05, durationMin: 10 }`. Tätä tarvitaan myöhemmin kahville, kebabille ja kylmälle ilmalle.
2. **Pelikello** (`core/clock.ts`): pelin sisäinen aika minuutteina (esim. alku 02:10), `timeScale` (montako pelin minuuttia per oikea sekunti) ja `advance(realMs)`. Formatointi "HH:MM".
3. **RunState** (`core/runState.ts`): yhden pelikerran koko tila (mittarit, kello, sijainti reitillä, tapahtumaloki). Täysin serialisoitava JSON-muotoon.
4. **GameSession** (`core/session.ts`): luo RunStaten, pitää sen ja tarjoaa `tick(realMs)`, joka etenee kelloa ja päivittää mittarit.
5. **EventBus** (`core/events.ts`): tyypitetty, esim. `bus.emit('stopReached', { stopId })`. Tapahtumatyypit yhdessä `GameEvents`-tyypissä.
6. **RNG** (`core/rng.ts`): siemennetty generaattori (esim. mulberry32). `next()`, `range(a,b)`, `pick(arr)`.
7. **Tapahtumaloki**: RunState kerää merkittävät tapahtumat (`{ time, type, data }`). Loppuraportti (T07) rakennetaan tästä.
8. **Debug-overlay** (`ui/DebugOverlay.ts`): F1 näyttää mittarit, kellon ja timeScalen; F2 nopeuttaa aikaa ×4.

## Tekniset vinkit
- **Kiinteä aika-askel:** aja logiikka kiinteinä askelina (esim. 100 ms), vaikka ruutu päivittyy 60 fps. Kerää akkumulaattoriin `realMs` ja aja `step()` niin monta kertaa kuin mahtuu. Silloin tulos on sama joka koneella, ja testeissä voi simuloida 10 minuuttia silmukassa.
- **Mittarien päivitys = perusnopeus + modifierit + riippuvuudet.** Esim. `fatigueRate = BALANCE.fatigue.base + BALANCE.fatigue.perIntox * intoxication + Σ modifiers`. Kaikki luvut `balance.ts`:ään, jotta tasapainotus ei vaadi koodimuutoksia.
- **Humala laskee hitaasti ajan myötä**, väsymys nousee. Tämä luo pelin perusjännitteen ja kannattaa olla corea, ei bussiscenen erikoislogiikkaa.
- **Ei luokkahierarkioita.** Pidä tila tavallisina objekteina ja logiikka puhtaina funktioina (`updateMeters(state, dtMin, rng)`). Serialisointi ja testaus on silloin triviaalia, ja myöhemmin "jatka peliä" tai tallennus tulee ilmaiseksi.
- **Lähtöarvot ovat parametri:** `createRun({ intoxication: 0.6, fatigue: 0.4, money: 2500, startTime: '02:10', routeId })`. MVP:ssä arvot tulevat kiinteästi, myöhemmin baarivaihe asettaa ne.
- **Tapahtumaväylä vs. tila:** tila on totuus, ja tapahtumat ovat ilmoituksia muutoksista (UI-animaatioita ja ääniä varten). Älä tallenna mitään vain tapahtumiin.
- **Phaserin integrointi:** BusScene kutsuu `session.tick(delta)` omassa `update`-metodissaan. GameSession voidaan tallentaa `this.registry`-olioon tai omaan moduulisingletoniin, jotta se kulkee scenestä toiseen.

## Hyväksymiskriteerit
- [ ] Yksikkötestit: mittarit pysyvät rajoissa, modifier vanhenee oikein, kello formatoi oikein, sama siemen antaa saman tuloksen.
- [ ] Testi, joka simuloi 30 pelin minuuttia ja tarkistaa, että väsymys nousee nopeammin korkealla humalalla.
- [ ] `RunState` → `JSON.stringify` → `JSON.parse` toimii ilman tietojen menetystä.
- [ ] F1-debug-overlay näkyy BusScenessä ja päivittyy.

## Ei tässä taskissa
Grafiikkaa, reittejä tai pysäkkejä.
