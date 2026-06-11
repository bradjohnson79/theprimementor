import { classNames } from "@wisdom/ui/divin8-chat";
import { DIVIN8_CATEGORIES } from "@wisdom/utils";

interface Divin8GuideProps {
  isLightTheme: boolean;
}

type GuideSection = {
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

const guideSections: GuideSection[] = [
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
  {
    title: "Need More Help?",
    body: "If you have more questions about using Divin8 Chat, profiles, categories, reports, or image readings, please contact us.",
    span: "full",
  },
];

function PromptExample({ value, isLightTheme }: { value: string; isLightTheme: boolean }) {
  return (
    <div
      className={classNames(
        "whitespace-normal break-words rounded-xl border px-3 py-2.5 text-xs leading-5",
        isLightTheme
          ? "border-cyan-200 bg-cyan-50 text-cyan-900"
          : "border-cyan-300/25 bg-cyan-400/[0.08] text-cyan-50/90",
      )}
      style={{ overflowWrap: "anywhere" }}
    >
      {value}
    </div>
  );
}

function GuideList({
  title,
  items,
  isLightTheme,
}: {
  title: string;
  items: string[];
  isLightTheme: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className={classNames("text-[11px] font-semibold uppercase tracking-[0.16em]", isLightTheme ? "text-slate-400" : "text-white/45")}>
        {title}
      </p>
      <ul className={classNames("space-y-1.5 text-sm leading-6", isLightTheme ? "text-slate-600" : "text-white/65")}>
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-cyan/70" aria-hidden />
            <span className="min-w-0 break-words" style={{ overflowWrap: "anywhere" }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuideSectionCard({
  section,
  isLightTheme,
}: {
  section: GuideSection;
  isLightTheme: boolean;
}) {
  return (
    <article
      className={classNames(
        "rounded-2xl border p-4 shadow-[0_18px_50px_rgba(2,6,23,0.22)]",
        section.span === "full" ? "lg:col-span-2" : "",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.04]",
      )}
    >
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-accent-cyan">{section.title}</h4>
          {section.body ? (
            <p className={classNames("mt-1.5 text-sm leading-6", isLightTheme ? "text-slate-600" : "text-white/65")}>
              {section.body}
            </p>
          ) : null}
        </div>

        {section.formula ? (
          <div
            className={classNames(
              "rounded-xl border px-3 py-2.5 text-sm font-semibold",
              isLightTheme ? "border-amber-200 bg-amber-50 text-amber-900" : "border-amber-300/25 bg-amber-300/[0.08] text-amber-100",
            )}
            style={{ overflowWrap: "anywhere" }}
          >
            {section.formula}
          </div>
        ) : null}

        {section.examples && section.examples.length > 0 ? (
          <div className="space-y-2">
            <p className={classNames("text-[11px] font-semibold uppercase tracking-[0.16em]", isLightTheme ? "text-slate-400" : "text-white/45")}>
              Examples
            </p>
            <div className="grid gap-2">
              {section.examples.map((example) => (
                <PromptExample key={example} value={example} isLightTheme={isLightTheme} />
              ))}
            </div>
          </div>
        ) : null}

        <GuideList title="Tips" items={section.tips ?? []} isLightTheme={isLightTheme} />
        <GuideList title="Supported Uses" items={section.useCases ?? []} isLightTheme={isLightTheme} />

        {section.notes?.map((note) => (
          <p
            key={note}
            className={classNames(
              "rounded-xl border px-3 py-2 text-xs leading-5",
              isLightTheme ? "border-slate-200 bg-slate-50 text-slate-500" : "border-white/10 bg-slate-900/70 text-white/55",
            )}
          >
            {note}
          </p>
        ))}

        {section.safetyNote ? (
          <p
            className={classNames(
              "rounded-xl border px-3 py-2 text-xs leading-5",
              isLightTheme ? "border-rose-200 bg-rose-50 text-rose-800" : "border-rose-300/20 bg-rose-400/[0.08] text-rose-100/85",
            )}
          >
            {section.safetyNote}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function Divin8Guide({ isLightTheme }: Divin8GuideProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-accent-cyan">How to get stronger readings</p>
        <p className={classNames("mt-1 text-xs leading-5", isLightTheme ? "text-slate-500" : "text-white/55")}>
          Use a clear subject, add saved profiles when birth data matters, and choose real category tags when you want a specific reading lens.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {guideSections.map((section) => (
          <GuideSectionCard key={section.title} section={section} isLightTheme={isLightTheme} />
        ))}
      </div>
    </div>
  );
}
