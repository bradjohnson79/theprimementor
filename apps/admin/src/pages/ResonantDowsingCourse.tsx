import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Card from "../components/Card";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { api } from "../lib/api";

interface CourseModule {
  id: string;
  order: number;
  title: string;
  description: string[];
  lessons: Array<{ id: string; title: string; youtubeEmbedUrl: string }>;
  resources: Array<{ id: string; title: string; url: string }>;
}

interface AdminCourseResponse {
  course: {
    title: string;
    description: string[];
    price: { label: string };
    moduleCount: number;
    modules: CourseModule[];
    unresolvedTodos?: string[];
  };
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ResonantDowsingCourse() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [data, setData] = useState<AdminCourseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const response = await api.get("/admin/courses/resonant-dowsing/content", token) as AdminCourseResponse;
        if (!cancelled) {
          setData(response);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Course preview could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCourse();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const containerClass = isLightTheme ? "text-slate-900" : "text-white";
  const mutedClass = isLightTheme ? "text-slate-500" : "text-white/60";
  const cardClass = isLightTheme ? "!bg-white !shadow-[0_14px_34px_rgba(15,23,42,0.08)]" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={classNames("space-y-6", containerClass)}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Courses</p>
        <h2 className="mt-2 text-2xl font-bold">Resonant Dowsing Course Preview</h2>
        <p className={classNames("mt-1 max-w-3xl", mutedClass)}>
          Admin-authenticated preview of the protected course payload. Member access remains entitlement-gated.
        </p>
      </div>

      {loading ? <Card className={cardClass}>Loading course preview...</Card> : null}
      {error ? (
        <Card className={classNames(cardClass, isLightTheme ? "text-red-700" : "text-red-100")}>{error}</Card>
      ) : null}

      {data ? (
        <>
          <Card className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-3xl font-bold">{data.course.title}</h3>
                <p className="mt-2 text-lg font-semibold text-accent-cyan">{data.course.price.label}</p>
                <p className={classNames("mt-4 max-w-3xl text-sm leading-7", mutedClass)}>
                  {data.course.description.join(" ")}
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                {data.course.moduleCount} modules
              </span>
            </div>
          </Card>

          {data.course.unresolvedTodos?.length ? (
            <Card className={cardClass}>
              <h3 className="text-lg font-semibold">Open Content TODOs</h3>
              <ul className={classNames("mt-3 list-disc space-y-2 pl-5 text-sm", mutedClass)}>
                {data.course.unresolvedTodos.map((todo) => <li key={todo}>{todo}</li>)}
              </ul>
            </Card>
          ) : null}

          <div className="space-y-4">
            {data.course.modules.map((module) => (
              <Card key={module.id} className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan">
                      {module.order === 0 ? "Preparation" : `Module ${module.order}`}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">{module.title}</h3>
                  </div>
                  <span className={classNames("rounded-full px-3 py-1 text-xs font-semibold", isLightTheme ? "bg-slate-100 text-slate-600" : "bg-white/10 text-white/70")}>
                    {module.lessons.length} video{module.lessons.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className={classNames("mt-3 space-y-2 text-sm leading-7", mutedClass)}>
                  {module.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {module.lessons.map((lesson) => (
                    <div key={lesson.id} className={classNames("rounded-xl border p-3 text-sm", isLightTheme ? "border-slate-200 bg-slate-50" : "border-glass-border bg-white/5")}>
                      <p className="font-semibold">{lesson.title}</p>
                      <p className={classNames("mt-1 break-all text-xs", mutedClass)}>{lesson.youtubeEmbedUrl}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
