const INSTRUCTION_PATTERNS = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/gi,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/gi,
  /\bsystem\s*:\s*/gi,
  /\bdeveloper\s*:\s*/gi,
  /\bassistant\s*:\s*/gi,
];

export function sanitizeKnowledgeReferenceText(value: string) {
  let sanitized = value.split(String.fromCharCode(0)).join("").trim();
  for (const pattern of INSTRUCTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[removed instruction-like text]");
  }
  return sanitized.replace(/\n{4,}/g, "\n\n\n");
}
