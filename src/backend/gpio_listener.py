"""Detekce signálu jízdy z houpadla přes GPIO (gpiozero).

Princip podle předávacího dokumentu:
- Řídicí deska houpadla po zaplacení sama sepne motor. My pouze odposloucháváme
  tento motor-signál (12 V přes optočlen → GPIO 17, zapojení active-low s pull-up).
- Náběžná hrana  = jízda začala  -> spustit hru
- Sestupná hrana = jízda skončila -> ukončit hru

Na vývojovém PC (Windows) gpiozero/lgpio neexistuje. Modul to pozná a běží
v "simulation-only" režimu – signál se pak vyvolává testovacím endpointem
/dev/trigger nebo klávesou v prohlížeči. Hra tím jde vyvíjet úplně bez hardwaru.

POZOR: na Raspberry Pi 5 NEFUNGUJE RPi.GPIO – používáme výhradně gpiozero (lgpio).
"""

import logging

log = logging.getLogger(__name__)


class RideSignal:
    """Sleduje signál jízdy a volá callbacky on_start / on_end.

    Atribut `active` drží aktuální stav (True = jízda běží).
    Funguje i bez hardwaru – pak se stav mění jen přes simulate_* metody.
    """

    def __init__(self, pin=17, on_start=None, on_end=None, active_high=False):
        self.pin = pin
        # active_high=False (výchozí): jízda = pin stažený k zemi (log. 0).
        #   Tak to vyjde při zapojení přes optočlen s pull-upem – viz README.
        # active_high=True: jízda = na pinu je 3,3 V.
        #   Použij, kdyby signál vyšel obráceně (např. rozpínací kontakt).
        self.active_high = active_high
        self.on_start = on_start or (lambda: None)
        self.on_end = on_end or (lambda: None)
        self.active = False
        self.hardware = False
        self._button = None
        self._setup_hardware()

    def _setup_hardware(self):
        """Zkusí nastavit GPIO. Když to nejde (PC bez Pi), jede simulace."""
        try:
            from gpiozero import Button

            # pull_up=True  -> vnitřní pull-up, "stisk" = pin stažený k zemi
            # pull_up=False -> vnitřní pull-down, "stisk" = na pinu 3,3 V
            # bounce_time potlačí zákmity (motor v houpadle umí rušit)
            self._button = Button(
                self.pin, pull_up=not self.active_high, bounce_time=0.05
            )
            self._button.when_pressed = self._fire_start   # náběžná hrana
            self._button.when_released = self._fire_end     # sestupná hrana
            self.hardware = True
            log.info(
                "GPIO listener aktivní na pinu %s (jízda = %s)",
                self.pin,
                "3,3 V" if self.active_high else "spojeno se zemí",
            )
        except Exception as exc:  # noqa: BLE001 – chceme zachytit cokoliv (import i HW chyby)
            log.warning(
                "GPIO není k dispozici (%s) – jedu v SIMULACE režimu "
                "(signál jízdy vyvolávej přes /dev/trigger nebo klávesou G).",
                exc,
            )

    # --- vnitřní spouštění s ochranou proti dvojímu sepnutí ---
    def _fire_start(self):
        if not self.active:
            self.active = True
            log.info("Jízda ZAČALA")
            self.on_start()

    def _fire_end(self):
        if self.active:
            self.active = False
            log.info("Jízda SKONČILA")
            self.on_end()

    # --- simulace pro vývoj bez houpadla ---
    def simulate_start(self):
        self._fire_start()

    def simulate_end(self):
        self._fire_end()

    def simulate_toggle(self):
        if self.active:
            self._fire_end()
        else:
            self._fire_start()
