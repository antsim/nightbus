# T03 – Reittidata ja RouteProvider

## Tavoite
Reitin, pysäkkien ja maamerkkien tietomalli sekä lataus. MVP käyttää käsin tehtyä JSON-tiedostoa oman kotireitin perusteella, mutta malli vastaa oikeaa joukkoliikennedataa niin, että Digitransit voidaan kytkeä myöhemmin ilman pelilogiikan muutoksia.

## Vaatimukset
1. Tyypit (`core/route.ts`):
   ```ts
   type Stop = {
     id: string;            // esim. Digitransitin gtfsId "HSL:1234567" tai oma
     name: string;          // "Kauppatori"
     lat: number; lon: number;
     offsetSec: number;     // aika reitin alusta tälle pysäkille
     isHome?: boolean;      // pelaajan kotipysäkki
     isTerminus?: boolean;
   };
   type Landmark = {
     id: string;
     name: string;          // "Neste-huoltoasema"
     sprite: string;        // assettiavain
     atOffsetSec: number;   // milloin näkyy ikkunasta
     side: 'left' | 'right';
     hintForStopId?: string; // "tämän jälkeen tulee kotipysäkki"
   };
   type Route = {
     id: string; lineName: string; headsign: string;
     stops: Stop[]; landmarks: Landmark[];
   };
   ```
2. zod-skeema samasta mallista ja validointi latauksessa. Virheellinen JSON antaa selkeän virheilmoituksen.
3. `RouteProvider`-rajapinta (`services/routeProvider.ts`):
   ```ts
   interface RouteProvider { getRoute(routeId: string): Promise<Route>; }
   ```
   Toteutus `StaticRouteProvider` lukee `src/data/routes/*.json`.
4. Esimerkkireitti `src/data/routes/home-night-bus.json`: 12–18 pysäkkiä, kotipysäkki noin 2/3 matkasta, viimeinen pysäkki päätepysäkkinä ja 4–6 maamerkkiä. Antti täyttää oikeat nimet; Claude Code tekee rakenteen ja keksityt placeholder-nimet.
5. Apufunktiot: `stopAtOffset(route, sec)`, `nextStop(route, sec)`, `stopsBetween(route, a, b)`.

## Tekniset vinkit
- **offsetSec eikä kellonaika:** pysäkkien väliset ajat ovat suhteessa lähtöön. Samaa reittiä voi silloin ajaa mihin aikaan tahansa, ja Digitransitin `stoptimes`-kyselyn `scheduledArrival`-arvot muuntuvat tähän muotoon vähentämällä lähtöaika.
- **Käytä Digitransitin tunnisteita alusta asti**, jos mahdollista (pysäkin `gtfsId`). Silloin oikea data korvaa käsin tehdyn suoraan. Pysäkkien nimet ja koordinaatit saa helposti Reittioppaasta tai OpenStreetMapista.
- **Tuleva DigitransitRouteProvider** (ei tässä taskissa): GraphQL-endpoint `https://api.digitransit.fi/routing/v2/hsl/gtfs/v1` (muut alueet: `waltti`, `finland`), POST-pyyntö ja otsake `digitransit-subscription-key`. Avain ei saa päätyä selainkoodiin julkisessa repossa, joten live-data vaatii myöhemmin pienen välityspalvelun tai build-vaiheessa haetun JSONin. **Suositus:** skripti `scripts/fetch-route.ts`, joka hakee datan kehittäjän koneella ja kirjoittaa JSON-tiedoston. Peli pysyy staattisena.
- **Maamerkit ovat pelin tärkein data:** pelaaja tunnistaa reittinsä niistä. Lisää `hintForStopId`, jotta myöhemmin voi tehdä vaikeustasoja (helpolla tasolla vihje näytetään).
- **Validointi testeissä:** testi, joka validoi kaikki `routes/*.json`-tiedostot zod-skeemalla. Rikkinäinen reitti ei pääse mainiin.

## Hyväksymiskriteerit
- [ ] Esimerkkireitti latautuu `StaticRouteProvider`illa ja läpäisee validoinnin.
- [ ] Testit apufunktioille (rajatapaukset: ennen ensimmäistä pysäkkiä ja viimeisen jälkeen).
- [ ] Testi, joka tarkistaa, että reitillä on täsmälleen yksi `isHome`-pysäkki ja viimeinen pysäkki on `isTerminus`.
- [ ] `docs/route-format.md` kuvaa formaatin lyhyesti, jotta uusia reittejä voi tehdä käsin.

## Ei tässä taskissa
Live-rajapintakutsuja tai karttanäkymää.
