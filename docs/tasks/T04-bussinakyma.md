# T04 – Bussinäkymä ja matkan eteneminen

## Tavoite
Pelaaja istuu bussissa ja katsoo ikkunasta ulos. Maisema rullaa, bussi pysähtyy pysäkeille ja maamerkit ilmestyvät oikeilla kohdilla. Tämän taskin jälkeen bussi kulkee reitin alusta päätepysäkille ilman pelaajan toimia.

## Vaatimukset
1. **Matkalogiikka coressa** (`core/busRide.ts`): reitin sijainti `offsetSec`, bussin tila `'driving' | 'braking' | 'dwelling' | 'accelerating'` ja nykyinen/seuraava pysäkki. Etenee pelikellon mukaan.
2. Pysäkillä bussi seisoo `BALANCE.bus.dwellSec` (esim. 15 pelin sekuntia). Tapahtumat `stopApproaching`, `stopReached`, `stopDeparted` ja `terminusReached`.
3. **BusScene** piirtää:
   - bussin sisätilan etualalle (placeholder: tumma kehys, ikkuna-aukko, istuimet)
   - ulkomaiseman 3 parallaksikerroksena ikkunan takana (kaukaiset talot, katuvalot, lähin kerros)
   - maamerkit sprite-placeholderina (suorakulmio + nimi), jotka liukuvat ohi oikealla hetkellä
   - pysäkkinäytön bussin katossa ("Seuraava: ???", sisältö tulee T06:ssa)
   - pelikellon kulmassa
4. Maiseman nopeus seuraa bussin nopeutta: kiihdytys, ajo ja jarrutus näkyvät.
5. Ajan nopeus (`timeScale`) on säädetty niin, että koko reitti kestää noin 3–4 minuuttia oikeaa aikaa.

## Tekniset vinkit
- **Parallaksi `TileSprite`illä:** jokaiselle kerrokselle `tilePositionX += speed * layerFactor * dt`. Kertoimet esim. 0.2 / 0.5 / 1.0. Halpaa ja näyttää hyvältä myös placeholder-grafiikalla.
- **Nopeuskäyrä:** älä animoi nopeutta tweenillä vaan laske se coressa bussin tilasta (`speed = f(state, timeInState)`). Visuaali ja logiikka pysyvät synkronissa, ja ajan nopeutus (F2) toimii automaattisesti.
- **Maamerkkien ajoitus:** spawnaa maamerkki ruudun oikeaan reunaan, kun `offsetSec >= atOffsetSec - leadSec`, missä `leadSec` on aika, jonka kuluessa se liikkuu ikkunan keskelle. Laske `leadSec` lähimmän kerroksen nopeudesta.
- **Yövalaistus:** pimeä taivas ja katuvalojen keltaiset valokeilat ohittavat ikkunan säännöllisesti. Valon välkkyminen on myöhemmin tärkeää myös väsymysmekaniikalle (väläys herättää hetkeksi).
- **Sisätila päällimmäisenä:** ikkunan "lasi" omana kerroksena, jossa on kevyt heijastus (puoliläpinäkyvä suorakulmio). Myöhemmin samaan kohtaan tulee pelaajan oma heijastus, joka nuokkuu.
- **Kamera tärisee kevyesti** bussin kiihdyttäessä ja jarruttaessa (`cameras.main.shake` pienellä intensiteetillä) – humalassa enemmän.
- **Ääni (valmistele, ei pakollinen):** moottorin hurina, jonka pitch seuraa nopeutta. Lisää äänille avaimet manifestiin, vaikka tiedostoja ei vielä olisi.
- **Älä tee pysäkkilogiikkaa sceneen.** Scene vain kuuntelee tapahtumia ja reagoi visuaalisesti.

## Hyväksymiskriteerit
- [ ] Bussi kulkee esimerkkireitin alusta päätepysäkille, pysähtyy jokaisella pysäkillä ja lähtee uudelleen.
- [ ] Maamerkit ilmestyvät ikkunaan oikeassa kohdassa reittiä (näkyy debug-overlayssa `offsetSec`).
- [ ] F2-aikanopeutus nopeuttaa sekä logiikkaa että maisemaa.
- [ ] Yksikkötestit `busRide`-tilakoneelle: pysäkkien järjestys, pysähtymisaika ja päätepysäkki.

## Ei tässä taskissa
Väsymys, kuulutukset tai pysähdysnappi.
