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
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy px-6 text-white">
          <div className="absolute inset-0 aurora-bg opacity-80" />
          <div className="glass-card relative z-10 w-full max-w-lg rounded-2xl border border-white/10 p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-cyan/70">Admin Recovery</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">Something went wrong.</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              The admin dashboard hit an unexpected error. Refresh to restore the session and continue safely.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-accent-cyan/90"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
