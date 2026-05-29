import type { Divin8KnowledgeOverrideResponse } from "@wisdom/utils";

export function applyKnowledgeOverridesToText(text: string, overrides: Divin8KnowledgeOverrideResponse[]) {
  let output = text;
  for (const override of overrides) {
    for (const [from, to] of Object.entries(override.replacements)) {
      output = output.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), to);
    }
  }
  return output;
}
