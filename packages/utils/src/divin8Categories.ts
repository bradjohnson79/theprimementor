export const DIVIN8_CATEGORIES = [
  {
    label: "Vedic Astrology",
    tag: "#VedicAstrology",
    requiresImage: false,
    group: "astrology",
  },
  {
    label: "Western Astrology",
    tag: "#WesternAstrology",
    requiresImage: false,
    group: "astrology",
  },
  {
    label: "Chinese Astrology",
    tag: "#ChineseAstrology",
    requiresImage: false,
    group: "astrology",
  },
  {
    label: "Rune Astrology",
    tag: "#RuneAstrology",
    requiresImage: false,
    group: "astrology",
  },
  {
    label: "Numerology",
    tag: "#Numerology",
    requiresImage: false,
    group: "numberSymbol",
  },
  {
    label: "Body Map Numerology",
    tag: "#BodyMapNumerology",
    requiresImage: false,
    group: "numberSymbol",
  },
  {
    label: "Tarot",
    tag: "#Tarot",
    requiresImage: false,
    group: "divination",
  },
  {
    label: "I Ching",
    tag: "#IChing",
    requiresImage: false,
    group: "divination",
  },
  {
    label: "Kaballah",
    tag: "#Kaballah",
    requiresImage: false,
    group: "numberSymbol",
  },
  {
    label: "Human Systems",
    tag: "#HumanSystems",
    requiresImage: false,
    group: "numberSymbol",
  },
  {
    label: "Palmistry",
    tag: "#Palmistry",
    requiresImage: true,
    imageRequirement: "palm",
    group: "imageBased",
  },
  {
    label: "Face Reading",
    tag: "#FaceReading",
    requiresImage: true,
    imageRequirement: "selfie",
    group: "imageBased",
  },
  {
    label: "Energy Body Reading",
    tag: "#EnergyBodyReading",
    requiresImage: true,
    imageRequirement: "selfie",
    group: "imageBased",
  },
  {
    label: "Tea Leaf Reading",
    tag: "#TeaLeafReading",
    requiresImage: true,
    imageRequirement: "teacup",
    group: "imageBased",
  },
] as const;

export type Divin8Category = (typeof DIVIN8_CATEGORIES)[number];
export type Divin8CategoryGroup = Divin8Category["group"];

export const DIVIN8_CATEGORY_GROUPS: Array<{
  id: Divin8CategoryGroup;
  title: string;
}> = [
  { id: "astrology", title: "Astrology" },
  { id: "numberSymbol", title: "Number & Symbol Systems" },
  { id: "divination", title: "Divination Systems" },
  { id: "imageBased", title: "Image-Based Readings" },
];

export interface Divin8CategoryParseResult {
  tags: string[];
  labels: string[];
  requiresImageCategories: Divin8Category[];
}

const CATEGORY_BY_TAG = new Map(DIVIN8_CATEGORIES.map((category) => [category.tag.toLowerCase(), category]));

const CATEGORY_ALIASES: Array<[string, Divin8Category["tag"]]> = [
  ["#Vedic", "#VedicAstrology"],
  ["#Western", "#WesternAstrology"],
  ["#Chinese", "#ChineseAstrology"],
  ["#Rune", "#RuneAstrology"],
  ["#BodyMap", "#BodyMapNumerology"],
  ["#Kabbalah", "#Kaballah"],
  ["#Kabala", "#Kaballah"],
  ["#HumanDesign", "#HumanSystems"],
  ["#HumanSystem", "#HumanSystems"],
  ["#EnergyReading", "#EnergyBodyReading"],
  ["#AuraReading", "#EnergyBodyReading"],
  ["#TeaLeaf", "#TeaLeafReading"],
  ["#TeaLeaves", "#TeaLeafReading"],
  ["#TeaLeavesReading", "#TeaLeafReading"],
  ["#TeaCup", "#TeaLeafReading"],
  ["#TeaCupReading", "#TeaLeafReading"],
  ["#Tasseography", "#TeaLeafReading"],
  ["#Tasseomancy", "#TeaLeafReading"],
];

const CATEGORY_BY_ALIAS = new Map(
  CATEGORY_ALIASES
    .map(([alias, canonicalTag]) => {
      const category = CATEGORY_BY_TAG.get(canonicalTag.toLowerCase());
      return category ? [normalizeTagKey(alias), category] as const : null;
    })
    .filter((entry): entry is readonly [string, Divin8Category] => Boolean(entry)),
);

function normalizeTagKey(value: string) {
  const trimmed = value.trim();
  return (trimmed.startsWith("#") ? trimmed : `#${trimmed}`).toLowerCase();
}

function normalizeSuggestionKey(value: string) {
  return value.replace(/^#/, "").replace(/\s+/g, "").toLowerCase();
}

export function resolveDivin8CategoryTag(rawTag: string): Divin8Category | null {
  const key = normalizeTagKey(rawTag);
  return CATEGORY_BY_TAG.get(key) ?? CATEGORY_BY_ALIAS.get(key) ?? null;
}

export function parseDivin8CategoryTags(message: string): Divin8CategoryParseResult {
  const tokens = message.match(/#[A-Za-z][A-Za-z0-9]*/g) ?? [];
  const tags: string[] = [];
  const labels: string[] = [];
  const requiresImageCategories: Divin8Category[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const category = resolveDivin8CategoryTag(token);
    if (!category || seen.has(category.tag)) {
      continue;
    }
    seen.add(category.tag);
    tags.push(category.tag);
    labels.push(category.label);
    if (category.requiresImage) {
      requiresImageCategories.push(category);
    }
  }

  return { tags, labels, requiresImageCategories };
}

export function extractDivin8CategoryTags(message: string) {
  return parseDivin8CategoryTags(message).tags;
}

export function insertDivin8CategoryTags(currentText: string, tagsToAdd: string[]) {
  const existingTags = new Set(parseDivin8CategoryTags(currentText).tags);
  const canonicalTags = tagsToAdd
    .map((tag) => resolveDivin8CategoryTag(tag)?.tag ?? tag)
    .filter((tag, index, values) => values.indexOf(tag) === index && !existingTags.has(tag));

  if (canonicalTags.length === 0) {
    return currentText;
  }

  const tagText = canonicalTags.join(" ");
  const trimmed = currentText.trim();
  return trimmed ? `${trimmed} ${tagText}` : `${tagText} `;
}

export function filterDivin8CategorySuggestions(query: string, limit = 6) {
  const normalizedQuery = normalizeSuggestionKey(query);
  if (!normalizedQuery) {
    return DIVIN8_CATEGORIES.slice(0, limit);
  }

  const scored = DIVIN8_CATEGORIES
    .map((category) => {
      const candidates = [
        category.tag,
        category.label,
        ...CATEGORY_ALIASES
          .filter(([, canonicalTag]) => canonicalTag === category.tag)
          .map(([alias]) => alias),
      ].map(normalizeSuggestionKey);

      if (candidates.some((candidate) => candidate.startsWith(normalizedQuery))) {
        return { category, score: 0 };
      }
      if (candidates.some((candidate) => candidate.includes(normalizedQuery))) {
        return { category, score: 1 };
      }
      return null;
    })
    .filter((entry): entry is { category: Divin8Category; score: number } => Boolean(entry));

  const bestScore = normalizedQuery.length <= 2 ? scored[0]?.score : undefined;
  return scored
    .filter((entry) => bestScore === undefined || entry.score === bestScore)
    .sort((left, right) => left.score - right.score)
    .map((entry) => entry.category)
    .slice(0, limit);
}

export function getDivin8CategoriesByGroup(group: Divin8CategoryGroup) {
  return DIVIN8_CATEGORIES.filter((category) => category.group === group);
}

export function getDivin8CategoryImageHelperText(category: Divin8Category) {
  if (!category.requiresImage) {
    return null;
  }
  if (category.imageRequirement === "palm") {
    return "Requires palm image";
  }
  if (category.imageRequirement === "teacup") {
    return "Requires tea leaf cup image";
  }
  return "Requires selfie image";
}
