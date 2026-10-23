/**
 * Compliance filter for public testimonials.
 *
 * Source of truth: Section 2 ("DO NOT USE IN ADS") of
 * /Users/bradjohnson/Documents/primementor-revamp/prime-mentor-strengths-brief.md.
 * That section names specific customers whose quotes are medical, mental-health
 * or income/financial claims and says to keep them off public pages. Rather than
 * edit the DB seed data (packages/db/src/seed-shop-card-testimonials.ts,
 * seed-shop.ts — out of front-end scope), this filter is applied at render time
 * as defense-in-depth: it blocks by the exact customer name named in the brief,
 * plus a keyword net for anything else that reads as a health/medical/income
 * outcome claim.
 */

// Exact names called out in the brief's DO NOT USE section.
const BLOCKED_NAMES = new Set([
  "jess s.",
  "judith c.",
  "alice r.",
  "yvan.",
  "yvan",
  "nicola bourne",
  "barb salerno",
  "kathy latta",
  "lisa v.",
  "steve power",
  "linda jud",
  "sandra sederstrom",
  "jerry hildebrand",
  "joe",
  "kathryn beck",
  "angel 333",
  "david griffith",
  "rowena dumagan",
  "chris cleary petit",
  "helen davey",
  "patrick wise",
  "conny damman",
  "fred kim",
  "david violette",
  "chyrese soubasis",
  "bai su",
  "alan cohen",
  "carolann smith",
  "jan-christian",
  "alice bacon",
  "jenna",
]);

// Keyword net for anything else that reads as a medical, mental-health, or
// income/financial outcome claim (catches untitled or future testimonials with
// the same pattern, not just the names above).
const BLOCKED_CLAIM =
  /virus|co-?vid|inhaler|glasses|allerg|medication|autis|5-figure|lawsuit|\$\d|surgery|eliminator|\bdogs?\b|\bcats?\b|blindness|headache|migraine|osteoarthritis|arthritis|stiffness eliminator|joint enhancer|cartilage|muscle enhancer|pain eliminator|pain free|pain-free|sinus|wheezy|lungs enhancer|anxiety|brain enhancer|memory game|wound healed|sleep purifier|bladder|herniated disc|back pain|back muscle|weight loss|income came to me|checking before that/i;

export function isCompliantPublicTestimonial(text: string, name?: string): boolean {
  if (name && BLOCKED_NAMES.has(name.trim().toLowerCase())) {
    return false;
  }
  return !BLOCKED_CLAIM.test(text);
}

export function filterCompliantTestimonials<
  T extends { testimonialText?: string; quote?: string; customerName?: string; name?: string },
>(items: T[]): T[] {
  return items.filter((item) =>
    isCompliantPublicTestimonial(item.testimonialText ?? item.quote ?? "", item.customerName ?? item.name));
}
