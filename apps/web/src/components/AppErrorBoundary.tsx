import { Component, type ErrorInfo, type ReactNode } from "react";

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
    void error;
    void errorInfo;
    /* Swallow here so the boundary can render a stable fallback. */
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] px-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_40%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.12),transparent_45%)]" />
          <div className="dashboard-panel relative z-10 w-full max-w-lg text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/60">App Recovery</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">Something went wrong.</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/68">
              The page hit an unexpected error. Refresh to try again and continue where you left off.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="dashboard-action-primary mt-6"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
