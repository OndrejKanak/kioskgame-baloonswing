# Projekt: Interaktivní kiosek pro dětské houpadlo

> Předávací dokument pro pokračování v Claude Code. Obsahuje všechna technická
> rozhodnutí a kontext. Vlož jako úvodní kontext do Claude Code nebo nech jako
> README v kořeni projektu.

---

## 1. Cíl projektu

Interaktivní aplikace na dotykovém displeji běžící na Raspberry Pi, zabudovaná do
**dětského mincovního houpadla** (coin-operated rocking ride) určeného pro nasazení
v obchodním centru / vnitřní provozovně.

Aplikace je **hra / kvíz pro děti**, která se spustí ve chvíli, kdy je zaplacena
jízda (mincí z mincovníku **nebo** kartou z terminálu), a běží přesně po dobu jízdy.

prvni potrebuji vytvorit hru, absolutne jednoduchy format, balon bude stoupat nahoru kde bude narazet do objektu(mrak atp.),
pote se stane mala animace padu a bude nadale stoupat, grafiku si necham vygenerovat a doplnim pozdeji,
chtel bych vyuzit grafiku pohybu pomoci vice obrazku
hra bude mit menu pro 2 hry, druha hra zatim prazdna, nebudou se nikde ukladat vysledky
jedna se naprosto jednuduchou hru pro deti ktere zaplati za houpani na houpadle, delka houpani je priblizne 2/5 minut



---

## 2. Hardware (z velké části pořízeno)

| Komponenta | Stav | Detail |
|---|---|---|
| Raspberry Pi 5 (8 GB) | ✅ koupeno | hlavní výpočetní jednotka |
| Úložiště: NVMe SSD + M.2 HAT | ✅ nainstalováno, systém migrován z SD na NVMe | bootuje se z NVMe |
| Aktivní chladič | nutný | Pi 5 se topí, v 24/7 provozu povinné |
| Oficiální zdroj 27 W USB-C | nutný | levné zdroje Pi 5 nezvládají |
| Dotykový displej 13,3", FHD 1920×1080, kapacitní | ve výběru | viz pozn. níže |
| Ochranný kryt: polykarbonát 3 mm před displejem | plán | obětovaná vrstva proti dětem |


**Poznámky k displeji:**
- HDMI nese **jen obraz/zvuk**. Dotyk jde **samostatně přes USB** (HID zařízení,
  na Pi OS plug-and-play, bez ovladačů).
- Displej má vlastní napájení (12V zdroj), **nebere proud z Pi**.

---

## 3. Rozhraní pro detekci jízdy (signál z houpadla)

Tohle je klíčová hardwarová část propojení.

**Fakta o houpadle:**
- Houpadlo je napájené z 230 V AC, uvnitř má usměrňovač na 12 V DC.
- Platba probíhá mincovníkem **nebo** kartovým terminálem. Obojí jde do řídicí desky
  houpadla, která po dostatečném kreditu **sama sepne motor** na nastavenou dobu.

**Strategie detekce (důležité):**
- NEdetekujeme platbu jako takovou. Místo toho **odposloucháváme signál, kterým
  řídicí deska spouští motor** (typicky 12 V DC aktivní po celou dobu jízdy).
- Tím to funguje automaticky pro minci i kartu jediným vstupem.

**Elektrické zapojení:**
- 12 V signál NESMÍ jít přímo na GPIO (max 3,3 V). Jde přes **optočlen** (PC817 nebo
  hotový optocoupler modul) pro galvanické oddělení.
- Zapojení: 12V signál → R1 (1 kΩ) → LED optočlenu; výstupní tranzistor → GPIO pin
  s pull-up R2 (10 kΩ) k 3,3 V. Konfigurace **active-low** (sepnutí stáhne GPIO na 0).
- **Země houpadla a Pi zůstávají oddělené** (smysl optočlenu). Pi napájené z vlastní zásuvky.
- Pojistka 0,5 A na 12V větvi pro jistotu.
- Zvolený GPIO pin v dosavadních úvahách: **GPIO 17**.

**Bonus pro logiku hry:** signál je aktivní po **celou dobu jízdy**, takže lze
reagovat na obě hrany — náběžná = jízda začala (spustit hru), sestupná = jízda
skončila (ukončit hru). Délka hry se tak automaticky shoduje s délkou jízdy.

---

## 4. Softwarový stack (rozhodnuto)

- **OS:** Raspberry Pi OS 64-bit (Bookworm), bootuje z NVMe. Desktop autologin zapnutý.
  Screen blanking vypnutý.
- **Frontend hry:** HTML / CSS / JavaScript, běží v **Chromium v kiosk módu**
  (fullscreen, bez panelů).
- **Backend:** Python + **Flask** + **WebSocket** (nebo Server-Sent Events).
- **GPIO knihovna:** **`gpiozero`** (na pozadí `lgpio`).
  ⚠️ **`RPi.GPIO` na Pi 5 NEFUNGUJE** — nepoužívat. Staré tutoriály s
  `import RPi.GPIO` přepsat na `gpiozero`.
- **Produkce:** read-only filesystem (overlay FS přes `raspi-config`), watchdog pro
  autorestart, autostart aplikace přes `systemd`.

**Spuštění Chromium v kiosku (Wayland varianta na Bookworm):**
```bash
chromium-browser --kiosk \
  --enable-features=UseOzonePlatform --ozone-platform=wayland \
  http://localhost:5000
```
(Pokud Wayland zlobí s dotykem, přepnout na X11 přes `raspi-config` → Advanced → Wayland → X11.)

**Kostra detekce GPIO (Python, gpiozero):**
```python
from gpiozero import Button

ride = Button(17, pull_up=True, bounce_time=0.05)

ride.when_pressed = start_game    # jízda začala
ride.when_released = end_game     # jízda skončila
```

---

## 5. Logika / flow aplikace

```
┌─────────────────┐   signál aktivní (jízda začala)   ┌──────────────┐
│  ATRAKTOR        │ ────────────────────────────────▶ │   HRA/KVÍZ    │
│  (klidová obr.)  │                                    │  (běží)       │
│  - animace       │ ◀──────────────────────────────── │              │
│  - "Vlož minci"  │   signál neaktivní (jízda končí)   └──────────────┘
└─────────────────┘   → výsledek → zpět na atraktor
```

- **Atraktor (klidový stav):** animace, výzva k platbě, ukázka hry. Běží, dokud
  není aktivní signál jízdy.
- **Start hry:** náběžná hrana GPIO → přepnout frontend na hru/kvíz.
- **Běh hry:** hra/kvíz po dobu jízdy. Dotykové ovládání (prosté ťuknutí, multi-touch
  není potřeba).
- **Konec hry:** sestupná hrana GPIO → zobrazit výsledek / "ahoj, přijď zas" → návrat
  na atraktor.
- Obsah kvízu navržen tak, aby šel snadno editovat (např. otázky v JSONu).

---

## 6. Navrhovaná struktura projektu

```
houpadlo-kiosk/
├── backend/
│   ├── app.py              # Flask + WebSocket server
│   ├── gpio_listener.py    # gpiozero detekce signálu jízdy
│   └── requirements.txt    # flask, flask-sock (nebo flask-socketio), gpiozero
├── frontend/
│   ├── index.html          # hlavní stránka (atraktor + hra)
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── main.js         # WebSocket klient, přepínání stavů
│   │   ├── attract.js      # klidová obrazovka
│   │   └── quiz.js         # logika kvízu
│   └── assets/             # obrázky, zvuky
├── data/
│   └── questions.json      # otázky kvízu (snadná editace)
├── deploy/
│   ├── kiosk.service       # systemd unit pro autostart
│   └── start-kiosk.sh      # spuštění Chromium v kiosk módu
└── README.md
```

---

## 7. Co je hotové vs. co stavět

**Hotové / rozhodnuté:**
- [x] Pi 5 pořízeno, systém na NVMe, bootuje z NVMe
- [x] Pi OS 64-bit nainstalováno a aktualizováno
- [x] Architektura SW (Chromium kiosk + Flask + WebSocket + gpiozero)
- [x] Strategie detekce signálu (odposlech motor-signálu přes optočlen, GPIO 17)
- [x] Logika flow (atraktor ↔ hra řízená hranami GPIO)

**Ke stavbě v Claude Code:**
- [ ] Flask backend s WebSocket endpointem
- [ ] GPIO listener vlákno (gpiozero), posílá události start/end do frontendu
- [ ] Frontend: stavový stroj atraktor → hra → výsledek → atraktor
- [ ] Samotný kvíz/hra (mechanika, otázky z JSONu, dotykové ovládání)
- [ ] Atraktor obrazovka (animace + výzva k platbě)
- [ ] Zvuky a vizuální zpětná vazba
- [ ] systemd služba pro autostart + skript pro Chromium kiosk
- [ ] (později) read-only FS, watchdog

**Pro vývoj bez hardwaru:** přidat do backendu možnost simulovat signál jízdy
(např. klávesová zkratka nebo testovací endpoint `/dev/trigger`), aby šlo hru
vyvíjet a testovat na PC bez připojeného houpadla a optočlenu.

---

## 8. Důležité technické připomínky (ať se nestaví na špatných předpokladech)

- **`RPi.GPIO` nefunguje na Pi 5** → výhradně `gpiozero` / `lgpio`.
- Pi není real-time → na detekci sepnutí (ms odezva) stačí, na přesné časování ne.
- Chromium pod Wayland potřebuje ozone parametry (viz výše).
- Displej: dotyk přes USB (HID), obraz přes HDMI — dva kabely.
- PCIe Gen 3 na Pi 5 je experimentální → **necháno na Gen 2** kvůli stabilitě (pro
  kiosek rychlost disku irelevantní).
- V produkci: read-only filesystem + watchdog + systemd autostart.
- Pozor na child-safety a vhodnost obsahu — aplikace cílí na děti.
