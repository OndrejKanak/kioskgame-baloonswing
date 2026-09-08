// ============================================================================
//  Zábavné prvky sdílené oběma hrami:
//    • racek – přiletí, přistane balonu na kopuli, veze se a odletí
//              (nebo místo přistání udělá vývrtku); po odletu upustí pírko
//    • pírko – snáší se dolů, sebrat = bonusová hvězdička
//    • mýdlové bubliny – praskají po ťuknutí i po doteku balonem
//    • duha – klene se od rohu k rohu (jen Balónková výprava);
//             průlet obloukem = duhová stopa za balonem
//    • milníky – konfety, fanfára a cedule při 5/10/20… hvězdičkách
//
//  Obě hry mají jiný směr světa, proto update() dostává posun světa (wx, wy):
//  hra 1 posílá (0, +dy) = svět jede dolů, hra 2 (-dx, 0) = svět jede doleva.
//  Prvky, které patří do světa (duha, pírka), se posouvají s ním; racek
//  a bubliny mají vlastní pohyb.
// ============================================================================

function _frand(a, b) {
  return a + Math.random() * (b - a);
}

class FunFX {
  /** host = hra; potřebuje W, H, s, sparkles (částice), popups. */
  constructor(host) {
    this.h = host;
  }

  /** opts.rainbow = false vypne duhu pro tuto hru (Balónkový let ji nemá). */
  reset(opts = {}) {
    const F = CONFIG.fun;
    this.useRainbow = opts.rainbow !== false;
    this.seagull = null;
    this.seagullT = _frand(F.seagullEvery[0], F.seagullEvery[1]);
    this.feathers = [];
    this.bubbles = [];
    this.bubbleT = _frand(F.bubbleEvery[0], F.bubbleEvery[1]);
    this.rainbow = null;
    this.rainbowT = _frand(F.rainbowEvery[0], F.rainbowEvery[1]);
    this.rainbowTime = 0; // zbývající čas duhové stopy
    this.banner = null;
    this.hitMilestones = new Set();
  }

  /** Barva duhové stopy (nebo null, když duha nehraje). */
  trailHue(t) {
    return this.rainbowTime > 0 ? (t * 220) % 360 : null;
  }

  // ------------------------------------------------------------------ update
  /** Vrací počet bonusových hvězdiček získaných v tomto snímku. */
  update(dt, wx, wy, bal) {
    const F = CONFIG.fun;
    const S = this.h.s;
    let gained = 0;

    this.rainbowTime = Math.max(0, this.rainbowTime - dt);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }

    if (F.seagull) gained += this._updateSeagull(dt, wx, wy, bal, S);
    if (F.feathers) gained += this._updateFeathers(dt, wx, wy, bal, S);
    if (F.bubbles) this._updateBubbles(dt, wx, bal, S);
    if (F.rainbow && this.useRainbow) this._updateRainbow(dt, wx, wy, bal, S);

    return gained;
  }

  // ---- racek --------------------------------------------------------------
  _updateSeagull(dt, wx, wy, bal, S) {
    const F = CONFIG.fun;
    const h = this.h;

    if (!this.seagull) {
      this.seagullT -= dt;
      if (this.seagullT <= 0) {
        this.seagullT = _frand(F.seagullEvery[0], F.seagullEvery[1]);
        const dir = Math.random() < 0.5 ? 1 : -1; // 1 = letí doprava
        this.seagull = {
          x: dir > 0 ? -140 * S : h.W + 140 * S,
          y: _frand(h.H * 0.12, h.H * 0.42),
          size: 110 * S,
          dir,
          phase: 0,
          rot: 0,
          folded: false,
          state: Math.random() < F.seagullLoopChance ? 'toloop' : 'toperch',
          stay: _frand(F.seagullStay[0], F.seagullStay[1]),
          loopT: 0,
        };
        Sound.gull();
      }
      return 0;
    }

    const g = this.seagull;
    g.phase += dt * 9;

    if (g.state === 'toperch' || g.state === 'toloop') {
      // letí k balonu (nad jeho kopuli)
      const tx = bal.x;
      const ty = g.state === 'toperch' ? this._perchY(bal, g) : bal.y - bal.r * 1.6;
      const k = Math.min(2.2 * dt, 1);
      g.x += (tx - g.x) * k;
      g.y += (ty - g.y) * k;
      g.dir = tx >= g.x ? 1 : -1;
      if (Math.abs(g.x - tx) < 26 * S && Math.abs(g.y - ty) < 26 * S) {
        if (g.state === 'toperch') {
          g.state = 'perch';
          g.folded = true;
          Sound.gull();
        } else {
          g.state = 'loop';
          g.loopT = 0;
          g.cx = g.x;
          g.cy = g.y;
        }
      }
    } else if (g.state === 'perch') {
      // veze se balonu na kopuli
      g.x = bal.x;
      g.y = this._perchY(bal, g) + Math.sin(g.phase * 0.35) * 4 * S;
      g.rot = Math.sin(g.phase * 0.3) * 0.06;
      g.stay -= dt;
      if (g.stay <= 0) this._seagullLeave(false);
    } else if (g.state === 'loop') {
      // akrobatická vývrtka kolem bodu
      g.loopT += dt;
      const R = 150 * S;
      const a = g.loopT * 4.4 - Math.PI / 2;
      g.x = g.cx + Math.cos(a) * R * g.dir;
      g.y = g.cy + Math.sin(a) * R + R;
      g.rot = a + Math.PI / 2;
      if (g.loopT > (Math.PI * 2) / 4.4) {
        g.rot = 0;
        this._seagullLeave(false);
      }
    } else if (g.state === 'leave') {
      g.folded = false;
      g.x += g.dir * 430 * S * dt;
      g.y -= 150 * S * dt;
      g.rot = -g.dir * 0.12;
      if (g.x < -220 * S || g.x > h.W + 220 * S) this.seagull = null;
    }

    return 0;
  }

  /** Kde má racek sedět: nožičky se dotýkají vrcholu kopule balonu.
   *  Nohy sahají cca 0,38 velikosti pod střed racka; 0,28 znamená, že
   *  se drápky lehce "zaboří" do balonu, aby nevypadal, že levituje. */
  _perchY(bal, g) {
    return bal.top - g.size * 0.28;
  }

  /** Racek odlétá – a upustí pírko. */
  _seagullLeave(startled) {
    const g = this.seagull;
    if (!g || g.state === 'leave') return;
    if (CONFIG.fun.feathers) {
      this.feathers.push({
        x: g.x,
        y: g.y + g.size * 0.2,
        r: 34 * this.h.s,
        rot: _frand(0, 6.28),
        sway: _frand(0, 6.28),
        vy: 120 * this.h.s,
      });
    }
    g.state = 'leave';
    g.folded = false;
    g.stay = 0;
    if (startled) {
      g.dir = -g.dir;
      GFX.burst(this.h.sparkles, g.x, g.y, 8, 'white', this.h.s);
    }
    Sound.gull();
  }

  // ---- pírka --------------------------------------------------------------
  _updateFeathers(dt, wx, wy, bal, S) {
    let gained = 0;
    for (const f of this.feathers) {
      f.sway += dt * 2.2;
      f.y += f.vy * dt + wy * 0.35;            // padá + jede se světem
      f.x += Math.sin(f.sway) * 90 * S * dt + wx * 0.5;
      f.rot = Math.sin(f.sway) * 0.7;
      const dx = f.x - bal.x;
      const dy = f.y - bal.y;
      if (!f.got && dx * dx + dy * dy < (bal.r + f.r) ** 2) {
        f.got = true;
        gained++;
        GFX.burst(this.h.sparkles, f.x, f.y, 10, 'gold', S);
        GFX.addPopup(this.h.popups, f.x, f.y - 40 * S, '+1');
        Sound.feather();
      }
    }
    this.feathers = this.feathers.filter(
      (f) => !f.got && f.y < this.h.H + 120 * S && f.x > -120 * S && f.x < this.h.W + 120 * S
    );
    return gained;
  }

  // ---- bubliny ------------------------------------------------------------
  _updateBubbles(dt, wx, bal, S) {
    const F = CONFIG.fun;
    const h = this.h;
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) {
      this.bubbleT = _frand(F.bubbleEvery[0], F.bubbleEvery[1]);
      const n = 1 + Math.floor(Math.random() * 3);
      const bx = _frand(h.W * 0.1, h.W * 0.9);
      for (let i = 0; i < n; i++) {
        this.bubbles.push({
          x: bx + _frand(-70, 70) * S,
          y: h.H + _frand(30, 160) * S,
          r: _frand(28, 62) * S,
          rise: _frand(110, 210) * S,
          phase: _frand(0, 6.28),
          swayA: _frand(20, 55) * S,
        });
      }
    }
    for (const b of this.bubbles) {
      b.phase += dt * 2.4;
      b.y -= b.rise * dt;                       // stoupá vzhůru
      b.x += Math.sin(b.phase * 0.7) * b.swayA * dt + wx * 0.35;
      const dx = b.x - bal.x;
      const dy = b.y - bal.y;
      if (!b.pop && dx * dx + dy * dy < (bal.r + b.r * 0.8) ** 2) this._popBubble(b);
    }
    this.bubbles = this.bubbles.filter((b) => !b.pop && b.y + b.r > -40 * S);
  }

  _popBubble(b) {
    b.pop = true;
    const S = this.h.s;
    // duhový záblesk: pár zlatých jisker + bílé obláčky
    GFX.burst(this.h.sparkles, b.x, b.y, 6, 'gold', S);
    GFX.burst(this.h.sparkles, b.x, b.y, 4, 'white', S);
    Sound.pop2();
  }

  // ---- duha (od rohu k rohu) ----------------------------------------------
  _updateRainbow(dt, wx, wy, bal, S) {
    const h = this.h;
    if (!this.rainbow) {
      this.rainbowT -= dt;
      if (this.rainbowT <= 0) {
        this.rainbowT = _frand(CONFIG.fun.rainbowEvery[0], CONFIG.fun.rainbowEvery[1]);
        // Úhlopříčka obrazovky: jeden dolní roh → protilehlý horní roh.
        // Duha startuje nad obrazem a se světem sjede přes celou plochu.
        const flip = Math.random() < 0.5;
        const lift = h.H * 1.25;
        const ax = flip ? 0 : h.W;
        const bx = flip ? h.W : 0;
        const chord = Math.hypot(bx - ax, h.H);
        this.rainbow = {
          ax,
          ay: h.H - lift,
          bx,
          by: -lift,
          bulge: chord * CONFIG.fun.rainbowBulge,
          thick: 30 * S,
          alpha: 0,
          used: false,
        };
      }
      return;
    }
    const rb = this.rainbow;
    rb.ax += wx;
    rb.bx += wx;
    rb.ay += wy;
    rb.by += wy;
    rb.alpha = Math.min(0.8, rb.alpha + dt * 0.5);
    if (!rb.used && GFX.rainbowHit(rb, bal.x, bal.y, bal.r)) {
      rb.used = true;
      this.rainbowTime = CONFIG.fun.rainbowTrailTime;
      GFX.burst(this.h.sparkles, bal.x, bal.y, 16, 'gold', S);
      this.showBanner('Duha! 🌈');
      Sound.rainbow();
    }
    // zmizí, až i vrchol oblouku sjede pod spodní okraj
    if ((rb.ay + rb.by) / 2 - rb.bulge > h.H + 150 * S) this.rainbow = null;
  }

  // ---- milníky ------------------------------------------------------------
  /** Zavolej po každé sebrané hvězdičce. */
  onStars(count, bx, by) {
    if (!CONFIG.fun.milestones.includes(count)) return;
    if (this.hitMilestones.has(count)) return;
    this.hitMilestones.add(count);
    GFX.confetti(this.h.sparkles, bx, by, 44, this.h.s);
    this.showBanner(`Super! ${count} ⭐`);
    Sound.fanfare();
  }

  showBanner(text, dur = 2.2) {
    this.banner = { text, t: dur, t0: dur };
  }

  // ---- vstup --------------------------------------------------------------
  /** Ťuknutí na plochu – vrací true, když se něco trefilo. */
  tap(x, y) {
    // bubliny (od nejnovější)
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (!b.pop && Math.hypot(x - b.x, y - b.y) < b.r * 1.25) {
        this._popBubble(b);
        return true;
      }
    }
    // racek – vyplaší se a odletí dřív
    const g = this.seagull;
    if (g && g.state !== 'leave' && Math.hypot(x - g.x, y - g.y) < g.size * 0.7) {
      this._seagullLeave(true);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ render
  /** Kreslí se ZA mraky (duha). */
  renderBack(ctx) {
    if (this.rainbow) GFX.drawRainbow(ctx, this.rainbow);
  }

  /** Kreslí se PŘED balonem (bubliny, pírka, racek). */
  renderFront(ctx) {
    for (const b of this.bubbles) GFX.drawBubble(ctx, b);
    for (const f of this.feathers) GFX.drawFeather(ctx, f);
    if (this.seagull) GFX.drawSeagull(ctx, this.seagull);
  }

  /** Cedule se kreslí úplně navrch (nad mlhou i logem). */
  renderBanner(ctx) {
    if (this.banner) GFX.drawBanner(ctx, this.banner, this.h.W, this.h.H, this.h.s);
  }
}
