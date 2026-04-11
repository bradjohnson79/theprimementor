import { Outlet } from "react-router-dom";
import AppShell from "./AppShell";

export default function AdminLayout() {
  return (
    <AppShell>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-y-auto overscroll-y-contain p-8">
        <Outlet />
      </div>
    </AppShell>
  );
}
