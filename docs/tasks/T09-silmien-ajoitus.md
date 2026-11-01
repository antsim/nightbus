# T09 – Silmien avaaminen vaatii ajoitusta, ei rytmiä

## Tavoite
Nyt silmät pysyvät auki koko matkan, kun välilyöntiä painaa tasaisessa rytmissä (esim. 0,4 s välein). Hakkaamisen esto (`spamWindowMs` 300 ms) ei koske rauhallista rytmiä. Silmien pitämisestä auki tulee taitoa vaativa tehtävä: painalluksen pitää osua hetkeen, jolloin silmät oikeasti painuvat kiinni. Liian aikainen painallus haittaa.

Samalla tehdään **tasapainobotit ja -mittarit**, joita T10 ja T11 käyttävät, jotta vaikeus pysyy hallinnassa muutoksesta toiseen.

## Vaatimukset
1. **Hätkähdys liian aikaisesta painalluksesta** (`core/drowsiness.ts`, `openEyes`):
   - Jos painallus tulee, kun `eyelid < BALANCE.eyes.input.halfClosedThreshold`, silmät eivät avaudu. Pelaaja "hätkähtää": `eyelid` *nousee* arvon `earlyPressPenalty` verran, ja seuraava aalto alkaa tavallista aikaisemmin (`earlyPressWaveAdvanceSec`).
   - Nykyinen `earlyPressFactor` korvataan näillä kahdella arvolla.
   - Lähtöarvot: `halfClosedThreshold` 0,25 → **0,5**, `earlyPressPenalty` **0,1**, `earlyPressWaveAdvanceSec` **1,5**.
2. **Hakkaamisen esto pysyy**, mutta se koskee vain painalluksia, jotka eivät ole liian aikaisia, eli kun silmät ovat yli puolivälissä kiinni.
3. **Palaute pelaajalle:** hätkähdyksestä tulee tapahtuma `startled` (`GameEvents`). BusScene näyttää sen pienenä kameran nytkähdyksenä ja lyhyenä silmäluomien värähdyksenä, jotta pelaaja oppii, ettei turha painaminen kannata. Hätkähdykset kirjataan lokiin, jotta T07:n raportti voi myöhemmin käyttää niitä.
4. **Ohjeteksti** (`STR.bus.hint`, `STR.title.howTo`) päivitetään: "Paina vasta kun silmät painuvat – liian aikaisin säikähdät."
5. **Tasapainobotit** yhteiseen testiapuriin (`src/core/testing/bots.ts`, ei tuotantokoodiin):
   - `rhythmBot(intervalMs)`: painaa tasaisin välein riippumatta silmistä.
   - `reactiveBot(threshold, reactionMs)`: painaa, kun `eyelid > threshold`, ja reagoi viiveellä.
   - `idleBot()`: ei paina koskaan.
   - Apufunktio `runBot(bot, { seed, stopAt? })`, joka ajaa kierroksen ja palauttaa `RunState`n. Nykyiset kopiot vastaavista apureista (`drowsiness.test.ts`, `outcome.test.ts`, `report.test.ts`) vaihdetaan käyttämään tätä.
6. **Tasapainomittarit testeinä** (`src/core/balance.test.ts`), joissa ajetaan 20 siementä per botti:
   - `rhythmBot(400)`: vähintään yksi mikrouni ≥ 80 %:ssa siemenistä.
   - `reactiveBot(0.55, 400)`, eli tarkkaavainen pelaaja: ei mikrounta ≥ 70 %:ssa siemenistä.
   - `idleBot`: mikrouni ennen kotipysäkkiä 100 %:ssa siemenistä.
7. **Debug-overlay:** hätkähdysten määrä ja viimeisimmän painalluksen vaikutus (avasi / hakkaus / hätkähdys).

## Tekniset vinkit
- **Hätkähdys on reilu vain, jos tilanteen näkee.** Silmäluomien pitää olla selvästi näkyvissä ennen kuin painallus kannattaa, eli `eyelid` 0,5 näkyy ruudulla neljänneksenä kummastakin reunasta. Tarkista visuaalisesti, että raja on luettavissa, ja säädä tarvittaessa `Eyelids`-komponentin käyrää, ei rajaa.
- **Aallon aikaistus:** helpointa on vähentää arvoa `nextWaveInSec`. Jos aalto on jo käynnissä, nosta sen `depth`-arvoa hieman (esim. +0,1) sen sijaan.
- **Bottien determinismi:** botit saavat käyttää vain `RunState`a ja simuloitua aikaa, eivät `Math.random`ia, jotta mittarit ovat toistettavia.
- **Mittarit ovat tavoitteita, eivät totuus.** Jos raja menee rikki tasapainotuksen takia, säädä ensin `balance.ts`:ää. Muuta testin rajaa vain tietoisesti ja kirjaa syy commit-viestiin.
- **Puhelimella** reaktioaika on pidempi. Kokeile käsin myös kosketuksella, ettei 0,5:n raja ole liian tiukka. Tarvittaessa raja voi olla eri arvo kosketukselle (`pointerType`).

## Hyväksymiskriteerit
- [ ] Liian aikainen painallus sulkee silmiä hieman ja aikaistaa seuraavaa aaltoa (yksikkötestit).
- [ ] Rytmihakkaaja epäonnistuu ja tarkkaavainen pelaaja onnistuu mittarien rajoissa (`balance.test.ts`).
- [ ] Hätkähdyksestä tulee näkyvä palaute BusScenessä.
- [ ] Botit ja kierroksen ajaminen ovat yhdessä testiapurissa, ja vanhat kopiot on poistettu.
- [ ] Käsin testattuna (näppäimistö ja kosketus) silmien auki pitäminen tuntuu ajoitukselta, ei metronomilta.

## Ei tässä taskissa
Pahoinvointi (T10), pysähdyslogiikan muutokset (T11), nuokahdus-QTE:t tai tahdonvoimamittari.
