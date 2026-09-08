// ============================================================================
//  Procedurální zvuky přes WebAudio – žádné soubory, funguje offline.
//  Prohlížeč povolí zvuk až po prvním dotyku/kliku, proto se AudioContext
//  "odemyká" v Sound.unlock() (volá se z main.js při každém pointerdown).
//  Na kiosku navíc pomáhá Chromium flag --autoplay-policy=no-user-gesture-required.
// ============================================================================
const Sound = {
  ctx: null,
  master: null,

  get enabled() {
    return !!(CONFIG.sound && CONFIG.sound.enabled);
  },

  /** Zvukový kontext je potřeba i pro hudbu – efekty se dají vypnout zvlášť. */
  get audioWanted() {
    return this.enabled || !!(CONFIG.music && CONFIG.music.enabled);
  },

  unlock() {
    if (!this.audioWanted) return;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = CONFIG.sound.volume;
        this.master.connect(this.ctx.destination);
      } catch (e) {
        console.warn('WebAudio není k dispozici:', e);
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  // Krátké pípnutí: frekvence f0→f1 za dur sekund. Základ všech zvuků.
  _blip(f0, f1, dur, type, vol, delay = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  /** Žuchnutí do mraku – měkké "boing" dolů. */
  bounce() {
    this._blip(240, 110, 0.22, 'triangle', 0.5);
    this._blip(480, 220, 0.22, 'sine', 0.15);
  },

  /** Sebraná hvězdička – dvě stoupající cinknutí. */
  star() {
    this._blip(880, 880, 0.09, 'triangle', 0.35);
    this._blip(1318, 1318, 0.12, 'triangle', 0.3, 0.08);
  },

  /** Ťuknutí na tlačítko / kartu v menu. */
  pop() {
    this._blip(500, 220, 0.09, 'sine', 0.3);
  },

  /** Pošťouchnutí balonu prstem – veselé písknutí nahoru. */
  tap() {
    this._blip(300, 560, 0.12, 'sine', 0.25);
  },

  /** Poskok ve hře Balónkový let – měkké "fuf" nahoru. */
  flap() {
    this._blip(170, 330, 0.11, 'sine', 0.22);
  },

  /** Racek – dvojité "kvák" (klesavé, mírně chraplavé). */
  gull() {
    this._blip(900, 620, 0.10, 'sawtooth', 0.13);
    this._blip(780, 500, 0.13, 'sawtooth', 0.11, 0.14);
  },

  /** Prasknutí bubliny – krátké lupnutí. */
  pop2() {
    this._blip(1200, 300, 0.06, 'sine', 0.28);
  },

  /** Sebrané pírko – měkké cinknutí. */
  feather() {
    this._blip(1050, 1400, 0.16, 'sine', 0.22);
  },

  /** Průlet duhou – jiskřivý běh nahoru. */
  rainbow() {
    const n = [523, 659, 784, 1047];
    n.forEach((f, i) => this._blip(f, f, 0.12, 'triangle', 0.22, i * 0.06));
  },

  /** Stoupavý proud / větrný poryv – hučení. */
  whoosh() {
    this._blip(220, 700, 0.35, 'sawtooth', 0.10);
  },

  /** Milník – malá fanfára. */
  fanfare() {
    const n = [523, 659, 784, 1047, 1319];
    n.forEach((f, i) => this._blip(f, f, 0.16, 'triangle', 0.3, i * 0.09));
  },
};
