// ============================================================================
//  Živé náhledy her v dlaždicích menu – zmenšená ukázka skutečné hry.
//
//  Hrají to děti kolem 4 let a většina neumí číst, takže co se v které hře
//  dělá, musí ukázat obrázek. Každá dlaždice proto sama "hraje":
//
//    'up'    – hra 1 (Vzhůru!): mraky padají shora, balon stoupá a uhýbá
//              jim doleva a doprava – vždycky až na poslední chvíli
//    'right' – hra 2 (Vpřed!): sloupy mraků ujíždí doleva a balon mezi
//              nimi poskakuje mezerami, jako když dítě ťuká na obrazovku
//
//  Šipka směru a ťukající ruka jsou v HTML jako SVG (index.html + CSS),
//  takže zůstanou ostré i při sníženém rozlišení plátna.
//
//  Kreslí se stejnými funkcemi jako hra (GFX), takže náhled vypadá jako
//  zmenšenina skutečné hry a po výměně grafiky se změní zároveň s ní.
// ============================================================================

// Pozor: skripty sdílí globální prostor a _rand/_clamp už má balloon.js.
function _prevRand(a, b) {
  return a + Math.random() * (b - a);
}
function _prevClamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

class CardPreview {
  /** mode: 'up' = stoupání (hra 1) | 'right' = let do strany (hra 2) */
  constructor(canvas, mode, tint) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = mode;
    this.tint = tint || null; // CSS filtr pro balon (odlišení druhé hry)
    this.running = false;
    this.ready = false;
    this._raf = null;
    this.W = 0;
    this.H = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.ready = false; // scéna se založí, až bude znám rozměr
    this._lastT = performance.now();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  // ---- rozměr ------------------------------------------------------------
  /** Dlaždice je skrytá, dokud není menu aktivní, proto měříme každý snímek.
   *
   *  clientWidth/Height = rozměr podle layoutu, ne podle CSS transformace.
   *  Dlaždice se při dotyku zmáčkne (transform) a kdyby se měřilo přes
   *  getBoundingClientRect, scéna by se při každém stisku přestavěla.
   *
   *  Plátno má stejné snížené rozlišení jako hra (perf.renderScale) –
   *  dvě velké dlaždice by jinak na Pi stály víc než samotná hra. */
  _resize() {
    const scale = (CONFIG.perf && CONFIG.perf.renderScale) || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * scale));
    if (w === this.W && h === this.H) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.W = w;
    this.H = h;
    this.ready = false; // scénu postavit znovu na nový rozměr
  }

  // ---- smyčka ------------------------------------------------------------
  _loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - this._lastT) / 1000, 0.05);
    this._lastT = now;
    this._resize();
    if (this.W > 1) {
      if (!this.ready) this._initScene();
      this._update(dt);
      this._render();
    }
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _initScene() {
    this.t = 0;
    // pár malých vzdálených obláčků, které ujíždí pomaleji – dodají hloubku
    this.far = [];
    for (let i = 0; i < 3; i++) this.far.push(this._makeFar(i / 3));
    if (this.mode === 'up') this._initUp();
    else this._initRight();
    this.ready = true;
  }

  _update(dt) {
    this.t += dt;
    this._updateFar(dt);
    if (this.mode === 'up') this._updateUp(dt);
    else this._updateRight(dt);
  }

  _render() {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#4ea3ef');
    grad.addColorStop(1, '#cbe8ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    const img = Assets.get('cloud');
    for (const c of this.far) GFX.drawCloud(ctx, c, img);

    if (this.mode === 'up') this._renderUp(ctx, img);
    else this._renderRight(ctx, img);
  }

  // ---- společné ------------------------------------------------------------
  /** p = 0..1 poloha na dráze (0 = právě vstupuje do dlaždice) */
  _makeFar(p) {
    const w = this.W * _prevRand(0.13, 0.2);
    const c = { w, h: w * 0.55, puffs: GFX.makePuffs(), alpha: 0.45, _tex: GFX.pickCloudTex() };
    if (this.mode === 'up') {
      c.x = this.W * _prevRand(0.05, 0.95);
      c.y = -c.h + p * (this.H + c.h * 2);
    } else {
      c.x = this.W + c.w - p * (this.W + c.w * 2);
      c.y = this.H * _prevRand(0.1, 0.9);
    }
    return c;
  }

  _updateFar(dt) {
    for (let i = 0; i < this.far.length; i++) {
      const c = this.far[i];
      if (this.mode === 'up') {
        c.y += this.H * 0.2 * dt;
        if (c.y - c.h > this.H) this.far[i] = this._makeFar(0);
      } else {
        c.x -= this.W * 0.12 * dt;
        if (c.x + c.w < 0) this.far[i] = this._makeFar(0);
      }
    }
  }

  _drawBalloon(ctx, x, y, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    if (this.tint) ctx.filter = this.tint;
    GFX.drawBalloon(ctx, Math.floor(this.t * CONFIG.balloon.fps), 0, this.balloonW, 1, 1);
    ctx.restore();
  }

  // ======================= hra 1: uhýbání mrakům ===========================
  //  Dva pruhy (vlevo / vpravo). Každý mrak zablokuje jeden z nich a balon
  //  přeskočí do volného – až když je mrak skoro u něj, ať je vidět únik.

  _initUp() {
    const W = this.W;
    const H = this.H;
    this.balloonW = H * 0.25;
    this.bh = GFX.balloonVisualHeight(this.balloonW);
    this.lanes = [W * 0.27, W * 0.73];
    this.by = H * 0.7;
    this.vx = 0;
    this.speed = H * 0.48;       // mraky dolů = balon stoupá
    this.spacing = H * 0.85;     // svislý rozestup mraků (≈ jeden za 1,8 s)
    this.clouds = [];
    this._side = Math.random() < 0.5 ? 0 : 1;
    this._spawnY = H * 0.12;     // první mrak rovnou v dlaždici, ať není prázdná
    this._spawnUpClouds();
    // balon začne v pruhu, který je u prvního mraku volný
    this.targetX = this.lanes[1 - this.clouds[0].side];
    this.bx = this.targetX;
  }

  _spawnUpClouds() {
    while (this._spawnY > -this.H * 0.2) {
      // většinou na druhou stranu než minule – ať balon opravdu uhýbá
      if (Math.random() < 0.8) this._side = 1 - this._side;
      const w = this.W * _prevRand(0.38, 0.44);
      this.clouds.push({
        side: this._side,
        x: this.lanes[this._side] + this.W * _prevRand(-0.03, 0.03),
        y: this._spawnY,
        w,
        h: w * 0.5,
        puffs: GFX.makePuffs(),
        alpha: 1,
        hasFace: Math.random() < 0.5,
        faceT: 0,
        _tex: GFX.pickCloudTex(),
      });
      this._spawnY -= this.spacing;
    }
  }

  _updateUp(dt) {
    const H = this.H;
    const move = this.speed * dt;
    for (const c of this.clouds) c.y += move;
    this._spawnY += move;
    this.clouds = this.clouds.filter((c) => c.y - c.h < H);
    this._spawnUpClouds();

    // "Hráč": nejbližší mrak, který balon ještě nemá celý pod sebou
    const top = this.by - this.bh / 2;
    const bottom = this.by + this.bh / 2;
    let threat = null;
    for (const c of this.clouds) {
      if (c.y - c.h / 2 < bottom && (!threat || c.y > threat.y)) threat = c;
    }
    // uhne až na poslední chvíli – tak to vypadá jako opravdový únik
    if (threat && top - (threat.y + threat.h / 2) < H * 0.32) {
      this.targetX = this.lanes[1 - threat.side];
    }

    // pružina: rychlý, ale plynulý přesun do volného pruhu
    const k = 70;
    const d = 2 * Math.sqrt(k);
    this.vx += (k * (this.targetX - this.bx) - d * this.vx) * dt;
    this.bx += this.vx * dt;
  }

  _renderUp(ctx, img) {
    for (const c of this.clouds) GFX.drawCloud(ctx, c, img);
    // náklon ve směru pohybu, stejně jako ve hře
    const tilt = _prevClamp(this.vx / (this.W * 1.1), -1, 1) * 0.32 + Math.sin(this.t * 1.3) * 0.03;
    const bob = Math.sin(this.t * 1.8) * this.H * 0.015;
    this._drawBalloon(ctx, this.bx, this.by + bob, tilt);
  }

  // ===================== hra 2: poskakování mezerami =======================
  //  Sloupy mraků s mezerou, stejně jako ve hře. Balon padá, a když klesne
  //  pod střed mezery, "ťukne" a poskočí – tak se proplétá sloup za sloupem.

  _initRight() {
    const W = this.W;
    const H = this.H;
    // Dlaždice je na šířku, ne na výšku jako hra – kdyby se zmenšila hra
    // poměrově, mezera by zabrala skoro celou výšku a ze sloupu by zbyl
    // jeden obláček. Proto menší balon a užší mezera.
    this.balloonW = H * 0.17;
    this.bh = GFX.balloonVisualHeight(this.balloonW);
    this.bx = W * 0.3;
    this.g = H * 3.0;            // gravitace
    this.flapV = H * 0.75;       // poskok (≈ 0,09 výšky dlaždice), rytmus ~0,5 s
    this.maxFall = H * 1.4;
    this.speed = W * 0.3;        // sloupy doleva = balon letí doprava
    this.colW = W * 0.19;
    this.gapH = H * 0.46;
    this.colSpacing = W * 0.55;
    this.columns = [];
    this.fx = [];                // obláčky páry po poskoku
    this._nextColX = W * 0.62;   // první sloup kousek před balonem
    this._spawnColumns();
    this.by = this.columns[0].gapY;
    this.vy = 0;
    this._flapCd = 0;
  }

  _spawnColumns() {
    while (this._nextColX < this.W * 1.5) {
      this._spawnColumn(this._nextColX);
      this._nextColX += this.colSpacing;
    }
  }

  /** Sloup = mezera + stoh obláčků nad ní a pod ní (jako _spawnColumn ve hře) */
  _spawnColumn(x) {
    const H = this.H;
    // mezera víc u středu, ať jsou vidět oba stohy, nahoře i dole
    const gapY = H * _prevRand(0.4, 0.6);
    const segH = H * 0.22;
    const step = segH * 0.62; // obláčky se hodně překrývají = souvislá zeď
    const seg = (cy) => ({
      oy: cy,
      ox: this.colW * _prevRand(-0.1, 0.1),
      w: this.colW * _prevRand(1.0, 1.3),
      h: segH * _prevRand(0.95, 1.15),
      puffs: GFX.makePuffs(),
      alpha: 1,
      hasFace: false,
      faceT: 0,
      _tex: GFX.pickCloudTex(), // vzhled se losuje jen jednou, jinak by se třepal
    });
    // první obláček stohu má okraj zhruba na hraně mezery
    const edge = segH * 0.4;
    const segs = [];
    for (let cy = gapY - this.gapH / 2 - edge; cy > -step; cy -= step) segs.push(seg(cy));
    const below = segs.length;
    for (let cy = gapY + this.gapH / 2 + edge; cy < H + step; cy += step) segs.push(seg(cy));
    // obličej dostane jen obláček přímo u mezery – jako ve hře
    if (segs[0]) segs[0].hasFace = true;
    if (segs[below]) segs[below].hasFace = true;
    this.columns.push({ x, gapY, segs });
  }

  _updateRight(dt) {
    const H = this.H;
    const move = this.speed * dt;
    for (const c of this.columns) c.x -= move;
    this._nextColX -= move;
    this.columns = this.columns.filter((c) => c.x + this.colW > -this.colW);
    this._spawnColumns();

    // "Hráč": míří do mezery nejbližšího sloupu, který ještě neminul
    const half = this.balloonW * 0.4;
    let next = null;
    for (const c of this.columns) {
      if (c.x + this.colW / 2 > this.bx - half && (!next || c.x < next.x)) next = c;
    }
    const target = next ? next.gapY : H * 0.5;

    // ťuk = poskok, jakmile balon klesne pod střed mezery
    this._flapCd -= dt;
    if (this.by > target + H * 0.05 && this.vy >= 0 && this._flapCd <= 0) {
      this.vy = -this.flapV;
      this._flapCd = 0.15;
      this._puff();
    }
    this.vy = Math.min(this.vy + this.g * dt, this.maxFall);
    this.by += this.vy * dt;

    for (const p of this.fx) {
      p.life -= dt;
      p.x -= move * 0.6;
      p.y += H * 0.15 * dt;
      p.r += H * 0.12 * dt;
    }
    this.fx = this.fx.filter((p) => p.life > 0);
  }

  /** Obláček páry pod košem – vizuální "ťuk". */
  _puff() {
    const y = this.by + this.bh * 0.45;
    for (let i = 0; i < 3; i++) {
      this.fx.push({
        x: this.bx + this.W * _prevRand(-0.025, 0.025),
        y,
        r: this.H * _prevRand(0.025, 0.04),
        life: 0.45,
        max: 0.45,
      });
    }
  }

  _renderRight(ctx, img) {
    for (const col of this.columns) {
      for (const s of col.segs) {
        // segment si pamatuje svůj vzhled (_tex), tady se dopočítá jen poloha
        s.x = col.x + s.ox;
        s.y = s.oy;
        GFX.drawCloud(ctx, s, img);
      }
    }

    ctx.fillStyle = '#fff';
    for (const p of this.fx) {
      ctx.globalAlpha = 0.7 * (p.life / p.max);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const tilt = _prevClamp(this.vy / (this.H * 1.4), -1, 1) * 0.18;
    this._drawBalloon(ctx, this.bx, this.by, tilt);
  }
}
