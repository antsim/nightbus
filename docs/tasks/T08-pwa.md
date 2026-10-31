# T08 – PWA-tuki (asennettava peli)

## Tavoite
Pelin voi asentaa puhelimen kotinäytölle ja tietokoneelle. Asennettuna se aukeaa koko ruudulle ilman selaimen palkkeja ja toimii ilman verkkoyhteyttä. Erityisesti iPhonella tämä on ainoa tapa saada peli koko ruudulle.

## Vaatimukset
1. **Web App Manifest:** nimi "Viimeinen yöbussi", lyhyt nimi "Yöbussi", `display: "fullscreen"` (varalla `standalone`), `orientation: "landscape"`, tumma `theme_color` ja `background_color` sekä ikonit 192×192, 512×512 ja maskable-versio.
2. **Service worker:** kaikki buildin tiedostot (JS, kuvat, äänet, fontit, reittien JSONit) esiladataan välimuistiin. Peli käynnistyy ja on pelattavissa kokonaan offline-tilassa.
3. **Päivitykset:** kun uusi versio on julkaistu, TitleScene näyttää ilmoituksen "Uusi versio saatavilla – päivitä". Päivitys ei koskaan käynnisty kesken bussimatkan.
4. **iOS-tuki:** `apple-touch-icon`, oikea status bar -tyyli ja safe area -marginaalit (lovi ja kotipalkki eivät peitä pysähdysnappia tai kelloa).
5. **Pystyasento:** jos puhelin on pystyasennossa, näytetään "Käännä puhelin" -ruutu ja peli pysähtyy. iOS ei noudata manifestin `orientation`-arvoa, joten tämä tarvitaan.
6. **Näyttö pysyy päällä** bussimatkan aikana Screen Wake Lock API:lla, jos selain tukee sitä. Hiljaa ohitetaan, jos ei tue.
7. **Asennuskehotus:** TitleScenessä on "Asenna peli" -nappi Chrome/Edge/Android-selaimille. iOS:llä näytetään ohje "Jaa → Lisää Koti-valikkoon", koska iOS ei tarjoa asennus-API:a.

## Tekniset vinkit
- **`vite-plugin-pwa`** hoitaa manifestin, service workerin (Workbox) ja esilatauslistan automaattisesti buildista. Käytä `registerType: 'prompt'`, ei `autoUpdate`: automaattinen päivitys voisi ladata sivun uudelleen kesken pelin. Kytke pluginin `onNeedRefresh`-callback EventBusiin (T02), jolloin TitleScene voi näyttää ilmoituksen.
- **Esilataa myös isot tiedostot:** Workboxin oletusraja on 2 Mt per tiedosto. Nosta `maximumFileSizeToCacheInBytes`, jos äänet tai spritesheetit ovat suurempia, muuten ne puuttuvat offline-tilassa hiljaa.
- **GitHub Pages -polku:** `start_url` ja `scope` pitää olla sama kuin Viten `base` (`/<repo-nimi>/`). Väärä polku on yleisin syy siihen, ettei asennus toimi.
- **Fontit omalta palvelimelta:** T07:n monospace-fontti pitää paketoida projektiin (esim. `@fontsource`-paketti), ei ladata Google Fontsista. Muuten offline-tila näyttää kuitin varafontilla.
- **Safe area:** viewport-meta `viewport-fit=cover` ja CSS:ssä `env(safe-area-inset-*)` canvasin ympärille. Phaserin `Scale.FIT` toimii sen jälkeen oikein lovellisillakin puhelimilla.
- **Ääni iOS:llä:** iOS sallii äänen vasta käyttäjän ensimmäisen kosketuksen jälkeen. TitleScenen "Aloita"-painallus hoitaa tämän luonnostaan; varmista, ettei ääntä yritetä soittaa ennen sitä.
- **Wake lock vapautuu itsestään,** kun sovellus menee taustalle. Pyydä se uudelleen `visibilitychange`-tapahtumassa, kun peli palaa näkyviin ja bussimatka on käynnissä.
- **Tauko taustalle mennessä:** pysäytä pelikello `visibilitychange`-tapahtumassa. Muuten pelaaja palaa puhelun jälkeen päätepysäkille.
- **Tallennukset iOS:llä:** asennetun PWA:n `localStorage` on erillinen Safarin `localStorage`sta, joten selaimessa saatu paras tulos ei näy asennetussa pelissä. Riittää mainita tämä README:ssä.
- **Testaus:** Chrome DevToolsin Application-välilehti näyttää manifestin, service workerin ja välimuistin, ja Network-välilehdeltä voi kytkeä offline-tilan päälle. Lighthousen erillistä PWA-auditointia ei enää ole, joten älä nojaa siihen. Testaa asennus lopuksi oikealla iPhonella ja Android-puhelimella.

## Hyväksymiskriteerit
- [ ] Peli asentuu Android Chromella ja tietokoneen Chromella/Edgellä "Asenna peli" -napista.
- [ ] Peli asentuu iPhonella "Lisää Koti-valikkoon" -toiminnolla ja aukeaa ilman Safarin palkkeja.
- [ ] Lentotilassa asennettu peli käynnistyy ja koko kierros (aloitus → bussi → raportti) toimii, fontit ja äänet mukaan lukien.
- [ ] Uuden version julkaisun jälkeen TitleScene näyttää päivitysilmoituksen, ja päivitys toimii.
- [ ] Pystyasennossa näkyy "Käännä puhelin" -ruutu, ja peli jatkuu vaakaan käännettäessä.
- [ ] Pelikello pysähtyy, kun peli menee taustalle.
- [ ] Lovi tai kotipalkki eivät peitä pelin UI-elementtejä iPhonella.

## Ei tässä taskissa
Push-ilmoituksia, sovelluskauppapaketointia (Capacitor) tai työpöytäsovellusta (Tauri/Electron).
