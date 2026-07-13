// ============================================================================
//  Sdílené kreslení pro obě hry: obloha se sluncem, mraky, hvězdičky,
//  HUD počítadlo, částice (jiskry / obláčky / stopa), "+1" popupy, mlha.
//  Když se později vymění grafika (PNG mraku apod.), mění se jen tady
//  a obě hry zůstanou vizuálně jednotné.
// ============================================================================
const GFX = {
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
    // slunce vlevo nahoře: velká měkká záře + jádro s prstencem
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

  /** Mrak: PNG z assets (pokud je), jinak proceduální kupole
   *  se stínem dole a světlým odleskem nahoře (3 vrstvy = plastický vzhled).
   *  c = {x, y, w, h, puff 0..1, puffs, alpha} */
  drawCloud(ctx, c, img) {
    const scale = 1 + 0.16 * (c.puff || 0);
    if (img) {
      ctx.save();
      ctx.globalAlpha = c.alpha != null ? c.alpha : 1;
      const w = c.w * scale;
      const h = c.h * scale;
      ctx.drawImage(img, c.x - w / 2, c.y - h / 2, w, h);
      ctx.restore();
      return;
    }
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
  },

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
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.strokeStyle = '#e0912f';
    ctx.lineWidth = Math.max(2, 6 * s);
    ctx.lineJoin = 'round';
    ctx.stroke();
    // třpyt: malý křížek u cípu, pulzuje s fází
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

  /** Přidá částicový výbuch do seznamu: 'gold' jiskry, 'white' obláčky. */
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

  /** Obláček stopy za balonem (malý, pomalu mizí a zmenšuje se). */
  emitTrail(list, x, y, vx, vy, S) {
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
      r0: (9 + Math.random() * 7) * S,
    });
  },

  /** Posune částice a vrátí pročištěný seznam (max 160 kusů). */
  updateParticles(list, dt) {
    for (const p of list) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.life -= dt;
    }
    const out = list.filter((p) => p.life > 0);
    if (out.length > 160) out.splice(0, out.length - 160);
    return out;
  },

  drawParticles(ctx, list, s) {
    for (const p of list) {
      if (p.kind === 'trail') {
        const k = Math.max(0, p.life / p.life0);
        ctx.globalAlpha = k * 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.r0 * (0.4 + 0.6 * k)), 0, Math.PI * 2);
        ctx.fill();
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

  /** "+1" popup po sebrání hvězdičky. */
  addPopup(list, x, y, text) {
    list.push({ x, y, vy: -140, life: 0.9, text });
  },

  updatePopups(list, dt) {
    for (const p of list) {
      p.y += p.vy * dt;
      p.vy += 90 * dt; // zpomaluje
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

  /** Poloprůhledné firemní logo dole uprostřed (watermark ve hře).
   *  Kreslí se do pásu mlhy, aby bylo čitelné a nepřekáželo hře. */
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
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? starR : starR * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const sxp = cx + Math.cos(a) * rr;
      const syp = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(sxp, syp);
      else ctx.lineTo(sxp, syp);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffb62e';
    ctx.fill();
    ctx.fillStyle = '#0b2b56';
    ctx.fillText(label, cx + starR + gap, cy + 2 * s);
    ctx.restore();
  },
};
