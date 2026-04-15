import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

interface PromptResponse {
  prompt: string;
  defaultPrompt: string;
  hasOverride: boolean;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function Divin8Prompt() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const { t } = useI18n();
  const isLightTheme = resolvedTheme === "light";

  const [promptValue, setPromptValue] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [hasOverride, setHasOverride] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrompt() {
      try {
        const token = await getToken();
        const response = (await api.get("/divin8/prompt", token)) as PromptResponse;
        if (!cancelled) {
          setPromptValue(response.prompt);
          setDefaultPrompt(response.defaultPrompt);
          setHasOverride(response.hasOverride);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("prompt.loadError"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPrompt();
    return () => {
      cancelled = true;
    };
  }, [getToken, t]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const token = await getToken();
      const response = (await api.post(
        "/divin8/prompt",
        { prompt: promptValue },
        token,
      )) as PromptResponse;

      setPromptValue(response.prompt);
      setDefaultPrompt(response.defaultPrompt);
      setHasOverride(response.hasOverride);
      setMessage(t("prompt.saved"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("prompt.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const token = await getToken();
      const response = (await api.post(
        "/divin8/prompt",
        { reset: true },
        token,
      )) as PromptResponse;

      setPromptValue(response.prompt);
      setDefaultPrompt(response.defaultPrompt);
      setHasOverride(response.hasOverride);
      setMessage(t("prompt.resetDone"));
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t("prompt.resetError"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={classNames("space-y-6", isLightTheme ? "text-slate-900" : "text-white")}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("prompt.title")}</h2>
          <p className={classNames("mt-1 text-sm", isLightTheme ? "text-slate-500" : "text-white/55")}>
            {t("prompt.description")}
          </p>
        </div>
        <Link
          to="/admin/divin8-chat"
          className={classNames(
            "inline-flex rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
            isLightTheme ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/15",
          )}
        >
          {t("prompt.backToChat")}
        </Link>
      </div>

      <div
        className={classNames(
          "rounded-3xl border p-6",
          isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5",
        )}
      >
        {isLoading ? (
          <p className={classNames("text-sm", isLightTheme ? "text-slate-500" : "text-white/55")}>
            {t("prompt.loading")}
          </p>
        ) : (
          <form className="space-y-5" onSubmit={handleSave}>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={classNames(
                  "rounded-full px-3 py-1",
                  hasOverride
                    ? "bg-accent-cyan/15 text-accent-cyan"
                    : isLightTheme
                      ? "bg-slate-100 text-slate-600"
                      : "bg-white/10 text-white/60",
                )}
              >
                {hasOverride ? t("prompt.overrideActive") : t("prompt.default")}
              </span>
              <span className={classNames(isLightTheme ? "text-slate-500" : "text-white/55")}>
                {t("prompt.changesApply")}
              </span>
            </div>

            <div
              className={classNames(
                "rounded-2xl border px-4 py-3 text-sm leading-6",
                isLightTheme ? "border-sky-200 bg-sky-50 text-slate-700" : "border-sky-500/30 bg-sky-500/10 text-sky-100",
              )}
            >
              <p className="font-semibold">{t("prompt.guardrailTitle")}</p>
              <p className="mt-1">{t("prompt.guardrailBody")}</p>
            </div>

            <textarea
              rows={24}
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              className={classNames(
                "w-full rounded-2xl border px-4 py-4 text-sm leading-7 outline-none transition-colors",
                isLightTheme
                  ? "border-slate-200 bg-slate-50 text-slate-900"
                  : "border-white/10 bg-navy-medium text-white",
              )}
            />

            {message ? (
              <div
                className={classNames(
                  "rounded-xl border px-4 py-3 text-sm",
                  isLightTheme ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                )}
              >
                {message}
              </div>
            ) : null}

            {error ? (
              <div
                className={classNames(
                  "rounded-xl border px-4 py-3 text-sm",
                  isLightTheme ? "border-rose-200 bg-rose-50 text-rose-700" : "border-rose-500/30 bg-rose-500/10 text-rose-100",
                )}
              >
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className={classNames(
                  "rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                  isSaving
                    ? "cursor-not-allowed bg-slate-400/30 text-white/50"
                    : "bg-accent-cyan text-slate-950 hover:brightness-110",
                )}
              >
                {t("prompt.save")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleReset}
                className={classNames(
                  "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  isLightTheme ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/15",
                )}
              >
                {t("prompt.reset")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setPromptValue(defaultPrompt)}
                className={classNames(
                  "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  isLightTheme ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/15",
                )}
              >
                {t("prompt.revert")}
              </button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
}
