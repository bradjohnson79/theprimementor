/** Model and product photos for each apparel design. source "spreadshop" is a photo from that design's live Spreadshop product page. */
export interface ApparelModelShot {
  file: string;
  label: string;
  alt: string;
  source: "spreadshop" | "mockup";
}

export type ModelGender = "male" | "female" | "unisex" | "kids" | "unknown";

/** Detect gender from product label */
export function detectModelGender(label: string): ModelGender {
  if (/\b(?:kids|toddler|baby)\b/i.test(label)) return "kids";
  if (/\bunisex\b/i.test(label)) return "unisex";
  if (/\b(?:women|female)\b/i.test(label)) return "female";
  if (/\b(?:men|male)\b/i.test(label)) return "male";
  return "unknown";
}

export const APPAREL_MODEL_SHOTS: Record<string, ApparelModelShot[]> = {
  "gold-rosette-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Gold Rosette Mandala – Sacred Geometry Overlapping Circles printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Gold Rosette Mandala – Sacred Geometry Overlapping Circles printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-women-s-flowy-tank-top-by-bella.webp", label: "Women's Flowy Tank Top by Bella", alt: "Gold Rosette Mandala – Sacred Geometry Overlapping Circles printed on a Women's Flowy Tank Top by Bella", source: "spreadshop" },
    { file: "04-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Gold Rosette Mandala – Sacred Geometry Overlapping Circles printed on a Men's Hoodie", source: "spreadshop" },
    { file: "05-unisex-crewneck-sweatshirt.webp", label: "Unisex Crewneck Sweatshirt", alt: "Gold Rosette Mandala – Sacred Geometry Overlapping Circles printed on an Unisex Crewneck Sweatshirt", source: "spreadshop" },
    { file: "06-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Gold Rosette Mandala – Sacred Geometry Overlapping Circles printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
  ],
  "wayshower-rainbow-jnana-mudra": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Wayshower – Rainbow Jnana Mudra on Flower of Life printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Wayshower – Rainbow Jnana Mudra on Flower of Life printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-women-s-flowy-tank-top-by-bella.webp", label: "Women's Flowy Tank Top by Bella", alt: "Wayshower – Rainbow Jnana Mudra on Flower of Life printed on a Women's Flowy Tank Top by Bella", source: "spreadshop" },
    { file: "04-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Wayshower – Rainbow Jnana Mudra on Flower of Life printed on a Men's Hoodie", source: "spreadshop" },
    { file: "05-unisex-crewneck-sweatshirt.webp", label: "Unisex Crewneck Sweatshirt", alt: "Wayshower – Rainbow Jnana Mudra on Flower of Life printed on an Unisex Crewneck Sweatshirt", source: "spreadshop" },
    { file: "06-kids-premium-t-shirt.webp", label: "Kids' Premium T-Shirt", alt: "Wayshower – Rainbow Jnana Mudra on Flower of Life printed on a Kids' Premium T-Shirt", source: "spreadshop" },
  ],
  "magenta-constellation-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-t-shirt.webp", label: "Men's T-Shirt", alt: "Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Men's T-Shirt", source: "spreadshop" },
    { file: "03-women-s-hoodie.webp", label: "Women's Hoodie", alt: "Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Women's Hoodie", source: "spreadshop" },
    { file: "04-women-s-moisture-wicking-performance-t-shirt.webp", label: "Women's Moisture Wicking Performance T-Shirt", alt: "Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Women's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
    { file: "05-women-s-premium-slim-fit-long-sleeve-t-shirt.webp", label: "Women's Premium Slim Fit Long Sleeve T-Shirt", alt: "Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Women's Premium Slim Fit Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "06-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Snapback Baseball Cap", source: "spreadshop" },
  ],
  "pink-bloom-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Pink Bloom Mandala – Lace Ring Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Pink Bloom Mandala – Lace Ring Sacred Geometry printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Pink Bloom Mandala – Lace Ring Sacred Geometry printed on a Men's Hoodie", source: "spreadshop" },
    { file: "04-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Pink Bloom Mandala – Lace Ring Sacred Geometry printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
    { file: "05-men-s-long-sleeve-t-shirt.webp", label: "Men's Long Sleeve T-Shirt", alt: "Pink Bloom Mandala – Lace Ring Sacred Geometry printed on a Men's Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "06-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Pink Bloom Mandala – Lace Ring Sacred Geometry printed on a Snapback Baseball Cap", source: "spreadshop" },
  ],
  "sky-constellation-star-ray-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Sky Constellation Star-Ray Mandala – Blue Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Sky Constellation Star-Ray Mandala – Blue Sacred Geometry printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Sky Constellation Star-Ray Mandala – Blue Sacred Geometry printed on a Men's Hoodie", source: "spreadshop" },
    { file: "04-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Sky Constellation Star-Ray Mandala – Blue Sacred Geometry printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
    { file: "05-men-s-long-sleeve-t-shirt.webp", label: "Men's Long Sleeve T-Shirt", alt: "Sky Constellation Star-Ray Mandala – Blue Sacred Geometry printed on a Men's Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "06-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Sky Constellation Star-Ray Mandala – Blue Sacred Geometry printed on a Snapback Baseball Cap", source: "spreadshop" },
  ],
  "ice-blue-sparkle-star-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-unisex-premium-organic-zip-hoodie.webp", label: "Unisex Premium Organic Zip Hoodie", alt: "Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on an Unisex Premium Organic Zip Hoodie", source: "spreadshop" },
    { file: "04-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
    { file: "05-men-s-long-sleeve-t-shirt.webp", label: "Men's Long Sleeve T-Shirt", alt: "Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Men's Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "06-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Snapback Baseball Cap", source: "spreadshop" },
  ],
  "lilac-sparkle-star-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-men-s-premium-hoodie.webp", label: "Men's Premium Hoodie", alt: "Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Men's Premium Hoodie", source: "spreadshop" },
    { file: "04-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
    { file: "05-men-s-long-sleeve-t-shirt.webp", label: "Men's Long Sleeve T-Shirt", alt: "Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Men's Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "06-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Snapback Baseball Cap", source: "spreadshop" },
  ],
  "aqua-lattice-mandala": [
    { file: "01-women-s-v-neck-football-tee.webp", label: "Women's V-Neck Football Tee", alt: "Aqua Lattice Mandala – Overlapping Circle Sacred Geometry printed on a Women's V-Neck Football Tee", source: "spreadshop" },
    { file: "02-unisex-baseball-t-shirt.webp", label: "Unisex Baseball T-Shirt", alt: "Aqua Lattice Mandala – Overlapping Circle Sacred Geometry printed on an Unisex Baseball T-Shirt", source: "spreadshop" },
    { file: "03-women-s-flowy-tank-top-by-bella.webp", label: "Women's Flowy Tank Top by Bella", alt: "Aqua Lattice Mandala – Overlapping Circle Sacred Geometry printed on a Women's Flowy Tank Top by Bella", source: "spreadshop" },
    { file: "04-women-s-hoodie.webp", label: "Women's Hoodie", alt: "Aqua Lattice Mandala – Overlapping Circle Sacred Geometry printed on a Women's Hoodie", source: "spreadshop" },
    { file: "05-unisex-crewneck-sweatshirt.webp", label: "Unisex Crewneck Sweatshirt", alt: "Aqua Lattice Mandala – Overlapping Circle Sacred Geometry printed on an Unisex Crewneck Sweatshirt", source: "spreadshop" },
    { file: "06-women-s-premium-hoodie.webp", label: "Women's Premium Hoodie", alt: "Aqua Lattice Mandala – Overlapping Circle Sacred Geometry printed on a Women's Premium Hoodie", source: "spreadshop" },
  ],
  "rose-lattice-mandala": [
    { file: "01-women-s-v-neck-football-tee.webp", label: "Women's V-Neck Football Tee", alt: "Rose Lattice Mandala – Overlapping Circle Sacred Geometry printed on a Women's V-Neck Football Tee", source: "spreadshop" },
    { file: "02-unisex-baseball-t-shirt.webp", label: "Unisex Baseball T-Shirt", alt: "Rose Lattice Mandala – Overlapping Circle Sacred Geometry printed on an Unisex Baseball T-Shirt", source: "spreadshop" },
    { file: "03-women-s-flowy-tank-top-by-bella.webp", label: "Women's Flowy Tank Top by Bella", alt: "Rose Lattice Mandala – Overlapping Circle Sacred Geometry printed on a Women's Flowy Tank Top by Bella", source: "spreadshop" },
    { file: "04-women-s-hoodie.webp", label: "Women's Hoodie", alt: "Rose Lattice Mandala – Overlapping Circle Sacred Geometry printed on a Women's Hoodie", source: "spreadshop" },
    { file: "05-unisex-crewneck-sweatshirt.webp", label: "Unisex Crewneck Sweatshirt", alt: "Rose Lattice Mandala – Overlapping Circle Sacred Geometry printed on an Unisex Crewneck Sweatshirt", source: "spreadshop" },
    { file: "06-women-s-premium-hoodie.webp", label: "Women's Premium Hoodie", alt: "Rose Lattice Mandala – Overlapping Circle Sacred Geometry printed on a Women's Premium Hoodie", source: "spreadshop" },
  ],
  "blue-pearl-wheel-mandala": [
    { file: "01-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Blue Pearl Wheel Mandala – Sacred Geometry Circle printed on a Snapback Baseball Cap", source: "spreadshop" },
    { file: "02-artisan-apron.webp", label: "Artisan Apron", alt: "Blue Pearl Wheel Mandala – Sacred Geometry Circle printed on an Artisan Apron", source: "spreadshop" },
    { file: "03-throw-pillow-cover-17-5-x-17-5.webp", label: "Throw Pillow Cover 17.5” x 17.5”", alt: "Blue Pearl Wheel Mandala – Sacred Geometry Circle printed on a Throw Pillow Cover 17.5” x 17.5”", source: "spreadshop" },
    { file: "04-cotton-drawstring-bag.webp", label: "Cotton Drawstring Bag", alt: "Blue Pearl Wheel Mandala – Sacred Geometry Circle printed on a Cotton Drawstring Bag", source: "spreadshop" },
    { file: "05-17-oz-insulated-stainless-steel-water-bottle.webp", label: "17 oz Insulated Stainless Steel Water Bottle", alt: "Blue Pearl Wheel Mandala – Sacred Geometry Circle printed on a 17 oz Insulated Stainless Steel Water Bottle", source: "spreadshop" },
    { file: "06-buttons-small-1-5-pack.webp", label: "Buttons small 1'' (5-pack)", alt: "Blue Pearl Wheel Mandala – Sacred Geometry Circle printed on a Buttons small 1'' (5-pack)", source: "spreadshop" },
  ],
  "pink-pearl-wheel-mandala": [
    { file: "01-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Pink Pearl Wheel Mandala – Sacred Geometry Circle printed on a Snapback Baseball Cap", source: "spreadshop" },
    { file: "02-adjustable-apron.webp", label: "Adjustable Apron", alt: "Pink Pearl Wheel Mandala – Sacred Geometry Circle printed on an Adjustable Apron", source: "spreadshop" },
    { file: "03-throw-pillow-cover-17-5-x-17-5.webp", label: "Throw Pillow Cover 17.5” x 17.5”", alt: "Pink Pearl Wheel Mandala – Sacred Geometry Circle printed on a Throw Pillow Cover 17.5” x 17.5”", source: "spreadshop" },
    { file: "04-eco-friendly-cotton-tote.webp", label: "Eco-Friendly Cotton Tote", alt: "Pink Pearl Wheel Mandala – Sacred Geometry Circle printed on an Eco-Friendly Cotton Tote", source: "spreadshop" },
    { file: "05-coffee-tea-mug.webp", label: "Coffee/Tea Mug", alt: "Pink Pearl Wheel Mandala – Sacred Geometry Circle printed on a Coffee/Tea Mug", source: "spreadshop" },
    { file: "06-buttons-large-2-2-5-pack.webp", label: "Buttons large 2.2'' (5-pack)", alt: "Pink Pearl Wheel Mandala – Sacred Geometry Circle printed on a Buttons large 2.2'' (5-pack)", source: "spreadshop" },
  ],
  "dragon-dimension-blue-chrome-dragon": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Dragon Dimension – Blue Chrome Tribal Dragon with Spiral Vortex printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Dragon Dimension – Blue Chrome Tribal Dragon with Spiral Vortex printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-women-s-flowy-tank-top-by-bella.webp", label: "Women's Flowy Tank Top by Bella", alt: "Dragon Dimension – Blue Chrome Tribal Dragon with Spiral Vortex printed on a Women's Flowy Tank Top by Bella", source: "spreadshop" },
    { file: "04-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Dragon Dimension – Blue Chrome Tribal Dragon with Spiral Vortex printed on a Men's Hoodie", source: "spreadshop" },
    { file: "05-unisex-crewneck-sweatshirt.webp", label: "Unisex Crewneck Sweatshirt", alt: "Dragon Dimension – Blue Chrome Tribal Dragon with Spiral Vortex printed on an Unisex Crewneck Sweatshirt", source: "spreadshop" },
    { file: "06-kids-premium-t-shirt.webp", label: "Kids' Premium T-Shirt", alt: "Dragon Dimension – Blue Chrome Tribal Dragon with Spiral Vortex printed on a Kids' Premium T-Shirt", source: "spreadshop" },
  ],
  "fire-phoenix-tribal-phoenix": [
    { file: "01-women-s-v-neck-t-shirt.webp", label: "Women's V-Neck T-Shirt", alt: "Fire Phoenix – Tribal Phoenix with Twin Spirals printed on a Women's V-Neck T-Shirt", source: "spreadshop" },
    { file: "02-men-s-t-shirt.webp", label: "Men's T-Shirt", alt: "Fire Phoenix – Tribal Phoenix with Twin Spirals printed on a Men's T-Shirt", source: "spreadshop" },
    { file: "03-women-s-flowy-tank-top-by-bella.webp", label: "Women's Flowy Tank Top by Bella", alt: "Fire Phoenix – Tribal Phoenix with Twin Spirals printed on a Women's Flowy Tank Top by Bella", source: "spreadshop" },
    { file: "04-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Fire Phoenix – Tribal Phoenix with Twin Spirals printed on a Men's Hoodie", source: "spreadshop" },
    { file: "05-unisex-crewneck-sweatshirt.webp", label: "Unisex Crewneck Sweatshirt", alt: "Fire Phoenix – Tribal Phoenix with Twin Spirals printed on an Unisex Crewneck Sweatshirt", source: "spreadshop" },
    { file: "06-kids-premium-t-shirt.webp", label: "Kids' Premium T-Shirt", alt: "Fire Phoenix – Tribal Phoenix with Twin Spirals printed on a Kids' Premium T-Shirt", source: "spreadshop" },
  ],
  "azure-constellation-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-men-s-premium-hoodie.webp", label: "Men's Premium Hoodie", alt: "Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Men's Premium Hoodie", source: "spreadshop" },
    { file: "04-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
    { file: "05-men-s-long-sleeve-t-shirt.webp", label: "Men's Long Sleeve T-Shirt", alt: "Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Men's Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "06-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Snapback Baseball Cap", source: "spreadshop" },
  ],
  "sky-bloom-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Sky Bloom Mandala – Lace Ring Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Sky Bloom Mandala – Lace Ring Sacred Geometry printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Sky Bloom Mandala – Lace Ring Sacred Geometry printed on a Men's Hoodie", source: "spreadshop" },
    { file: "04-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Sky Bloom Mandala – Lace Ring Sacred Geometry printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
    { file: "05-men-s-long-sleeve-t-shirt.webp", label: "Men's Long Sleeve T-Shirt", alt: "Sky Bloom Mandala – Lace Ring Sacred Geometry printed on a Men's Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "06-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Sky Bloom Mandala – Lace Ring Sacred Geometry printed on a Snapback Baseball Cap", source: "spreadshop" },
  ],
  "gold-star-ray-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Gold Star-Ray Mandala – Eight-Point Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Gold Star-Ray Mandala – Eight-Point Sacred Geometry printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-women-s-flowy-tank-top-by-bella.webp", label: "Women's Flowy Tank Top by Bella", alt: "Gold Star-Ray Mandala – Eight-Point Sacred Geometry printed on a Women's Flowy Tank Top by Bella", source: "spreadshop" },
    { file: "04-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Gold Star-Ray Mandala – Eight-Point Sacred Geometry printed on a Men's Hoodie", source: "spreadshop" },
    { file: "05-unisex-crewneck-sweatshirt.webp", label: "Unisex Crewneck Sweatshirt", alt: "Gold Star-Ray Mandala – Eight-Point Sacred Geometry printed on an Unisex Crewneck Sweatshirt", source: "spreadshop" },
    { file: "06-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Gold Star-Ray Mandala – Eight-Point Sacred Geometry printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
  ],
  "rose-constellation-star-ray-mandala": [
    { file: "01-women-s-t-shirt.webp", label: "Women's T-Shirt", alt: "Rose Constellation Star-Ray Mandala – Pink Sacred Geometry printed on a Women's T-Shirt", source: "spreadshop" },
    { file: "02-men-s-ringer-t-shirt.webp", label: "Men's Ringer T-Shirt", alt: "Rose Constellation Star-Ray Mandala – Pink Sacred Geometry printed on a Men's Ringer T-Shirt", source: "spreadshop" },
    { file: "03-men-s-hoodie.webp", label: "Men's Hoodie", alt: "Rose Constellation Star-Ray Mandala – Pink Sacred Geometry printed on a Men's Hoodie", source: "spreadshop" },
    { file: "04-men-s-moisture-wicking-performance-t-shirt.webp", label: "Men's Moisture Wicking Performance T-Shirt", alt: "Rose Constellation Star-Ray Mandala – Pink Sacred Geometry printed on a Men's Moisture Wicking Performance T-Shirt", source: "spreadshop" },
    { file: "05-men-s-long-sleeve-t-shirt.webp", label: "Men's Long Sleeve T-Shirt", alt: "Rose Constellation Star-Ray Mandala – Pink Sacred Geometry printed on a Men's Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "06-snapback-baseball-cap.webp", label: "Snapback Baseball Cap", alt: "Rose Constellation Star-Ray Mandala – Pink Sacred Geometry printed on a Snapback Baseball Cap", source: "spreadshop" },
  ],
  "kids-magenta-constellation-mandala": [
    { file: "01-kids-premium-hoodie.webp", label: "Kids' Premium Hoodie", alt: "Kids' Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Kids' Premium Hoodie", source: "spreadshop" },
    { file: "02-kids-crewneck-sweatshirt.webp", label: "Kids' Crewneck Sweatshirt", alt: "Kids' Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Kids' Crewneck Sweatshirt", source: "spreadshop" },
    { file: "03-kids-premium-t-shirt.webp", label: "Kids' Premium T-Shirt", alt: "Kids' Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Kids' Premium T-Shirt", source: "spreadshop" },
    { file: "04-kids-premium-long-sleeve-t-shirt.webp", label: "Kids' Premium Long Sleeve T-Shirt", alt: "Kids' Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Kids' Premium Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "05-baby-cap.webp", label: "Baby Cap", alt: "Kids' Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Baby Cap", source: "spreadshop" },
    { file: "06-toddler-premium-t-shirt.webp", label: "Toddler Premium T-Shirt", alt: "Kids' Magenta Constellation Mandala – Glowing Orb Sacred Geometry printed on a Toddler Premium T-Shirt", source: "spreadshop" },
  ],
  "kids-azure-constellation-mandala": [
    { file: "01-kids-hoodie.webp", label: "Kids' Hoodie", alt: "Kids' Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Kids' Hoodie", source: "spreadshop" },
    { file: "02-kids-crewneck-sweatshirt.webp", label: "Kids' Crewneck Sweatshirt", alt: "Kids' Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Kids' Crewneck Sweatshirt", source: "spreadshop" },
    { file: "03-kids-premium-t-shirt.webp", label: "Kids' Premium T-Shirt", alt: "Kids' Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Kids' Premium T-Shirt", source: "spreadshop" },
    { file: "04-kids-premium-long-sleeve-t-shirt.webp", label: "Kids' Premium Long Sleeve T-Shirt", alt: "Kids' Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Kids' Premium Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "05-baby-cap.webp", label: "Baby Cap", alt: "Kids' Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Baby Cap", source: "spreadshop" },
    { file: "06-baby-premium-short-sleeve-bodysuit.webp", label: "Baby Premium short-sleeve bodysuit", alt: "Kids' Azure Constellation Mandala – Glowing Orb Sacred Geometry printed on a Baby Premium short-sleeve bodysuit", source: "spreadshop" },
  ],
  "kids-lilac-sparkle-star-mandala": [
    { file: "01-kids-hoodie.webp", label: "Kids' Hoodie", alt: "Kids' Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Kids' Hoodie", source: "spreadshop" },
    { file: "02-kids-crewneck-sweatshirt.webp", label: "Kids' Crewneck Sweatshirt", alt: "Kids' Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Kids' Crewneck Sweatshirt", source: "spreadshop" },
    { file: "03-kids-premium-t-shirt.webp", label: "Kids' Premium T-Shirt", alt: "Kids' Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Kids' Premium T-Shirt", source: "spreadshop" },
    { file: "04-kids-premium-long-sleeve-t-shirt.webp", label: "Kids' Premium Long Sleeve T-Shirt", alt: "Kids' Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Kids' Premium Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "05-baby-cap.webp", label: "Baby Cap", alt: "Kids' Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Baby Cap", source: "spreadshop" },
    { file: "06-baby-premium-short-sleeve-bodysuit.webp", label: "Baby Premium short-sleeve bodysuit", alt: "Kids' Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Baby Premium short-sleeve bodysuit", source: "spreadshop" },
  ],
  "kids-ice-blue-sparkle-star-mandala": [
    { file: "01-kids-hoodie.webp", label: "Kids' Hoodie", alt: "Kids' Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Kids' Hoodie", source: "spreadshop" },
    { file: "02-kids-crewneck-sweatshirt.webp", label: "Kids' Crewneck Sweatshirt", alt: "Kids' Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Kids' Crewneck Sweatshirt", source: "spreadshop" },
    { file: "03-kids-premium-t-shirt.webp", label: "Kids' Premium T-Shirt", alt: "Kids' Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Kids' Premium T-Shirt", source: "spreadshop" },
    { file: "04-kids-premium-long-sleeve-t-shirt.webp", label: "Kids' Premium Long Sleeve T-Shirt", alt: "Kids' Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Kids' Premium Long Sleeve T-Shirt", source: "spreadshop" },
    { file: "05-baby-cap.webp", label: "Baby Cap", alt: "Kids' Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Baby Cap", source: "spreadshop" },
    { file: "06-toddler-premium-t-shirt.webp", label: "Toddler Premium T-Shirt", alt: "Kids' Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry printed on a Toddler Premium T-Shirt", source: "spreadshop" },
  ],
};

export function getApparelModelShots(slug: string): ApparelModelShot[] {
  return APPAREL_MODEL_SHOTS[slug] ?? [];
}

export function apparelModelSrc(slug: string, file: string): string {
  return `/shop/apparel/models/${slug}/${file}`;
}

const NOT_WORN = /cap|snapback|pillow|mug|bottle|button|tote|drawstring|apron|bib/i;

/** Higher is a stronger on-model tee for cards and galleries. Flat goods score below zero. */
export function apparelShotRank(shot: ApparelModelShot): number {
  const label = shot.label;
  if (NOT_WORN.test(label)) return -1;
  if (/(?:women|men)'s (?:v-neck |ringer )?t-shirt/i.test(label) || /football tee|baseball t-shirt/i.test(label)) return 100;
  if (/t-shirt|tee/i.test(label) && !/kids|toddler|baby/i.test(label)) return 90;
  if (/tank/i.test(label)) return 78;
  if (/hoodie|sweatshirt|long sleeve/i.test(label) && !/kids|toddler|baby/i.test(label)) return 68;
  if (/t-shirt|tee/i.test(label)) return 58;
  if (/hoodie|sweatshirt|long sleeve|bodysuit/i.test(label)) return 48;
  return -1;
}

/** Spreadshop photos of a person wearing the design, strongest tees first. */
export function getWornApparelShots(slug: string): ApparelModelShot[] {
  return getApparelModelShots(slug)
    .map((shot, index) => ({ shot, index, rank: apparelShotRank(shot) }))
    .filter((item) => item.rank >= 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((item) => item.shot);
}

export function getApparelSpotlight(slug: string): ApparelModelShot | undefined {
  return getWornApparelShots(slug)[0];
}

export function getApparelGalleryShots(slug: string, limit = 4): ApparelModelShot[] {
  return getWornApparelShots(slug).slice(0, limit);
}

/**
 * Card image with gender preference. Worn tee when one exists. Designs with no on-model photo
 * (the pearl-wheel pieces) fall back to the first Spreadshop product photo,
 * still not the bare mandala artwork.
 */
export function getApparelCardImage(slug: string, preferGender?: ModelGender): { src: string; alt: string; onModel: boolean; gender: ModelGender } | undefined {
  const wornShots = getWornApparelShots(slug);
  
  // If gender preference specified, try to find a match
  if (preferGender && wornShots.length > 0) {
    const preferred = wornShots.find(shot => detectModelGender(shot.label) === preferGender);
    if (preferred) {
      return { 
        src: apparelModelSrc(slug, preferred.file), 
        alt: preferred.alt, 
        onModel: true,
        gender: preferGender
      };
    }
  }
  
  // Fall back to spotlight (highest ranked)
  const spotlight = wornShots[0];
  if (spotlight) {
    return { 
      src: apparelModelSrc(slug, spotlight.file), 
      alt: spotlight.alt, 
      onModel: true,
      gender: detectModelGender(spotlight.label)
    };
  }
  
  const fallback = getApparelModelShots(slug)[0];
  if (!fallback) return undefined;
  return { 
    src: apparelModelSrc(slug, fallback.file), 
    alt: fallback.alt, 
    onModel: false,
    gender: detectModelGender(fallback.label)
  };
}

/**
 * Get balanced gender mix for card display. Alternates between male and female models
 * where available to show that designs are unisex.
 */
export function getBalancedCardImages(slugs: string[]): Map<string, ReturnType<typeof getApparelCardImage>> {
  const result = new Map<string, ReturnType<typeof getApparelCardImage>>();
  let preferFemale = true; // Start with female to maintain current first card
  
  slugs.forEach(slug => {
    const wornShots = getWornApparelShots(slug);
    const hasFemale = wornShots.some(shot => detectModelGender(shot.label) === "female");
    const hasMale = wornShots.some(shot => detectModelGender(shot.label) === "male");
    
    // If design has both genders, alternate preference
    if (hasFemale && hasMale) {
      const cardImage = getApparelCardImage(slug, preferFemale ? "female" : "male");
      result.set(slug, cardImage);
      preferFemale = !preferFemale; // Alternate for next eligible design
    } else {
      // Use default (highest ranked)
      result.set(slug, getApparelCardImage(slug));
    }
  });
  
  return result;
}
