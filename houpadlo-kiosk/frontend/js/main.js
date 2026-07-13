// ============================================================================
//  Hlavní řízení kiosku – stavový stroj obrazovek.
//
//  Tok podle předávacího dokumentu:
//    ATRAKTOR  --(jízda začala)-->  MENU --> HRA
//    HRA/MENU  --(jízda skončila)-->  AHOJ (s výsledky) --> ATRAKTOR
//
//  Signál jízdy chodí z backendu přes SSE (/events). Pro vývoj bez houpadla
//  se dá jízda simulovat klávesou G nebo DEV tlačítkem dole.
// ============================================================================

const App = {
  state: 'attract',
  rideActive: false,
  sseConnected: false,
  game: null,
  _goodbyeTimer: null,
  // souhrn za jednu jízdu (nikam se neukládá, jen pro obrazovku "Ahoj")
  session: { stars: 0, meters: 0 },

  async init() {
    // načti grafiku (chybějící obrázky nevadí)
    await Assets.load(CONFIG.assets);

    this.screens = {
      attract: document.getElementById('screen-attract'),
      menu: document.getElementById('screen-menu'),
      balloon: document.getElementById('screen-balloon'),
      game2: document.getElementById('screen-game2'),
      goodbye: document.getElementById('screen-goodbye'),
    };

    this.game = new BalloonGame(document.getElementById('balloon-canvas'));
    this.game2 = new FlappyGame(document.getElementById('flappy-canvas'));

    // zvuk smí prohlížeč pustit až po dotyku -> odemknout při každém ťuknutí
    window.addEventListener('pointerdown', () => Sound.unlock(), true);

    this._wireUI();
    this._connectSSE();
    this._setupDev();

    this.show('attract');
  },

  // ---- přepínání obrazovek ----------------------------------------------
  show(name) {
    this.state = name;
    for (const key in this.screens) {
      this.screens[key].classList.toggle('active', key === name);
    }
  },

  // ---- stavové přechody --------------------------------------------------
  onRideStart() {
    if (this.rideActive) return;
    this.rideActive = true;
    this.session = { stars: 0, meters: 0 };
    clearTimeout(this._goodbyeTimer);
    this.show('menu'); // jízda začala -> nabídka her
  },

  onRideEnd() {
    if (!this.rideActive) return;
    this.rideActive = false;
    this._stopGame(); // zároveň přičte výsledky do session
    this._setGoodbyeStats();
    this.show('goodbye');
    clearTimeout(this._goodbyeTimer);
    this._goodbyeTimer = setTimeout(() => {
      if (!this.rideActive) this.show('attract');
    }, CONFIG.timing.goodbyeMs);
  },

  selectGame(id) {
    if (!this.rideActive) return; // hrát jde jen během jízdy
    Sound.pop();
    if (id === 'balloon') {
      this.show('balloon');
      this.game.start();
    } else if (id === 'game2') {
      this.show('game2');
      this.game2.start();
    }
  },

  backToMenu() {
    Sound.pop();
    this._stopGame();
    this.show('menu');
  },

  _stopGame() {
    // zastaví běžící hru (kteroukoli) a přičte její výsledky do souhrnu jízdy
    for (const g of [this.game, this.game2]) {
      if (g && g.running) {
        const st = g.getStats();
        this.session.stars += st.stars;
        this.session.meters += st.meters;
        g.stop();
      }
    }
  },

  // ---- výsledky na obrazovce "Ahoj" ---------------------------------------
  _setGoodbyeStats() {
    const el = document.getElementById('goodbye-stats');
    if (!el) return;
    const { stars, meters } = this.session;
    if (meters <= 0) {
      el.textContent = ''; // hra se nehrála -> žádný řádek
      return;
    }
    const parts = [];
    if (stars > 0) parts.push(`⭐ ${stars} ${this._pluralCz(stars, 'hvězdička', 'hvězdičky', 'hvězdiček')}`);
    parts.push(`🎈 výška ${meters} ${this._pluralCz(meters, 'metr', 'metry', 'metrů')}`);
    el.textContent = parts.join('  ·  ');
  },

  _pluralCz(n, one, few, many) {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
  },

  // ---- UI dráty ----------------------------------------------------------
  _wireUI() {
    document.querySelectorAll('[data-game]').forEach((el) => {
      el.addEventListener('click', () => this.selectGame(el.dataset.game));
    });
    document.querySelectorAll('[data-action="menu"]').forEach((el) => {
      el.addEventListener('click', () => this.backToMenu());
    });
  },

  // ---- SSE: příjem signálu jízdy z backendu ------------------------------
  _connectSSE() {
    let es;
    try {
      es = new EventSource('/events');
    } catch (e) {
      console.warn('SSE nedostupné:', e);
      return;
    }
    es.onopen = () => {
      this.sseConnected = true;
      this._updateDev();
    };
    es.onerror = () => {
      this.sseConnected = false;
      this._updateDev();
      // EventSource se připojí sám znovu
    };
    es.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.event === 'ride_start') this.onRideStart();
      else if (msg.event === 'ride_end') this.onRideEnd();
      else if (msg.event === 'state') {
        // synchronizace po připojení
        if (msg.active && !this.rideActive) this.onRideStart();
        else if (!msg.active && this.rideActive) this.onRideEnd();
      }
    };
  },

  // ---- DEV nástroje (jen když CONFIG.debug) ------------------------------
  _setupDev() {
    this.devBar = document.getElementById('dev-bar');
    if (!CONFIG.debug) {
      if (this.devBar) this.devBar.style.display = 'none';
      return;
    }
    this.devBar.style.display = 'flex';
    document.getElementById('dev-toggle').addEventListener('click', () => this.devToggleRide());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'g' || e.key === 'G') this.devToggleRide();
    });
    this._updateDev();
  },

  devToggleRide() {
    // Když je připojený backend, jdi "pravou cestou" přes server (vrátí se SSE).
    // Jinak (čistý frontend bez backendu) přepni stav lokálně.
    if (this.sseConnected) {
      fetch('/dev/trigger?state=toggle').catch(() => {});
    } else if (this.rideActive) {
      this.onRideEnd();
    } else {
      this.onRideStart();
    }
  },

  _updateDev() {
    const s = document.getElementById('dev-status');
    if (s) s.textContent = this.sseConnected ? 'backend ✓' : 'bez backendu';
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
