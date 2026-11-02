/**
 * Apparel Shop Data
 * 
 * Generated from apparel-manifest.json
 * All 17 adult designs linking to Spreadshop for purchase.
 * 
 * IMPORTANT: Never display internalName in UI, alt text, meta tags, or URLs.
 * Drop the "DRAFT (pending Brad's review):" prefix from descriptions in the UI.
 */

export const APPAREL_CONFIG = {
  shopName: "The Prime Mentor Shop", // PLACEHOLDER - awaiting final shop name
  shopBaseUrl: "https://healing-code-shop.myspreadshop.com",
  showPrices: false, // Prices are unverified - keep OFF
} as const;

export interface ProductCode {
  code: string;
  name: string;
}

export const PRODUCT_CODES: Record<string, string> = {
  WPT: "Women's Premium T-Shirt",
  MPT: "Men's Premium T-Shirt",
  WTK: "Women's Premium Tank Top",
  WLS: "Women's Long Sleeve",
  RU: "Women's Roll-Up Sleeve T-Shirt",
  HD: "Women's Hoodie",
  ST: "Sticker",
  PHONE: "Phone Case",
} as const;

export const FROM_PRICES_CAD_UNVERIFIED: Record<string, number> = {
  WPT: 35.49,
  MPT: 35.49,
  WTK: 35.49,
  WLS: 38.99,
  RU: 30.99,
  HD: 51.49,
  ST: 4.29,
} as const;

export interface ApparelTopic {
  slug: string;
  name: string;
}

export const APPAREL_TOPICS: ApparelTopic[] = [
  { slug: "best-sellers", name: "Best Sellers" },
  { slug: "mandalas", name: "Sacred Geometry Mandalas" },
  { slug: "dragon-phoenix", name: "Dragon & Phoenix" },
  { slug: "mudra-flower-of-life", name: "Mudra & Flower of Life" },
];

export interface ApparelDesign {
  slug: string;
  designId: number;
  title: string;
  description: string;
  tags: string[];
  enableFirst: string[]; // Product codes to show first
  spreadshopUrl: string;
  featuredRank: number;
  topics: string[];
  image: string; // SEO-friendly filename
  draft: boolean; // True if description has DRAFT prefix
}

export const APPAREL_DESIGNS: ApparelDesign[] = [
  {
    slug: "gold-rosette-mandala",
    designId: 1034302442,
    title: "Gold Rosette Mandala – Sacred Geometry Overlapping Circles",
    description: "A gold spirograph rosette of overlapping circles around a white-hot glowing centre, with a few small sparkles. A bright sacred-geometry mandala that stands out on dark fabric.",
    tags: [
      "sacred geometry",
      "mandala",
      "gold mandala",
      "rosette",
      "overlapping circles",
      "spirograph",
      "geometric art",
      "meditation",
      "spiritual art",
      "yoga shirt",
    ],
    enableFirst: ["WPT", "MPT", "WTK", "WLS", "RU", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/youth+body+round+healingcodeshopcom-A5fa88c4a27d613000ecd175b",
    featuredRank: 1,
    topics: ["best-sellers", "mandalas"],
    image: "gold-rosette-mandala.webp",
    draft: false,
  },
  {
    slug: "wayshower-rainbow-jnana-mudra",
    designId: 1034824553,
    title: "Wayshower – Rainbow Jnana Mudra on Flower of Life",
    description: "A rainbow-striped hand forms the jnana mudra, with thumb and index finger meeting at a glowing point. It sits over a magenta-to-cyan Flower of Life hexagon.",
    tags: [
      "wayshower",
      "jnana mudra",
      "mudra",
      "flower of life",
      "rainbow hand",
      "sacred geometry",
      "meditation",
      "yoga shirt",
      "spiritual art",
      "hand gesture",
    ],
    enableFirst: ["WPT", "MPT", "WTK", "WLS", "RU", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/wayshower+healingcodeshopcom-A5fc03ff0cee9144094eec7a1",
    featuredRank: 2,
    topics: ["best-sellers", "mudra-flower-of-life"],
    image: "wayshower-rainbow-jnana-mudra.webp",
    draft: false,
  },
  {
    slug: "magenta-constellation-mandala",
    designId: 1031364714,
    title: "Magenta Constellation Mandala – Glowing Orb Sacred Geometry",
    description: "A vivid magenta web of straight-line polygons forms a lace-like rosette, ringed by nine glowing orbs around a luminous centre.",
    tags: [
      "magenta mandala",
      "pink mandala",
      "sacred geometry",
      "constellation",
      "glowing orbs",
      "polygon art",
      "geometric mandala",
      "meditation",
      "spiritual art",
      "yoga shirt",
    ],
    enableFirst: ["WPT", "WTK", "WLS", "RU", "MPT", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/detoxifier+round+pink+healingcodecardscom-A5f18cbc91cbf3a0e13c9580d",
    featuredRank: 3,
    topics: ["best-sellers", "mandalas"],
    image: "magenta-constellation-mandala.webp",
    draft: false,
  },
  {
    slug: "pink-bloom-mandala",
    designId: 1031364074,
    title: "Pink Bloom Mandala – Lace Ring Sacred Geometry",
    description: "A hot-pink lace ring of looping polygons blooms around an open dark centre with a fine spoked sunburst.",
    tags: [
      "pink mandala",
      "lace mandala",
      "bloom",
      "sacred geometry",
      "sunburst",
      "geometric art",
      "mandala art",
      "meditation",
      "spiritual art",
      "yoga shirt",
    ],
    enableFirst: ["WPT", "WTK", "WLS", "RU", "MPT", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/rejuvenator+round+pink+healingcodeshopcom-A5f18c2b220517643284149a4",
    featuredRank: 4,
    topics: ["best-sellers", "mandalas"],
    image: "pink-bloom-mandala.webp",
    draft: false,
  },
  {
    slug: "sky-constellation-star-ray-mandala",
    designId: 1031364440,
    title: "Sky Constellation Star-Ray Mandala – Blue Sacred Geometry",
    description: "Cyan rays radiate from a small dotted star, crossed by a ring of nine large glowing orbs. A clean, celestial mandala.",
    tags: [
      "blue mandala",
      "star rays",
      "constellation",
      "glowing orbs",
      "sacred geometry",
      "celestial art",
      "cosmic",
      "geometric mandala",
      "meditation",
      "spiritual art",
    ],
    enableFirst: ["MPT", "WPT", "WTK", "WLS", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/detoxifier+edge+blue+healingcodeshopcom-A5f18c8a2f9376440be8ca4d1",
    featuredRank: 5,
    topics: ["best-sellers", "mandalas"],
    image: "sky-constellation-star-ray-mandala.webp",
    draft: false,
  },
  {
    slug: "ice-blue-sparkle-star-mandala",
    designId: 1031363567,
    title: "Ice Blue Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry",
    description: "Jagged zig-zag star points burst outward from a spoked centre, scattered with tiny white sparkles, in pale ice blue.",
    tags: [
      "star mandala",
      "sparkle",
      "ice blue",
      "star rays",
      "sacred geometry",
      "celestial art",
      "geometric mandala",
      "cosmic",
      "spiritual art",
      "meditation",
    ],
    enableFirst: ["WPT", "MPT", "WTK", "WLS", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/rejuvenator+edge+blue+healingcodeshopcom-A5f18b9aff9376440be42eb8a",
    featuredRank: 6,
    topics: ["best-sellers", "mandalas"],
    image: "ice-blue-sparkle-star-mandala.webp",
    draft: false,
  },
  {
    slug: "lilac-sparkle-star-mandala",
    designId: 1031363752,
    title: "Lilac Sparkle Star Mandala – Jagged Star-Ray Sacred Geometry",
    description: "Jagged zig-zag star points burst outward from a spoked centre, scattered with tiny white sparkles, in lilac.",
    tags: [
      "star mandala",
      "sparkle",
      "lilac",
      "lavender",
      "star rays",
      "sacred geometry",
      "celestial art",
      "geometric mandala",
      "cosmic",
      "spiritual art",
    ],
    enableFirst: ["WPT", "MPT", "WTK", "WLS", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/rejuvenator+edge+pink+healingcodeshopcom-A5f18bb7520517643280f10a3",
    featuredRank: 7,
    topics: ["mandalas"],
    image: "lilac-sparkle-star-mandala.webp",
    draft: false,
  },
  {
    slug: "aqua-lattice-mandala",
    designId: 1031528213,
    title: "Aqua Lattice Mandala – Overlapping Circle Sacred Geometry",
    description: "A smooth weave of overlapping circles in aqua frames an inner ring of seven glowing orbs and a small cog-like centre.",
    tags: [
      "aqua mandala",
      "lattice",
      "overlapping circles",
      "circle weave",
      "sacred geometry",
      "glowing orbs",
      "geometric art",
      "yoga shirt",
      "meditation",
      "spiritual art",
    ],
    enableFirst: ["WTK", "WPT", "MPT", "RU", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/strengthener+blue+healingcodeshopcom-A5f21113720517660341a7a01",
    featuredRank: 8,
    topics: ["mandalas"],
    image: "aqua-lattice-mandala.webp",
    draft: false,
  },
  {
    slug: "rose-lattice-mandala",
    designId: 1031528356,
    title: "Rose Lattice Mandala – Overlapping Circle Sacred Geometry",
    description: "A smooth weave of overlapping circles in soft rose frames an inner ring of seven glowing orbs and a small cog-like centre.",
    tags: [
      "rose mandala",
      "lattice",
      "overlapping circles",
      "circle weave",
      "sacred geometry",
      "glowing orbs",
      "geometric art",
      "yoga shirt",
      "meditation",
      "spiritual art",
    ],
    enableFirst: ["WTK", "WPT", "MPT", "RU", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/strengthener+pink+healingcodeshopcom-A5f21123af9376458d1b63aa3",
    featuredRank: 9,
    topics: ["mandalas"],
    image: "rose-lattice-mandala.webp",
    draft: false,
  },
  {
    slug: "blue-pearl-wheel-mandala",
    designId: 1031498847,
    title: "Blue Pearl Wheel Mandala – Sacred Geometry Circle",
    description: "A looped rosette wheel in cyan set with a ring of about 24 glowing pearls, around a dotted inner circle and a spoked sunburst centre.",
    tags: [
      "pearl wheel",
      "mandala",
      "blue mandala",
      "sacred geometry",
      "beaded circle",
      "sunburst",
      "geometric art",
      "phone case",
      "spiritual art",
      "meditation",
    ],
    enableFirst: ["WPT", "MPT", "PHONE", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/charger+blue+healingcodeshopcom-A5f1fa34ff9376458d1b1c549",
    featuredRank: 10,
    topics: ["mandalas"],
    image: "blue-pearl-wheel-mandala.webp",
    draft: false,
  },
  {
    slug: "pink-pearl-wheel-mandala",
    designId: 1031499383,
    title: "Pink Pearl Wheel Mandala – Sacred Geometry Circle",
    description: "A looped rosette wheel in hot pink set with a ring of about 24 glowing pearls, around a dotted inner circle and a spoked sunburst centre.",
    tags: [
      "pearl wheel",
      "mandala",
      "pink mandala",
      "sacred geometry",
      "beaded circle",
      "sunburst",
      "geometric art",
      "phone case",
      "spiritual art",
      "meditation",
    ],
    enableFirst: ["WPT", "MPT", "PHONE", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/charger+pink+healingcodeshopcom-A5f1fa762f9376458d1b82d63",
    featuredRank: 11,
    topics: ["mandalas"],
    image: "pink-pearl-wheel-mandala.webp",
    draft: false,
  },
  {
    slug: "dragon-dimension-blue-chrome-dragon",
    designId: 1046725654,
    title: "Dragon Dimension – Blue Chrome Tribal Dragon with Spiral Vortex",
    description: "A blue-to-gunmetal chrome tribal dragon coils in an S-curve with open fanged jaws, beside a spiked spiral vortex.",
    tags: [
      "dragon",
      "tribal dragon",
      "chrome dragon",
      "blue dragon",
      "dragon art",
      "spiral vortex",
      "fantasy art",
      "dragon shirt",
      "tattoo style",
      "mythical creature",
    ],
    enableFirst: ["MPT", "HD", "WPT", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/dragon+detoxifier+dimension+series-A6316aa485e3f02040717d401",
    featuredRank: 12,
    topics: ["dragon-phoenix"],
    image: "dragon-dimension-blue-chrome-dragon.webp",
    draft: false,
  },
  {
    slug: "fire-phoenix-tribal-phoenix",
    designId: 1047005098,
    title: "Fire Phoenix – Tribal Phoenix with Twin Spirals",
    description: "An orange-to-red tribal phoenix rises with raised wings, twin spirals on its body and a double-helix flame tail.",
    tags: [
      "phoenix",
      "fire phoenix",
      "tribal phoenix",
      "firebird",
      "phoenix art",
      "flame",
      "spiral",
      "mythical bird",
      "fantasy art",
      "tattoo style",
    ],
    enableFirst: ["MPT", "WPT", "HD", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/phoenix+rejuvenator-A6330dccd59712733b5784b9f",
    featuredRank: 13,
    topics: ["dragon-phoenix"],
    image: "fire-phoenix-tribal-phoenix.webp",
    draft: false,
  },
  {
    slug: "azure-constellation-mandala",
    designId: 1031364228,
    title: "Azure Constellation Mandala – Glowing Orb Sacred Geometry",
    description: "An azure web of straight-line polygons forms a lace-like rosette, ringed by glowing orbs around a luminous centre.",
    tags: [
      "blue mandala",
      "azure",
      "sacred geometry",
      "constellation",
      "glowing orbs",
      "polygon art",
      "geometric mandala",
      "meditation",
      "spiritual art",
    ],
    enableFirst: ["WPT", "MPT", "WTK", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/detoxifier+round+blue+healing+code+shop-A5f18c41b1cbf3a0e13baa399",
    featuredRank: 14,
    topics: ["mandalas"],
    image: "azure-constellation-mandala.webp",
    draft: true, // DRAFT (pending Brad's review)
  },
  {
    slug: "sky-bloom-mandala",
    designId: 1031364111,
    title: "Sky Bloom Mandala – Lace Ring Sacred Geometry",
    description: "A sky-blue lace ring of looping polygons blooms around an open dark centre with a fine spoked sunburst.",
    tags: [
      "blue mandala",
      "lace mandala",
      "bloom",
      "sacred geometry",
      "sunburst",
      "geometric art",
      "meditation",
      "spiritual art",
    ],
    enableFirst: ["WPT", "MPT", "WTK", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/rejuvenator+round+blue+healingcodeshopcom-A5f18c18ff9376440be7c85c6",
    featuredRank: 15,
    topics: ["mandalas"],
    image: "sky-bloom-mandala.webp",
    draft: true, // DRAFT (pending Brad's review)
  },
  {
    slug: "gold-star-ray-mandala",
    designId: 1034302570,
    title: "Gold Star-Ray Mandala – Eight-Point Sacred Geometry",
    description: "A gold eight-point star-ray mandala in sacred-geometry style.",
    tags: [
      "gold mandala",
      "star rays",
      "eight-point star",
      "sacred geometry",
      "geometric mandala",
      "meditation",
      "spiritual art",
    ],
    enableFirst: ["WPT", "MPT", "WTK", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/youth+body+edge+healingcodeshopcom-A5fa88c1888a2f447202cb4c2",
    featuredRank: 16,
    topics: ["mandalas"],
    image: "gold-star-ray-mandala.webp",
    draft: true, // DRAFT (pending Brad's review)
  },
  {
    slug: "rose-constellation-star-ray-mandala",
    designId: 1031364095,
    title: "Rose Constellation Star-Ray Mandala – Pink Sacred Geometry",
    description: "Soft pink rays radiate from a small dotted star, crossed by a ring of nine large glowing orbs. A clean, celestial mandala.",
    tags: [
      "pink mandala",
      "star rays",
      "constellation",
      "glowing orbs",
      "sacred geometry",
      "celestial art",
      "cosmic",
      "geometric mandala",
      "meditation",
      "spiritual art",
    ],
    enableFirst: ["MPT", "WPT", "WTK", "WLS", "ST"],
    spreadshopUrl: "https://healing-code-shop.myspreadshop.com/detoxifier+edge+pink+healingcodeshopcom-A5f18c51d205176432845b7bf",
    featuredRank: 17,
    topics: ["mandalas"],
    image: "rose-constellation-star-ray-mandala.webp",
    draft: false,
  },
];

/**
 * Build a Spreadshop URL with UTM parameters for tracking
 */
export function buildSpreadshopUrl(design: ApparelDesign): string {
  const url = new URL(design.spreadshopUrl);
  url.searchParams.set("utm_source", "theprimementor");
  url.searchParams.set("utm_medium", "shop");
  url.searchParams.set("utm_campaign", "apparel");
  url.searchParams.set("utm_content", design.slug);
  return url.toString();
}

/**
 * Get the image path for a design
 */
export function getApparelImagePath(design: ApparelDesign): string {
  return `/shop/apparel/${design.image}`;
}

/**
 * Get designs by topic
 */
export function getDesignsByTopic(topicSlug: string): ApparelDesign[] {
  return APPAREL_DESIGNS.filter((design) =>
    design.topics.includes(topicSlug)
  ).sort((a, b) => a.featuredRank - b.featuredRank);
}

/**
 * Get related designs (same topic, excluding current)
 */
export function getRelatedDesigns(design: ApparelDesign, limit = 3): ApparelDesign[] {
  const topic = design.topics[0];
  if (!topic) return [];
  
  return APPAREL_DESIGNS
    .filter((d) => d.slug !== design.slug && d.topics.includes(topic))
    .sort((a, b) => a.featuredRank - b.featuredRank)
    .slice(0, limit);
}

/**
 * Get design by slug
 */
export function getDesignBySlug(slug: string): ApparelDesign | undefined {
  return APPAREL_DESIGNS.find((design) => design.slug === slug);
}
