/**
 * One line on every apparel product page, plus any non-health remainder
 * of that design's Spreadshop description.
 */
export const REJUVENATION_LINE =
  "This design is imbued with Rejuvenation frequencies to encourage natural vitality for the body and mind.";

/**
 * Spreadshop text that still describes the design after frequency, healing,
 * and health wording is removed. Designs whose write-up was only that wording
 * are omitted; their visual description stays on the page.
 */
export const APPAREL_SPREADSHOP_WRITEUPS: Record<string, string> = {
  "wayshower-rainbow-jnana-mudra":
    "The Wayshower theme uses the Jnana Mudra to neutralize and dissolve all forms of aggression, hostility, stagnancy and lack altogether.",
  "aqua-lattice-mandala":
    "The Strengthener theme. Perfect for workouts!",
  "rose-lattice-mandala":
    "The Strengthener theme. Perfect for workouts!",
  "blue-pearl-wheel-mandala":
    "The Charger theme works with accessories.",
  "pink-pearl-wheel-mandala":
    "The Charger theme works with accessories.",
  "dragon-dimension-blue-chrome-dragon":
    'This amazing looking Dragon of the new "Dimension series".',
};

export function getApparelWriteup(slug: string): string | undefined {
  return APPAREL_SPREADSHOP_WRITEUPS[slug];
}
