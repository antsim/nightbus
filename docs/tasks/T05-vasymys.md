# T05 – Väsymys ja silmäluomimekaniikka

## Tavoite
Pelin ydinmekaniikka: väsymys painaa silmiä kiinni, ja pelaaja pitää itseään hereillä. Jos silmät menevät kokonaan kiinni, pelaaja nukahtaa ja aikaa hyppää eteenpäin. Pysäkkejä voi mennä ohi huomaamatta.

## Vaatimukset
1. **Silmien sulkeutuminen coressa** (`core/drowsiness.ts`): `eyelid` 0–1 (0 = auki, 1 = kiinni).
   - Silmät painuvat aaltoina, eivät tasaisesti: aallon todennäköisyys ja syvyys kasvavat väsymyksen mukaan.
   - Pelaajan syöte (välilyönti / napautus) avaa silmiä kerralla tietyn määrän.
   - Jos `eyelid` pysyy arvossa 1 yli `BALANCE.sleep.graceMs`, alkaa **mikrouni**.
2. **Mikrouni:** pelikello hyppää eteenpäin satunnaisen ajan (riippuu väsymyksestä, esim. 1–6 minuuttia) ja bussi etenee sen verran reitillä. Ohitetut pysäkit kirjataan tapahtumalokiin (`stopMissedWhileAsleep`). Herätessä peli näyttää lyhyen hämmennysefektin.
3. **Visuaali BusScenessä:** ylä- ja alasilmäluomi (mustat muodot), jotka sulkeutuvat `eyelid`-arvon mukaan; reunojen tummuminen (vignette) ja kevyt sumeus väsymyksen kasvaessa.
4. **Väsymysmittari** näkyy pelaajalle hienovaraisesti (esim. haukotus-ikoni tai palkki), ei pelkästään debugissa.
5. **Väsymyksen herättäjät** (modifier-järjestelmän kautta, T02): katuvalon väläys tai bussin kova jarrutus avaa silmiä hetkeksi.
6. MVP:n lähtöarvot ovat kiinteät (esim. humala 0.6, väsymys 0.5). Peli on läpäistävissä, mutta vaatii keskittymistä.

## Tekniset vinkit
- **Kohinaa, ei siniaaltoa:** käytä aaltojen ajoitukseen RNG:tä ja tasoitettua kohinaa (esim. 1D value noise). Silloin pelaaja ei opi rytmiä ulkoa, ja nukahtaminen tuntuu luonnolliselta.
- **"Hakkaamisen" esto:** jos pelaaja voi vain hakata välilyöntiä, peli on tylsä. Kaksi vaihtoehtoa: (a) jokainen painallus avaa vähemmän, jos edellisestä on alle X ms; (b) painallus toimii vain, kun silmät ovat yli puolivälissä kiinni. Tee molemmat `balance.ts`:ssä säädettäviksi ja kokeile.
- **Puhelin-toiminto (valmistele):** myöhemmin pelaaja voi selata puhelinta (pitää hereillä, mutta peittää ikkunan). Rakenna syöte niin, että siihen voi lisätä toisen toiminnon.
- **Silmäluomet:** kaksi `Graphics`-muotoa tai kaarevat spritet, joiden y-koordinaatti lasketaan suoraan `eyelid`-arvosta joka framessa. Ei tweenejä, koska arvo tulee coresta.
- **Sumeus Phaser 4:ssä:** tarkista dokumentaatiosta, miten blur/vignette tehdään Phaser 4:n filters-järjestelmällä (API poikkeaa Phaser 3:n postFX:stä). Jos filtteri osoittautuu hankalaksi, puoliläpinäkyvä musta vignette-kuva riittää MVP:hen.
- **Mikrouni on dramaattisin hetki:** ruutu pimeäksi, äänet vaimenevat ja jäljelle jää bussin hurina. Herätessä nopea "missä mä oon" -efekti: kamera tärähtää, kello hyppää näkyvästi ja pysäkkinäyttö näyttää vieraan pysäkin nimen.
- **Tasapainotus:** lisää debug-overlayhin `eyelid`, aaltojen määrä ja aika viimeisimmästä mikrounesta. Lisää näppäin (F3), joka asettaa väsymyksen maksimiin testausta varten.

## Hyväksymiskriteerit
- [ ] Silmät painuvat kiinni aaltoina, ja pelaaja voi pitää ne auki syötteellä.
- [ ] Mikrouni hyppää aikaa eteenpäin ja kirjaa ohitetut pysäkit lokiin.
- [ ] Korkeampi lähtöväsymys johtaa testissä nopeammin mikrouneen (simuloitu ilman syötettä samalla siemenellä).
- [ ] Silmäluomi- ja vignette-visuaalit toimivat myös puhelimen kokoisella ruudulla.

## Ei tässä taskissa
Kuulutukset, pysähdysnappi tai lopputulos.
