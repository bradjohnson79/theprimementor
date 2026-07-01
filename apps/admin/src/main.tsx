import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { AdminSettingsProvider } from "./context/AdminSettingsContext";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const ADMIN_DEV_PREVIEW = import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_PREVIEW === "true";

if (!CLERK_PUBLISHABLE_KEY && !ADMIN_DEV_PREVIEW) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables");
}

const app = (
  <AdminSettingsProvider>
    <App />
  </AdminSettingsProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      {ADMIN_DEV_PREVIEW ? app : (
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
          {app}
        </ClerkProvider>
      )}
    </AppErrorBoundary>
  </StrictMode>,
);
