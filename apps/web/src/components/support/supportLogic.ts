import { supportFallbackAnswer, supportKnowledge } from "./supportKnowledge";
import type { SupportResponse } from "./supportTypes";

export function getResponse(input: string): SupportResponse {
  const normalized = input.trim().toLowerCase();

  for (const item of supportKnowledge) {
    if (item.keywords.some((keyword) => normalized.includes(keyword))) {
      return {
        answer: item.answer,
        links: item.links,
      };
    }
  }

  return {
    answer: supportFallbackAnswer,
  };
}
