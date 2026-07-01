import { motion } from "framer-motion";
import Card from "../components/Card";
import { useAdminSettings } from "../context/AdminSettingsContext";

const previewModules = [
  "Preparation Module",
  "Module 1",
  "Module 2",
  "Module 3",
  "Module 4",
  "Module 5",
  "Module 6",
  "Module 7",
  "Module 8",
  "Module 9",
  "Module 10",
  "Module 11",
  "Module 12",
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ResonantDowsingCourseLocalPreview() {
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const mutedClass = isLightTheme ? "text-slate-500" : "text-white/60";
  const cardClass = isLightTheme ? "!bg-white !shadow-[0_14px_34px_rgba(15,23,42,0.08)]" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={classNames("space-y-6", isLightTheme ? "text-slate-900" : "text-white")}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Local Design Preview</p>
        <h2 className="mt-2 text-2xl font-bold">Resonant Dowsing Course Preview</h2>
        <p className={classNames("mt-1 max-w-3xl", mutedClass)}>
          Clerk is bypassed only for this local visual preview. Production/admin data access remains authenticated.
        </p>
      </div>

      <Card className={cardClass}>
        <div className="grid gap-6 xl:grid-cols-[1.3fr,0.7fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent-cyan/10 px-3 py-1 text-xs font-semibold text-accent-cyan">
                One-Time Course
              </span>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Lifetime Access
              </span>
            </div>
            <h3 className="mt-5 text-3xl font-bold">The Resonant Dowsing Course</h3>
            <p className="mt-2 text-lg font-semibold text-accent-cyan">$99 CAD</p>
            <p className={classNames("mt-4 max-w-3xl text-sm leading-7", mutedClass)}>
              A protected dashboard course teaching Resonant Dowsing practices through structured modules, embedded lessons,
              and authorized resources after purchase.
            </p>
          </div>

          <div className={classNames("rounded-3xl border p-5", isLightTheme ? "border-slate-200 bg-slate-50" : "border-glass-border bg-white/5")}>
            <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Course Status</p>
            <p className="mt-2 text-2xl font-bold">13 modules</p>
            <p className={classNames("mt-3 text-sm leading-6", mutedClass)}>
              Placeholder thumbnail and final Module 10 map review remain open TODOs.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className={classNames(cardClass, "h-fit")}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-cyan">Modules</p>
          <div className="mt-4 space-y-2">
            {previewModules.map((module, index) => (
              <div
                key={module}
                className={classNames(
                  "rounded-xl border px-4 py-3 text-sm",
                  index === 0
                    ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                    : isLightTheme
                      ? "border-slate-200 bg-slate-50 text-slate-600"
                      : "border-glass-border bg-white/5 text-white/65",
                )}
              >
                {module}
              </div>
            ))}
          </div>
        </Card>

        <Card className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-cyan">Selected Module</p>
          <h3 className="mt-2 text-2xl font-bold">Preparation Module</h3>
          <p className={classNames("mt-3 text-sm leading-7", mutedClass)}>
            This panel previews the protected lesson layout: description copy, embedded video frame, resource area,
            and next/previous navigation.
          </p>
          <div className={classNames("mt-6 aspect-video rounded-3xl border", isLightTheme ? "border-slate-200 bg-slate-100" : "border-glass-border bg-black/30")}>
            <div className="flex h-full items-center justify-center text-sm text-accent-cyan">YouTube no-cookie embed area</div>
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button type="button" className={classNames("rounded-lg border px-4 py-2 text-sm", isLightTheme ? "border-slate-200 text-slate-500" : "border-white/10 text-white/50")}>
              Previous
            </button>
            <button type="button" className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950">
              Next
            </button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
