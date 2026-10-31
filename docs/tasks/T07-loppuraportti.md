# T07 – Loppuraportti ja pelikierroksen kulku

## Tavoite
Peli päättyy kuitin näköiseen loppuraporttiin, jonka pelaaja haluaa jakaa kavereille. Lisäksi pelikierros toimii kokonaisuutena: aloitusruutu → bussi → raportti → uusi yritys.

## Vaatimukset
1. **Raportin data** (`core/report.ts`): puhdas funktio `buildReport(runState): RunReport`, joka laskee:
   - kellonajan, jolloin pelaaja jäi pois
   - lopputuloksen (T06)
   - ohi nukutut pysäkit ja mikrounien määrän
   - pisimmän mikrounen
   - pisteet (`BALANCE.score`-kertoimilla)
   - 1–3 humoristista riviä tilanteen mukaan
2. **Humoristiset rivit** (`src/data/reportLines.fi.ts`): lista ehdollisia rivejä, esim.
   ```ts
   { when: r => r.outcome === 'terminus', text: 'Kuski herätti. Kuski ei ollut vaikuttunut.' },
   { when: r => r.microsleeps === 0, text: 'Hereillä koko matkan. Epäilyttävää.' },
   { when: r => r.stopsMissed >= 5, text: 'Kävit katsomassa naapurikunnan.' },
   ```
   Valitaan RNG:llä enintään 3 sopivaa riviä.
3. **ResultScene:** kuittimainen ulkoasu (kapea valkoinen paperi, monospace-fontti, katkoviivat), jossa näkyvät raportin rivit ja pisteet. MVP:ssä selviytymisvaihetta ei ole, joten `tooEarly`, `overshot` ja `terminus` näyttävät rivin "Kotimatka jatkuu jalan… (tulossa myöhemmin)".
4. **Napit:** "Uusi yritys" (sama reitti, uusi siemen) ja "Tallenna kuva" (lataa raportin PNG:nä).
5. **Aloitusruutu** (`TitleScene`): pelin nimi, "Aloita" ja lyhyt ohje (pidä silmät auki, paina pysähdysnappia kotipysäkillä).
6. Paras tulos tallennetaan `localStorage`en ja näytetään aloitusruudulla.

## Tekniset vinkit
- **Raportti datana, scene vain piirtää:** sama `RunReport` voidaan myöhemmin jakaa linkkinä, lähettää tulostauluun tai laajentaa koko pelin raportiksi (baari, kävely, taksikulut).
- **PNG-vienti:** `this.game.renderer.snapshot(image => …)` tai `snapshotArea` vain kuitin alueelta; muunna dataURL:ksi ja lataa `<a download>`-linkillä. Tarkista Phaser 4:n snapshot-API dokumentaatiosta. Puhelimella `navigator.share` tiedostolla on parempi vaihtoehto, jos selain tukee sitä.
- **Fontti:** paketoi monospace-fontti projektiin (esim. `@fontsource/ibm-plex-mono`), älä lataa sitä CDN:stä, jotta T08:n offline-tila toimii. Lataa fontti ennen ResultScenen piirtoa, muuten ensimmäinen piirto käyttää varafonttia. `document.fonts.load()` BootScenessä.
- **Kuitin tunnelma:** päiväys, "Kuitti nro" (siemenestä johdettu), viivakoodi suorakulmioista ja "KIITOS JA TERVETULOA UUDELLEEN" alareunassa. Pienet yksityiskohdat tekevät jaettavasta kuvasta hauskan.
- **localStorage turvallisesti:** kääri luku ja kirjoitus `try/catch`iin (yksityinen selaustila voi heittää virheen) ja versioi avain (`yobussi.v1.best`).
- **Siemen näkyviin:** näytä siemen kuitissa. Kaveri voi silloin pelata saman yön ("Kokeile siementä 48213, mä nukuin 9 pysäkkiä ohi").
- **Pisteytys yksinkertaiseksi:** esim. `home` = 1000, −150 per väärä pysäkki ja +bonus jokaisesta minuutista ilman mikrounta. Kaikki luvut `balance.ts`:ään.

## Hyväksymiskriteerit
- [ ] Koko kierros toimii: TitleScene → BusScene → ResultScene → uusi yritys.
- [ ] `buildReport` on testattu kaikilla neljällä lopputuloksella.
- [ ] "Tallenna kuva" tuottaa PNG:n, jossa kuitti näkyy kokonaan.
- [ ] Paras tulos säilyy sivun uudelleenlatauksen yli.
- [ ] Peli on julkaistu GitHub Pagesiin ja pelattavissa puhelimella.

## Ei tässä taskissa
Selviytymisvaihe, baarivaihe tai tulostaulu.

---

**Vaiheen 1 jälkeen:** pelaa itse ja anna kavereiden pelata. Tärkein kysymys ennen vaihetta 2 on, onko silmien auki pitäminen ja pysäkin tunnistaminen hauskaa. Säädä `balance.ts`-arvoja, kunnes on.
