"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Icon } from "@iconify/react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

function generateErrorId(): string {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: "" };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (typeof this.props.onError === "function") {
      this.props.onError(error, errorInfo);
    }

    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorId: "" });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const {
      fallbackTitle = "Something went wrong",
      fallbackMessage = "An unexpected error occurred in this section. You can try again or reload the page.",
      compact = false,
    } = this.props;

    if (compact) {
      return (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4" role="alert" aria-live="assertive">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-xl" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-rose-200">{fallbackTitle}</p>
              <p className="mt-1 text-xs text-rose-200/80">{this.state.error?.message || fallbackMessage}</p>
              {this.state.errorId ? <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-rose-200/45">Error ID: {this.state.errorId}</p> : null}
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 active:scale-95"
            >
              <Icon icon="solar:restart-bold-duotone" className="text-sm" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 active:scale-95"
            >
              <Icon icon="solar:home-2-bold-duotone" className="text-sm" />
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4 sm:p-6" role="alert" aria-live="assertive">
        <div className="w-full max-w-md rounded-[2rem] border border-rose-500/20 bg-[linear-gradient(145deg,rgba(40,20,20,0.9),rgba(20,10,10,0.95))] p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/15 text-rose-300">
            <Icon icon="solar:shield-warning-bold-duotone" className="text-3xl" />
          </div>

          <h2 className="mt-6 text-xl font-bold text-rose-100">{fallbackTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-rose-200/70">{fallbackMessage}</p>

          {this.state.error?.message ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Error details</p>
              <p className="mt-1 break-words font-mono text-xs text-rose-200/80">{this.state.error.message}</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/15 px-6 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25 active:scale-95"
            >
              <Icon icon="solar:restart-bold-duotone" className="text-base" />
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 active:scale-95"
            >
              <Icon icon="solar:refresh-circle-bold-duotone" className="text-base" />
              Reload Page
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 active:scale-95"
            >
              <Icon icon="solar:home-2-bold-duotone" className="text-base" />
              Go Home
            </button>
          </div>

          <p className="mt-6 text-[10px] uppercase tracking-[0.16em] text-white/30">
            Error ID: {this.state.errorId}
          </p>
        </div>
      </div>
    );
  }
}
