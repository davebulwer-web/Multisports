// Invented 80s-flavoured sponsors for the trackside advertising boards.
//
// Each brand becomes one 96x16 frame in the `boards` sheet (src/art/boards.js),
// tagged with its id. The lettering is drawn from the game font so it is always
// legible; the little logo comes from src/art/logos.js, which
// tools/pixellab-logos.mjs fills from PixelLab using the `icon` prompt.
//
//   seasons  which event tabs show the board ('any' = everywhere)
//   bg       background style (see BACKGROUNDS in boards.js)
//   c        palette keys: bg, bg2 (second background colour), fg (lettering),
//            acc (accent: stripes, tagline), sh (lettering shadow / outline)
//   letter   plain | tall | wide | italic | outline
//   side     which end the logo sits at
//
// Names are made up. Don't use real trademarks.

export const BRANDS = [
  // ---- everywhere ----
  { id: 'zapcola', name: 'ZAP COLA', tag: 'THE TASTE OF NOW', seasons: ['any'], icon: 'red cola soda glass bottle, white label',
    bg: 'solid', c: { bg: 'lamp.1', bg2: 'lamp.0', fg: 'grey.6', acc: 'grey.6', sh: 'lamp.0' }, letter: 'italic', side: 'left' },
  { id: 'megatronix', name: 'MEGATRONIX', tag: '64K HOME COMPUTERS', seasons: ['any'], icon: 'beige 1980s home computer with keyboard and small monitor',
    bg: 'grid', c: { bg: 'blue.0', bg2: 'purple.0', fg: 'cyan.2', acc: 'yellow.2', sh: 'blue.1' }, letter: 'plain', side: 'left' },
  { id: 'voltex', name: 'VOLTEX', tag: 'LONG LIFE CELLS', seasons: ['any'], icon: 'battery with a yellow lightning bolt',
    bg: 'split', c: { bg: 'grey.1', bg2: 'yellow.2', fg: 'yellow.2', acc: 'grey.5', sh: 'grey.0' }, letter: 'wide', side: 'left' },
  { id: 'maxitape', name: 'MAXITAPE', tag: 'C90 CASSETTES', seasons: ['any'], icon: 'audio cassette tape',
    bg: 'stripes', c: { bg: 'grey.1', bg2: 'orange.3', fg: 'grey.6', acc: 'orange.3', sh: 'grey.0' }, letter: 'plain', side: 'left' },
  { id: 'chronotek', name: 'CHRONOTEK', tag: 'DIGITAL QUARTZ', seasons: ['any'], icon: 'black digital wrist watch with LCD display',
    bg: 'solid', c: { bg: 'grey.6', bg2: 'grey.5', fg: 'grey.1', acc: 'lamp.1', sh: null }, letter: 'plain', side: 'right' },
  { id: 'vectorgt', name: 'VECTOR GT', tag: 'TURBO POWER', seasons: ['any'], icon: 'red sports car side view',
    bg: 'check', c: { bg: 'grey.1', bg2: 'grey.6', fg: 'lamp.2', acc: 'grey.5', sh: 'lamp.0' }, letter: 'italic', side: 'right' },
  { id: 'orbitair', name: 'ORBIT AIR', tag: 'FLY THE WORLD', seasons: ['any'], icon: 'white jet airliner flying, side view',
    bg: 'sunset', c: { bg: 'sky.1', bg2: 'sky.2', fg: 'grey.6', acc: 'blue.1', sh: 'blue.1' }, letter: 'plain', side: 'left' },
  { id: 'pixeltv', name: 'PIXEL TV', tag: 'NOW IN COLOUR', seasons: ['any'], icon: 'retro television set with rainbow stripes on the screen',
    bg: 'rainbow', c: { bg: 'grey.1', bg2: 'grey.0', fg: 'grey.6', acc: 'grey.5', sh: 'grey.0' }, letter: 'wide', side: 'left' },
  { id: 'snapz', name: 'SNAPZ', tag: 'INSTANT FILM', seasons: ['any'], icon: 'instant camera with rainbow stripe',
    bg: 'split', c: { bg: 'purple.1', bg2: 'grey.6', fg: 'grey.6', acc: 'yellow.2', sh: 'purple.0' }, letter: 'tall', side: 'left' },
  { id: 'kwikkrunch', name: 'KWIK KRUNCH', tag: 'CHEESE & ONION', seasons: ['any'], icon: 'packet of potato crisps',
    bg: 'solid', c: { bg: 'yellow.2', bg2: 'yellow.1', fg: 'blue.1', acc: 'lamp.1', sh: null }, letter: 'plain', side: 'right' },
  { id: 'starbyte', name: 'STARBYTE', tag: 'SOFTWARE', seasons: ['any'], icon: 'floppy disk with a star',
    bg: 'grid', c: { bg: 'grey.0', bg2: 'green.0', fg: 'green.2', acc: 'green.3', sh: 'green.0' }, letter: 'outline', side: 'right' },
  { id: 'boomtown', name: 'BOOMTOWN', tag: 'STEREO SOUND', seasons: ['any'], icon: 'silver boombox stereo radio cassette player',
    bg: 'stripes', c: { bg: 'purple.0', bg2: 'lamp.2', fg: 'cyan.2', acc: 'lamp.2', sh: 'blue.0' }, letter: 'plain', side: 'left' },
  { id: 'multisports', name: 'MULTISPORTS', tag: null, seasons: ['any'], icon: null,
    bg: 'solid', c: { bg: 'blue.1', bg2: 'blue.0', fg: 'grey.6', acc: 'yellow.2', sh: 'blue.0' }, letter: 'tall', side: 'left' },
  { id: 'goforgold', name: 'GO FOR GOLD', tag: null, seasons: ['any'], icon: 'shiny gold medal with a red ribbon',
    bg: 'sunset', c: { bg: 'lamp.0', bg2: 'lamp.1', fg: 'yellow.2', acc: 'yellow.2', sh: 'lamp.0' }, letter: 'plain', side: 'left' },

  // ---- summer (stadium) ----
  { id: 'sprintex', name: 'SPRINTEX', tag: 'BUILT FOR SPEED', seasons: ['summer'], icon: 'white running shoe with red stripes, side view',
    bg: 'stripes', c: { bg: 'blue.1', bg2: 'lamp.1', fg: 'grey.6', acc: 'lamp.2', sh: 'blue.0' }, letter: 'italic', side: 'left' },
  { id: 'vitaburst', name: 'VITABURST', tag: 'ISOTONIC ENERGY', seasons: ['summer', 'challenge'], icon: 'green sports drink bottle',
    bg: 'split', c: { bg: 'green.1', bg2: 'grey.6', fg: 'grey.6', acc: 'green.3', sh: 'green.0' }, letter: 'plain', side: 'left' },
  { id: 'poweroats', name: 'POWER OATS', tag: 'HERO BREAKFAST', seasons: ['summer'], icon: 'cereal box with a sun on it',
    bg: 'solid', c: { bg: 'orange.3', bg2: 'orange.2', fg: 'track.0', acc: 'grey.1', sh: null }, letter: 'plain', side: 'right' },
  { id: 'sunzest', name: 'SUNZEST', tag: 'PURE ORANGE', seasons: ['summer', 'beach'], icon: 'glass of orange juice with a slice of orange',
    bg: 'sunset', c: { bg: 'orange.2', bg2: 'orange.3', fg: 'grey.6', acc: 'track.0', sh: 'track.0' }, letter: 'tall', side: 'left' },
  { id: 'tempo', name: 'TEMPO', tag: 'OFFICIAL TIMING', seasons: ['summer', 'winter'], icon: 'silver stopwatch',
    bg: 'solid', c: { bg: 'grey.1', bg2: 'grey.0', fg: 'yellow.2', acc: 'grey.5', sh: 'grey.0' }, letter: 'wide', side: 'left' },
  { id: 'hyperade', name: 'HYPERADE', tag: 'LEMON & LIME', seasons: ['summer'], icon: 'yellow lemon fruit with a green lime',
    bg: 'check', c: { bg: 'yellow.2', bg2: 'green.2', fg: 'green.0', acc: 'green.0', sh: null }, letter: 'plain', side: 'right' },

  // ---- winter ----
  { id: 'frostmints', name: 'FROSTMINTS', tag: 'ICE COLD FRESH', seasons: ['winter'], icon: 'round white peppermint sweet with blue swirl',
    bg: 'solid', c: { bg: 'cyan.1', bg2: 'cyan.0', fg: 'grey.6', acc: 'blue.1', sh: 'cyan.0' }, letter: 'plain', side: 'left' },
  { id: 'cocoalps', name: 'COCO ALPS', tag: 'HOT CHOCOLATE', seasons: ['winter'], icon: 'mug of hot chocolate with steam',
    bg: 'split', c: { bg: 'orange.0', bg2: 'grey.6', fg: 'orange.3', acc: 'grey.6', sh: 'grey.0' }, letter: 'italic', side: 'left' },
  { id: 'polaris', name: 'POLARIS', tag: 'RACING SKIS', seasons: ['winter'], icon: 'pair of red racing skis crossed with ski poles',
    bg: 'stripes', c: { bg: 'grey.6', bg2: 'lamp.1', fg: 'blue.1', acc: 'lamp.1', sh: null }, letter: 'wide', side: 'right' },
  { id: 'thermoknit', name: 'THERMOKNIT', tag: 'KEEP IT WARM', seasons: ['winter'], icon: 'red and white knitted bobble hat',
    bg: 'check', c: { bg: 'lamp.1', bg2: 'grey.6', fg: 'grey.6', acc: 'grey.6', sh: 'lamp.0' }, letter: 'plain', side: 'left' },
  { id: 'glacier', name: 'GLACIER', tag: 'SPRING WATER', seasons: ['winter'], icon: 'snowy mountain peak',
    bg: 'sunset', c: { bg: 'sky.0', bg2: 'sky.2', fg: 'grey.6', acc: 'blue.1', sh: 'blue.1' }, letter: 'tall', side: 'left' },
  { id: 'yetigear', name: 'YETI GEAR', tag: 'ALL WEATHER', seasons: ['winter'], icon: 'ski goggles with orange lens',
    bg: 'solid', c: { bg: 'grey.1', bg2: 'grey.0', fg: 'orange.3', acc: 'grey.5', sh: 'grey.0' }, letter: 'outline', side: 'right' },
  { id: 'snowcat', name: 'SNOWCAT', tag: 'TRACKED SLEDS', seasons: ['winter'], icon: 'yellow snowmobile side view',
    bg: 'stripes', c: { bg: 'blue.1', bg2: 'yellow.2', fg: 'yellow.2', acc: 'yellow.2', sh: 'blue.0' }, letter: 'italic', side: 'left' },

  // ---- beach ----
  { id: 'solara', name: 'SOLARA', tag: 'SUN CREAM SPF 15', seasons: ['beach'], icon: 'orange bottle of sun cream lotion',
    bg: 'sunset', c: { bg: 'lamp.1', bg2: 'orange.3', fg: 'grey.6', acc: 'yellow.2', sh: 'lamp.0' }, letter: 'wide', side: 'left' },
  { id: 'waverider', name: 'WAVERIDER', tag: 'SURF WAX', seasons: ['beach'], icon: 'surfboard with a stripe, standing upright',
    bg: 'stripes', c: { bg: 'cyan.1', bg2: 'grey.6', fg: 'grey.6', acc: 'blue.1', sh: 'cyan.0' }, letter: 'italic', side: 'left' },
  { id: 'tropix', name: 'TROPIX', tag: 'ICE LOLLIES', seasons: ['beach'], icon: 'striped ice lolly popsicle on a stick',
    bg: 'grid', c: { bg: 'purple.1', bg2: 'purple.0', fg: 'yellow.2', acc: 'lamp.2', sh: 'purple.0' }, letter: 'tall', side: 'right' },
  { id: 'cocobay', name: 'COCO BAY', tag: 'TROPICAL PUNCH', seasons: ['beach'], icon: 'coconut drink with a straw and umbrella',
    bg: 'split', c: { bg: 'green.1', bg2: 'yellow.2', fg: 'yellow.2', acc: 'grey.6', sh: 'green.0' }, letter: 'plain', side: 'left' },
  { id: 'radshades', name: 'RAD SHADES', tag: 'SUNGLASSES', seasons: ['beach'], icon: 'pink neon sunglasses',
    bg: 'grid', c: { bg: 'grey.0', bg2: 'cyan.0', fg: 'lamp.2', acc: 'cyan.2', sh: null }, letter: 'outline', side: 'left' },
  { id: 'koolkone', name: 'KOOL KONE', tag: 'SOFT SERVE', seasons: ['beach'], icon: 'ice cream cone with pink scoop',
    bg: 'solid', c: { bg: 'grey.6', bg2: 'cyan.2', fg: 'lamp.1', acc: 'cyan.0', sh: null }, letter: 'italic', side: 'right' },

  // ---- world (caber, cliff diving, canoe) ----
  { id: 'tartan', name: 'TARTAN', tag: 'BUTTER TOFFEES', seasons: ['world'], icon: 'wrapped toffee sweet with gold wrapper',
    bg: 'tartan', c: { bg: 'lamp.0', bg2: 'green.0', fg: 'yellow.2', acc: 'yellow.2', sh: 'grey.0' }, letter: 'wide', side: 'left' },
  { id: 'trailblazer', name: 'TRAILBLAZER', tag: 'WALKING BOOTS', seasons: ['world', 'challenge'], icon: 'brown leather hiking boot side view',
    bg: 'solid', c: { bg: 'green.0', bg2: 'green.1', fg: 'orange.3', acc: 'grey.5', sh: 'grey.0' }, letter: 'plain', side: 'left' },
  { id: 'rapids', name: 'RAPIDS', tag: 'CANOES & KAYAKS', seasons: ['world'], icon: 'red kayak with a paddle',
    bg: 'stripes', c: { bg: 'cyan.0', bg2: 'cyan.2', fg: 'grey.6', acc: 'cyan.2', sh: 'grey.0' }, letter: 'tall', side: 'right' },
  { id: 'globetrot', name: 'GLOBETROT', tag: 'HOLIDAYS', seasons: ['world', 'beach'], icon: 'globe of the earth blue and green',
    bg: 'sunset', c: { bg: 'blue.1', bg2: 'blue.2', fg: 'yellow.2', acc: 'grey.6', sh: 'blue.0' }, letter: 'plain', side: 'left' },
  { id: 'highland', name: 'HIGHLAND', tag: 'SHORTBREAD', seasons: ['world'], icon: 'tin of shortbread biscuits with tartan lid',
    bg: 'split', c: { bg: 'blue.1', bg2: 'grey.6', fg: 'grey.6', acc: 'lamp.2', sh: 'blue.0' }, letter: 'italic', side: 'left' },

  // ---- challenge (assault course) ----
  { id: 'gripmaster', name: 'GRIPMASTER', tag: 'WORK GLOVES', seasons: ['challenge'], icon: 'brown leather work glove',
    bg: 'check', c: { bg: 'brown.1', bg2: 'yellow.1', fg: 'yellow.2', acc: 'yellow.2', sh: 'grey.0' }, letter: 'plain', side: 'left' },
  { id: 'brawn', name: 'BRAWN BEANS', tag: 'FUEL FOR HEROES', seasons: ['challenge'], icon: 'tin can of baked beans with orange label',
    bg: 'solid', c: { bg: 'track.1', bg2: 'track.0', fg: 'grey.6', acc: 'orange.3', sh: 'track.0' }, letter: 'plain', side: 'left' },
  { id: 'terra4x4', name: 'TERRA 4X4', tag: 'GO ANYWHERE', seasons: ['challenge', 'world'], icon: 'green off-road jeep side view',
    bg: 'stripes', c: { bg: 'grass.0', bg2: 'orange.3', fg: 'grey.6', acc: 'orange.3', sh: 'grey.0' }, letter: 'italic', side: 'right' },
  { id: 'outpost', name: 'OUTPOST', tag: 'COMPASSES & MAPS', seasons: ['challenge'], icon: 'brass compass',
    bg: 'grid', c: { bg: 'green.0', bg2: 'green.1', fg: 'yellow.2', acc: 'green.3', sh: 'grey.0' }, letter: 'wide', side: 'left' },
];

/** Brands whose boards suit a season tab ('any' brands are always in; 'all' = every brand). */
export function brandsFor(season) {
  if (season === 'all') return BRANDS;
  return BRANDS.filter((b) => b.seasons.includes(season) || b.seasons.includes('any'));
}
