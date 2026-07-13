// ============================================================================
//  Hra 2: Balónkový let
//  - Balon letí doprava (svět ubíhá doleva), gravitace ho táhne dolů.
//  - Ťuknutí KAMKOLIV = balon si poskočí nahoru.
//  - Překážky: sloupy mraků shora a zdola s mezerou; v každé mezeře je
//    hvězdička ke sbírání.
//  - Náraz do sloupu balon ZASTAVÍ: svět se přestane posouvat (metry
//    nepřibývají), balon se odrazí a dostane jemné postrčení směrem
//    k mezeře. Jakmile hráč balon vyrovná do mezery, letí se dál.
//    Uvnitř mezery drží balon měkké mantinely, takže sloupem proletí čistě.
//  - Nedá se prohrát; strop i země jsou měkké mantinely.
//
//  Rozměry v CONFIGu jsou v referenčních px (obrazovka široká 1080 px);
//  vše se násobí this.s = skutečná šířka / 1080. Ladění: config.js → flappy.
// ============================================================================

class FlappyGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this._raf = null;
    this._lastT = 0;

    this._onResize = this._resize.bind(this);
    this._onPointerDown = this._pointerDown.bind(this);
    this._onKeyDown = (e) => {
      if ((e.key === ' ' || e.key === 'ArrowUp') && !e.repeat) this._flap();
    };
  }

  // ---- životní cyklus -----------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;

    this._resize();

    const img = Assets.get('balloon');
    const fc = CONFIG.balloon.frameCols;
    const fr = CONFIG.balloon.frameRows;
    this.frameW = img ? img.width / fc : 100;
    this.frameH = img ? img.height / fr : 150;
    this.balloonW = CONFIG.flappy.balloonWidth * this.s;
    this.balloonH = this.balloonW * (this.frameH / this.frameW);

    this.bx = this.W * CONFIG.flappy.balloonX; // vodorovná poloha balonu (pevná)
    this.balloon = {
      y: this.H * 0.45,
      vy: 0,
      squash: 0,     // stlačení při nárazu
      stretch: 0,    // protažení při poskoku
      stun: 0,       // po nárazu chvíli nejde ťukat
      frame: 0,
      frameTime: 0,
    };
    this.kx = 0;  // odražení balonu dozadu po nárazu (fyzické, ≤ 0)
    this.kvx = 0; // rychlost odražení / návratu
    this.t = 0;

    this.columns = [];
    this.stars = [];
    this.farClouds = [];
    this.sparkles = [];
    this.popups = [];
    this.birds = [];
    this.birdTimer = _rand(5, 11);
    this.streaks = [];
    this.trailT = 0;

    this.starCount = 0;
    this.meters = 0;
    this.hudPulse = 0;

    // první sloup až kus za obrazovkou, ať má dítě čas se rozkoukat
    this._nextColX = this.W + 300 * this.s;
    this._ensureColumns();
    this._ensureFarClouds();
    if (CONFIG.effects.windStreaks) {
      for (let i = 0; i < 7; i++) this.streaks.push(this._newStreak(_rand(0, this.W)));
    }

    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);

    this._lastT = performance.now();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;

    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('keydown', this._onKeyDown);
  }

  /** Výsledky téhle hry – čte je main.js pro obrazovku "Ahoj". */
  getStats() {
    return { stars: this.starCount, meters: Math.round(this.meters) };
  }

  // ---- vstup --------------------------------------------------------------
  _pointerDown() {
    this._flap();
  }

  _flap() {
    const b = this.balloon;
    if (!this.running || b.stun > 0) return;
    b.vy = -CONFIG.flappy.flapImpulse * this.s;
    b.stretch = 1;
    Sound.flap();
  }

  _resize() {
    const stage = this.canvas.parentElement;
    const w = Math.max(1, Math.round(stage.clientWidth));
    const h = Math.max(1, Math.round(stage.clientHeight));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this._skyCache = null;
    }
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.s = this.W / 1080;
    if (this.frameW) {
      this.balloonW = CONFIG.flappy.balloonWidth * this.s;
      this.balloonH = this.balloonW * (this.frameH / this.frameW);
      this.bx = this.W * CONFIG.flappy.balloonX;
    }
  }

  // ---- svět: sloupy mraků + hvězdičky + parallax ---------------------------
  /** Sloup = mezera (gapY, gapH) + kupy mraků nad ní a pod ní.
   *  Vizuálně sloupec obláčků; kolizně obdélník. */
  _spawnColumn(x) {
    const S = this.s;
    const F = CONFIG.flappy;
    const w = F.columnWidth * S;
    const gapH = _rand(F.gapMin, F.gapMax) * S;
    const margin = F.gapEdgeMargin * S + gapH / 2;
    const gapY = _rand(margin, this.H - margin);

    // vizuální segmenty (obláčky) nad a pod mezerou
    const segs = [];
    const step = 190 * S;
    for (let cy = gapY - gapH / 2 - step * 0.35; cy > -step; cy -= step) {
      segs.push(this._makeSeg(cy, w, S));
    }
    for (let cy = gapY + gapH / 2 + step * 0.35; cy < this.H + step; cy += step) {
      segs.push(this._makeSeg(cy, w, S));
    }

    this.columns.push({ x, w, gapY, gapH, segs, puff: 0, cd: 0 });

    // hvězdička uprostřed mezery
    if (CONFIG.stars.enabled) {
      this.stars.push({ x, y: gapY, r: CONFIG.stars.radius * S, phase: _rand(0, 6.28) });
    }
  }

  _makeSeg(cy, w, S) {
    return {
      oy: cy,
      ox: (Math.random() - 0.5) * w * 0.25,
      w: w * (0.95 + Math.random() * 0.4),
      h: 230 * S * (0.9 + Math.random() * 0.3),
      puffs: GFX.makePuffs(),
    };
  }

  _ensureColumns() {
    const S = this.s;
    const F = CONFIG.flappy;
    while (this._nextColX < this.W * 2) {
      this._spawnColumn(this._nextColX);
      this._nextColX += _rand(F.spacingMin, F.spacingMax) * S;
    }
  }

  _ensureFarClouds() {
    if (!CONFIG.effects.parallax) return;
    const S = this.s;
    let maxX = -Infinity;
    for (const c of this.farClouds) if (c.x > maxX) maxX = c.x;
    if (maxX === -Infinity) maxX = 0;
    while (maxX < this.W + 500 * S) {
      maxX += _rand(500, 1100) * S;
      const w = _rand(260, 430) * S;
      this.farClouds.push({
        x: maxX,
        y: _rand(0, this.H),
        w,
        h: w * _rand(0.5, 0.62),
        puff: 0,
        puffs: GFX.makePuffs(),
        alpha: 0.55,
      });
    }
  }

  _newStreak(x) {
    const S = this.s;
    return {
      x,
      y: _rand(0, this.H),
      len: _rand(100, 220) * S,
      alpha: _rand(0.06, 0.14),
      speedMul: _rand(1.8, 2.6),
    };
  }

  // ---- update -------------------------------------------------------------
  _update(dt) {
    const F = CONFIG.flappy;
    const S = this.s;
    this.t += dt;
    const b = this.balloon;
    const r = this.balloonW * 0.34; // přibližný poloměr balonu

    // fyzika letu
    b.vy += F.gravity * S * dt;
    b.vy = Math.min(b.vy, F.maxFall * S);
    b.y += b.vy * dt;

    // měkký strop a země
    const minY = r * 1.2;
    const maxY = this.H - r * 1.2;
    if (b.y < minY) {
      b.y = minY;
      if (b.vy < 0) b.vy = 0;
    }
    if (b.y > maxY) {
      b.y = maxY;
      if (b.vy > 0) b.vy = -b.vy * 0.25; // jemný odskok od "země"
    }

    // odeznívání efektů
    b.squash = Math.max(0, b.squash - dt * 3);
    b.stretch = Math.max(0, b.stretch - dt * 4);
    b.stun = Math.max(0, b.stun - dt);
    this.hudPulse = Math.max(0, this.hudPulse - dt * 2.5);

    // fyzika odražení dozadu: po nárazu balon couvne a plynule se vrací
    if (this.kx < 0 || this.kvx !== 0) {
      this.kvx += F.knockReturn * S * dt; // zrychlování zpět dopředu
      this.kx += this.kvx * dt;
      if (this.kx <= -F.knockMax * S) {
        this.kx = -F.knockMax * S;
        if (this.kvx < 0) this.kvx = 0;
      }
      if (this.kx >= 0) {
        this.kx = 0;
        this.kvx = 0;
      }
    }

    // animace snímků balonu
    b.frameTime += dt;
    const frameDur = 1 / CONFIG.balloon.fps;
    while (b.frameTime >= frameDur) {
      b.frameTime -= frameDur;
      b.frame = (b.frame + 1) % CONFIG.balloon.frameCount;
    }

    // ---- posun světa s blokováním o sloupy --------------------------------
    // Když balon nesedí v mezeře a dorazí ke sloupu: náraz ho ODRAZÍ DOZADU,
    // překážka ZŮSTANE STÁT na místě (dx = 0) a čeká, dokud hráč balon
    // nevyrovná do mezery. Pak se svět zase rozjede a balon sloupem proletí
    // (uvnitř mezery ho drží měkké mantinely).
    const bxk = this.bx + this.kx; // skutečná poloha balonu (vč. odražení)
    const nose = bxk + r;          // "nos" balonu
    const dxNominal = F.scrollSpeed * S * dt;
    let dx = dxNominal;
    for (const c of this.columns) {
      const cw = c.w * 0.85; // kolizní šířka užší než vizuál (shovívavost)
      const left = c.x - cw / 2;
      const right = c.x + cw / 2;
      if (right < bxk - r) {
        c.engaged = false; // sloup už je za balonem
        continue;
      }
      const gapTop = c.gapY - c.gapH / 2;
      const gapBottom = c.gapY + c.gapH / 2;
      const fits = b.y - r >= gapTop + 4 && b.y + r <= gapBottom - 4;
      if (fits) {
        // balon sedí v mezeře: překážka je překonatelná, svět smí jet
        c.engaged = false;
        if (left < bxk + r && right > bxk - r) {
          if (b.y - r < gapTop + 2) {
            b.y = gapTop + r + 2;
            if (b.vy < 0) b.vy = 0;
          }
          if (b.y + r > gapBottom - 2) {
            b.y = gapBottom - r - 2;
            if (b.vy > 0) b.vy = -b.vy * 0.2;
          }
        }
        continue;
      }
      // balon v mezeře nesedí
      const gapToNose = left - nose;
      if (c.engaged || gapToNose <= 0) {
        // zapojená překážka: stojí na místě, dokud ji hráč nepřekoná
        c.engaged = true;
        dx = 0;
        if (gapToNose <= 2) this._hit(c); // dotyk → odraz dozadu (s cooldownem)
      } else {
        // vzdálený sloup: svět dojede maximálně k jeho hraně
        dx = Math.min(dx, gapToNose);
      }
    }

    // sloupy
    this._nextColX -= dx;
    for (const c of this.columns) {
      c.x -= dx;
      c.puff = Math.max(0, c.puff - dt * 2.2);
      c.cd = Math.max(0, c.cd - dt);
    }
    this.columns = this.columns.filter((c) => c.x + c.w > -250 * S);
    this._ensureColumns();

    // vzdálené mraky (parallax)
    for (const c of this.farClouds) c.x -= dx * 0.35;
    this.farClouds = this.farClouds.filter((c) => c.x + c.w > -200 * S);
    this._ensureFarClouds();

    // hvězdičky
    const collectR = this.balloonW * 0.42;
    for (const st of this.stars) {
      st.x -= dx;
      st.phase += dt * 3;
      const dsx = st.x - bxk;
      const dsy = st.y - b.y;
      if (!st.collected && dsx * dsx + dsy * dsy < (collectR + st.r * 0.7) ** 2) {
        st.collected = true;
        this.starCount++;
        this.hudPulse = 1;
        GFX.burst(this.sparkles, st.x, st.y, 14, 'gold', S);
        GFX.addPopup(this.popups, st.x, st.y - 50 * S, '+1');
        Sound.star();
      }
    }
    this.stars = this.stars.filter((st) => !st.collected && st.x + st.r > -60);

    // ptáčci (létají doleva, nezávisle na světě)
    if (CONFIG.effects.birds) this._updateBirds(dt);

    // větrné šmouhy: jedou se světem – když balon stojí, vítr se zastaví
    for (const w of this.streaks) {
      w.x -= dx * w.speedMul + 30 * S * dt;
      if (w.x + w.len < 0) {
        Object.assign(w, this._newStreak(0), { x: this.W + w.len });
      }
    }

    // obláčková stopa za balonem – jen když balon skutečně letí
    if (CONFIG.effects.trail && dx > 0.1) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.06;
        GFX.emitTrail(
          this.sparkles,
          bxk - this.balloonW * 0.4,
          b.y + this.balloonH * _rand(0.05, 0.3),
          -(dx / dt) * 0.55,
          _rand(-30, 30) * S,
          S
        );
      }
    }

    this.sparkles = GFX.updateParticles(this.sparkles, dt);
    this.popups = GFX.updatePopups(this.popups, dt);

    // nalétané metry (40 ref. px = 1 m) – při zastavení nepřibývají
    this.meters += (dx / S) / 40;
  }

  /** Náraz do sloupu: balon se fyzicky odrazí DOZADU a vrací se; překážka
   *  stojí. Zároveň dostane jemné postrčení směrem ke středu mezery
   *  (dopomoc pro malé děti). */
  _hit(column) {
    const b = this.balloon;
    if (column.cd <= 0) {
      column.cd = 0.6;
      column.puff = 1;
      b.squash = 1;
      b.stun = CONFIG.flappy.stunTime;
      this.kvx = -CONFIG.flappy.knockback * this.s; // odraz dozadu
      GFX.burst(this.sparkles, this.bx + this.kx + this.balloonW * 0.35, b.y, 10, 'white', this.s);
      Sound.bounce();
      // dopomoc jen v momentě nárazu, ne trvale
      const dir = column.gapY > b.y ? 1 : -1;
      b.vy = dir * CONFIG.flappy.deflect * this.s;
    }
  }

  _updateBirds(dt) {
    const S = this.s;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = _rand(8, 16);
      const y = _rand(this.H * 0.08, this.H * 0.45);
      const speed = _rand(260, 420) * S;
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        this.birds.push({
          x: this.W + (80 + i * 90) * S,
          y: y + (i % 2 ? 34 : 0) * S,
          dir: -1,
          speed,
          phase: _rand(0, Math.PI * 2),
        });
      }
    }
    for (const b of this.birds) {
      b.x += b.dir * b.speed * dt;
      b.phase += dt * 11;
    }
    const margin = 200 * this.s;
    this.birds = this.birds.filter((b) => b.x > -margin && b.x < this.W + margin);
  }

  // ---- render -------------------------------------------------------------
  _render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    this._drawSky(ctx);
    this._drawStreaks(ctx);
    for (const c of this.farClouds) GFX.drawCloud(ctx, c, Assets.get('cloud'));
    for (const st of this.stars) GFX.drawStar(ctx, st, this.s);
    this._drawColumns(ctx);
    GFX.drawParticles(ctx, this.sparkles, this.s);
    this._drawBirds(ctx);
    this._drawBalloon(ctx);
    if (CONFIG.effects.fog) GFX.drawFog(ctx, this.W, this.H);
    if (CONFIG.effects.logoInGame) GFX.drawLogo(ctx, Assets.get('logo'), this.W, this.H, this.s);
    GFX.drawPopups(ctx, this.popups, this.s);
    if (CONFIG.stars.enabled) GFX.drawHud(ctx, this.W, this.s, this.starCount, this.hudPulse);
  }

  _drawSky(ctx) {
    if (!this._skyCache) {
      const c = document.createElement('canvas');
      c.width = this.W;
      c.height = this.H;
      GFX.paintSky(c.getContext('2d'), this.W, this.H, Assets.get('sky'));
      this._skyCache = c;
    }
    ctx.drawImage(this._skyCache, 0, 0);
  }

  _drawStreaks(ctx) {
    if (!CONFIG.effects.windStreaks) return;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5 * this.s;
    for (const w of this.streaks) {
      ctx.globalAlpha = w.alpha;
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x + w.len, w.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawColumns(ctx) {
    const img = Assets.get('cloud');
    for (const c of this.columns) {
      for (const seg of c.segs) {
        GFX.drawCloud(
          ctx,
          { x: c.x + seg.ox, y: seg.oy, w: seg.w, h: seg.h, puff: c.puff, puffs: seg.puffs, alpha: 1 },
          img
        );
      }
    }
  }

  _drawBirds(ctx) {
    if (!CONFIG.effects.birds) return;
    const S = this.s;
    ctx.save();
    ctx.strokeStyle = 'rgba(28, 44, 72, 0.85)';
    ctx.lineWidth = 7 * S;
    ctx.lineCap = 'round';
    for (const b of this.birds) {
      const flap = Math.sin(b.phase) * 0.9;
      const w = 26 * S;
      const h = 16 * S * flap;
      ctx.beginPath();
      ctx.moveTo(b.x - w, b.y);
      ctx.quadraticCurveTo(b.x - w / 2, b.y - h, b.x, b.y);
      ctx.quadraticCurveTo(b.x + w / 2, b.y - h, b.x + w, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawBalloon(ctx) {
    const b = this.balloon;
    const img = Assets.get('balloon');

    // náklon podle svislé rychlosti (nahoru = mírně vzhůru, pád = dolů)
    const tilt = Math.max(-1, Math.min(1, b.vy / (1400 * this.s))) * (22 * Math.PI) / 180;

    const sx = (1 + 0.12 * b.squash) * (1 - 0.08 * b.stretch);
    const sy = (1 - 0.18 * b.squash) * (1 + 0.12 * b.stretch);
    const dw = this.balloonW * sx;
    const dh = this.balloonH * sy;

    ctx.save();
    ctx.translate(this.bx + this.kx, b.y); // kx = fyzické odražení dozadu
    ctx.rotate(tilt);
    if (img) {
      const cols = CONFIG.balloon.frameCols;
      const col = b.frame % cols;
      const row = Math.floor(b.frame / cols);
      ctx.drawImage(
        img,
        col * this.frameW,
        row * this.frameH,
        this.frameW,
        this.frameH,
        -dw / 2,
        -dh / 2,
        dw,
        dh
      );
    } else {
      ctx.fillStyle = '#2e8b57';
      ctx.beginPath();
      ctx.ellipse(0, -dh * 0.1, dw * 0.45, dh * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-dw * 0.12, dh * 0.32, dw * 0.24, dh * 0.16);
    }
    ctx.restore();
  }

  // ---- smyčka -------------------------------------------------------------
  _loop(t) {
    if (!this.running) return;
    let dt = (t - this._lastT) / 1000;
    this._lastT = t;
    dt = Math.min(dt, 0.05);
    this._update(dt);
    this._render();
    this._raf = requestAnimationFrame((tt) => this._loop(tt));
  }
}
