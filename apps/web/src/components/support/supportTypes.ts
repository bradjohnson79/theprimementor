export type AllowedSupportRoute = "/sessions" | "/reports" | "/contact" | "/sign-in";

export interface SupportLink {
  label: string;
  href: AllowedSupportRoute;
}

export interface SupportKnowledgeItem {
  id: string;
  keywords: string[];
  answer: string;
  links?: SupportLink[];
}

export interface SupportResponse {
  answer: string;
  links?: SupportLink[];
}

export interface SupportMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  links?: SupportLink[];
}

export interface SupportQuickAction {
  label: string;
  prompt: string;
}
