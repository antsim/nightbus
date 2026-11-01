# T10 – Pahoinvointi vs. uni

## Tavoite
Pelissä on nyt vain yksi vastavoima, väsymys, eikä pelaaja tee yhtään oikeaa päätöstä. Uusi mittari **pahoinvointi** luo ydindilemman: liikkuvan maiseman katsominen humalassa pahentaa oloa, ja silmien sulkeminen helpottaa, mutta vie kohti mikrounta. Pelaajan pitää koko ajan punnita, kumpi riski on pahempi juuri nyt.

## Vaatimukset
1. **Mittari `nausea`** (0–1) lisätään coren mittareihin (`core/meters.ts`, `METER_IDS`). Muutosnopeus per pelin minuutti (`BALANCE.nausea`):
   - **Silmät auki:** `+ (openBasePerMin + openPerIntoxPerMin × humala) × (1 − eyelid)`, eli mitä enemmän silmät ovat auki, sitä enemmän maisema pyörii.
   - **Liike:** lisäpiikki bussin kiihdytyksissä ja jarrutuksissa (`movingSpeed`-vaiheet `accelerating` / `braking`), skaalattuna `(1 − eyelid)`.
   - **Silmät kiinni:** kun `eyelid > closedRelief.threshold` (esim. 0,7), mittari laskee `closedRelief.perMin`.
   - **Seisovassa bussissa** mittari laskee hitaasti, myös silmät auki.
   - **Mikrouni** laskee pahoinvointia unen pituuden mukaan.
2. **Raja ylittyy** (`nausea ≥ 1`):
   - Pakollinen pysähdyspyyntö: `stopRequested = true`, ja pelaaja jää pois seuraavalla pysäkillä, vaikka nukahtaisi.
   - Tapahtuma `nauseaCritical` ja lokikirjaus.
   - Uusi lopputulos `sick` (`core/outcome.ts`): `{ kind: 'sick', stops: number, early: boolean }`, eli kuinka kaukana kotipysäkistä ja kummalla puolella. Jos pakkopoistuminen osuu kotipysäkille, tulos on silti `home` (onnekas sattuma, oma raporttirivi).
3. **Varoitusportaat**, jotta pelaaja ehtii reagoida:
   - **≥ 0,6:** kamera keinuu kevyesti (rotaatio / sivuttaissiirto), ja voimakkuus kasvaa mittarin mukana.
   - **≥ 0,8:** vihertävä sävy ja tekstitys "Nyt alkaa olla huono olo…".
   - Ääniavain `sfx-urp` manifestiin (tiedosto myöhemmin).
4. **HUD:** mittari "Pahoinvointi" näkyy väsymysmittarin vieressä (`MeterBar`), ja sillä on oma väriskaalansa.
5. **Raportti ja pisteet (T07):**
   - `buildReport` tukee `sick`-tulosta.
   - Kuitissa on rivi "Pahoinvointimaksu" (`BALANCE.score.sickPenalty`) ja rivi "Pisin silmät kiinni -jakso", ja `reportLines.fi.ts`:ään tulee 3–4 uutta riviä. Esim. "Bussin lattia selvisi. Juuri ja juuri."
   - `bestScore`-skeemaan lisätään `sick`.
6. **Debug:** F4 asettaa pahoinvoinnin arvoon 0,95, ja overlay näyttää mittarin sekä sen hetkisen muutosnopeuden.

## Tekniset vinkit
- **Toteutus modifier-järjestelmän rinnalle, ei sen sisään:** pahoinvoinnin perusnopeus riippuu `eyelid`-arvosta ja bussin vaiheesta, joita `updateMeters` ei nyt tiedä. Laajenna `baseRates`-funktiota ottamaan konteksti (`{ eyelid, busPhase }`) parametrina, niin funktio pysyy puhtaana ja testattavana.
- **Järjestys `GameSession.step`issä:** silmät päivitetään nyt mittarien *jälkeen*. Pahoinvointi tarvitsee edellisen askeleen `eyelid`-arvon, mikä riittää 100 ms:n askeleella. Kirjaa valinta kommenttiin.
- **Dilemman pitää olla oikea:** tarkkaavainen botti (T09), joka pitää silmät auki koko ajan, ei saa päästä kotiin humalassa 0,6 luotettavasti. Toisaalta botti, joka sulkee silmät hetkeksi (esim. 2 s), kun `nausea > 0,6`, ja avaa ne taas, pitää pärjätä. Rakenna `nauseaAwareBot` T09:n botteihin ja käytä sitä mittarina.
- **Keinunta Phaser 4:ssä:** `cameras.main.setRotation()` ja pieni `scrollX`-siniaalto ovat halpoja. Vihreän sävyn voi tehdä joko puoliläpinäkyvällä suorakulmiolla tai filters-järjestelmän värimatriisilla. Tarkista Phaser 4:n `ColorMatrix`-filtterin API dokumentaatiosta, sillä se poikkeaa Phaser 3:sta.
- **Silmien sulkeminen tahallaan:** pelaajalla ei vielä ole "sulje silmät" -toimintoa, vaan silmät painuvat itsestään, kun ei paina. Se riittää tähän taskiin. Jos pelitestissä tuntuu, että tarvitaan aktiivinen toiminto (esim. pidä C pohjassa), lisää se `PlayerAction`iin erillisenä muutoksena.
- **Tasapainotus:** aloita niin, että humalassa 0,6 ja silmät koko ajan auki raja tulee vastaan noin 2/3:n kohdalla matkaa.

## Hyväksymiskriteerit
- [ ] Pahoinvointi nousee silmät auki ja liikkeessä ja laskee silmät kiinni sekä pysähdyksissä (yksikkötestit, sama siemen).
- [ ] Raja pakottaa poistumaan seuraavalla pysäkillä, ja tulos on `sick` (tai `home` onnekkaasti). Tämä on testattu.
- [ ] Mittarit (`balance.test.ts`): tarkkaavainen botti ilman pahoinvoinnin hallintaa epäonnistuu ≥ 50 %:ssa siemenistä, `nauseaAwareBot` onnistuu ≥ 60 %:ssa.
- [ ] Varoitusportaat ja HUD-mittari näkyvät, ja ne toimivat myös puhelimen kokoisella ruudulla.
- [ ] Kuitti ja paras tulos tukevat `sick`-lopputulosta.

## Ei tässä taskissa
Mutkat reittidatassa (voidaan lisätä myöhemmin `Route`-malliin), oksennusanimaatio tai aktiivinen "sulje silmät" -toiminto.
