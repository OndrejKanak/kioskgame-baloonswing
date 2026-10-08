#!/usr/bin/env bash
# Spustí backend a Chromium v kiosk módu. Určeno pro Raspberry Pi OS (Bookworm, Wayland).
#
# Skript HLÍDÁ oba procesy: když kterýkoli skončí (pád, zavření okna), ukončí
# i ten druhý a sám skončí s chybou. Služba kiosk.service (Restart=always) pak
# celý kiosk do pár sekund spustí znovu – bez toho by po pádu backendu Chromium
# běžel dál a kiosk by tiše přestal reagovat na mince.
#
# Ladění na Pi:  KIOSK_DEBUG=1 ./start-kiosk.sh   (DEV lišta, klávesa G, kurzor)
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR/backend"

# 0) Polarita signálu jízdy.
#    Deska houpadla dává za jízdy 3,3 V (logická 1), ne zem – proto active-high.
#    Ověřeno na Pi:  pinctrl get 17  ->  klid = lo, po minci = hi
export RIDE_PIN=17
export RIDE_ACTIVE_HIGH=1

URL="http://localhost:5000/"
if [ "${KIOSK_DEBUG:-0}" = "1" ]; then
  URL="${URL}?debug"
  echo "Ladicí režim (DEV lišta, klávesa G)."
fi

BACKEND_PID=""
CHROMIUM_PID=""
cleanup() {
  for pid in $CHROMIUM_PID $BACKEND_PID; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

# 1) Grafická relace (Wayland).
#    Služba systemd nezdědí proměnné z přihlášené relace, takže socket
#    kompozitoru najdeme sami. Po bootu se uživatel teprve automaticky
#    přihlašuje – proto na něj chvíli počkáme.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -z "${WAYLAND_DISPLAY:-}" ]; then
  echo "Čekám na grafickou relaci (Wayland)…"
  for _ in $(seq 1 90); do
    for s in "$XDG_RUNTIME_DIR"/wayland-*; do
      case "$s" in *.lock) continue ;; esac
      if [ -S "$s" ]; then
        export WAYLAND_DISPLAY="${s##*/}"
        break 2
      fi
    done
    sleep 1
  done
fi
if [ -z "${WAYLAND_DISPLAY:-}" ]; then
  echo "CHYBA: grafická relace (Wayland) neběží." >&2
  echo "Zkontroluj raspi-config → System Options → Boot / Auto Login → Desktop Autologin." >&2
  exit 1
fi
echo "Grafická relace: $WAYLAND_DISPLAY"

# 2) Backend (Flask + GPIO listener)
python3 app.py &
BACKEND_PID=$!

# 3) Počkej, až backend naběhne (max 20 s).
#    Port testujeme přímo bashem (/dev/tcp), ne curlem – curl na Pi být nemusí
#    a když chybí, kontrola by nikdy neuspěla a Chromium by naběhl naprázdno.
echo "Čekám na backend…"
for _ in $(seq 1 40); do
  if (exec 3<>/dev/tcp/127.0.0.1/5000) 2>/dev/null; then
    BACKEND_UP=1
    echo "Backend běží."
    break
  fi
  # když backend mezitím spadl, nemá smysl čekat dál
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Backend spadl při startu." >&2
    break
  fi
  sleep 0.5
done

# Bez backendu by Chromium ukázal jen "This site can't be reached",
# což vypadá jako chyba prohlížeče. Radši skonči s jasnou hláškou.
if [ "${BACKEND_UP:-0}" != "1" ]; then
  echo "" >&2
  echo "CHYBA: backend nenaběhl na http://localhost:5000 – Chromium nespouštím." >&2
  echo "Spusť ho ručně a přečti si chybu:" >&2
  echo "    cd $APP_DIR/backend && RIDE_ACTIVE_HIGH=1 python3 app.py" >&2
  echo "" >&2
  exit 1
fi

# 4) Chromium v kiosku.
#    Binárka může být 'chromium' nebo 'chromium-browser' podle verze OS.
CHROMIUM="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROMIUM" ]; then
  echo "CHYBA: Chromium nenalezen (zkoušel jsem 'chromium-browser' i 'chromium')." >&2
  echo "Doinstaluj:  sudo apt install -y chromium-browser" >&2
  exit 1
fi

# Příznaky navíc proti oknům, která v kiosku nejdou zavřít:
#   --password-store=basic     dotaz na heslo klíčenky po automatickém přihlášení
#   --disable-features=Translate  nabídka "Přeložit tuto stránku?"
#   --no-first-run / --no-default-browser-check  uvítání a "nastavit jako výchozí"
#   --disable-session-crashed-bubble  "Chromium nebyl správně ukončen" po výpadku
echo "Spouštím Chromium na $URL"
"$CHROMIUM" --kiosk \
  --enable-features=UseOzonePlatform --ozone-platform=wayland \
  --noerrdialogs --disable-infobars --incognito \
  --no-first-run --no-default-browser-check \
  --password-store=basic \
  --disable-features=Translate \
  --disable-session-crashed-bubble \
  --disable-pinch --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  "$URL" &
CHROMIUM_PID=$!

# 5) Hlídání: čekej, dokud jeden z nich neskončí. Pak ukonči i druhý
#    (trap cleanup) a skonči s chybou – systemd spustí celý kiosk znovu.
set +e
wait -n
code=$?
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Backend skončil (kód $code) – ukončuji kiosk." >&2
else
  echo "Chromium skončil (kód $code) – ukončuji kiosk." >&2
fi
exit 1
