// ============================================================================
//  Sdílené kreslení pro obě hry: obloha se sluncem, mraky (s obličeji),
//  hvězdičky, HUD, částice (jiskry / obláčky / stopa / konfety), "+1" popupy,
//  mlha, logo a všechny zábavné prvky – racek, pírko, bublina, duha,
//  obruč, stoupavý proud, větrný poryv a milníková cedule.
//
//  Když se později vymění grafika (PNG mraku apod.), mění se jen tady
//  a obě hry zůstanou vizuálně jednotné.
// ============================================================================
const GFX = {
  // ---- obloha ------------------------------------------------------------
  /** Namaluje oblohu (obrázek nebo gradient) + měkké slunce. Volá se jen
   *  jednou do cache canvasu – za běhu je pak pozadí zadarmo. */
  paintSky(g, W, H, img) {
    if (img) {
      g.imageSmoothingEnabled = false;
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#2b6fd6');
      grad.addColorStop(1, '#9ed0ff');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }
    if (CONFIG.effects.sun === false) return;
    const sx = W * 0.16;
    const sy = H * 0.09;
    const r = W * 0.10;
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, r * 2.6);
    glow.addColorStop(0, 'rgba(255, 244, 180, 0.80)');
    glow.addColorStop(0.35, 'rgba(255, 238, 160, 0.30)');
    glow.addColorStop(1, 'rgba(255, 238, 160, 0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(sx, sy, r * 2.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255, 250, 214, 0.95)';
    g.beginPath();
    g.arc(sx, sy, r * 0.62, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255, 255, 235, 0.85)';
    g.lineWidth = Math.max(2, W * 0.006);
    g.beginPath();
    g.arc(sx, sy, r * 0.74, 0, Math.PI * 2);
    g.stroke();
  },

  // ---- mraky -------------------------------------------------------------
  /** Náhodný tvar obláčku (jednotkové souřadnice vůči w/h mraku). */
  makePuffs() {
    const puffs = [[0, -0.08, 0.46, 0.62]]; // střední kupole vždy
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      puffs.push([
        -0.3 + Math.random() * 0.6,
        -0.06 + Math.random() * 0.22,
        0.26 + Math.random() * 0.14,
        0.36 + Math.random() * 0.19,
      ]);
    }
    puffs.push([-0.28, 0.1, 0.34, 0.48], [0.28, 0.1, 0.34, 0.48]); // boky
    return puffs;
  },

  /** Mrak: PNG z assets (pokud je), jinak proceduální kupole se stínem dole
   *  a odleskem nahoře. Když má mrak `hasFace`, dokreslí se obličej.
   *  c = {x, y, w, h, puff 0..1, puffs, alpha, hasFace, faceT} */
  drawCloud(ctx, c, img) {
    const scale = 1 + 0.16 * (c.puff || 0);
    if (img) {
      ctx.save();
      ctx.globalAlpha = c.alpha != null ? c.alpha : 1;
      const w = c.w * scale;
      const h = c.h * scale;
      ctx.drawImage(img, c.x - w / 2, c.y - h / 2, w, h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = c.alpha != null ? c.alpha : 1;
      // stín (dole)
      ctx.fillStyle = 'rgba(140, 172, 212, 0.60)';
      for (const [px, py, pw, ph] of c.puffs) {
        ctx.beginPath();
        ctx.ellipse(px * c.w, (py + 0.12) * c.h, (pw * c.w) / 2, (ph * c.h) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // tělo
      ctx.fillStyle = 'rgba(247, 250, 255, 0.97)';
      for (const [px, py, pw, ph] of c.puffs) {
        ctx.beginPath();
        ctx.ellipse(px * c.w, py * c.h, (pw * c.w) / 2, (ph * c.h) / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // odlesk (nahoře, směrem ke slunci)
      ctx.fillStyle = '#ffffff';
      for (const [px, py, pw, ph] of c.puffs) {
        ctx.beginPath();
        ctx.ellipse(
          (px - 0.04) * c.w,
          (py - 0.09) * c.h,
          (pw * c.w * 0.62) / 2,
          (ph * c.h * 0.62) / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
    }
    if (c.hasFace && CONFIG.fun.cloudFaces) this.drawCloudFace(ctx, c, scale);
  },

  /** Obličej mraku: ospalá zavřená očka; po žuchnutí se lekne (vykulí oči
   *  a udělá "ó") a pak se usměje. Řídí to c.faceT, který hra odečítá. */
  drawCloudFace(ctx, c, scale) {
    const t = c.faceT || 0;
    const w = c.w * scale;
    const h = c.h * scale;
    const eyeDX = w * 0.13;
    const eyeY = c.y - h * 0.04;
    const ink = '#2a4266';
    const lw = Math.max(2, w * 0.016);

    ctx.save();
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';

    if (t > 1.15) {
      // LEKNUTÍ: vykulené oči + pusa do "ó"
      const r = w * 0.055;
      for (const dx of [-eyeDX, eyeDX]) {
        ctx.beginPath();
        ctx.arc(c.x + dx, eyeY, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c.x + dx, eyeY, r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + h * 0.13, w * 0.035, h * 0.055, 0, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
    } else if (t > 0) {
      // ÚSMĚV: přivřená oči do obloučků "^ ^" + široký úsměv
      ctx.strokeStyle = ink;
      for (const dx of [-eyeDX, eyeDX]) {
        ctx.beginPath();
        ctx.arc(c.x + dx, eyeY + h * 0.02, w * 0.045, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(c.x, c.y + h * 0.06, w * 0.075, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      // OSPALÝ KLID: zavřená očka "‿ ‿" + drobný úsměv
      ctx.strokeStyle = ink;
      for (const dx of [-eyeDX, eyeDX]) {
        ctx.beginPath();
        ctx.arc(c.x + dx, eyeY, w * 0.042, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(c.x, c.y + h * 0.07, w * 0.04, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  },

  // ---- hvězdičky ---------------------------------------------------------
  /** Hvězdička ke sbírání, s občasným třpytem. st = {x, y, r, phase} */
  drawStar(ctx, st, s) {
    const pulse = 1 + 0.1 * Math.sin(st.phase);
    const rot = 0.2 * Math.sin(st.phase * 0.6);
    const r = st.r * pulse;
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.fillStyle = 'rgba(255, 220, 90, 0.25)'; // levná záře bez shadowBlur
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(rot);
    this._starPath(ctx, 0, 0, r);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.strokeStyle = '#e0912f';
    ctx.lineWidth = Math.max(2, 6 * s);
    ctx.lineJoin = 'round';
    ctx.stroke();
    const tw = (Math.sin(st.phase * 2.3) + 1) / 2;
    if (tw > 0.2) {
      ctx.globalAlpha = tw * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, 3.5 * s);
      ctx.lineCap = 'round';
      const ox = r * 0.95;
      const oy = -r * 0.95;
      const L = r * 0.45 * (0.6 + 0.4 * tw);
      ctx.beginPath();
      ctx.moveTo(ox - L, oy);
      ctx.lineTo(ox + L, oy);
      ctx.moveTo(ox, oy - L);
      ctx.lineTo(ox, oy + L);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },

  _starPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  // ---- balon --------------------------------------------------------------
  /** Skutecna vyska balonu na obrazovce (vyska OBSAHU spritu).
   *  Pozor: `balloonH` ve hrach je vyska BUNKY sheetu, ktera je vetsi -
   *  na to se neda spolehat, kdyz neco ma na balonu sedet. */
  balloonVisualHeight(width) {
    const spr = Assets.sprite('balloon');
    if (spr && spr.cellW) return spr.contentH * (width / spr.cellW);
    const img = Assets.get('balloon');
    if (img) {
      const fw = img.width / CONFIG.balloon.frameCols;
      const fh = img.height / CONFIG.balloon.frameRows;
      return width * (fh / fw);
    }
    return width * 1.5;
  },

  /** Vykresli balon do pocatku souradnic (uz posunuteho/otoceneho hrou).
   *  frame    = index snimku
   *  frameT   = 0..1 postup k dalsimu snimku (pro prolinani)
   *  width    = sirka balonu na obrazovce (odpovida sirce bunky sheetu)
   *  sx, sy   = stlaceni/protazeni (squash & stretch)
   *  Vraci true, kdyz se opravdu kreslilo. */
  drawBalloon(ctx, frame, frameT, width, sx, sy) {
    const B = CONFIG.balloon;
    const prevSmooth = ctx.imageSmoothingEnabled;
    if (B.smoothScaling !== false) {
      // sprite je mnohem vetsi nez balon na obrazovce - bez vyhlazeni
      // by pri pohybu "mzil" (aliasing pri zmensovani)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    const spr = Assets.sprite('balloon');
    let drawn = false;

    if (spr && spr.frames.length) {
      const n = spr.frames.length;
      const a = ((frame % n) + n) % n;
      const k = width / spr.cellW;      // stejne meritko jako pred registraci
      const dw = spr.w * k * sx;
      const dh = spr.h * k * sy;
      ctx.drawImage(spr.frames[a], -dw / 2, -dh / 2, dw, dh);
      if (B.crossFade && n > 1 && frameT > 0) {
        const g = ctx.globalAlpha;
        ctx.globalAlpha = g * frameT;
        ctx.drawImage(spr.frames[(a + 1) % n], -dw / 2, -dh / 2, dw, dh);
        ctx.globalAlpha = g;
      }
      drawn = true;
    } else {
      // zaloha: kresleni primo ze sheetu (bez registrace)
      const img = Assets.get('balloon');
      if (img) {
        const cols = B.frameCols;
        const fw = img.width / cols;
        const fh = img.height / B.frameRows;
        const n = Math.max(1, B.frameCount);
        const a = ((frame % n) + n) % n;
        const dw = width * sx;
        const dh = width * (fh / fw) * sy;
        ctx.drawImage(
          img, (a % cols) * fw, Math.floor(a / cols) * fh, fw, fh,
          -dw / 2, -dh / 2, dw, dh
        );
        drawn = true;
      }
    }
    ctx.imageSmoothingEnabled = prevSmooth;
    return drawn;
  },

  // ---- racek -------------------------------------------------------------
  /** Racek. g = {x, y, size, dir (1/-1), phase, rot, folded}
   *  Kresli se celem doprava, `dir` = -1 ho zrcadli. */
  drawSeagull(ctx, g) {
    const S = g.size;
    const ink = '#3b4d68';
    const shade = '#dce7f6';
    const tipCol = '#61748c';
    const lw = Math.max(1.5, S * 0.03);
    const flap = g.folded ? 0 : Math.sin(g.phase);
    // uhel kridla: kladny = vztycene nahoru
    const wingA = 0.3 + 0.65 * flap;

    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot || 0);
    ctx.scale(g.dir || 1, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lw;

    // cesta tela - potrebujeme ji dvakrat (vypln + obtah), proto funkce
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(-S * 0.32, -S * 0.03);
      ctx.bezierCurveTo(-S * 0.3, -S * 0.25, S * 0.04, -S * 0.29, S * 0.25, -S * 0.15);
      ctx.bezierCurveTo(S * 0.42, -S * 0.03, S * 0.3, S * 0.19, S * 0.0, S * 0.22);
      ctx.bezierCurveTo(-S * 0.19, S * 0.24, -S * 0.31, S * 0.11, -S * 0.32, -S * 0.03);
      ctx.closePath();
    };

    // 1) vzdalene kridlo (za telem, tmavsi = hloubka)
    if (!g.folded) this._gullWing(ctx, S, wingA * 0.72, '#cfdcee', tipCol, ink, lw);

    // 2) ocas: vejir uzky u tela, siroky na konci (zacina uvnitr tela)
    ctx.beginPath();
    ctx.moveTo(-S * 0.16, -S * 0.05);
    ctx.quadraticCurveTo(-S * 0.4, -S * 0.13, -S * 0.55, -S * 0.11);
    ctx.quadraticCurveTo(-S * 0.47, S * 0.01, -S * 0.52, S * 0.11);
    ctx.quadraticCurveTo(-S * 0.34, S * 0.11, -S * 0.16, S * 0.06);
    ctx.closePath();
    ctx.fillStyle = '#f0f6ff';
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.stroke();

    // 3) telo + jemny stin na brise
    bodyPath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(S * 0.02, S * 0.21, S * 0.38, S * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    bodyPath();                 // znovu: obtahuje se TELO, ne stin
    ctx.strokeStyle = ink;
    ctx.stroke();

    // 4) hlava
    ctx.beginPath();
    ctx.arc(S * 0.29, -S * 0.23, S * 0.185, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.stroke();

    // 5) zobak: mirne zahnuty, s cervenou teckou
    ctx.beginPath();
    ctx.moveTo(S * 0.43, -S * 0.29);
    ctx.quadraticCurveTo(S * 0.72, -S * 0.25, S * 0.75, -S * 0.16);
    ctx.quadraticCurveTo(S * 0.6, -S * 0.12, S * 0.43, -S * 0.15);
    ctx.closePath();
    ctx.fillStyle = '#ffb02e';
    ctx.fill();
    ctx.strokeStyle = '#c97d16';
    ctx.stroke();
    ctx.fillStyle = '#e8413f';
    ctx.beginPath();
    ctx.arc(S * 0.65, -S * 0.175, S * 0.028, 0, Math.PI * 2);
    ctx.fill();

    // 6) oko s odleskem
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(S * 0.35, -S * 0.28, S * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(S * 0.368, -S * 0.297, S * 0.018, 0, Math.PI * 2);
    ctx.fill();

    if (g.folded) {
      // slozene kridlo prilehle k telu (oval jako u letovych kridel)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-S * 0.07, S * 0.01, S * 0.27, S * 0.115, -0.1, 0, Math.PI * 2);
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.clip();
      ctx.fillStyle = tipCol;
      ctx.beginPath();
      ctx.arc(-S * 0.29, S * 0.03, S * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // nozicky s blanou
      ctx.strokeStyle = '#ffb02e';
      ctx.lineWidth = lw * 1.5;
      for (const dx of [-S * 0.04, S * 0.12]) {
        ctx.beginPath();
        ctx.moveTo(dx, S * 0.19);
        ctx.lineTo(dx, S * 0.34);
        ctx.moveTo(dx - S * 0.07, S * 0.35);
        ctx.lineTo(dx + S * 0.08, S * 0.35);
        ctx.stroke();
      }
    } else {
      // blizsi kridlo (pred telem)
      this._gullWing(ctx, S, wingA, '#ffffff', tipCol, ink, lw);
    }
    ctx.restore();
  },

  /** Jedno kridlo racka: plny oval otaceny kolem ramene + tmava spicka.
   *  a = uhel kridla v radianech (kladny = vztycene nahoru). */
  _gullWing(ctx, S, a, fill, tipCol, ink, lw) {
    const sx = -S * 0.02;     // rameno (mirne za hlavou)
    const sy = -S * 0.09;
    const L = S * 0.66;       // delka kridla
    const tx = sx - L * Math.cos(a);
    const ty = sy - L * Math.sin(a);
    const ang = Math.atan2(ty - sy, tx - sx);
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;

    ctx.save();
    // telo kridla = oval podel osy rameno->spicka
    ctx.beginPath();
    ctx.ellipse(mx, my, L / 2, S * 0.17, ang, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = lw;
    ctx.stroke();
    // tmava spicka: mala oblast u konce kridla, orezana tvarem kridla
    ctx.clip();
    ctx.fillStyle = tipCol;
    ctx.beginPath();
    ctx.arc(tx + (mx - tx) * 0.12, ty + (my - ty) * 0.12, S * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /** Pirko, ktere se snasi dolu. f = {x, y, rot, r} */
  drawFeather(ctx, f) {
    const R = f.r;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(90,110,140,0.6)';
    ctx.lineWidth = Math.max(1.5, R * 0.09);
    ctx.lineJoin = 'round';
    // list pirka
    ctx.beginPath();
    ctx.moveTo(0, -R);
    ctx.bezierCurveTo(R * 0.5, -R * 0.4, R * 0.42, R * 0.5, 0, R * 0.95);
    ctx.bezierCurveTo(-R * 0.42, R * 0.5, -R * 0.5, -R * 0.4, 0, -R);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // brk
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.85);
    ctx.lineTo(0, R * 1.05);
    ctx.stroke();
    ctx.restore();
  },

  // ---- bublina -----------------------------------------------------------
  /** Mýdlová bublina. b = {x, y, r, phase} */
  drawBubble(ctx, b) {
    const wob = 1 + 0.06 * Math.sin(b.phase);
    const r = b.r * wob;
    ctx.save();
    ctx.translate(b.x, b.y);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.42)');
    grad.addColorStop(0.55, 'rgba(180,225,255,0.16)');
    grad.addColorStop(1, 'rgba(255,255,255,0.30)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // duhový lem
    const hues = [[0, 'rgba(255,150,200,0.55)'], [2.1, 'rgba(150,230,255,0.55)'], [4.2, 'rgba(200,255,180,0.55)']];
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    for (const [off, col] of hues) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.94, off + b.phase * 0.2, off + 1.5 + b.phase * 0.2);
      ctx.stroke();
    }
    // odlesk
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.38, r * 0.17, r * 0.11, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // ---- duha (od rohu k rohu) --------------------------------------------
  /** Normala oblouku - miri vzhuru, tedy smerem vyklenuti. */
  rainbowNormal(rb) {
    const dx = rb.bx - rb.ax;
    const dy = rb.by - rb.ay;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    return { nx, ny, len };
  },

  /** Bod na oblouku (kvadraticka Bezier) v parametru t (0..1),
   *  posunuty o `off` po normale. */
  rainbowPoint(rb, t, off) {
    const n = this.rainbowNormal(rb);
    const k = rb.bulge * 2 + off;
    const cx = (rb.ax + rb.bx) / 2 + n.nx * k;
    const cy = (rb.ay + rb.by) / 2 + n.ny * k;
    const ax = rb.ax + n.nx * off;
    const ay = rb.ay + n.ny * off;
    const bx = rb.bx + n.nx * off;
    const by = rb.by + n.ny * off;
    const u = 1 - t;
    return {
      x: u * u * ax + 2 * u * t * cx + t * t * bx,
      y: u * u * ay + 2 * u * t * cy + t * t * by,
    };
  },

  /** Proletel balon pasem duhy? (vzorkuje stredni pas oblouku) */
  rainbowHit(rb, x, y, r) {
    const off = -rb.thick * 2.5; // stred pasu duhy
    const reach = rb.thick * 3.5 + r;
    for (let i = 0; i <= 24; i++) {
      const p = this.rainbowPoint(rb, i / 24, off);
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < reach * reach) return true;
    }
    return false;
  },

  /** Duha klenouci se od rohu k rohu.
   *  rb = {ax, ay, bx, by, bulge, thick, alpha} */
  drawRainbow(ctx, rb) {
    const bands = ['#ff5a5a', '#ffa63d', '#ffe24a', '#63d76b', '#4fb3ff', '#a06bff'];
    const n = this.rainbowNormal(rb);
    const mx = (rb.ax + rb.bx) / 2;
    const my = (rb.ay + rb.by) / 2;
    ctx.save();
    ctx.globalAlpha = rb.alpha != null ? rb.alpha : 0.75;
    ctx.lineWidth = rb.thick;
    ctx.lineCap = 'round';
    bands.forEach((col, i) => {
      const off = -i * rb.thick;
      const k = rb.bulge * 2 + off;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(rb.ax + n.nx * off, rb.ay + n.ny * off);
      ctx.quadraticCurveTo(mx + n.nx * k, my + n.ny * k, rb.bx + n.nx * off, rb.by + n.ny * off);
      ctx.stroke();
    });
    ctx.restore();
  },

  // ---- obruč (hra 2) -----------------------------------------------------
  /** Obruč k prolétnutí. h = {x, y, r, phase, passed} */
  drawHoop(ctx, h, s) {
    const wob = 1 + 0.04 * Math.sin(h.phase);
    const rx = h.r * 0.42 * wob;
    const ry = h.r * wob;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.lineWidth = Math.max(4, 22 * s);
    ctx.lineCap = 'round';
    // zadní půlka (tmavší) + přední půlka (světlá) = dojem 3D
    ctx.strokeStyle = h.passed ? '#7fd68a' : '#c98a2e';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = h.passed ? '#b6f5bd' : '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();
    // jiskřičky na obruči
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 3; i++) {
      const a = h.phase * 0.8 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rx, Math.sin(a) * ry, Math.max(2, 6 * s), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  // ---- stoupavý proud (hra 1) -------------------------------------------
  /** Teplý stoupavý proud. t = {x, y, w, h, phase} */
  drawThermal(ctx, t) {
    ctx.save();
    const grad = ctx.createLinearGradient(t.x - t.w / 2, 0, t.x + t.w / 2, 0);
    grad.addColorStop(0, 'rgba(255, 226, 140, 0)');
    grad.addColorStop(0.5, 'rgba(255, 226, 140, 0.30)');
    grad.addColorStop(1, 'rgba(255, 226, 140, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
    // stoupající vlnky
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, t.w * 0.03);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const p = ((t.phase * 0.6 + i / 5) % 1);
      const y = t.y + t.h / 2 - p * t.h;
      const amp = t.w * 0.22;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const yy = y - k * (t.h * 0.03);
        const xx = t.x + Math.sin(k * 0.9 + t.phase * 4 + i) * amp;
        if (k === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  },

  // ---- větrný poryv (hra 2) ---------------------------------------------
  /** Vodorovný poryv větru. g = {x, y, w, h, phase} */
  drawGust(ctx, g, s) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, g.y - g.h / 2, 0, g.y + g.h / 2);
    grad.addColorStop(0, 'rgba(200, 235, 255, 0)');
    grad.addColorStop(0.5, 'rgba(200, 235, 255, 0.26)');
    grad.addColorStop(1, 'rgba(200, 235, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h);
    // šipky/proužky letící doleva
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(2, 7 * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      const p = ((g.phase * 0.5 + i / 6) % 1);
      const x = g.x + g.w / 2 - p * g.w;
      const y = g.y + Math.sin(i * 2.1) * g.h * 0.3;
      const L = 70 * s;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
      ctx.beginPath();
      ctx.moveTo(x - L, y);
      ctx.lineTo(x, y);
      ctx.moveTo(x - L * 0.35, y - L * 0.22);
      ctx.lineTo(x, y);
      ctx.lineTo(x - L * 0.35, y + L * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  },

  // ---- částice -----------------------------------------------------------
  /** Přidá částicový výbuch: 'gold' jiskry, 'white' obláčky. */
  burst(list, x, y, count, kind, S) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (190 + Math.random() * 430) * S;
      list.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 280 * S,
        grav: (kind === 'white' ? 500 : 1400) * S,
        life: 0.4 + Math.random() * 0.5,
        life0: 0.9,
        kind,
      });
    }
  },

  /** Konfety – barevné rotující obdélníčky (milníky). */
  confetti(list, x, y, count, S) {
    const cols = ['#ff5a5a', '#ffd23f', '#63d76b', '#4fb3ff', '#a06bff', '#ff8ad0'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (250 + Math.random() * 620) * S;
      list.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 420 * S,
        grav: 900 * S,
        life: 1.0 + Math.random() * 0.8,
        life0: 1.8,
        kind: 'confetti',
        col: cols[(Math.random() * cols.length) | 0],
        rot: Math.random() * 6.28,
        rotV: (Math.random() - 0.5) * 14,
        w: (10 + Math.random() * 10) * S,
        h: (16 + Math.random() * 12) * S,
      });
    }
  },

  /** Obláček stopy za balonem. `hue` = duhová stopa (0..360), jinak bílá. */
  emitTrail(list, x, y, vx, vy, S, hue) {
    const life = 0.55 + Math.random() * 0.3;
    list.push({
      x,
      y,
      vx,
      vy,
      grav: 0,
      life,
      life0: life,
      kind: 'trail',
      hue: hue == null ? null : hue,
      r0: (9 + Math.random() * 7) * S,
    });
  },

  /** Posune částice a vrátí pročištěný seznam (max 200 kusů). */
  updateParticles(list, dt) {
    for (const p of list) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      if (p.rotV) p.rot += p.rotV * dt;
      p.life -= dt;
    }
    const out = list.filter((p) => p.life > 0);
    if (out.length > 200) out.splice(0, out.length - 200);
    return out;
  },

  drawParticles(ctx, list, s) {
    for (const p of list) {
      if (p.kind === 'trail') {
        const k = Math.max(0, p.life / p.life0);
        ctx.globalAlpha = k * (p.hue == null ? 0.4 : 0.55);
        ctx.fillStyle = p.hue == null ? '#ffffff' : `hsl(${p.hue}, 95%, 68%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.r0 * (0.4 + 0.6 * k)), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (p.kind === 'confetti') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)) * (p.kind === 'white' ? 0.8 : 1);
      ctx.fillStyle = p.kind === 'white' ? '#ffffff' : '#ffe28a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.kind === 'white' ? 14 : 9) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  // ---- popupy a cedule ---------------------------------------------------
  /** "+1" popup po sebrání hvězdičky. */
  addPopup(list, x, y, text) {
    list.push({ x, y, vy: -140, life: 0.9, text });
  },

  updatePopups(list, dt) {
    for (const p of list) {
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      p.life -= dt;
    }
    return list.filter((p) => p.life > 0);
  },

  drawPopups(ctx, list, s) {
    if (!list.length) return;
    ctx.save();
    ctx.font = `800 ${Math.round(58 * s)}px "Baloo 2", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
      ctx.lineWidth = 8 * s;
      ctx.strokeStyle = 'rgba(11, 43, 86, 0.85)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  },

  /** Milníková cedule uprostřed nahoře (naskočí a zase zmizí).
   *  b = {text, t, t0} */
  drawBanner(ctx, b, W, H, s) {
    const k = 1 - b.t / b.t0;             // 0..1 průběh
    const pop = k < 0.18 ? k / 0.18 : 1;  // naskočení
    const fade = b.t < 0.5 ? b.t / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = `800 ${Math.round(72 * s)}px "Baloo 2", "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(b.text).width;
    const pw = tw + 90 * s;
    const ph = 130 * s;
    const cx = W / 2;
    const cy = H * 0.24;
    ctx.translate(cx, cy);
    ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.rotate(Math.sin(k * 10) * 0.02 * (1 - k));
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(-pw / 2, -ph / 2, pw, ph, ph * 0.36);
      ctx.fill();
    } else {
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    }
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 9 * s;
    if (ctx.roundRect) ctx.stroke();
    ctx.fillStyle = '#0b2b56';
    ctx.fillText(b.text, 0, 4 * s);
    ctx.restore();
  },

  // ---- mlha, logo, HUD ---------------------------------------------------
  /** Poloprůhledné firemní logo dole uprostřed (watermark ve hře). */
  drawLogo(ctx, img, W, H, s) {
    if (!img) return;
    const lw = 340 * s;
    const lh = lw * (img.height / img.width);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(img, (W - lw) / 2, H - lh - 20 * s, lw, lh);
    ctx.restore();
  },

  /** Jemná bílá mlha u spodního okraje – dodá scéně hloubku. */
  drawFog(ctx, W, H) {
    const grad = ctx.createLinearGradient(0, H * 0.86, 0, H);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H * 0.86, W, H * 0.14);
  },

  /** Počítadlo hvězdiček vpravo nahoře (bílá pilulka + hvězda + číslo). */
  drawHud(ctx, W, s, count, pulse01) {
    const pulse = 1 + 0.15 * pulse01;
    const fontPx = Math.round(64 * s);
    ctx.save();
    ctx.font = `800 ${fontPx}px "Baloo 2", "Segoe UI", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    const label = String(count);
    const textW = ctx.measureText(label).width;
    const starR = 34 * s;
    const padX = 30 * s;
    const gap = 18 * s;
    const pillW = padX * 2 + starR * 2 + gap + textW;
    const pillH = 100 * s;
    const px = W - 36 * s - pillW;
    const py = 36 * s;

    ctx.translate(px + pillW / 2, py + pillH / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-(px + pillW / 2), -(py + pillH / 2));

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(px, py, pillW, pillH, pillH / 2);
      ctx.fill();
    } else {
      ctx.fillRect(px, py, pillW, pillH);
    }
    const cx = px + padX + starR;
    const cy = py + pillH / 2;
    this._starPath(ctx, cx, cy, starR);
    ctx.fillStyle = '#ffb62e';
    ctx.fill();
    ctx.fillStyle = '#0b2b56';
    ctx.fillText(label, cx + starR + gap, cy + 2 * s);
    ctx.restore();
  },
};
