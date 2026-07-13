// ============================================================================
//  Jednoduchý nahrávač obrázků. Chybějící obrázek nevadí – vrátí null a hra
//  ho nahradí proceduálním vykreslením (mraky) nebo prostě nevykreslí.
// ============================================================================
const Assets = {
  images: {},

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
          console.warn('Nepodařilo se načíst obrázek:', src);
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
};
