import { Component, type ErrorInfo, type ReactNode } from "react";
import WebsiteStatusPage from "./public/WebsiteStatusPage";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("app_error_boundary_caught", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <WebsiteStatusPage
          eyebrow="App Recovery"
          code="Error"
          title="Something went wrong."
          description="The page hit an unexpected error. Refresh to try again, or return to the homepage and continue from a fresh page load."
          actions={[
            { label: "Try Again", onClick: () => window.location.reload() },
            { label: "Return Home", href: "/", variant: "secondary", preserveQuery: true },
            { label: "Contact Support", href: "/contact", variant: "secondary", preserveQuery: true },
          ]}
        />
      );
    }

    return this.props.children;
  }
}
