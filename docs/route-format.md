# Reittiformaatti

Reitit ovat JSON-tiedostoja kansiossa `src/data/routes/`. Tiedoston nimi on reitin tunniste:
`home-night-bus.json` ladataan `routeId`:llä `home-night-bus`, ja tiedoston `id`-kentän täytyy olla sama.
Kaikki reitit validoidaan zod-skeemalla (`src/core/route.ts`) sekä latauksessa että testeissä (`npm test`),
joten rikkinäinen reitti ei mene testeistä läpi.

## Rakenne

```jsonc
{
  "id": "home-night-bus",      // = tiedostonimi ilman .json-päätettä
  "lineName": "N55",           // linjan numero
  "headsign": "Metsälä",       // määränpää bussin kyltissä
  "stops": [ /* Stop[] */ ],
  "landmarks": [ /* Landmark[] */ ]
}
```

### Stop (pysäkki)

| Kenttä | Tyyppi | Kuvaus |
|---|---|---|
| `id` | string | Digitransitin `gtfsId` (esim. `HSL:1234567`) tai oma tunniste (`local:kotikatu`). Uniikki. |
| `name` | string | Pysäkin nimi kuulutuksissa ja näytöllä. |
| `lat`, `lon` | number | Koordinaatit (Reittiopas / OpenStreetMap). |
| `offsetSec` | number | Sekunteja reitin lähdöstä. Ensimmäinen yleensä 0. Kasvaa aidosti pysäkiltä toiselle. |
| `isHome` | boolean? | Pelaajan kotipysäkki. **Täsmälleen yksi**, ei päätepysäkki. |
| `isTerminus` | boolean? | Päätepysäkki. **Vain ja aina viimeinen** pysäkki. |

### Landmark (maamerkki)

| Kenttä | Tyyppi | Kuvaus |
|---|---|---|
| `id` | string | Uniikki tunniste. |
| `name` | string | Nimi, esim. "Huoltoasema". |
| `sprite` | string | Assettiavain (`src/assets/manifest.ts`). Ilman kuvaa piirretään placeholder. |
| `atOffsetSec` | number | Milloin maamerkki näkyy ikkunasta (sekunteja lähdöstä, enintään päätepysäkin aika). |
| `side` | `"left"` \| `"right"` | Kummalla puolella bussia. |
| `hintForStopId` | string? | Pysäkki, joka tulee tämän maamerkin jälkeen (esim. kotipysäkki). Käytetään vihjeisiin helpoilla vaikeustasoilla. |

## Uuden reitin tekeminen käsin

1. Kopioi `home-night-bus.json` uudella nimellä ja vaihda `id`.
2. Täytä pysäkit järjestyksessä. Ajat saat aikataulusta: `offsetSec = saapumisaika − lähtöaika` sekunteina.
   Digitransitin `stoptimes`-kyselyn `scheduledArrival` on sekunteja keskiyöstä, joten vähennä siitä
   ensimmäisen pysäkin arvo.
3. Merkitse kotipysäkki (`"isHome": true`) ja viimeinen pysäkki (`"isTerminus": true`).
4. Lisää 4–6 tunnistettavaa maamerkkiä. Ne ovat pelaajalle tärkein keino tunnistaa reitti.
5. Aja `npm test`. Virheilmoitus kertoo tiedoston ja kentän, esim. `stops[3].offsetSec: offsetSec must be strictly increasing`.

## Pelin aika-akseli

Koko reitti kestää pelissä noin `päätepysäkin offsetSec / 60 / BALANCE.time.timeScale` oikeaa sekuntia
(esimerkkireitti: 1320 s = 22 pelin minuuttia ≈ 3,7 min oikeaa aikaa).
