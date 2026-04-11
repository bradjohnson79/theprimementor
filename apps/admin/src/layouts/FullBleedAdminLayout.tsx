import { Outlet } from "react-router-dom";
import AppShell from "./AppShell";

export default function FullBleedAdminLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
