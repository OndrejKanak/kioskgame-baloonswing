# Houpadlo – kiosek s hrami

Interaktivní hra na dotykovém displeji pro dětské mincovní houpadlo.
Běží na Raspberry Pi 5, Chromium v kiosk módu, **na výšku (FHD 1080×1920)**.
Hru spouští a ukončuje signál jízdy z houpadla (přes GPIO), pro vývoj jde
signál simulovat bez hardwaru.

> Tohle je **základní model** – grafika je placeholder a postupně se bude
> ladit. Vše podstatné k naladění je v [`frontend/js/config.js`](frontend/js/config.js).

## Co to umí teď

- **Atraktor** (klidová obrazovka): výzva „Vlož minci / přilož kartu".
- **Menu** se dvěma hrami: *Vzhůru!* + *Vpřed!*. Hráči jsou předškoláci,
  kteří většinou neumí číst, takže rozdíl mezi hrami sděluje hlavně **živý
  náhled** v každé kartě – naznačuje směr třemi způsoby najednou: tvarem
  (na výšku vs. na šířku), pohybem mraků a poskakujícími šipkami.
  Názvy a jejich skrytí: `config.js` → `menu.names` / `menu.showNames`.
- **Hra 1 – Vzhůru!** (stoupání): balon stoupá sám do oblak a sleduje prst
  **ve všech směrech** (do stran i nahoru/dolů), naklání se po směru letu.
  Mrak je **překážka**: balon od něj odskočí dolů, a dokud mu hráč neuhne,
  svět stojí na místě (metry nepřibývají). Vedle každého mraku je zaručená
  průletná mezera, takže hra nikdy neuvízne. Mezi mraky se sbírají
  **hvězdičky** (počítadlo vpravo nahoře). Ťuknutí přímo na balon = balon se
  vesele zavrtí. Nedá se prohrát, nic se neukládá.
- **Hra 2 – Vpřed!** (let do strany): balon letí doprava a gravitace ho táhne dolů;
  ťuknutí kamkoliv = poskok nahoru. Proletává mezerami mezi sloupy mraků,
  v každé mezeře je hvězdička. Náraz nezabíjí – **balon se odrazí dozadu
  a vrací se, překážka zůstane stát na místě** (svět stojí, metry
  nepřibývají), dokud hráč balon nevyrovná do mezery a překážku nepřekoná.
  Nedá se prohrát. Ladění: `config.js` → `flappy` (`knockback`,
  `knockReturn`, `knockMax`).
- **Zábavné prvky v obou hrách** (ladění: `config.js` → `fun`):
  - 🕊️ **Racek** – přiletí, přistane balonu na kopuli, chvíli se veze
    a odletí (občas místo přistání udělá vývrtku). Ťuknutí na něj = vyplaší
    se a odletí dřív. Při odletu **upustí pírko** = bonusová hvězdička.
  - ☁️ **Mraky mají obličeje** – ospalá zavřená očka; po žuchnutí se leknou
    (vykulí oči, udělají „ó") a pak se usmějí.
  - 🫧 **Mýdlové bubliny** – stoupají vzhůru, praskají po ťuknutí i po
    doteku balonem.
  - 🌈 **Duha** (jen hra *Vzhůru!*) – klene se od rohu k rohu přes
    celou obrazovku; průlet obloukem obarví stopu za balonem na několik sekund.
  - 🎉 **Milníky** – při 5/10/20/35/50 hvězdičkách konfety, fanfára a cedule.
- **Jen hra 1:** výškové vrstvy (nad 150 m obloha tmavne do soumraku
  a rozsvítí se hvězdy), cedule každých 100 m, **stoupavý proud** (třpytivý
  sloup, který balon vystřelí nahoru) a **plaché mraky**, které před
  blížícím se balonem uhnou stranou.
- **Jen hra 2:** **obruče** mezi sloupy (průlet středem = bonusová
  hvězdička), **racek posedávající na sloupu**, který se při přiblížení
  vyplaší, a **větrný poryv**, který balon prožene úsekem rychleji.
- **Efekty:** slunce se září, parallax vzdálených mraků, plastické mraky
  (stín + odlesk), obláčková stopa za balonem, „+1" při sebrání hvězdičky,
  třpyt hvězdiček, ptáčci, větrné šmouhy, mlha u spodního okraje, částice,
  „nafouknutí" mraku při odrazu. Vše jde vypnout v `config.js` (`effects`).
- **Zvuky:** procedurální WebAudio (odraz, hvězdička, ťuknutí, racek,
  prasknutí bubliny, pírko, duha, hučení proudu, fanfára) – žádné soubory,
  funguje offline. Vypnutí: `config.js` → `sound.enabled`.
- **Hudba na pozadí:** tři skladby, každá se **skládá proceduálně v kódu**
  ([`music.js`](frontend/js/music.js)), takže je **bez autorských práv**,
  nepotřebuje žádné soubory a funguje offline:
  - `lobby` – klidný valčík 3/4 (atraktor, menu, obrazovka „Ahoj")
  - `game1` – snivá, vzdušná (Balónková výprava)
  - `game2` – hopsavá s poskakujícím basem (Balónkový let)

  Skladba se přepíná automaticky podle obrazovky a plynule se prolne.
  Hlasitost/vypnutí: `config.js` → `music.volume` / `music.enabled`.
- **Konec jízdy:** obrazovka „Ahoj" ukáže nasbírané hvězdičky a nalétané
  metry (jen za tuto jízdu) → zpět na atraktor.

Tok: `ATRAKTOR → (jízda začala) → MENU → HRA → (jízda skončila) → AHOJ → ATRAKTOR`

## Struktura

```
src/
├── backend/
│   ├── app.py            # Flask server + SSE (události jízdy) + /dev/trigger
│   ├── gpio_listener.py  # detekce signálu jízdy (gpiozero), na PC simulace
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── config.js     # ← TADY se ladí chování a cesty ke grafice
│   │   ├── assets.js     # nahrávání obrázků
│   │   ├── sound.js      # procedurální zvuky (WebAudio)
│   │   ├── music.js      # procedurální hudba (3 skladby, bez copyrightu)
│   │   ├── gfx.js        # sdílené kreslení (mraky, hvězdy, HUD, částice…)
│   │   ├── menu.js       # živé náhledy her v kartách menu (směr letu)
│   │   ├── fun.js        # sdílené zábavné prvky (racek, bubliny, duha…)
│   │   ├── balloon.js    # hra 1: Balónková výprava (stoupání, překážky)
│   │   ├── flappy.js     # hra 2: Balónkový let (ťukni = poskoč)
│   │   └── main.js       # stavový stroj obrazovek + příjem signálu jízdy
│   └── assets/
│       ├── balloon_sheet.png  # sprite sheet balonu (mřížka 6×2 = 12 snímků)
│       └── sky_bg.png         # pozadí oblohy
├── deploy/
│   ├── start-kiosk.sh    # spustí backend + Chromium kiosk (na Pi)
│   └── kiosk.service     # systemd autostart
└── README.md
```

## Spuštění na vývojovém PC (Windows / bez houpadla)

```powershell
cd src\backend
pip install -r requirements.txt   # nainstaluje jen Flask (GPIO se na PC vynechá)
python app.py
```

Otevři **http://localhost:5000**.

Dole je **DEV lišta**: tlačítko *Simuluj jízdu* (nebo klávesa **G**) přepíná
„jízda začala / skončila", takže projdeš celým tokem bez hardwaru.
V DEV režimu jde balon řídit i **šipkami ←/→**. DEV lištu vypneš nastavením
`debug: false` v [`config.js`](frontend/js/config.js).

> Hru lze rozjet i bez backendu (otevřením `frontend/index.html`), ale doporučená
> cesta je přes Flask, protože tak funguje i signál jízdy a SSE.

## Spuštění na Raspberry Pi 5

```bash
cd src/backend
pip install -r requirements.txt        # na Pi doinstaluje gpiozero + lgpio
chmod +x ../deploy/start-kiosk.sh
../deploy/start-kiosk.sh
```

Autostart po bootu: viz komentář v [`deploy/kiosk.service`](deploy/kiosk.service).

**Emoji font:** čisté Raspberry Pi OS ho nemusí mít a emoji by se
vykreslila jako prázdné rámečky. Doinstaluj ho:

```bash
sudo apt install -y fonts-noto-color-emoji
```

Hra si sama zjistí, jestli emoji font existuje, a když ne, texty vypíše bez
nich (místo rámečků). S fontem to ale vypadá líp.

## Zapojení signálu jízdy (naměřeno na konkrétním houpadle)

Signál z řídicí desky houpadla, změřeno multimetrem proti zemi houpadla:

| Stav | Napětí |
|---|---|
| Houpadlo stojí | 0,01 V |
| Houpadlo jede | 7 V, během jízdy postupně klesá na 6,4 V |

Pokles je nejspíš časovač jízdy (vybíjení kondenzátoru) – optočlen spolehlivě
sepne v celém rozsahu.

**Součástky:** PC817, R1 = 470 Ω / 0,25 W, R2 = 10 kΩ, C1 = 1 µF

```
   STRANA HOUPADLA               │ izolace │      STRANA PI
   (vlastní zem, NEPROPOJOVAT!)  │         │      (vlastní zem)

   signál 7 V ──[ R1 470Ω ]──► 1 ─┤▶  ┌─── 4 ─────┬──── GPIO 17 (pin 11)
                                  │   ┊  │        │
                                  │  PC817     [R2 10kΩ]   ─┬─ C1 1µF
                                  │   ┊  │        │         │
   zem houpadla ────────────► 2 ──┤   └─── 3 ──┐  └─ 3,3 V  │
                                  │            │   (pin 1)  │
                                         zem Pi (pin 9) ────┘
```

PC817: 1 = anoda, 2 = katoda, 3 = emitor, 4 = kolektor (tečka = nožička 1).

- **Země houpadla a Pi se NIKDY nepropojují** – to je celý smysl optočlenu.
  Zem houpadla jde jen na vstupní stranu (nožička 2).
- R1 = 470 Ω dá proud LED ~12 mA při 7 V a ~11 mA při 6,4 V (PC817 snese 50 mA).
- C1 tlumí rušení od motoru. Kdyby detekce kmitala, zvětši ho na 10 µF.
- Polarita jde přehodit bez zásahu do kódu: `RIDE_ACTIVE_HIGH=1`,
  číslo pinu `RIDE_PIN=17` (proměnné prostředí).

**Připomínky k hardwaru (z předávacího dokumentu):**
- Na Pi 5 **NEPOUŽÍVAT `RPi.GPIO`** – jen `gpiozero` (`lgpio`).
- Pokud Wayland zlobí s dotykem, přepni přes `raspi-config` na X11 a v
  `start-kiosk.sh` vynech ozone parametry.

## Jak vyměnit / doplnit grafiku

- **Balon:** přepiš `frontend/assets/balloon_sheet.png`. Pokud bude jiná mřížka
  než 6×2, uprav `frameCols/frameRows/frameCount` v `config.js`.
- **Pozadí:** přepiš `frontend/assets/sky_bg.png`.
- **Mraky:** zatím se kreslí proceduálně (bílé obláčky). Až budeš mít PNG mraku,
  dej cestu do `config.assets.cloud` a použije se místo kreslení.
- **Ikonky místo emoji:** Raspberry Pi OS mívá jen černobílý emoji font.
  Stačí do `frontend/assets/` nakopírovat PNG s **průhledným pozadím**
  a použijí se automaticky (každá zvlášť; co chybí, nahradí emoji):

  | Soubor | Co na něm je | Kde se použije | Velikost |
  |---|---|---|---|
  | `icon_star.png` | hvězdička | výsledky po jízdě, cedule „Super! 10" | 256×256 |
  | `icon_balloon.png` | balonek | výsledky, výškové cedule „100 metrů!" | 256×256 |
  | `icon_rainbow.png` | duha | cedule „Duha!" | 256×256 |
  | `icon_wave.png` | mávající ruka | velká na obrazovce „Ahoj" | 512×512 |

  Cesty se dají změnit v `config.js` → `assets.icons`.

## Časté úpravy v `config.js`

| Co | Klíč |
|---|---|
| Rychlost stoupání | `world.riseSpeed` |
| Síla / pružnost odrazu od mraku | `world.bounceImpulse`, `bounceStiffness`, `bounceDamping` |
| Hustota mraků | `world.cloudMinGap` / `cloudMaxGap` |
| Zaručená mezera vedle mraku | `world.passageGap` |
| Velikost balonu | `balloon.displayWidth` |
| Rozsah pohybu nahoru/dolů | `balloon.topLimit` / `bottomLimit` |
| Svižnost řízení (sledování prstu) | `balloon.followSpeed` |
| Rychlost animace balonu | `balloon.fps` (5 = pomalé houpání) |
| Plynulost animace balonu | `balloon.register`, `smoothScaling`, `crossFade` |
| Vypnout sprite animaci úplně | `balloon.frameCount: 1` (nejhladší) |
| Hvězdičky (zap/vyp, četnost, velikost) | `stars.enabled` / `chance` / `radius` |
| Racek, bubliny, duha, milníky | `fun.*` (každý prvek zvlášť) |
| Stoupavý proud, plaché mraky (hra 1) | `world.thermal*`, `world.shy*` |
| Obruče, racek na sloupu, poryv (hra 2) | `flappy.hoopChance`, `perchChance`, `gust*` |
| Náklon balonu, parallax, ptáčci, šmouhy | `effects.*` |
| Názvy her v menu / skrytí názvů | `menu.names` / `menu.showNames` |
| **Výkon na Pi (sekání)** | `perf.renderScale` (0.75 / 0.6), viz níže |
| Zvuk (zap/vyp, hlasitost) | `sound.enabled` / `volume` |
| Hudba (zap/vyp, hlasitost) | `music.enabled` / `music.volume` |
| Melodie skladeb | `music.js` → `Music.tracks` |
| Délka obrazovky „Ahoj" | `timing.goodbyeMs` |
| DEV nástroje on/off | `debug` |

## Když se hra na Raspberry Pi seká

Hry kreslí celou obrazovku (1080×1920 = 2 miliony pixelů) každý snímek – na Pi
je to hlavní zátěž. Lobby a menu se nesekají, protože jsou to obyčejné HTML
obrazovky.

1. Zapni si měřič: `debug: true` (FPS se ukáže v DEV liště dole).
   Cíl je **stabilních 30+ FPS**, ideálně 60.
2. Uber rozlišení – zdaleka největší jediná úspora:
   `perf.renderScale: 0.75` a když nestačí, `0.6`.
   Hra zůstane stejně velká (plátno se roztáhne), jen bude o něco měkčí.
   Naměřeno: **0.7 = 1,65× rychlejší vykreslení**.
3. Teprve pak vypínej efekty v `effects` (`parallax`, `windStreaks`, `trail`,
   `altitudeLayers`) a prvky v `fun` (`bubbles`, `seagull`).

> Pozn.: rozměry a rychlosti v configu jsou v **referenčních pixelech**
> obrazovky široké 1080 px – hra si je přepočítá podle skutečné velikosti
> okna, takže vypadá stejně na PC náhledu i na FHD displeji kiosku.
