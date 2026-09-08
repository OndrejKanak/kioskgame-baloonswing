// ============================================================================
//  Nahrávač obrázků + registrace sprite sheetu.
//  Chybějící obrázek nevadí – vrátí null a hra ho nahradí proceduálním
//  vykreslením (mraky) nebo prostě nevykreslí.
// ============================================================================
const Assets = {
  images: {},
  sprites: {},

  // map = { klic: 'cesta.png' | null }. Vrací Promise s { klic: Image|null }.
  load(map) {
    const tasks = Object.entries(map).map(([key, src]) => {
      if (!src) {
        this.images[key] = null;
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.images[key] = img;
          resolve();
        };
        img.onerror = () => {
          // Ikonky (icon_*) jsou nepovinné – když chybí, hra použije emoji.
          // Nehlásíme to jako chybu, ať je konzole na kiosku čitelná.
          if (!key.startsWith('icon_')) {
            console.warn('Nepodařilo se načíst obrázek:', src);
          }
          this.images[key] = null;
          resolve();
        };
        img.src = src;
      });
    });
    return Promise.all(tasks).then(() => this.images);
  },

  get(key) {
    return this.images[key] || null;
  },

  /** Registrované snímky sprite sheetu (nebo null). */
  sprite(key) {
    return this.sprites[key] || null;
  },

  // --------------------------------------------------------------------------
  //  REGISTRACE SPRITE SHEETU
  //
  //  Snímky v generovaných sheetech bývají v každé buňce jinak posunuté
  //  a jinak velké – při přehrávání pak objekt "poskakuje". Tahle funkce
  //  najde u každého snímku obrys (bounding box neprůhledných pixelů),
  //  vyřízne ho a překreslí doprostřed společného plátna v jednotné
  //  velikosti. Výsledkem je sada snímků, které na sebe přesně sedí.
  //
  //  Vrací { frames: [canvas], w, h, contentW, contentH } nebo null.
  // --------------------------------------------------------------------------
  buildSprite(key, cols, rows, count) {
    const img = this.get(key);
    if (!img) return null;
    try {
      const IW = img.width;
      const IH = img.height;
      const src = document.createElement('canvas');
      src.width = IW;
      src.height = IH;
      const sctx = src.getContext('2d', { willReadFrequently: true });
      sctx.drawImage(img, 0, 0);
      const data = sctx.getImageData(0, 0, IW, IH).data;

      const cw = IW / cols;
      const ch = IH / rows;
      const STEP = 2; // vzorkování po 2 px kvůli rychlosti (přesnost stačí)
      const boxes = [];

      for (let f = 0; f < count; f++) {
        const col = f % cols;
        const row = Math.floor(f / cols);
        const x0 = Math.round(col * cw);
        const x1 = Math.round((col + 1) * cw);
        const y0 = Math.round(row * ch);
        const y1 = Math.round((row + 1) * ch);
        let minx = x1;
        let maxx = x0 - 1;
        let miny = y1;
        let maxy = y0 - 1;
        for (let y = y0; y < y1; y += STEP) {
          const rowOff = y * IW;
          for (let x = x0; x < x1; x += STEP) {
            if (data[(rowOff + x) * 4 + 3] > 128) {
              if (x < minx) minx = x;
              if (x > maxx) maxx = x;
              if (y < miny) miny = y;
              if (y > maxy) maxy = y;
            }
          }
        }
        if (maxx < minx) {
          // prázdný snímek – vezmi celou buňku
          minx = x0;
          maxx = x1 - 1;
          miny = y0;
          maxy = y1 - 1;
        }
        boxes.push({
          x: Math.max(x0, minx - STEP),
          y: Math.max(y0, miny - STEP),
          w: Math.min(x1, maxx + STEP) - Math.max(x0, minx - STEP) + 1,
          h: Math.min(y1, maxy + STEP) - Math.max(y0, miny - STEP) + 1,
        });
      }

      // společná velikost snímku = největší obrys + malý okraj
      const maxW = Math.max(...boxes.map((b) => b.w));
      const maxH = Math.max(...boxes.map((b) => b.h));
      const pad = Math.round(maxW * 0.04);
      const fw = Math.round(maxW + pad * 2);
      const fh = Math.round(maxH + pad * 2);
      // všechny snímky se přepočítají na průměrnou šířku (srovná kolísání velikosti)
      const avgW = boxes.reduce((s, b) => s + b.w, 0) / boxes.length;
      let sumH = 0;

      const frames = boxes.map((b) => {
        const c = document.createElement('canvas');
        c.width = fw;
        c.height = fh;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        const k = avgW / b.w;
        const dw = b.w * k;
        const dh = b.h * k;
        sumH += dh;
        g.drawImage(img, b.x, b.y, b.w, b.h, (fw - dw) / 2, (fh - dh) / 2, dw, dh);
        return c;
      });

      const sprite = {
        frames,
        w: fw,
        h: fh,
        cellW: cw,   // rozmer puvodni bunky - drzi stejne meritko jako pred registraci
        cellH: ch,
        contentW: avgW,
        contentH: sumH / boxes.length,
      };
      this.sprites[key] = sprite;
      return sprite;
    } catch (e) {
      console.warn('Registrace sprite sheetu selhala:', e);
      return null;
    }
  },
};
