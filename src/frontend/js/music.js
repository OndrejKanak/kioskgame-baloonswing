// ============================================================================
//  Hudba na pozadí – skládá se proceduálně přes WebAudio, žádné zvukové
//  soubory. Díky tomu je BEZ AUTORSKÝCH PRÁV (melodie i zvuk vznikají přímo
//  tady v kódu), funguje offline a nezabere žádné místo.
//
//  Tři skladby:
//    lobby  – klidný valčík pro atraktor, menu a obrazovku „Ahoj"
//    game1  – snivá, vzdušná pro Balónkovou výpravu (stoupání)
//    game2  – hopsavá pro Balónkový let
//
//  Zvuk: jednoduchá „hrací skříňka" (trojúhelníková vlna s rychlým náběhem
//  a dlouhým dozníváním) + měkký bas. Přesné časování zajišťuje plánovač,
//  který noty zadává dopředu do WebAudio (ne setTimeout), takže rytmus
//  nekolísá ani při zátěži.
//
//  Ladění hlasitosti: config.js → music.volume
// ============================================================================

const Music = {
  // --- převod názvu noty na frekvenci (A4 = 440 Hz) ---------------------
  _BASE: { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 },
  _freq(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) return 440;
    let semi = this._BASE[m[1]];
    if (m[2] === '#') semi += 1;
    if (m[2] === 'b') semi -= 1;
    const midi = semi + (parseInt(m[3], 10) + 1) * 12; // C4 = 60
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  // ==========================================================================
  //  SKLADBY
  //  lead   = melodie: [doba, nota, délka, hlasitost]
  //  chords = akordy:  [doba, [noty]] – z nich se dělá bas a rozklad
  //  Doby jsou v „taktových dobách", délka skladby je `beats`.
  // ==========================================================================
  tracks: {
    // --- LOBBY: klidný valčík 3/4 v C dur, jako hrací skříňka -------------
    lobby: {
      bpm: 84,
      beats: 24,
      arp: 'none',
      bassVel: 0.16,
      chords: [
        [0, ['C3', 'G3']], [3, ['A2', 'E3']], [6, ['F2', 'C3']], [9, ['G2', 'D3']],
        [12, ['C3', 'G3']], [15, ['A2', 'E3']], [18, ['F2', 'C3']], [21, ['G2', 'D3']],
      ],
      lead: [
        [0, 'E5', 1.5, 0.30], [1.5, 'G5', 1.5, 0.30],
        [3, 'A5', 1, 0.30], [4, 'G5', 1, 0.26], [5, 'E5', 1, 0.26],
        [6, 'F5', 1.5, 0.30], [7.5, 'A5', 1.5, 0.30],
        [9, 'G5', 2, 0.30], [11, 'D5', 1, 0.24],
        [12, 'E5', 1, 0.30], [13, 'G5', 1, 0.28], [14, 'C6', 1, 0.32],
        [15, 'A5', 2, 0.30], [17, 'G5', 1, 0.24],
        [18, 'F5', 1, 0.28], [19, 'E5', 1, 0.26], [20, 'D5', 1, 0.26],
        [21, 'D5', 1, 0.26], [22, 'B4', 1, 0.24], [23, 'G4', 1, 0.24],
      ],
    },

    // --- HRA 1: snivá, vzdušná 4/4 v F dur, s jemným rozkladem -----------
    game1: {
      bpm: 92,
      beats: 32,
      arp: 'quarter',
      arpVel: 0.09,
      bassVel: 0.14,
      chords: [
        [0, ['F2', 'A3', 'C4']], [4, ['Bb2', 'D4', 'F4']],
        [8, ['C3', 'E4', 'G4']], [12, ['F2', 'A3', 'C4']],
        [16, ['D2', 'F3', 'A3']], [20, ['Bb2', 'D4', 'F4']],
        [24, ['C3', 'E4', 'G4']], [28, ['F2', 'A3', 'C4']],
      ],
      lead: [
        [0, 'F4', 1, 0.26], [1, 'A4', 1, 0.26], [2, 'C5', 2, 0.28],
        [4, 'D5', 1, 0.28], [5, 'C5', 1, 0.24], [6, 'Bb4', 2, 0.26],
        [8, 'C5', 1, 0.26], [9, 'E5', 1, 0.28], [10, 'G5', 2, 0.30],
        [12, 'F5', 3, 0.30], [15, 'C5', 1, 0.22],
        [16, 'A4', 1, 0.26], [17, 'D5', 1, 0.28], [18, 'F5', 2, 0.28],
        [20, 'D5', 2, 0.26], [22, 'Bb4', 2, 0.24],
        [24, 'C5', 1, 0.26], [25, 'D5', 1, 0.26], [26, 'E5', 2, 0.28],
        [28, 'F5', 2, 0.30], [30, 'A4', 2, 0.24],
      ],
    },

    // --- HRA 2: hopsavá 4/4 v G dur, poskakující bas ----------------------
    game2: {
      bpm: 116,
      beats: 32,
      arp: 'none',
      bassVel: 0.17,
      bounce: true, // bas hraje na doby 0 a 2 („oom-pa")
      chords: [
        [0, ['G2', 'D3']], [4, ['C3', 'G3']], [8, ['D3', 'A3']], [12, ['G2', 'D3']],
        [16, ['E3', 'B3']], [20, ['C3', 'G3']], [24, ['D3', 'A3']], [28, ['G2', 'D3']],
      ],
      lead: [
        [0, 'G4', 0.5, 0.26], [0.5, 'B4', 0.5, 0.26], [1, 'D5', 0.5, 0.28],
        [1.5, 'B4', 0.5, 0.24], [2, 'G5', 1, 0.30], [3, 'D5', 1, 0.26],
        [4, 'E5', 0.5, 0.28], [4.5, 'C5', 0.5, 0.24], [5, 'E5', 0.5, 0.26],
        [5.5, 'G5', 0.5, 0.28], [6, 'E5', 2, 0.28],
        [8, 'F#5', 0.5, 0.28], [8.5, 'D5', 0.5, 0.24], [9, 'A4', 0.5, 0.24],
        [9.5, 'D5', 0.5, 0.26], [10, 'F#5', 2, 0.28],
        [12, 'G5', 1, 0.30], [13, 'D5', 1, 0.26], [14, 'B4', 2, 0.26],
        [16, 'E5', 0.5, 0.28], [16.5, 'G5', 0.5, 0.26], [17, 'B5', 0.5, 0.30],
        [17.5, 'G5', 0.5, 0.26], [18, 'E5', 2, 0.28],
        [20, 'C5', 0.5, 0.26], [20.5, 'E5', 0.5, 0.26], [21, 'G5', 0.5, 0.28],
        [21.5, 'E5', 0.5, 0.24], [22, 'C5', 2, 0.26],
        [24, 'D5', 0.5, 0.26], [24.5, 'F#5', 0.5, 0.26], [25, 'A5', 0.5, 0.28],
        [25.5, 'F#5', 0.5, 0.24], [26, 'D5', 2, 0.26],
        [28, 'G5', 1, 0.30], [29, 'B4', 1, 0.26], [30, 'G4', 2, 0.26],
      ],
    },
  },

  // ==========================================================================
  //  PŘEHRÁVÁNÍ
  // ==========================================================================
  wanted: null,     // jakou skladbu chceme hrát
  playing: null,    // co opravdu hraje
  gain: null,
  _timer: null,
  _step: 0,
  _nextTime: 0,
  _steps: null,     // předpočítané noty po 1/4 doby

  get enabled() {
    return !!(CONFIG.music && CONFIG.music.enabled);
  },

  /** Přepne na skladbu (plynule prolne). name = 'lobby' | 'game1' | 'game2' */
  play(name) {
    if (!this.enabled || !this.tracks[name]) return;
    if (this.wanted === name) return;
    this.wanted = name;
    this._start();
  },

  /** Zastaví hudbu (s krátkým doznením). */
  stop() {
    this.wanted = null;
    this.playing = null;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this.gain && Sound.ctx) {
      const t = Sound.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    }
  },

  /** Zkusí rozjet hudbu – volá se i po odemčení zvuku prvním dotykem. */
  resume() {
    if (this.enabled && this.wanted && this.playing !== this.wanted) this._start();
  },

  // --- vnitřní ------------------------------------------------------------
  _start() {
    Sound.unlock();
    const ctx = Sound.ctx;
    if (!ctx || ctx.state !== 'running') return; // zkusíme znovu po dotyku

    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.connect(ctx.destination);
    }
    const vol = CONFIG.music.volume != null ? CONFIG.music.volume : 0.3;
    const t = ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(0.0001, t);
    this.gain.gain.linearRampToValueAtTime(vol, t + 0.8); // plynulý nástup

    this.playing = this.wanted;
    this._steps = this._buildSteps(this.tracks[this.playing]);
    this._step = 0;
    this._nextTime = t + 0.15;

    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this._schedule(), 60);
    this._schedule();
  },

  /** Rozloží skladbu do kroků po 1/4 doby: krok -> seznam not. */
  _buildSteps(tr) {
    const total = Math.round(tr.beats * 4);
    const map = new Array(total);
    const add = (beat, note, dur, vel, voice) => {
      const i = Math.round(beat * 4) % total;
      (map[i] || (map[i] = [])).push({ note, dur, vel, voice });
    };

    for (const [beat, note, dur, vel] of tr.lead) add(beat, note, dur, vel, 'lead');

    // bas + volitelný rozklad z akordů
    tr.chords.forEach(([beat, notes], idx) => {
      const next = tr.chords[idx + 1] ? tr.chords[idx + 1][0] : tr.beats;
      const barLen = next - beat;
      const bassVel = tr.bassVel != null ? tr.bassVel : 0.15;
      if (tr.bounce) {
        // „oom-pa": kořen na začátku, kvinta v půlce taktu
        add(beat, notes[0], barLen * 0.45, bassVel, 'bass');
        add(beat + barLen / 2, notes[1] || notes[0], barLen * 0.35, bassVel * 0.8, 'bass');
      } else {
        for (const n of notes.slice(0, 1)) add(beat, n, barLen * 0.9, bassVel, 'bass');
      }
      if (tr.arp === 'quarter' && notes.length > 1) {
        const tones = notes.slice(1);
        for (let k = 0; k < barLen; k++) {
          add(beat + k, tones[k % tones.length], 0.9, tr.arpVel || 0.09, 'arp');
        }
      }
    });
    return { map, total, stepDur: 60 / tr.bpm / 4 };
  },

  /** Zadá do WebAudio noty na nejbližších ~0,3 s dopředu. */
  _schedule() {
    const ctx = Sound.ctx;
    if (!ctx || !this._steps || this.playing !== this.wanted) return;
    const { map, total, stepDur } = this._steps;
    const horizon = ctx.currentTime + 0.3;
    let guard = 0;
    while (this._nextTime < horizon && guard++ < 200) {
      const notes = map[this._step % total];
      if (notes) for (const n of notes) this._voice(n, this._nextTime);
      this._step++;
      this._nextTime += stepDur;
    }
  },

  /** Jedna nota. Hrací skříňka = trojúhelník + tichá oktáva navrch. */
  _voice(n, t) {
    const ctx = Sound.ctx;
    const beatDur = 60 / this.tracks[this.playing].bpm;
    const dur = Math.max(0.12, n.dur * beatDur);
    const f = this._freq(n.note);

    const make = (type, freq, vel, decay) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(g).connect(this.gain);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    };

    if (n.voice === 'bass') {
      make('sine', f, n.vel, dur * 0.95);
    } else if (n.voice === 'arp') {
      make('sine', f, n.vel, dur * 0.8);
    } else {
      make('triangle', f, n.vel, dur * 1.15);
      make('sine', f * 2, n.vel * 0.22, dur * 0.5); // jiskra hrací skříňky
    }
  },
};
