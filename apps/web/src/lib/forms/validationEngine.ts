export type ValidationErrors = Record<string, string>;

export interface ValidationResult {
  errors: ValidationErrors;
  isValid: boolean;
}

export const FRIENDLY_CONTINUE_MESSAGE = "Just one more step here before we continue.";
export const FRIENDLY_HELPER_MESSAGE = "You're doing great. Just follow the steps.";
export const OPTIONAL_FIELD_MESSAGE = "Optional - include if relevant";

export function createValidationResult(errors: ValidationErrors = {}): ValidationResult {
  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

export function emptyValidationResult(): ValidationResult {
  return createValidationResult();
}

export function pickValidationErrors(
  errors: ValidationErrors,
  keys: string[],
): ValidationErrors {
  return keys.reduce<ValidationErrors>((next, key) => {
    if (errors[key]) {
      next[key] = errors[key];
    }
    return next;
  }, {});
}

export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
  return createValidationResult(
    results.reduce<ValidationErrors>((next, result) => ({ ...next, ...result.errors }), {}),
  );
}

export function hasValidationErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function requiredStepMessage(label?: string): string {
  return label
    ? `${label} helps us keep moving smoothly. ${FRIENDLY_CONTINUE_MESSAGE}`
    : FRIENDLY_CONTINUE_MESSAGE;
}
