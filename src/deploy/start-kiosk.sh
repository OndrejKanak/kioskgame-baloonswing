#!/usr/bin/env bash
# Spustí backend a Chromium v kiosk módu. Určeno pro Raspberry Pi OS (Bookworm).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR/backend"

# 0) Polarita signálu jízdy.
#    Deska houpadla dává za jízdy 3,3 V (logická 1), ne zem – proto active-high.
#    Ověřeno na Pi:  pinctrl get 17  ->  klid = lo, po minci = hi
export RIDE_PIN=17
export RIDE_ACTIVE_HIGH=1

# 1) backend (Flask + GPIO listener)
python3 app.py &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

# 2) počkej, až backend naběhne (max 20 s)
for _ in $(seq 1 40); do
  if curl -sf http://localhost:5000/health >/dev/null 2>&1; then
    BACKEND_UP=1
    break
  fi
  # když backend mezitím spadl, nemá smysl čekat dál
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then break; fi
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

# 3) vypni šetřič/blank a schovej kurzor (pokud jsou nástroje k dispozici)
xset s off -dpms 2>/dev/null || true
command -v unclutter >/dev/null 2>&1 && unclutter -idle 0 &

# 4) Chromium v kiosku (Wayland varianta dle předávacího dokumentu).
#    Pozn.: binárka může být 'chromium' nebo 'chromium-browser' podle verze OS.
CHROMIUM="$(command -v chromium-browser || command -v chromium)"
"$CHROMIUM" --kiosk \
  --enable-features=UseOzonePlatform --ozone-platform=wayland \
  --noerrdialogs --disable-infobars --incognito \
  --disable-pinch --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  http://localhost:5000
