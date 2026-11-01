# T11 – Pysähdykset vain pyynnöstä ja muut matkustajat

## Tavoite
Nyt bussi pysähtyy jokaisella pysäkillä 15 pelin sekunniksi, pysähdyspyynnölle on reilusti aikaa, ja PYSÄHTYY-valo palaa vain pelaajan omasta painalluksesta. Kotipysäkin tunnistaminen on siksi helppoa. Tässä taskissa tieto muuttuu niukaksi ja harhaanjohtavaksi:
- Pysäkit vilahtavat ohi.
- Pyyntö pitää tehdä ajoissa.
- Muut matkustajat painavat nappia ja harhauttavat.

## Vaatimukset
1. **Bussi pysähtyy vain tarvittaessa** (`core/busRide.ts`). Bussi pysähtyy, jos
   - joku on pyytänyt pysähdystä (pelaaja tai muu matkustaja), tai
   - pysäkillä odottaa joku (RNG, `BALANCE.stops.waitingChance`, ratkaistaan pysäkin `stopApproaching`-hetkellä).

   Muuten bussi ajaa ohi täyttä vauhtia. Uusi tapahtuma on `stopPassed`. `stopReached` tarkoittaa jatkossa vain oikeaa pysähdystä. Päätepysäkillä pysähdytään aina.
2. **Lyhyempi pysähdys:** `dwellSec` 15 → **6** (yöllä ei ole ruuhkaa).
3. **Myöhäinen pyyntö:** jos pelaaja painaa, kun seuraavaan pysäkkiin on alle `BALANCE.stops.requestCutoffSec`, kuski ei ehdi pysähtyä.
   - Pyyntö siirtyy seuraavaa pysäkkiä koskevaksi, ja tekstitys kertoo: "Kuski ei ehtinyt."
   - Raja vastaa jarrutusmatkaa, eli `brakeDistanceSec` + pieni marginaali.
4. **Muut matkustajat painavat nappia:**
   - Jokaisen pysäkin kohdalla RNG päättää, pyytääkö joku muu pysähdystä (`BALANCE.stops.otherRequestChance`, joka voi riippua pysäkistä, esim. kampus ja sairaala ovat suositumpia). Pyyntö tulee satunnaisella hetkellä pysäkkien välissä.
   - Tila erotellaan: `stopRequested` → `playerRequested: boolean` ja `otherRequested: boolean`.
   - **Kattovalo PYSÄHTYY** palaa kummastakin pyynnöstä. **STOP-napin oma hehku** palaa vain pelaajan omasta pyynnöstä. Jos valo palaa jo, pelaajan painallus ei näytä kattovalossa uutta, mutta nappi hehkuu, eli pelaaja voi tarkistaa oman tilansa.
   - Pelaaja jää pois vain omalla pyynnöllään. Muiden pyynnöstä bussi pysähtyy, mutta pelaaja jää kyytiin.
5. **Pysäkit näkyvät maisemassa:**
   - Jokaisen pysäkin kohdalla ikkunan ohi liukuu pysäkkikatos ja nimikyltti (`WindowScenery`, placeholder-grafiikka).
   - Kyltin teksti sotketaan samalla tasolla kuin pysäkkinäyttö. Kun bussi ajaa ohi täyttä vauhtia, nimi ehtii näkyä vain hetken.
   - Odottava matkustaja näkyy katoksessa (placeholder-hahmo), mikä antaa vihjeen tulevasta pysähdyksestä.
6. **Mikrouni:** myös unen aikana ohi ajetut pysäkit (`stopPassed`) kirjataan `stopMissedWhileAsleep`-tapahtumina. Raportin "ohi nukutut" -luku pysyy oikeana.
7. **Matkan kesto:** pysähdyksiä on vähemmän ja ne ovat lyhyempiä, joten viritä `cruiseSpeed` ja/tai `timeScale` niin, että koko reitti kestää edelleen 3–4 minuuttia oikeaa aikaa. Päivitä nykyinen kestotesti.

## Tekniset vinkit
- **Pysähtymispäätös lukitaan jarrutuspisteessä:** tilakone tarvitsee tiedon "pysähdytäänkö seuraavalla" ennen kuin `movingSpeed` alkaa jarruttaa. Pidä `BusRideState`ssa kenttä `willStopAtNext` ja aseta se, kun etäisyys alittaa `brakeDistanceSec`-arvon. Jos pysähdystä ei ole, `movingSpeed` saa käyttää jarrutuskerrointa 1.
- **`stepRide` pysyy puhtaana:** odottavat matkustajat ja muiden pyynnöt arvotaan `GameSession`issa RNG:llä ja annetaan `stepRide`lle parametrina (esim. `requests: { stopAtNextStop: boolean }`). Silloin busRide-testit voivat ohjata tilannetta suoraan.
- **Harhautus pitää olla reilu:** muiden pyynnön valo syttyy aina vähintään `minLeadSec` ennen jarrutuspistettä. Pelaaja voi silloin tarkistaa napin hehkun ja ehtii vielä painaa itse.
- **Kuulutukset (T06)** pysyvät jokaiselle pysäkille, myös ohitettaville. Yöbussin kuulutus ei tiedä, pysähdytäänkö. Pysäkkinäyttö vaihtuu seuraavaan pysäkkiin heti edellisen ohituksen jälkeen.
- **T09:n botit:** lisää `stopAt`-logiikkaan realistinen reaktioviive. Pysähdyspyyntö tehdään vasta, kun botti on "nähnyt" edellisen pysäkin ohituksen, eikä tilan perusteella etukäteen. Muuten mittari ei kerro mitään aikapaineesta.
- **Kotipysäkin jälkeen** (`overshot`) pelaaja voi edelleen painaa nappia. Tähän ei tarvita muutoksia.

## Hyväksymiskriteerit
- [ ] Bussi ajaa ohi pysäkeistä, joilla ei ole pyyntöä eikä odottajaa, ja pysähtyy 6 sekunniksi muualla (busRide-testit, sama siemen).
- [ ] Liian myöhäinen pyyntö siirtyy seuraavaan pysäkkiin, ja pelaaja saa siitä palautteen.
- [ ] Muiden pyynnöt sytyttävät kattovalon mutta eivät napin hehkua, eikä pelaaja jää pois ilman omaa pyyntöä (testit).
- [ ] Ohi ajetut ja unessa ohitetut pysäkit näkyvät oikein lokissa ja raportissa.
- [ ] Mittarit (`balance.test.ts`): reaktiivinen botti, joka pyytää pysähdystä vasta nähtyään kotia edeltävän pysäkin, onnistuu ≥ 60 %:ssa siemenistä. Botti, joka painaa aina 2 pysäkkiä ennen kotia ja luottaa valoon, epäonnistuu selvästi useammin.
- [ ] Reitti kestää 3–4 minuuttia oikeaa aikaa, ja pysäkkikatokset näkyvät maisemassa myös puhelimen kokoisella ruudulla.

## Ei tässä taskissa
Pois jäämisen aikaikkuna ovella, kanssamatkustajien muut tapahtumat (jutustelu, lipuntarkastus) tai vaihtuva määränpää.
