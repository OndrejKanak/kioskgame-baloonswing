// ============================================================================
//  Živé náhledy her v menu.
//
//  Hráči jsou předškoláci – většina neumí číst, takže rozdíl mezi hrami musí
//  sdělit obrázek, ne název. Každá karta proto ukazuje malou smyčku toho, co
//  hra opravdu dělá, a naznačuje směr třemi způsoby najednou:
//
//    1) TVAR náhledu   – hra nahoru má náhled na výšku, hra do strany na šířku
//    2) POHYB          – mraky ujíždí přesně tak jako ve hře (dolů / doleva)
//    3) ŠIPKY          – tři poskakující šipky ukazují směr letu
//
//  Kreslí se stejnými funkcemi jako hra (GFX), takže náhled vypadá jako
//  zmenšenina skutečné hry a po výměně grafiky se změní zároveň s ní.
// ============================================================================

class CardPreview {
  /** mode: 'up' = stoupání (hra 1) | 'right' = let do strany (hra 2) */
  constructor(canvas, mode, tint) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = mode;
    this.tint = tint || null; // CSS filtr pro balon (odlišení druhé hry)
    this.running = false;
    this._raf = null;
    this.W = 0;
    this.H = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.t = 0;
    this.clouds = null; // scéna se založí, až bude znám rozměr
    this._lastT = performance.now();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  // ---- rozměr ------------------------------------------------------------
  /** Karta je skrytá, dokud není menu aktivní, proto měříme každý snímek. */
  _resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === this.W && h === this.H) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    this.W = w;
    this.H = h;
    this.s = Math.min(w, h) / 170; // měřítko kreslení vůči velikosti náhledu
    this.clouds = null;            // scénu postavit znovu na nový rozměr
    return true;
  }

  _initScene() {
    const S = this.s;
    this.balloonW = Math.min(this.W, this.H) * 0.42;
    this.balloonH = this.balloonW * 1.35;
    if (this.mode === 'up') {
      this.bx = this.W * 0.5;
      this.by = this.H * 0.62;
      this.speed = this.H * 0.42; // px/s dolů
    } else {
      this.bx = this.W * 0.28;
      this.by = this.H * 0.5;
      this.speed = this.W * 0.34; // px/s doleva
    }
    // pár mráčků rozmístěných po dráze
    this.clouds = [];
    const n = 3;
    for (let i = 0; i < n; i++) {
      this.clouds.push(this._makeCloud(i / n));
    }
  }

  /** p = 0..1 poloha na dráze (0 = právě vstupuje do náhledu) */
  _makeCloud(p) {
    const w = this.W * (this.mode === 'up' ? 0.42 : 0.34) * (0.8 + Math.random() * 0.5);
    const c = {
      w,
      h: w * 0.6,
      puffs: GFX.makePuffs(),
      alpha: 0.95,
    };
    if (this.mode === 'up') {
      c.x = this.W * (0.2 + Math.random() * 0.6);
      c.y = -c.h + p * (this.H + c.h * 2);
    } else {
      c.x = this.W + c.w - p * (this.W + c.w * 2);
      c.y = this.H * (0.18 + Math.random() * 0.64);
    }
    return c;
  }

  // ---- smyčka ------------------------------------------------------------
  _loop(now) {
    if (!this.running) return;
    let dt = (now - this._lastT) / 1000;
    this._lastT = now;
    dt = Math.min(dt, 0.05);
    this._resize();
    if (this.W > 1) {
      if (!this.clouds) this._initScene();
      this._update(dt);
      this._render();
    }
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    this.t += dt;
    for (const c of this.clouds) {
      if (this.mode === 'up') {
        c.y += this.speed * dt;
        if (c.y - c.h > this.H) Object.assign(c, this._makeCloud(0));
      } else {
        c.x -= this.speed * dt;
        if (c.x + c.w < 0) Object.assign(c, this._makeCloud(0));
      }
    }
  }

  // ---- kreslení ----------------------------------------------------------
  _render() {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, '#4ea3ef');
    grad.addColorStop(1, '#cbe8ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    for (const c of this.clouds) GFX.drawCloud(ctx, c, Assets.get('cloud'));

    // balon (jemné houpání), případně barevně odlišený
    const bob = Math.sin(this.t * 1.8) * this.H * 0.02;
    ctx.save();
    ctx.translate(this.bx, this.by + bob);
    if (this.tint) ctx.filter = this.tint;
    GFX.drawBalloon(ctx, Math.floor(this.t * CONFIG.balloon.fps), 0, this.balloonW, 1, 1);
    ctx.restore();

    this._drawArrows(ctx);
  }

  /** Tři šipky poskakující směrem letu. */
  _drawArrows(ctx) {
    const size = Math.min(this.W, this.H) * 0.09;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const p = (this.t * 0.8 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.95;
      let x;
      let y;
      if (this.mode === 'up') {
        x = this.bx;
        y = this.by - this.balloonH * 0.55 - p * this.H * 0.34;
      } else {
        x = this.bx + this.balloonW * 0.62 + p * this.W * 0.34;
        y = this.by;
      }
      // tmavý podklad pro čitelnost + zlatá šipka navrch
      for (const [col, lw] of [['rgba(11,43,86,0.55)', size * 0.62], ['#ffd23f', size * 0.34]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        if (this.mode === 'up') {
          ctx.moveTo(x - size, y + size * 0.55);
          ctx.lineTo(x, y - size * 0.45);
          ctx.lineTo(x + size, y + size * 0.55);
        } else {
          ctx.moveTo(x - size * 0.55, y - size);
          ctx.lineTo(x + size * 0.45, y);
          ctx.lineTo(x - size * 0.55, y + size);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
