import { Fragment, type ReactNode } from "react";

interface Column<T> {
  key: keyof T;
  label: ReactNode;
  render?: (value: T[keyof T], row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;
  isRowExpanded?: (row: T) => boolean;
  renderExpandedRow?: (row: T) => ReactNode;
}

export default function Table<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  getRowClassName,
  isRowExpanded,
  renderExpandedRow,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-glass-border">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const expanded = isRowExpanded?.(row) === true;

            return (
              <Fragment key={row.id}>
                <tr
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-glass-border/50 transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-glass-hover" : ""
                  } ${getRowClassName?.(row) ?? ""}`}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-sm text-white/80">
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
                {expanded && renderExpandedRow ? (
                  <tr className="border-b border-glass-border/50 bg-white/[0.03]">
                    <td colSpan={columns.length} className="px-4 py-4">
                      {renderExpandedRow(row)}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
