import { useAuth } from "@clerk/react";
import { useEffect, useState, type ReactNode } from "react";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";
import { unwrapData, type ReportingEnvelope } from "./adsApi";
import { adsCardClass, adsMutedClass, adsTitleClass } from "./adsTheme";

type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

export default function AdsReportingTable<T>({
  title,
  path,
  rowKey,
  columns,
  emptyLabel,
  testId,
}: {
  title: string;
  path: string;
  rowKey: (row: T) => string;
  columns: Array<Column<T>>;
  emptyLabel: string;
  testId: string;
}) {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [rows, setRows] = useState<T[] | null>(null);
  const [message, setMessage] = useState("Loading…");

  useEffect(() => {
    void getToken()
      .then((token) => api.get(path, token))
      .then((response) => {
        const payload = unwrapData<ReportingEnvelope<T[]> | T[]>(response);
        if (payload && "available" in payload) {
          if (!payload.available) {
            setRows([]);
            setMessage(payload.message || "Connect Google Ads to begin");
            return;
          }
          setRows(payload.data ?? []);
          setMessage("");
          return;
        }
        setRows(Array.isArray(payload) ? payload : []);
        setMessage("");
      })
      .catch(() => {
        setRows([]);
        setMessage("Connect Google Ads to begin");
      });
  }, [getToken, path]);

  return (
    <div data-ads-reporting={testId} className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Ads</p>
        <h1 className={`mt-2 text-3xl font-semibold ${adsTitleClass(isLightTheme)}`}>{title}</h1>
        <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>Last 30 Days · read only</p>
      </div>
      <section className={`${adsCardClass(isLightTheme)} overflow-x-auto`}>
        {rows && rows.length > 0 ? (
          <table className="min-w-full text-left text-sm">
            <thead className={adsMutedClass(isLightTheme)}>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    className={index === columns.length - 1 ? "pb-3 font-medium" : "pb-3 pr-4 font-medium"}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className={isLightTheme ? "border-t border-slate-200" : "border-t border-white/10"}>
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`${index === 0 ? adsTitleClass(isLightTheme) : ""} ${index === columns.length - 1 ? "py-3" : "py-3 pr-4"}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={`text-sm ${adsMutedClass(isLightTheme)}`}>{message || emptyLabel}</p>
        )}
      </section>
    </div>
  );
}
