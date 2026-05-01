import { useCallback, useState } from "react";
import { validatePromoCode, type PromoValidationContext, type PromoValidationResult } from "../lib/promoCodes";

export function usePromoCode(getToken: () => Promise<string | null>) {
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<PromoValidationResult | null>(null);

  const clear = useCallback(() => {
    setValidation(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setCode("");
    setValidation(null);
    setError(null);
    setApplying(false);
  }, []);

  const apply = useCallback(async (context: PromoValidationContext) => {
    setApplying(true);
    setError(null);
    try {
      const token = await getToken();
      const result = await validatePromoCode(code, context, token);
      if (!result.valid) {
        setValidation(null);
        setError(result.message ?? "This promo code is not valid.");
        return null;
      }
      setValidation(result);
      return result;
    } catch (err) {
      setValidation(null);
      setError(err instanceof Error ? err.message : "Unable to validate promo code.");
      return null;
    } finally {
      setApplying(false);
    }
  }, [code, getToken]);

  return {
    code,
    setCode,
    applying,
    error,
    validation,
    apply,
    clear,
    reset,
  };
}
