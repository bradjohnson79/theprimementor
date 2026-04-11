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
      "To request a session, sign in first, go to the Sessions page, choose a session type, and complete the intake form. Focus and Mentoring sessions collect availability, while Regeneration does not require a live time selection up front.",
    links: [
      { label: "Go to Sessions", href: "/sessions" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
  {
    id: "sessions",
    keywords: ["types", "difference", "focus", "mentoring", "regeneration", "sessions"],
    answer:
      "There are three session types. Focus Session is a shorter guided session for a specific area of clarity or decision-making. Mentoring Session is a deeper live session for strategy and longer-form support. Regeneration Session is an offline regeneration request with no live date or time selection required up front.",
    links: [{ label: "View Sessions", href: "/sessions" }],
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
