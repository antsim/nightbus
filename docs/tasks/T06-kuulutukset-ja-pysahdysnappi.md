# T06 – Kuulutukset ja pysähdysnappi

## Tavoite
Pelaaja tunnistaa oman pysäkkinsä epäselvien kuulutusten ja maamerkkien avulla ja painaa pysähdysnappia oikealla hetkellä. Tämän taskin jälkeen pelillä on kolme lopputulosta, ja se on ensimmäistä kertaa oikeasti pelattava.

## Vaatimukset
1. **Kuulutukset:** ennen jokaista pysäkkiä (`stopApproaching`) näytetään tekstitys "Seuraava pysäkki: …" ja sama teksti katon pysäkkinäytössä.
2. **Sotkeminen** (`core/garble.ts`): puhdas funktio `garble(text, level, rng)`. Mitä korkeampi `level` (humala + väsymys), sitä enemmän tavuja korvautuu ("mmh", "…", "rrh"), kirjaimia putoaa ja sanoja katkeaa. Esim. "Seuraava pysäkki: Kauppatori" → "Seuraava… mmrhh…tori".
3. **Pysäkkinäyttö** voi myös "välkkyä" ja näyttää väärän pysäkin hetken, jos humala on korkea.
4. **Pysähdysnappi:** iso punainen nappi ruudulla + näppäin (S tai Enter). Painallus pysäkkien välillä merkitsee pysähdyspyynnön ("Pysähtyy"-valo syttyy). Bussi pysähtyy seuraavalla pysäkillä, ja pelaaja jää pois.
5. **Lopputulokset** (`core/outcome.ts`):
   - `home`: jäi kotipysäkillä
   - `tooEarly`: jäi ennen kotipysäkkiä (montako pysäkkiä liian aikaisin)
   - `overshot`: jäi kotipysäkin jälkeen (montako pysäkkiä yli)
   - `terminus`: nukkui päätepysäkille asti, ja kuski herättää
   Lopputulos tallennetaan RunStateen, ja siirrytään ResultSceneen (T07).
6. Jos pelaaja painaa nappia mikrounen aikana, se ei tee mitään.

## Tekniset vinkit
- **Sotkemisen pitää olla toistettava:** sama siemen + sama teksti + sama taso = sama tulos. Testit ja bugien toisto helpottuvat. Käytä T02:n RNG:tä.
- **Suomen tavutus yksinkertaisesti:** jaa sana tavuihin säännöllä "konsonantti ennen vokaalia aloittaa uuden tavun" (ka-up-pa-to-ri on riittävän lähellä). Sotkeminen tavutasolla kuulostaa paljon aidommalta kuin kirjaintasolla.
- **Pysäkin loppuosa säilyy useimmiten:** ihmiset kuulevat sanan lopun. Painota sotkemista sanan alkuun, jolloin pelaaja saa vihjeen mutta joutuu yhdistämään sen maamerkkeihin.
- **Puhesynteesi (valinnainen kokeilu):** Web Speech API (`speechSynthesis`, ääni `fi-FI`) voi lukea sotketun tekstin ääneen, ja `rate`/`pitch` muuttuvat humalan mukaan. Ääni vaihtelee selaimittain, joten tee siitä asetuksista kytkettävä lisä, ei pakollinen.
- **Pysähdyspyyntö on tila, ei tapahtuma:** `stopRequested: boolean` RunStatessa nollautuu, kun bussi pysähtyy. Myöhemmin kanssamatkustaja voi painaa nappia pelaajan puolesta, jolloin bussi pysähtyy, vaikka pelaaja ei sitä pyytänyt.
- **Lopputulos on puhdas funktio** `resolveOutcome(route, alightStopId)` ja helposti testattavissa kaikilla neljällä tapauksella.
- **Tulevaisuutta varten:** `tooEarly`- ja `overshot`-tulokset ovat myöhemmin selviytymisvaiheen lähtöpiste. Tallenna siksi poistumispysäkin koordinaatit ja kellonaika RunStateen, vaikka MVP ei vielä käytä niitä.

## Hyväksymiskriteerit
- [ ] Kuulutukset sotkeutuvat selvästi enemmän korkealla humalalla (yksikkötestit kolmella tasolla, sama siemen).
- [ ] Pysähdysnappi toimii hiirellä, kosketuksella ja näppäimellä.
- [ ] Kaikki neljä lopputulosta ovat saavutettavissa pelaamalla (testattu käsin) ja niillä on yksikkötestit.
- [ ] Peli siirtyy lopputuloksen jälkeen ResultSceneen.

## Ei tässä taskissa
Loppuraportin sisältöä (vain siirtymä ResultSceneen).
