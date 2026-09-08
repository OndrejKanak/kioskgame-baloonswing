// ============================================================================
//  Hra 1: Balónková výprava
//  - Balon sleduje prst VE VŠECH SMĚRECH (do stran i nahoru/dolů).
//  - Svět ujíždí dolů = balon stoupá a sbírá metry.
//  - Mrak je PŘEKÁŽKA: balon se od něj odrazí dolů (animace odskoku) a dokud
//    mu hráč neuhne do strany, svět stojí na místě (metry nepřibývají).
//  - Vedle každého mraku je zaručená průletná mezera, takže hra nikdy
//    neuvízne natrvalo.
//  - Mezi mraky se sbírají hvězdičky (jen počítadlo, nic se neukládá).
//  - Ťuknutí přímo na balon = balon se vesele zavrtí.
//  - Nedá se prohrát.
//
//  Rozměry v CONFIGu jsou v referenčních px (obrazovka široká 1080 px);
//  všechno se násobí this.s = skutečná šířka / 1080, takže hra vypadá
//  stejně na PC náhledu i na FHD displeji kiosku.
//
//  Veškeré ladění (rychlosti, síla odrazu, efekty, zvuk) je v config.js.
// ============================================================================

function _rand(a, b) {
  return a + Math.random() * (b - a);
}
function _clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

class BalloonGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this._raf = null;
    this._lastT = 0;

    // vstup
    this.pointerActive = false;
    this.targetX = 0;
    this.targetY = 0;
    this.keys = new Set();

    // bind listenerů (kvůli pozdějšímu odebrání)
    this._onResize = this._resize.bind(this);
    this._onPointerDown = this._pointerDown.bind(this);
    this._onPointerMove = this._pointerMove.bind(this);
    this._onPointerUp = this._pointerUp.bind(this);
    this._onKeyDown = (e) => this.keys.add(e.key);
    this._onKeyUp = (e) => this.keys.delete(e.key);
  }

  // ---- životní cyklus -----------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;

    this._resize();

    // balon (rozřezání sprite sheetu)
    const img = Assets.get('balloon');
    const fc = CONFIG.balloon.frameCols;
    const fr = CONFIG.balloon.frameRows;
    this.frameW = img ? img.width / fc : 100;
    this.frameH = img ? img.height / fr : 150;
    this.balloonW = CONFIG.balloon.displayWidth * this.s;
    this.balloonH = this.balloonW * (this.frameH / this.frameW);

    this.balloon = {
      x: this.W / 2,
      y: this.H * CONFIG.balloon.startYRatio,
      oy: 10,       // odskok od mraku (pružina, kladně = dolů)
      vy: 0,       // rychlost odskoku
      squash: 0,   // 0..1 stlačení při nárazu
      wiggle: 0,   // 0..1 zavrtění po ťuknutí na balon
      frame: 0,
      frameTime: 0,
    };
    this.targetX = this.balloon.x;
    this.targetY = this.balloon.y;
    this.prevX = this.balloon.x;
    this.vxSmooth = 0;
    this.bobPhase = 0;
    this.t = 0; // herní čas (s)

    // svět
    this.clouds = [];
    this.farClouds = [];
    this.stars = [];
    this.sparkles = [];
    this.popups = [];
    this.birds = [];
    this.birdTimer = _rand(4, 9);
    this.streaks = [];
    this.trailT = 0;

    // stoupavé proudy + hvězdy na noční obloze (výškové vrstvy)
    this.thermals = [];
    this.thermalT = _rand(CONFIG.world.thermalEvery[0], CONFIG.world.thermalEvery[1]);
    this.inThermal = false;
    this.skyStars = [];
    for (let i = 0; i < 60; i++) {
      this.skyStars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H * 0.75,
        r: _rand(1.5, 3.5) * this.s,
        ph: _rand(0, 6.28),
      });
    }

    // statistiky téhle hry (nikam se neukládají)
    this.starCount = 0;
    this.meters = 0;
    this.hudPulse = 0;
    this.nextAltitude = 100; // další výškový milník (m)

    // zábavné prvky (racek, bubliny, duha, milníky)
    this.fun = new FunFX(this);
    this.fun.reset();

    this._initWorld();

    // posluchače vstupu
    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

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
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.keys.clear();
    this.pointerActive = false;
  }

  /** Výsledky téhle hry – čte je main.js pro obrazovku "Ahoj". */
  getStats() {
    return { stars: this.starCount, meters: Math.round(this.meters) };
  }

  // ---- vstup --------------------------------------------------------------
  _canvasPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.W,
      y: ((e.clientY - r.top) / r.height) * this.H,
    };
  }
  _pointerDown(e) {
    this.pointerActive = true;
    const p = this._canvasPoint(e);
    // nejdřív zábavné prvky: bublina praskne / racek se vyplaší
    this.fun.tap(p.x, p.y);
    this.targetX = p.x;
    this.targetY = p.y;
    // ťuknutí přímo na balon -> zavrtění + jiskry + zvuk
    const by = this.balloon.y + this.balloon.oy;
    const dx = p.x - this.balloon.x;
    const dy = p.y - by;
    if (dx * dx + dy * dy < (this.balloonW * 0.55) ** 2) {
      this.balloon.wiggle = 1;
      this._burst(this.balloon.x, by, 8, 'gold');
      Sound.tap();
    }
  }
  _pointerMove(e) {
    if (this.pointerActive) {
      const p = this._canvasPoint(e);
      this.targetX = p.x;
      this.targetY = p.y;
    }
  }
  _pointerUp() {
    this.pointerActive = false;
  }

  _resize() {
    const stage = this.canvas.parentElement;
    // renderScale < 1 = kreslíme na menší plátno a CSS ho roztáhne přes celou
    // obrazovku. Hra vypadá stejně velká, jen o něco měkčí – a ušetří to
    // spoustu pixelů (na Pi největší jediná úspora).
    const rs = (CONFIG.perf && CONFIG.perf.renderScale) || 1;
    const w = Math.max(1, Math.round(stage.clientWidth * rs));
    const h = Math.max(1, Math.round(stage.clientHeight * rs));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this._skyCache = null; // překreslit cache pozadí
      this._altGrad = null;  // gradient soumraku závisí na výšce
    }
    // Při renderScale < 1 se plátno roztahuje přes celou obrazovku.
    // 'pixelated' by z textu a mraků udělalo kostky, proto hladké zvětšování;
    // v nativním rozlišení naopak necháme ostrou pixel-art variantu.
    this.canvas.style.imageRendering = rs < 1 ? 'auto' : 'pixelated';
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.s = this.W / 1080; // měřítko: referenční šířka 1080 px
    if (this.frameW) {
      this.balloonW = CONFIG.balloon.displayWidth * this.s;
      this.balloonH = this.balloonW * (this.frameH / this.frameW);
    }
  }

  // ---- svět: mraky, hvězdičky, parallax -----------------------------------
  _makePuffs() {
    return GFX.makePuffs();
  }

  /** Mrak vždy nechává vedle sebe zaručenou průletnou mezeru (passageGap),
   *  jinak by hráč mohl uvíznout navždy. Široké mraky se přisunou k okraji
   *  (klidně kousek za něj) a mezera zůstane na druhé straně. */
  _spawnCloudAt(y) {
    const S = this.s;
    const w = _rand(CONFIG.world.cloudMinWidth, CONFIG.world.cloudMaxWidth) * S;
    const h = w * _rand(0.5, 0.65);
    const gapNeed = CONFIG.world.passageGap * S;
    const overhang = w * 0.3; // o kolik smí mrak přesahovat okraj obrazovky
    // mezera vpravo: mrak nalevo, pravý okraj mraku ≤ W - gapNeed
    const rLo = w / 2 - overhang;
    const rHi = this.W - gapNeed - w / 2;
    // mezera vlevo: mrak napravo, levý okraj mraku ≥ gapNeed
    const lLo = gapNeed + w / 2;
    const lHi = this.W - w / 2 + overhang;
    let x;
    const canRight = rHi > rLo;
    const canLeft = lHi > lLo;
    if (canRight && (!canLeft || Math.random() < 0.5)) x = _rand(rLo, rHi);
    else if (canLeft) x = _rand(lLo, lHi);
    else x = this.W / 2; // nouzovka, s aktuálními rozměry nenastane
    this.clouds.push({
      x,
      y,
      w,
      h,
      puff: 0,
      cd: 0, // cooldown efektů odrazu, ať nehrají každý snímek
      driftPhase: _rand(0, Math.PI * 2),
      puffs: this._makePuffs(),
      alpha: 1,
      hasFace: true,   // ospalá očka; po žuchnutí se lekne a usměje
      faceT: 0,
      shy: Math.random() < CONFIG.world.shyChance, // plachý mrak uhne
    });
  }

  _spawnStarBetween(yTop, yBottom) {
    const S = this.s;
    const m = (CONFIG.balloon.sideMargin + 60) * S;
    this.stars.push({
      x: _rand(m, this.W - m),
      y: _rand(yTop, yBottom),
      r: CONFIG.stars.radius * S,
      phase: _rand(0, Math.PI * 2),
    });
  }

  _initWorld() {
    this._spawnCloudAt(this.H * 0.25);
    this._ensureClouds();
    this._ensureFarClouds();
    if (CONFIG.effects.windStreaks) {
      for (let i = 0; i < 7; i++) {
        this.streaks.push(this._newStreak(_rand(0, this.H)));
      }
    }
  }

  _ensureClouds() {
    // Pojistka: při nulovém/rozbitém rozměru plátna (např. skrytý panel nebo
    // přechodný stav při rotaci displeje) by smyčka spawnovala mraky donekonečna.
    if (this.W < 10 || this.clouds.length > 40) return;
    const S = this.s;
    let minY = Infinity;
    for (const c of this.clouds) if (c.y < minY) minY = c.y;
    if (minY === Infinity) minY = this.H * 0.25;
    const maxGap = CONFIG.world.cloudMaxGap * S;
    while (minY > -maxGap) {
      const gap = _rand(CONFIG.world.cloudMinGap, CONFIG.world.cloudMaxGap) * S;
      const newY = minY - gap;
      this._spawnCloudAt(newY);
      // hvězdička do mezery mezi mraky (vždy dosažitelná)
      if (CONFIG.stars.enabled && Math.random() < CONFIG.stars.chance) {
        this._spawnStarBetween(newY + gap * 0.3, newY + gap * 0.7);
      }
      minY = newY;
    }
  }

  _ensureFarClouds() {
    if (!CONFIG.effects.parallax) return;
    if (this.W < 10 || this.farClouds.length > 40) return; // viz _ensureClouds
    const S = this.s;
    let minY = Infinity;
    for (const c of this.farClouds) if (c.y < minY) minY = c.y;
    if (minY === Infinity) minY = this.H * 0.55;
    while (minY > -600 * S) {
      const gap = _rand(700, 1200) * S;
      const newY = minY - gap;
      const w = _rand(260, 430) * S;
      this.farClouds.push({
        x: _rand(0, this.W),
        y: newY,
        w,
        h: w * _rand(0.5, 0.62),
        puff: 0,
        driftPhase: _rand(0, Math.PI * 2),
        puffs: this._makePuffs(),
        alpha: 0.55,
      });
      minY = newY;
    }
  }

  _newStreak(y) {
    const S = this.s;
    return {
      x: _rand(0, this.W),
      y,
      len: _rand(100, 220) * S,
      alpha: _rand(0.06, 0.14),
      speedMul: _rand(1.8, 2.6),
    };
  }

  // ---- update -------------------------------------------------------------
  _update(dt) {
    const C = CONFIG;
    const S = this.s;
    this.t += dt;
    const b = this.balloon;
    const half = this.balloonW / 2;
    const minX = C.balloon.sideMargin * S + half;
    const maxX = this.W - C.balloon.sideMargin * S - half;
    const minY = this.H * C.balloon.topLimit;
    const maxY = this.H * C.balloon.bottomLimit;

    // klávesy (vývoj): šipky ve všech směrech
    const keySpeed = 1900 * S;
    if (this.keys.has('ArrowLeft')) this.targetX -= keySpeed * dt;
    if (this.keys.has('ArrowRight')) this.targetX += keySpeed * dt;
    if (this.keys.has('ArrowUp')) this.targetY -= keySpeed * dt;
    if (this.keys.has('ArrowDown')) this.targetY += keySpeed * dt;

    // volitelné samovystředění, když nikdo nedrží prst
    if (!this.pointerActive && C.balloon.autoCenter > 0) {
      this.targetX += (this.W / 2 - this.targetX) * C.balloon.autoCenter * dt;
    }

    // balon sleduje prst v obou osách
    this.targetX = _clamp(this.targetX, minX, maxX);
    this.targetY = _clamp(this.targetY, minY, maxY);
    const follow = Math.min(C.balloon.followSpeed * dt, 1);
    b.x += (this.targetX - b.x) * follow;
    b.y += (this.targetY - b.y) * follow;
    b.x = _clamp(b.x, minX, maxX);
    b.y = _clamp(b.y, minY, maxY);

    // vodorovná rychlost (pro náklon balonu), vyhlazená
    const vxInst = dt > 0 ? (b.x - this.prevX) / dt : 0;
    this.vxSmooth += (vxInst - this.vxSmooth) * Math.min(8 * dt, 1);
    this.prevX = b.x;

    // pružina odskoku od mraku
    const ay = -b.oy * C.world.bounceStiffness - b.vy * C.world.bounceDamping;
    b.vy += ay * dt;
    b.oy += b.vy * dt;

    // jemné houpání v klidu + odeznívání efektů
    this.bobPhase += C.balloon.bobSpeed * dt;
    b.squash = Math.max(0, b.squash - dt * 3);
    b.wiggle = Math.max(0, b.wiggle - dt * 1.6);
    this.hudPulse = Math.max(0, this.hudPulse - dt * 2.5);

    // animace snímků balonu
    b.frameTime += dt;
    const frameDur = 1 / C.balloon.fps;
    while (b.frameTime >= frameDur) {
      b.frameTime -= frameDur;
      b.frame = (b.frame + 1) % C.balloon.frameCount;
    }

    // ---- posun světa s blokováním o mraky --------------------------------
    // Mrak nad balonem (v jeho svislém pruhu) nepustí svět dál: posun se
    // ořízne tak, aby se mrak zastavil přesně na balonu. Hráč musí uhnout.
    const r = this.balloonW * 0.34; // přibližný poloměr balonu
    const bx = b.x;
    const by = b.y + b.oy;
    // stoupavý proud: uvnitř sloupu balon stoupá mnohem rychleji
    const boost = this._updateThermals(dt, bx, by, r);
    const dyNominal = C.world.riseSpeed * S * boost * dt;
    let dy = dyNominal;
    let blocker = null;
    for (const c of this.clouds) {
      const nx = _clamp(bx, c.x - c.w / 2, c.x + c.w / 2);
      const dxh = bx - nx;
      if (Math.abs(dxh) >= r) continue; // mrak není v pruhu nad balonem
      const cloudBottom = c.y + c.h / 2;
      if (cloudBottom > by) continue; // mrak už je pod středem balonu
      const ch = Math.sqrt(Math.max(0, r * r - dxh * dxh));
      const allowed = Math.max(0, (by - ch) - cloudBottom);
      if (allowed < dy) {
        dy = allowed;
        blocker = c;
      }
    }
    if (blocker && dy < dyNominal - 0.01) {
      this._bounceFx(blocker, bx, by, r); // odskok dolů (s cooldownem)
    }

    // mraky (+ jemný boční pohyb, odeznívání efektů, plaché uhýbání)
    const shyRange = C.world.shyRange * S;
    for (const c of this.clouds) {
      c.y += dy;
      c.driftPhase += dt;
      c.x += Math.sin(c.driftPhase) * C.world.cloudDrift * S * dt;
      c.puff = Math.max(0, c.puff - dt * 2.2);
      c.cd = Math.max(0, c.cd - dt);
      c.faceT = Math.max(0, (c.faceT || 0) - dt); // výraz obličeje odeznívá
      // plachý mrak: když se balon blíží zespodu, uhne do strany
      if (c.shy && c.y < by && by - c.y < shyRange && Math.abs(c.x - bx) < shyRange) {
        const away = c.x >= bx ? 1 : -1;
        c.x += away * C.world.shySpeed * S * dt;
      }
    }
    this.clouds = this.clouds.filter((c) => c.y - c.h < this.H + 120);
    this._ensureClouds();

    // vzdálené mraky (parallax – jedou se světem, jen pomaleji)
    for (const c of this.farClouds) {
      c.y += dy * 0.35;
      c.driftPhase += dt * 0.6;
      c.x += Math.sin(c.driftPhase) * 10 * S * dt;
    }
    this.farClouds = this.farClouds.filter((c) => c.y - c.h < this.H + 120);
    this._ensureFarClouds();

    // hvězdičky (jedou se světem)
    const collectR = this.balloonW * 0.42;
    for (const st of this.stars) {
      st.y += dy;
      st.phase += dt * 3;
      const dsx = st.x - bx;
      const dsy = st.y - by;
      if (!st.collected && dsx * dsx + dsy * dsy < (collectR + st.r * 0.7) ** 2) {
        st.collected = true;
        this.starCount++;
        this.hudPulse = 1;
        this._burst(st.x, st.y, 14, 'gold');
        GFX.addPopup(this.popups, st.x, st.y - 50 * S, '+1');
        Sound.star();
        this.fun.onStars(this.starCount, bx, by); // milník = konfety + fanfára
      }
    }
    this.stars = this.stars.filter((st) => !st.collected && st.y - st.r < this.H + 60);

    // ptáčci (nezávislí na světě)
    if (CONFIG.effects.birds) this._updateBirds(dt);

    // větrné šmouhy (jedou se světem – když svět stojí, vítr stojí)
    for (const w of this.streaks) {
      w.y += dy * w.speedMul;
      if (w.y - w.len > this.H) {
        Object.assign(w, this._newStreak(0), { y: -w.len });
      }
    }

    // přímé zatlačení balonu do mraku prstem -> vytlačit ven + odskok
    this._resolveOverlaps(r, minX, maxX, minY, maxY);

    // obláčková stopa za balonem – jen když balon skutečně stoupá
    if (CONFIG.effects.trail && dy > 0.1) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.07;
        GFX.emitTrail(
          this.sparkles,
          b.x + _rand(-14, 14) * S,
          b.y + b.oy + this.balloonH * 0.42,
          _rand(-25, 25) * S,
          120 * S,
          S,
          this.fun.trailHue(this.t) // po průletu duhou je stopa duhová
        );
      }
    }

    // zábavné prvky (racek, pírka, bubliny, duha, milníky)
    // POZOR: bx/by jsou z okamžiku posunu světa; _resolveOverlaps mohl balonem
    // ještě pohnout. Racek sedící na balonu musí dostat AKTUÁLNÍ polohu,
    // jinak o snímek zaostává a při rychlém pohybu "odskakuje".
    const curX = b.x;
    const curY = b.y + b.oy;
    this.starCount += this.fun.update(dt, 0, dy, {
      x: curX,
      y: curY,
      r: collectR,
      top: curY - GFX.balloonVisualHeight(this.balloonW) * 0.5, // skutečný vršek kopule
    });

    // výškové milníky: každých 100 m cedule
    if (this.meters >= this.nextAltitude) {
      this.fun.showBanner(`${this.nextAltitude} metrů!`, 'balloon');
      Sound.fanfare();
      this.nextAltitude += 100;
    }

    // jiskřičky / obláčky částic + "+1" popupy
    this.sparkles = GFX.updateParticles(this.sparkles, dt);
    this.popups = GFX.updatePopups(this.popups, dt);

    // nalétané metry: jen skutečný posun světa (40 ref. px = 1 m).
    // Když balon stojí pod mrakem, metry nepřibývají.
    this.meters += (dy / S) / 40;
  }

  /** Vytlačí balon z mraku, když ho tam hráč zatlačí prstem. */
  _resolveOverlaps(r, minX, maxX, minY, maxY) {
    const b = this.balloon;
    for (const c of this.clouds) {
      const bx = b.x;
      const by = b.y + b.oy;
      const nx = _clamp(bx, c.x - c.w / 2, c.x + c.w / 2);
      const ny = _clamp(by, c.y - c.h / 2, c.y + c.h / 2);
      const dx = bx - nx;
      const dyv = by - ny;
      const d2 = dx * dx + dyv * dyv;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2);
      const push = r - d;
      let ux, uy;
      if (d > 0.001) {
        ux = dx / d;
        uy = dyv / d;
      } else {
        ux = 0;
        uy = 1; // střed uvnitř mraku -> vytlačit dolů
      }
      b.x += ux * push;
      b.y += uy * push;
      if (push > 3 * this.s) this._bounceFx(c, bx, by, r);
    }
    b.x = _clamp(b.x, minX, maxX);
    b.y = _clamp(b.y, minY, maxY);
  }

  /** Odskok od mraku: animace dolů + squash + nafouknutí mraku + zvuk.
   *  Cooldown na mraku brání spamu efektů, když balon stojí pod mrakem. */
  _bounceFx(cloud, bx, by, r) {
    if (cloud.cd > 0) return;
    cloud.cd = 0.7;
    cloud.puff = 1;
    cloud.faceT = 1.6; // mrak se lekne a pak se usměje
    this.balloon.vy += CONFIG.world.bounceImpulse * this.s; // odskok dolů
    this.balloon.squash = 1;
    this._burst(bx, by - r, 10, 'white');
    Sound.bounce();
  }

  /** Stoupavé proudy: spawn, posun a zjištění, jestli je v nich balon.
   *  Vrací násobitel rychlosti stoupání (1 = normál). */
  _updateThermals(dt, bx, by, r) {
    const C = CONFIG.world;
    const S = this.s;
    this.thermalT -= dt;
    if (this.thermalT <= 0) {
      this.thermalT = _rand(C.thermalEvery[0], C.thermalEvery[1]);
      const w = C.thermalWidth * S;
      const h = C.thermalHeight * S;
      this.thermals.push({
        x: _rand(w / 2 + 40 * S, this.W - w / 2 - 40 * S),
        y: -h / 2,
        w,
        h,
        phase: 0,
      });
    }
    let boost = 1;
    let inside = false;
    for (const t of this.thermals) {
      t.phase += dt;
      if (
        Math.abs(bx - t.x) < t.w / 2 + r * 0.4 &&
        by > t.y - t.h / 2 &&
        by < t.y + t.h / 2
      ) {
        inside = true;
        boost = C.thermalBoost;
      }
    }
    // proudy se posouvají dolů spolu se světem (základní rychlostí)
    const dy = C.riseSpeed * S * boost * dt;
    for (const t of this.thermals) t.y += dy;
    this.thermals = this.thermals.filter((t) => t.y - t.h / 2 < this.H + 100 * S);

    if (inside && !this.inThermal) Sound.whoosh(); // zvuk jen při vstupu
    this.inThermal = inside;
    return boost;
  }

  _updateBirds(dt) {
    const S = this.s;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = _rand(7, 16);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const y = _rand(this.H * 0.08, this.H * 0.4);
      const speed = _rand(300, 480) * S;
      const n = 2 + Math.floor(Math.random() * 2);
      const startX = dir > 0 ? -80 * S : this.W + 80 * S;
      for (let i = 0; i < n; i++) {
        this.birds.push({
          x: startX - dir * i * 90 * S,
          y: y + (i % 2 ? 34 : 0) * S,
          dir,
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

  /** Částicový výbuch: 'gold' jiskry, 'white' obláčky. */
  _burst(x, y, count, kind) {
    GFX.burst(this.sparkles, x, y, count, kind, this.s);
  }

  // ---- render -------------------------------------------------------------
  _render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false; // ostrá pixel-art grafika
    this._drawSky(ctx);
    this._drawAltitude(ctx);   // ztmavení oblohy + hvězdy ve výšce
    this._drawStreaks(ctx);
    this.fun.renderBack(ctx);  // duha patří za mraky
    for (const c of this.farClouds) this._drawCloud(ctx, c);
    for (const t of this.thermals) GFX.drawThermal(ctx, t);
    for (const st of this.stars) this._drawStar(ctx, st);
    for (const c of this.clouds) this._drawCloud(ctx, c);
    this._drawSparkles(ctx);
    this._drawBirds(ctx);
    this._drawBalloon(ctx);
    this.fun.renderFront(ctx); // bubliny, pírka, racek
    if (CONFIG.effects.fog) GFX.drawFog(ctx, this.W, this.H);
    if (CONFIG.effects.logoInGame) GFX.drawLogo(ctx, Assets.get('logo'), this.W, this.H, this.s);
    GFX.drawPopups(ctx, this.popups, this.s);
    this._drawHud(ctx);
    this.fun.renderBanner(ctx);
  }

  /** Výškové vrstvy: čím výš, tím tmavší obloha a víc hvězd.
   *  0–150 m běžná obloha, 150–350 m vysoko, nad 350 m soumrak. */
  _drawAltitude(ctx) {
    if (!CONFIG.effects.altitudeLayers) return;
    const m = this.meters;
    if (m < 150) return;
    const k = Math.min(1, (m - 150) / 260); // 0..1 přechod do soumraku
    ctx.save();
    // gradient se vyrobí jen jednou; sílu soumraku řídí globalAlpha,
    // takže se nemusí každý snímek skládat znovu
    if (!this._altGrad) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.H);
      grad.addColorStop(0, 'rgba(18, 22, 62, 0.72)');
      grad.addColorStop(0.6, 'rgba(50, 40, 95, 0.5)');
      grad.addColorStop(1, 'rgba(120, 80, 110, 0.2)');
      this._altGrad = grad;
    }
    ctx.globalAlpha = k;
    ctx.fillStyle = this._altGrad;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 1;
    // blikající hvězdy
    if (k > 0.25) {
      ctx.fillStyle = '#ffffff';
      for (const st of this.skyStars) {
        const tw = 0.45 + 0.55 * Math.sin(this.t * 2.2 + st.ph);
        ctx.globalAlpha = k * tw * 0.9;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawSky(ctx) {
    // Obloha je CSS pozadím herní sekce (viz style.css) – plátno je průhledné
    // a stačí ho vyčistit. Dřív se sem každý snímek kopíroval celý obrázek
    // oblohy, což byla nejdražší část vykreslování.
    ctx.clearRect(0, 0, this.W, this.H);
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
      ctx.moveTo(w.x, w.y - w.len);
      ctx.lineTo(w.x, w.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCloud(ctx, c) {
    GFX.drawCloud(ctx, c, Assets.get('cloud'));
  }

  _drawStar(ctx, st) {
    GFX.drawStar(ctx, st, this.s);
  }

  _drawSparkles(ctx) {
    GFX.drawParticles(ctx, this.sparkles, this.s);
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
    const bob = Math.sin(this.bobPhase) * CONFIG.balloon.bobAmount * this.s;
    const x = b.x;
    const y = b.y + b.oy + bob;

    // náklon podle vodorovné rychlosti + jemné kývání + zavrtění po ťuknutí
    const tiltMax = (CONFIG.effects.tiltMaxDeg * Math.PI) / 180;
    let tilt = _clamp(this.vxSmooth / (600 * this.s), -1, 1) * tiltMax;
    tilt += Math.sin(this.bobPhase * 0.7) * 0.03;
    if (b.wiggle > 0) tilt += Math.sin(this.t * 26) * 0.13 * b.wiggle;

    // stlačení při nárazu (squash & stretch) + puls při zavrtění
    const wigglePulse = 1 + 0.05 * Math.sin(this.t * 22) * b.wiggle;
    const sx = (1 + 0.12 * b.squash) * wigglePulse;
    const sy = (1 - 0.18 * b.squash) * wigglePulse;
    const dw = this.balloonW * sx;
    const dh = this.balloonH * sy;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // postup k dalsimu snimku (0..1) - pouziva se pri prolinani
    const frameT = b.frameTime * CONFIG.balloon.fps;
    if (GFX.drawBalloon(ctx, b.frame, frameT, this.balloonW, sx, sy)) {
      // vykresleno sdilenym helperem (registrovane snimky + vyhlazeni)
    } else {
      // náhradní balon, dokud není grafika
      ctx.fillStyle = '#2e8b57';
      ctx.beginPath();
      ctx.ellipse(0, -dh * 0.1, dw * 0.45, dh * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-dw * 0.12, dh * 0.32, dw * 0.24, dh * 0.16);
    }
    ctx.restore();
  }

  _drawHud(ctx) {
    if (!CONFIG.stars.enabled) return;
    GFX.drawHud(ctx, this.W, this.s, this.starCount, this.hudPulse);
  }

  // ---- smyčka -------------------------------------------------------------
  _loop(t) {
    if (!this.running) return;
    let dt = (t - this._lastT) / 1000;
    this._lastT = t;
    dt = Math.min(dt, 0.05); // ochrana proti skoku (např. po přepnutí karty)
    this._update(dt);
    this._render();
    GFX.fpsTick(dt);
    this._raf = requestAnimationFrame((tt) => this._loop(tt));
  }
}
