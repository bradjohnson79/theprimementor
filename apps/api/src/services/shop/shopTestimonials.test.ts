import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterActiveTestimonials,
  normalizeProductSlugs,
  serializePublicTestimonial,
  sortTestimonials,
} from "./shopTestimonials.js";

describe("shop testimonials helpers", () => {
  it("filters inactive testimonials out of the public set", () => {
    const rows = [
      { id: "a", is_active: true },
      { id: "b", is_active: false },
    ];
    assert.deepEqual(filterActiveTestimonials(rows).map((row) => row.id), ["a"]);
  });

  it("sorts by sort_order then created_at", () => {
    const rows = [
      { id: "c", sort_order: 2, created_at: new Date("2026-01-02") },
      { id: "a", sort_order: 1, created_at: new Date("2026-01-03") },
      { id: "b", sort_order: 1, created_at: new Date("2026-01-01") },
    ];
    assert.deepEqual(sortTestimonials(rows).map((row) => row.id), ["b", "a", "c"]);
  });

  it("lets one testimonial resolve to multiple product slugs without duplication", () => {
    const slugs = normalizeProductSlugs(
      {
        productIds: ["body-id", "mind-id"],
        productSlugs: ["healing-code-cards-energy-deck", "healing-code-cards-body-deck"],
      },
      [
        { id: "body-id", slug: "healing-code-cards-body-deck" },
        { id: "mind-id", slug: "healing-code-cards-mind-deck" },
      ],
    );
    assert.deepEqual(slugs.sort(), [
      "healing-code-cards-body-deck",
      "healing-code-cards-energy-deck",
      "healing-code-cards-mind-deck",
    ]);
  });

  it("exposes only public testimonial fields", () => {
    const publicFields = serializePublicTestimonial({
      id: "t1",
      customer_name: "Barb Salerno",
      location: "Los Angeles, CA",
      title: "Body & Mind Deck Experience",
      testimonial_text: "Original customer wording.",
      source_label: "AetherX customer testimonial",
      context_label: "Originally shared regarding the Body & Mind Decks",
      is_active: true,
      sort_order: 1,
      created_at: new Date("2026-08-20"),
      updated_at: new Date("2026-08-20"),
    });
    assert.deepEqual(Object.keys(publicFields).sort(), [
      "contextLabel",
      "customerName",
      "id",
      "location",
      "sortOrder",
      "testimonialText",
      "title",
    ]);
    assert.equal("sourceLabel" in publicFields, false);
    assert.equal("isActive" in publicFields, false);
    assert.equal("productIds" in publicFields, false);
  });
});
