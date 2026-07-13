#!/usr/bin/env bash
# Spustí backend a Chromium v kiosk módu. Určeno pro Raspberry Pi OS (Bookworm).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR/backend"

# 1) backend (Flask + GPIO listener)
python3 app.py &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

# 2) počkej, až backend naběhne
for _ in $(seq 1 40); do
  if curl -sf http://localhost:5000/health >/dev/null 2>&1; then break; fi
  sleep 0.5
done

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
