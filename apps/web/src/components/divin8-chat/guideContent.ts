import { DIVIN8_CATEGORIES } from "@wisdom/utils";

export type GuideSection = {
  title: string;
  body?: string;
  formula?: string;
  examples?: string[];
  tips?: string[];
  notes?: string[];
  useCases?: string[];
  safetyNote?: string;
  span?: "default" | "full";
};

function categoryTag(label: string) {
  return DIVIN8_CATEGORIES.find((category) => category.label === label)?.tag ?? `#${label.replace(/\s+/g, "")}`;
}

const categoryExamples = [
  categoryTag("Vedic Astrology"),
  categoryTag("Numerology"),
  categoryTag("Tarot"),
  categoryTag("Palmistry"),
  categoryTag("Face Reading"),
  categoryTag("Energy Body Reading"),
  categoryTag("Tea Leaf Reading"),
];

export const guideSections: GuideSection[] = [
  {
    title: "Quick Start",
    body: "Divin8 Chat works best when you give it a clear subject, choose the right metaphysical category, and include a saved profile when the reading is personal.",
    examples: [
      "What does my chart show about my career direction this year?",
      "Using my profile, look into relationship patterns and emotional compatibility.",
      "Give me a synthesis reading on finances, career, and spiritual purpose.",
    ],
  },
  {
    title: "Using Profiles",
    body: "Saved profiles let Divin8 remember birth details and other important client information during a conversation. Use @ProfileName in your prompt when you want the reading to focus on that person.",
    examples: [
      "@BradJohnson What does my chart show about my current career direction?",
      "@ClientName Look at their relationship patterns and current growth themes.",
    ],
    notes: [
      "Once a profile is added to a conversation, Divin8 should continue remembering that profile during follow-up messages in the same chat.",
    ],
  },
  {
    title: "Comparing Two Profiles",
    body: "You can include two profiles when you want relationship, compatibility, family, business, friendship, or partnership insight.",
    examples: [
      "@BradJohnson @ClientName Compare our relationship compatibility and communication patterns.",
      "@PersonOne @PersonTwo What are the strengths and challenges of this business partnership?",
      "@PartnerOne @PartnerTwo Look at love, emotional rhythm, and long-term compatibility.",
    ],
    notes: [
      "When two profiles are detected, Divin8 should treat the prompt as a comparison reading unless the user clearly requests separate individual readings.",
    ],
  },
  {
    title: "Using Categories",
    body: "Categories help Divin8 focus the reading. Open the Categories menu with the document icon near the chat input, or type # to quickly search and insert a category.",
    examples: [
      ...categoryExamples,
      "@BradJohnson #VedicAstrology Look into my career direction and financial timing over the next 6 months.",
      "@ClientName #Numerology What are their strongest patterns around relationships, communication, and personal growth?",
      "@PersonOne @PersonTwo #Tarot Give a comparison reading on emotional compatibility and long-term partnership potential.",
    ],
    notes: [
      "Category names may appear as metaphysical systems or reading lenses depending on the current Divin8 setup. Type # in the chat box to see the available options.",
      "Categories act as structured reading lenses. They do not replace the user's actual question.",
    ],
  },
  {
    title: "Best Prompt Formula",
    body: "For the strongest reading, combine a profile, one or more categories, and a clear subject.",
    formula: "@ProfileName + #Category + your specific question",
    examples: [
      "@BradJohnson #VedicAstrology What is the strongest direction for my work over the next 6 months?",
      "@ClientName #Numerology Where are their strongest financial growth patterns and current blocks?",
      "@BradJohnson @PartnerName #Tarot Look at emotional compatibility, communication, and long-term relationship rhythm.",
      "@ClientName #ChineseAstrology What should they pay attention to over the next 90 days?",
    ],
    notes: [
      "The clearer the subject, the more focused the reading. \"Tell me about my life\" is broad. \"Look at my career direction and money patterns for the next 6 months\" is much stronger.",
    ],
    span: "full",
  },
  {
    title: "Image Uploads",
    body: "You can upload JPG, PNG, or WEBP images for symbolic and intuitive interpretation. Divin8 supports up to two images at a time.",
    useCases: [
      "Face reading / physiognomy",
      "Palm reading",
      "Body aura or energy scan",
      "Symbol interpretation",
      "Object or artwork symbolism",
      "Spiritual impressions from an image",
    ],
    examples: [
      "Upload a palm image and ask: \"Read the main palm lines and energetic themes shown here.\"",
      "Upload a face image and ask: \"Give me a symbolic physiognomy reading focused on personality, life direction, and emotional patterning.\"",
      "Upload a symbol image and ask: \"Interpret the metaphysical meaning and energetic impression of this symbol.\"",
    ],
    safetyNote: "Image readings are interpreted symbolically, energetically, and reflectively. They are not medical, legal, or diagnostic readings.",
    span: "full",
  },
  {
    title: "Prompt Tips",
    tips: [
      "Be specific about the life area you want explored.",
      "Use a saved profile when the reading depends on birth data.",
      "Use categories when you want the answer focused.",
      "Ask for synthesis when you want multiple systems blended together.",
      "Ask follow-up questions in the same conversation to go deeper.",
      "For timing questions, mention the date range you want examined.",
    ],
    examples: [
      "Give me a synthesis reading using Vedic, Numerology, and Tarot.",
      "Focus this reading only on career and finances.",
      "Look at June and July 2026 only.",
    ],
  },
  {
    title: "Synthesis Readings",
    body: "Ask for synthesis when you want Divin8 to combine multiple metaphysical systems into one integrated interpretation.",
    examples: [
      "@ProfileName Give me a synthesis reading on career, money, and spiritual purpose.",
      "@ProfileOne @ProfileTwo Give me a synthesis compatibility reading using astrology, numerology, and tarot.",
    ],
    notes: [
      "Synthesis readings are best for deeper questions. For simple questions, one system may be enough.",
    ],
  },
];

export const contactGuideSection: GuideSection = {
  title: "Need More Help?",
  body: "If you have more questions about using Divin8 Chat, profiles, categories, reports, or image readings, please contact us.",
  span: "full",
};
