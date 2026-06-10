import type { SupportKnowledgeItem, SupportQuickAction } from "./supportTypes";

export const supportQuickActions: SupportQuickAction[] = [
  {
    label: "How do I book a session?",
    prompt: "How do I book a session?",
  },
  {
    label: "What's the difference between sessions?",
    prompt: "What's the difference between sessions?",
  },
  {
    label: "How do reports work?",
    prompt: "How do reports work?",
  },
  {
    label: "Do I need an account?",
    prompt: "Do I need an account?",
  },
];

export const supportKnowledge: SupportKnowledgeItem[] = [
  {
    id: "booking",
    keywords: ["book", "booking", "session", "availability", "purchase"],
    answer:
      "To request Q&A or Mentoring sessions, choose your path from the Guided Private Sessions card, sign in or create your account if prompted, and complete the intake form. The Regeneration Monthly Package starts its own recurring checkout flow for $99 CAD/month and includes one 15-minute Zoom consultation each month. Cancel anytime.",
    links: [
      { label: "Go to Sessions", href: "/sessions" },
      { label: "View Regeneration Package", href: "/sessions/regeneration" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
  {
    id: "sessions",
    keywords: ["types", "difference", "qa", "questions", "mentoring", "regeneration", "sessions"],
    answer:
      "There are three core service paths. Q&A Session is an open format for direct questions and fast clarity. Mentoring Session is a deeper guided session for blueprint insight, goal alignment, and longer-form support. The Regeneration Monthly Package is a $99 CAD/month subscription that includes one 15-minute Zoom consultation with Brad Johnson, safeguarded manifestation work, offline anti-goal clearing, personalized MP3 clearing exercises, and 30-day priority email support. It can be used for health and wellness, personal debt elimination, financial abundance, career improvement, relationships, household improvement, personal development, selling homes/assets, and custom personal manifestation requests. Cancel anytime.",
    links: [
      { label: "View Sessions", href: "/sessions" },
      { label: "View Regeneration Package", href: "/sessions/regeneration" },
    ],
  },
  {
    id: "reports",
    keywords: ["report", "reports", "intro", "deep dive", "initiate", "tier"],
    answer:
      "Reports come in three tiers: Introductory, Deep Dive, and Initiate. The Reports flow lets you choose a tier, complete the intake, and submit your request. The page states reports are delivered within 48 hours.",
    links: [{ label: "Go to Reports", href: "/reports" }],
  },
  {
    id: "account",
    keywords: ["account", "sign in", "sign-in", "login", "log in", "member"],
    answer:
      "Yes. Sessions and reports are protected routes in the current site flow, so you will be prompted to sign in before accessing them.",
    links: [{ label: "Sign in", href: "/sign-in" }],
  },
  {
    id: "contact",
    keywords: ["help", "contact", "support"],
    answer:
      "If you still need help after checking sessions or reports, you can use the contact page for direct support.",
    links: [{ label: "Contact Support", href: "/contact" }],
  },
];

export const supportFallbackAnswer =
  "I can help with sessions, reports, or booking. What would you like to know?";
