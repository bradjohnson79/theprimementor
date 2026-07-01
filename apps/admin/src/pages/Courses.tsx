import { CourseCatalogCard } from "@wisdom/ui/courses";
import { motion } from "framer-motion";
import Card from "../components/Card";
import { useAdminSettings } from "../context/AdminSettingsContext";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function Courses() {
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={classNames("space-y-6", isLightTheme ? "text-slate-900" : "text-white")}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Courses</p>
        <h2 className="mt-2 text-2xl font-bold">Courses Catalog</h2>
        <p className={classNames("mt-1 max-w-3xl", isLightTheme ? "text-slate-500" : "text-white/60")}>
          Open each course exactly as members experience it after access is granted. Admin access bypasses payment and lesson locks.
        </p>
      </div>

      <Card className={isLightTheme ? "!bg-white !shadow-[0_14px_34px_rgba(15,23,42,0.08)]" : ""}>
        <div className="grid gap-5 lg:grid-cols-2">
          <CourseCatalogCard
            title="Trauma Transcendence Technique Course"
            description="Through this 10-day guided course, you will learn a proven technique designed to neutralize trauma and cultivate a deep sense of inner peace."
            badge="Free"
            badgeTone="free"
            meta="Available Now"
            ctaLabel="View Now"
            thumbnailUrl="/images/Trauma-Transcendence-Technique-banner.png"
            href="/admin/courses/ttt"
          />
          <CourseCatalogCard
            title="The Resonant Dowsing Course"
            description="The Resonant Dowsing Course is an online teaching series instructed by its founder, Brad Johnson. Through the Resonant Dowsing Course, you will learn practices involving both neutral and universal pendulums."
            badge="$99 CAD"
            badgeTone="paid"
            meta="Lifetime Access"
            ctaLabel="View Now"
            thumbnailUrl="/images/courses/resonant-dowsing-course.png"
            href="/admin/courses/resonant-dowsing"
          />
        </div>
      </Card>
    </motion.div>
  );
}
