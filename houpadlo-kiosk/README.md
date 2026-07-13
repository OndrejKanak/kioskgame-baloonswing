# Houpadlo – kiosek s hrami

Interaktivní hra na dotykovém displeji pro dětské mincovní houpadlo.
Běží na Raspberry Pi 5, Chromium v kiosk módu, **na výšku (FHD 1080×1920)**.
Hru spouští a ukončuje signál jízdy z houpadla (přes GPIO), pro vývoj jde
signál simulovat bez hardwaru.

> Tohle je **základní model** – grafika je placeholder a postupně se bude
> ladit. Vše podstatné k naladění je v [`frontend/js/config.js`](frontend/js/config.js).

## Co to umí teď

- **Atraktor** (klidová obrazovka): výzva „Vlož minci / přilož kartu".
- **Menu** se dvěma hrami: *Balónková výprava* + *Balónkový let*.
- **Hra 1 – Balónková výprava:** balon stoupá sám do oblak a sleduje prst
  **ve všech směrech** (do stran i nahoru/dolů), naklání se po směru letu.
  Mrak je **překážka**: balon od něj odskočí dolů, a dokud mu hráč neuhne,
  svět stojí na místě (metry nepřibývají). Vedle každého mraku je zaručená
  průletná mezera, takže hra nikdy neuvízne. Mezi mraky se sbírají
  **hvězdičky** (počítadlo vpravo nahoře). Ťuknutí přímo na balon = balon se
  vesele zavrtí. Nedá se prohrát, nic se neukládá.
- **Hra 2 – Balónkový let:** balon letí doprava a gravitace ho táhne dolů;
  ťuknutí kamkoliv = poskok nahoru. Proletává mezerami mezi sloupy mraků,
  v každé mezeře je hvězdička. Náraz nezabíjí – **balon se odrazí dozadu
  a vrací se, překážka zůstane stát na místě** (svět stojí, metry
  nepřibývají), dokud hráč balon nevyrovná do mezery a překážku nepřekoná.
  Nedá se prohrát. Ladění: `config.js` → `flappy` (`knockback`,
  `knockReturn`, `knockMax`).
- **Efekty:** slunce se září, parallax vzdálených mraků, plastické mraky
  (stín + odlesk), obláčková stopa za balonem, „+1" při sebrání hvězdičky,
  třpyt hvězdiček, ptáčci, větrné šmouhy, mlha u spodního okraje, částice,
  „nafouknutí" mraku při odrazu. Vše jde vypnout v `config.js` (`effects`).
- **Zvuky:** procedurální WebAudio (odraz, hvězdička, ťuknutí) – žádné
  soubory, funguje offline. Vypnutí: `config.js` → `sound.enabled`.
- **Konec jízdy:** obrazovka „Ahoj" ukáže nasbírané hvězdičky a nalétané
  metry (jen za tuto jízdu) → zpět na atraktor.

Tok: `ATRAKTOR → (jízda začala) → MENU → HRA → (jízda skončila) → AHOJ → ATRAKTOR`

## Struktura

```
houpadlo-kiosk/
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
│   │   ├── gfx.js        # sdílené kreslení (mraky, hvězdy, HUD, částice)
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
cd houpadlo-kiosk\backend
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
cd houpadlo-kiosk/backend
pip install -r requirements.txt        # na Pi doinstaluje gpiozero + lgpio
chmod +x ../deploy/start-kiosk.sh
../deploy/start-kiosk.sh
```

Autostart po bootu: viz komentář v [`deploy/kiosk.service`](deploy/kiosk.service).

**Připomínky k hardwaru (z předávacího dokumentu):**
- Signál jízdy = motor-signál řídicí desky přes **optočlen → GPIO 17**
  (active-low, pull-up). Číslo pinu se mění v `app.py` (`RideSignal(pin=17, …)`).
- Na Pi 5 **NEPOUŽÍVAT `RPi.GPIO`** – jen `gpiozero` (`lgpio`).
- Pokud Wayland zlobí s dotykem, přepni přes `raspi-config` na X11 a v
  `start-kiosk.sh` vynech ozone parametry.

## Jak vyměnit / doplnit grafiku

- **Balon:** přepiš `frontend/assets/balloon_sheet.png`. Pokud bude jiná mřížka
  než 6×2, uprav `frameCols/frameRows/frameCount` v `config.js`.
- **Pozadí:** přepiš `frontend/assets/sky_bg.png`.
- **Mraky:** zatím se kreslí proceduálně (bílé obláčky). Až budeš mít PNG mraku,
  dej cestu do `config.assets.cloud` a použije se místo kreslení.

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
| Rychlost animace balonu | `balloon.fps` |
| Hvězdičky (zap/vyp, četnost, velikost) | `stars.enabled` / `chance` / `radius` |
| Náklon balonu, parallax, ptáčci, šmouhy | `effects.*` |
| Zvuk (zap/vyp, hlasitost) | `sound.enabled` / `volume` |
| Délka obrazovky „Ahoj" | `timing.goodbyeMs` |
| DEV nástroje on/off | `debug` |

> Pozn.: rozměry a rychlosti v configu jsou v **referenčních pixelech**
> obrazovky široké 1080 px – hra si je přepočítá podle skutečné velikosti
> okna, takže vypadá stejně na PC náhledu i na FHD displeji kiosku.
