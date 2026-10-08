# Houpadlo – kiosek s hrami

Interaktivní hra na dotykovém displeji pro dětské mincovní houpadlo.
Běží na Raspberry Pi 5, Chromium v kiosk módu, **na výšku (FHD 1080×1920)**.
Hru spouští a ukončuje signál jízdy z houpadla (přes GPIO), pro vývoj jde
signál simulovat bez hardwaru.

> Tohle je **základní model** – grafika je placeholder a postupně se bude
> ladit. Vše podstatné k naladění je v [`frontend/js/config.js`](frontend/js/config.js).

## Co to umí teď

- **Atraktor** (klidová obrazovka): výzva „Vlož minci / přilož kartu".
- **Menu** se dvěma hrami: *Vzhůru!* + *Vpřed!*. Hrají to děti kolem 4 let,
  které neumí číst, takže volba stojí čistě na obrázku:
  - dvě **obří dlaždice** přes skoro celou obrazovku, s tlustým barevným
    rámem a „tlustým spodkem" – vypadají jako tlačítka, ne jako ukázka hry
  - v každé dlaždici se **hra sama hraje**: nahoře padají mraky a balon jim
    uhýbá doleva a doprava, dole balon poskakuje mezerami mezi sloupy mraků
  - **šipka směru** jako lesklá samolepka přes roh dlaždice
  - **ruka (rukavička), která střídavě ťuká** na jednu a pak na druhou
    dlaždici, s vlnkou jako po dotyku prstu; manžeta má barvu dlaždice
  - každá hra má svou **barvu rámu** (žlutá / zelená)

  Šipky a ruka jsou SVG v `index.html`, takže zůstanou ostré i při
  sníženém rozlišení plátna. Hratelnost náhledů je v `menu.js`.

  Názvy her jsou ve výchozím stavu skryté – zapnou se v `config.js` →
  `menu.showNames`, texty jsou v `menu.names`.

  **Automatický start:** když si dítě v menu do 15 s nic nevybere, spustí
  se samo *Vzhůru!*, ať zaplacená jízda neprojde u nabídky. Platí po minci
  i po návratu do menu tlačítkem „‹ Menu". Čas a hra: `menu.autoStartMs`
  (0 = vypnuto) a `menu.autoStartGame`.
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
│   │   ├── gfx.js        # sdílené kreslení (mraky, hvězdy, HUD, částice…)
│   │   ├── menu.js       # dlaždice menu: zmenšené hry, které se hrají samy
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

Otevři **http://localhost:5000/?debug** (bez `?debug` uvidíš ostrý provoz –
bez DEV lišty a bez kurzoru).

Dole je **DEV lišta**: tlačítko *Simuluj jízdu* (nebo klávesa **G**) přepíná
„jízda začala / skončila", takže projdeš celým tokem bez hardwaru.
V DEV režimu jde balon řídit i **šipkami ←/→**. Výchozí stav je v
[`config.js`](frontend/js/config.js) → `debug` (pro provoz `false`).

> Hru lze rozjet i bez backendu (otevřením `frontend/index.html`), ale doporučená
> cesta je přes Flask, protože tak funguje i signál jízdy a SSE.

## Spuštění na Raspberry Pi 5

```bash
cd ~/kioskgame-baloonswing
./src/deploy/start-kiosk.sh                   # ostrý provoz
KIOSK_DEBUG=1 ./src/deploy/start-kiosk.sh     # s DEV lištou a klávesou G
```

Závislosti (Flask, gpiozero, lgpio) ber z apt – Bookworm má systémový Python
chráněný a `pip install` odmítne:
`sudo apt install -y python3-flask python3-gpiozero python3-lgpio`

### Ostrý provoz

**Co dělá ostrý režim** (`debug: false`, výchozí):
- žádná DEV lišta, nejde simulovat jízdu klávesou G
- schovaný kurzor, zablokované kontextové menu po dlouhém podržení prstu
- backend poslouchá jen na `127.0.0.1` – nikdo ze sítě nemůže přes
  `/dev/trigger` přepínat obrazovky (pro ladění z jiného PC: `HOST=0.0.0.0`)
- [`start-kiosk.sh`](deploy/start-kiosk.sh) hlídá backend i Chromium; když
  kterýkoli spadne, ukončí oba a služba celý kiosk do 3 s spustí znovu
- po startu uprostřed jízdy (výpadek proudu) se jízda pozná podle stavu pinu

**Jednorázové nastavení Pi** – `sudo raspi-config`:
1. *System Options → Boot / Auto Login → **Desktop Autologin***
2. *Display Options → Screen Blanking → **No*** (jinak displej po chvíli zhasne)
3. změň heslo uživatele: `passwd`

**Autostart** (systemd uživatelská služba, podrobnosti v
[`deploy/kiosk.service`](deploy/kiosk.service)):

```bash
cd ~/kioskgame-baloonswing && mkdir -p ~/.config/systemd/user
sed "s|^ExecStart=.*|ExecStart=$PWD/src/deploy/start-kiosk.sh|" src/deploy/kiosk.service > ~/.config/systemd/user/kiosk.service
systemctl --user daemon-reload && systemctl --user reenable kiosk.service
sudo loginctl enable-linger $USER
```

| Co chceš | Příkaz (vždy **bez sudo**, s `--user`) |
|---|---|
| restartovat kiosk | `systemctl --user restart kiosk` |
| zastavit (ladění) | `systemctl --user stop kiosk` |
| stav | `systemctl --user status kiosk` |
| živý log | `journalctl --user -u kiosk -f` |

**Úplně nakonec – ochrana SD karty:** *raspi-config → Performance Options →
**Overlay File System*** → zapnout. Systém pak běží jen pro čtení a vypnutí
proudu (houpadlo se večer vypíná vypínačem) kartu nepoškodí. Pozor: od té
chvíle se **neuloží žádná změna** – na aktualizaci overlay vypnout, restart,
`git pull`, zapnout, restart.

**Emoji font:** čisté Raspberry Pi OS ho nemusí mít a emoji by se
vykreslila jako prázdné rámečky. Doinstaluj ho:

```bash
sudo apt install -y fonts-noto-color-emoji
```

Hra si sama zjistí, jestli emoji font existuje, a když ne, texty vypíše bez
nich (místo rámečků). S fontem to ale vypadá líp.

## Zapojení signálu jízdy

> Dřívější údaj 7 V → 6,4 V byl omylem naměřený na **jiné desce**. Neplatí.

Naměřeno na správné desce, multimetrem proti zemi houpadla:

| Stav | Napětí |
|---|---|
| Houpadlo stojí | **0,01 V** |
| Houpadlo jede (i s hydraulikou) | **1,67 V** |

> ⚠️ **Polarita je active-high, ne active-low.** Vlastní deska mezi houpadlem
> a Pi dává za jízdy na GPIO 17 napětí 3,45 V, ne zem. Proto je ve
> [`start-kiosk.sh`](deploy/start-kiosk.sh) nastaveno `RIDE_ACTIVE_HIGH=1`.
> Ověření na Pi: `pinctrl get 17` → v klidu `lo`, po minci `hi`.

Signál je **stabilní stejnosměrný, PWM ověřeno že tam není**.

Klidových 0,01 V je hluboko pod prahem LED (~1 V), takže v klidu neteče nic
a stav je jednoznačný.

Nad úbytkem LED (~1,2 V) zbývá jen **0,47 V**, takže R1 musí být řádově menší
než původních 470 Ω, jinak LED běží na ~1 mA – v oblasti, kde CTR optočlenu
prudce klesá.

```
U(R1) = 1,67 − 1,2 = 0,47 V
I_F   = 0,47 / 100 = 4,7 mA        (R1 = 100 Ω)
```

**Součástky:** PC817, **R1 = 100 Ω** / 0,25 W, R2 = 10 kΩ, C1 = 1 µF

R1 = 100 Ω je výchozí volba. Kdyby se signál po připojení obvodu propadl pod
~1,5 V, je zdroj měkký a R1 se zvětší na 150 nebo 220 Ω (proud klesne, ale
rezerva v CTR je pořád přes desetinásobek). Mít doma 47 / 100 / 150 / 220 Ω
a vybrat podle měření je nejrychlejší cesta.

```
   STRANA HOUPADLA               │ izolace │      STRANA PI
   (vlastní zem, NEPROPOJOVAT!)  │         │      (vlastní zem)

   signál 1,67V ─[ R1 100Ω ]──► 1 ─┤▶  ┌─── 4 ─────┬──── GPIO 17 (pin 11)
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
- R1 = 100 Ω dá proud LED ~5 mA při 1,67 V. PC817 tím zvládne spínat ~10 mA,
  potřebujeme 0,33 mA – rezerva přes třicetinásobek.
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
| Automatický start hry z menu (čas, která hra) | `menu.autoStartMs` / `menu.autoStartGame` |
| **Výkon na Pi (sekání)** | `perf.renderScale` (provozně 0.4), viz níže |
| Zvuk (zap/vyp, hlasitost) | `sound.enabled` / `volume` |
| Délka obrazovky „Ahoj" | `timing.goodbyeMs` |
| DEV nástroje on/off | `debug` (nebo jen `?debug` v adrese / `KIOSK_DEBUG=1`) |

## Když se hra na Raspberry Pi seká

Hry kreslí celou obrazovku (1080×1920 = 2 miliony pixelů) každý snímek – na Pi
je to hlavní zátěž. Lobby a menu se nesekají, protože jsou to obyčejné HTML
obrazovky.

1. Zapni si měřič: `debug: true` (FPS se ukáže v DEV liště dole).
   Cíl je **stabilních 30+ FPS**, ideálně 60.
2. Uber rozlišení – zdaleka největší jediná úspora.
   Hra zůstane stejně velká (plátno se roztáhne), jen bude o něco měkčí.

   | `renderScale` | Míň pixelů | Naměřeno |
   |---|---|---|
   | 0.7 | o 51 % | 1,65× rychlejší |
   | **0.4** | **o 84 %** | **3,3× rychlejší** (4,85 ms vs 15,8 ms) |

   **0.4 je ověřená provozní hodnota** na Pi 5 s FHD displejem – na ní hra
   jede plynule. Níž nechoď, text v HUD začne být rozmazaný.
3. Teprve pak vypínej efekty v `effects` (`parallax`, `windStreaks`, `trail`,
   `altitudeLayers`) a prvky v `fun` (`bubbles`, `seagull`).

> Pozn.: rozměry a rychlosti v configu jsou v **referenčních pixelech**
> obrazovky široké 1080 px – hra si je přepočítá podle skutečné velikosti
> okna, takže vypadá stejně na PC náhledu i na FHD displeji kiosku.
