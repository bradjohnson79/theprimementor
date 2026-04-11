import { useRef, useState } from "react";
import { motion } from "framer-motion";
import ReportsTab from "../components/ReportsTab";

export default function Reports() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const reportViewerRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">Reports</h2>
        <p className="mt-1 text-white/50">
          Review, edit, regenerate, finalize, export, and manage archived reports.
        </p>
      </div>

      <ReportsTab
        selectedReportId={selectedReportId}
        onSelectReport={setSelectedReportId}
        listRefreshKey={0}
        viewerRef={reportViewerRef}
      />
    </motion.div>
  );
}
