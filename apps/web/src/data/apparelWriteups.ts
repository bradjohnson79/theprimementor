/**
 * Original Spreadshop design descriptions.
 * Medical and cure wording is softened. Everything else is the live page text.
 */
export const APPAREL_SPREADSHOP_WRITEUPS: Record<string, string> = {
  "gold-rosette-mandala":
    "The Youth Body theme works with symbolic codes. From a symbolic sense of renewal.",
  "wayshower-rainbow-jnana-mudra":
    "The Wayshower theme uses the Jnana Mudra to neutralize and dissolve all forms of negative energy including aggression, hostility, stagnancy and lack altogether leaving your environment purified.",
  "magenta-constellation-mandala":
    "The Detoxifier theme works with a symbolic cleansing motif and a sense of balance overall.",
  "pink-bloom-mandala":
    'The "Rejuvenator" theme works with a symbolic renewal motif.',
  "sky-constellation-star-ray-mandala":
    "The Detoxifier theme works with a symbolic cleansing motif and a sense of balance overall.",
  "ice-blue-sparkle-star-mandala":
    'The "Rejuvenator" theme works with a symbolic renewal motif.',
  "lilac-sparkle-star-mandala":
    'The "Rejuvenator" theme works with a symbolic renewal motif.',
  "aqua-lattice-mandala":
    "The Strengthener theme carries a strengthening motif. Perfect for workouts!",
  "rose-lattice-mandala":
    "The Strengthener theme carries a strengthening motif. Perfect for workouts!",
  "blue-pearl-wheel-mandala":
    "The Charger theme works with accessories for a symbolic charge motif.",
  "pink-pearl-wheel-mandala":
    "The Charger theme works with accessories for a symbolic charge motif.",
  "dragon-dimension-blue-chrome-dragon":
    'This amazing looking Dragon Detoxifier of the new "Dimension series" carries a symbolic cleansing motif.',
  "fire-phoenix-tribal-phoenix":
    'The "Phoenix Rejuvenator" theme uses the "Rejuvenator" symbolic code technology theme and works with a symbolic renewal motif',
  "azure-constellation-mandala":
    "The Detoxifier theme works with a symbolic cleansing motif and a sense of balance overall.",
  "sky-bloom-mandala":
    'The "Rejuvenator" theme works with a symbolic renewal motif.',
  "gold-star-ray-mandala":
    "The Youth Body theme works with symbolic codes. From a symbolic sense of renewal.",
  "rose-constellation-star-ray-mandala":
    "The Detoxifier theme works with a symbolic cleansing motif and a sense of balance overall.",
  "kids-magenta-constellation-mandala":
    "The Kid's Detoxifier theme (infant to teenager) works with a symbolic cleansing motif and a sense of balance overall.",
  "kids-azure-constellation-mandala":
    "The Kid's Detoxifier theme (infant to teenager) works from to a symbolic cleansing motif and a sense of balance overall.",
  "kids-lilac-sparkle-star-mandala":
    'The Kid\'s "Rejuvenator" theme (infant to teenager) works with a symbolic renewal motif.',
  "kids-ice-blue-sparkle-star-mandala":
    'The Kid\'s "Rejuvenator" theme (infant to teenager) works with a symbolic renewal motif.',
};

export function getApparelWriteup(slug: string): string | undefined {
  return APPAREL_SPREADSHOP_WRITEUPS[slug];
}
