import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { AdminSettingsProvider } from "./context/AdminSettingsContext";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <AdminSettingsProvider>
          <App />
        </AdminSettingsProvider>
      </ClerkProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
