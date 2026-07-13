"""Flask server pro kiosek houpadla.

- Servíruje frontend (frontend/ složku).
- Posílá události "jízda začala/skončila" do prohlížeče přes SSE (Server-Sent
  Events) – jednoduché, robustní, automatické znovupřipojení v prohlížeči.
- Dev endpoint /dev/trigger umožní simulovat signál jízdy bez hardwaru.

Spuštění:
    cd backend
    pip install -r requirements.txt
    python app.py
Pak otevři http://localhost:5000
"""

import json
import logging
import os
import queue
import threading

from flask import Flask, Response, jsonify, request, send_from_directory

from gpio_listener import RideSignal

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger("kiosk")

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

app = Flask(__name__, static_folder=None)

# --- seznam připojených prohlížečů (každý má svou frontu zpráv) ---
_subscribers = set()
_subscribers_lock = threading.Lock()


def broadcast(event, **data):
    """Pošle událost všem připojeným prohlížečům."""
    payload = json.dumps({"event": event, **data})
    with _subscribers_lock:
        for q in list(_subscribers):
            q.put(payload)
    log.info("broadcast -> %s", payload)


# --- detekce jízdy: při hraně přepošli událost do frontendu ---
ride = RideSignal(
    pin=17,
    on_start=lambda: broadcast("ride_start"),
    on_end=lambda: broadcast("ride_end"),
)


# ---------------------------------------------------------------------------
#  SSE stream – frontend se připojí na /events a poslouchá
# ---------------------------------------------------------------------------
@app.route("/events")
def events():
    def stream():
        q = queue.Queue()
        with _subscribers_lock:
            _subscribers.add(q)
        # hned po připojení pošli aktuální stav, ať se frontend synchronizuje
        q.put(json.dumps({"event": "state", "active": ride.active}))
        try:
            while True:
                try:
                    msg = q.get(timeout=15)
                    yield f"data: {msg}\n\n"
                except queue.Empty:
                    # keep-alive komentář, aby spojení nezamrzlo / neodpadlo
                    yield ": keep-alive\n\n"
        finally:
            with _subscribers_lock:
                _subscribers.discard(q)

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
#  DEV: simulace signálu jízdy (bez houpadla)
#  GET kvůli snadnému testu z prohlížeče, POST pro aplikaci.
#  ?state=start | end | toggle
# ---------------------------------------------------------------------------
@app.route("/dev/trigger", methods=["GET", "POST"])
def dev_trigger():
    state = (request.values.get("state") or "toggle").lower()
    if state == "start":
        ride.simulate_start()
    elif state == "end":
        ride.simulate_end()
    else:
        ride.simulate_toggle()
    return jsonify(ok=True, active=ride.active)


@app.route("/health")
def health():
    return jsonify(ok=True, hardware=ride.hardware, active=ride.active)


# ---------------------------------------------------------------------------
#  Servírování frontendu
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(FRONTEND_DIR, path)


if __name__ == "__main__":
    log.info("Frontend: %s", FRONTEND_DIR)
    log.info("HW detekce GPIO: %s", "ANO" if ride.hardware else "NE (simulace)")
    # threaded=True je nutné pro souběžné SSE streamy
    app.run(host="0.0.0.0", port=5000, threaded=True)
