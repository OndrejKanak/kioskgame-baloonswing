// ============================================================================
//  Konfigurace – tady se pohodlně ladí chování hry i napojení grafiky.
//  Po úpravě stačí obnovit stránku (F5).
//
//  DŮLEŽITÉ: rozměry a rychlosti jsou v "referenčních pixelech" obrazovky
//  široké 1080 px (FHD na výšku). Hra si je sama přepočítá na skutečnou
//  velikost okna, takže vypadá stejně na PC náhledu i na displeji kiosku.
// ============================================================================
const CONFIG = {
  // true  = ukáže DEV lištu dole + klávesové zkratky (G = simuluj jízdu).
  // false = ostrý provoz na houpadle (vše řídí jen signál z GPIO).
  debug: true,

  // --- Cesty ke grafice. Stačí vyměnit soubory ve složce assets/ ---------
  assets: {
    sky: 'assets/sky_bg.png',            // pozadí oblohy (na výšku)
    balloon: 'assets/balloon_sheet.png', // sprite sheet balonu (mřížka snímků)
    cloud: null,                         // null = mraky se kreslí proceduálně.
                                         //  Až budeš mít PNG mraku, dej sem cestu.
    logo: 'assets/International_logo_red.png', // firemní logo (watermark ve hře)
  },

  // --- Balon: jak je rozřezaný sprite sheet a jak se chová ----------------
  balloon: {
    frameCols: 6,       // počet sloupců snímků ve sheetu
    frameRows: 2,       // počet řádků snímků
    frameCount: 12,     // kolik snímků se reálně přehrává (≤ cols*rows)
    fps: 12,            // rychlost přehrávání animace (snímků za sekundu)
    displayWidth: 300,  // šířka balonu (ref. px; výška se dopočítá)
    followSpeed: 6,     // jak svižně balon dojíždí k prstu (víc = rychleji)
    autoCenter: 0,      // 0 = zůstane kde ho pustíš; >0 = pomalu plyne do středu
    bobAmount: 20,      // jemné houpání nahoru/dolů v klidu (ref. px)
    bobSpeed: 1.8,      // rychlost tohoto houpání
    sideMargin: 48,     // jak blízko k bočnímu okraji balon smí (ref. px)
    topLimit: 0.12,     // horní hranice pohybu (podíl výšky obrazovky)
    bottomLimit: 0.90,  // dolní hranice pohybu (podíl výšky obrazovky)
    startYRatio: 0.62,  // kde balon začíná (podíl výšky obrazovky)
  },

  // --- "Stoupání" do oblak a mraky-překážky --------------------------------
  //  Mrak je pevná překážka: balon se od něj odrazí dolů a dokud mu hráč
  //  neuhne do strany, svět stojí na místě (metry nepřibývají).
  world: {
    riseSpeed: 360,        // rychlost stoupání = jak rychle mraky ujíždí dolů (ref. px/s)
    bounceImpulse: 1100,   // jak silně mrak balon odrazí dolů (ref. px/s)
    bounceStiffness: 90,   // jak rychle se balon vrací zpět nahoru (tuhost pružiny)
    bounceDamping: 9,      // tlumení odrazu (víc = míň houpání)
    cloudMinGap: 760,      // min. svislá mezera mezi mraky (ref. px)
    cloudMaxGap: 1300,     // max. svislá mezera mezi mraky (ref. px)
    cloudMinWidth: 420,
    cloudMaxWidth: 720,
    cloudDrift: 24,        // jemný boční pohyb mraků (ref. px/s)
    passageGap: 420,       // zaručená průletná mezera vedle každého mraku (ref. px)
  },

  // --- Hra 2: Balónkový let (ťukni = poskoč, proleť mezerou v mracích) ----
  //  Náraz do sloupu mraků: balon se ODRAZÍ DOZADU a vrací se, překážka
  //  zůstane stát na místě (svět stojí, metry nepřibývají), dokud hráč
  //  nevyrovná balon do mezery a překážku nepřekoná.
  flappy: {
    balloonWidth: 260,    // šířka balonu (ref. px) – menší než ve hře 1
    balloonX: 0.32,       // vodorovná poloha balonu (podíl šířky obrazovky)
    gravity: 2200,        // gravitace (ref. px/s²)
    flapImpulse: 1050,    // síla poskoku po ťuknutí (ref. px/s)
    maxFall: 1500,        // max. rychlost pádu (ref. px/s)
    scrollSpeed: 300,     // rychlost letu doprava (ref. px/s)
    columnWidth: 340,     // šířka sloupu mraků (ref. px)
    spacingMin: 900,      // min. rozestup sloupů (ref. px)
    spacingMax: 1250,     // max. rozestup sloupů (ref. px)
    gapMin: 720,          // min. výška mezery (ref. px) – velkorysé pro děti
    gapMax: 880,          // max. výška mezery (ref. px)
    gapEdgeMargin: 240,   // jak daleko od kraje obrazovky smí mezera být (ref. px)
    deflect: 800,         // dopomoc po nárazu: postrčení ke středu mezery (ref. px/s)
    stunTime: 0.35,       // po nárazu chvilku nejde ťukat (s)
    knockback: 1000,      // rychlost odražení balonu dozadu po nárazu (ref. px/s)
    knockReturn: 2400,    // jak rychle se balon vrací dopředu (ref. px/s²)
    knockMax: 320,        // max. vzdálenost odražení dozadu (ref. px)
  },

  // --- Hvězdičky ke sbírání (nic se neukládá, jen počítadlo během jízdy) --
  stars: {
    enabled: true,
    chance: 0.75,     // šance, že se v mezeře mezi mraky objeví hvězdička
    radius: 55,       // poloměr hvězdičky (ref. px)
  },

  // --- Vizuální efekty (všechny jdou vypnout) ------------------------------
  effects: {
    tiltMaxDeg: 10,     // max. náklon balonu při letu do stran (stupně)
    parallax: true,     // vzdálené mraky v pozadí (hloubka)
    birds: true,        // ptáčci letící přes obrazovku
    windStreaks: true,  // "větrné" šmouhy = pocit pohybu
    sun: true,          // slunce se září v rohu oblohy
    trail: true,        // obláčková stopa za balonem
    fog: true,          // jemná mlha u spodního okraje
    logoInGame: true,   // poloprůhledné logo dole ve hře (watermark)
  },

  // --- Zvuk (procedurální, žádné soubory; na dotyk se sám odemkne) --------
  sound: {
    enabled: true,
    volume: 0.5,   // 0..1
  },

  // --- Časování obrazovek -------------------------------------------------
  timing: {
    goodbyeMs: 5000,   // jak dlouho svítí "Ahoj" s výsledky po konci jízdy
  },
};
