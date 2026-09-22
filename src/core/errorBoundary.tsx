'use client';

import React from 'react';
import { createLogger } from './logger';
import { normalizeError, type OrbitError } from './errors';

const log = createLogger('core.errorBoundary');

interface Props {
  children: React.ReactNode;
  fallback?: (error: OrbitError, reset: () => void) => React.ReactNode;
  scope?: string;
}

interface State {
  error: OrbitError | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: normalizeError(error) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const normalized = normalizeError(error);
    log.error(`خطای رندر در ناحیه «${this.props.scope ?? 'نامشخص'}»`, {
      ...normalized.toJSON(),
      componentStack: info.componentStack,
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div
        dir="rtl"
        className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center"
      >
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-bold text-red-300">خطایی رخ داد</h2>
        <p className="max-w-md text-sm text-red-200/80">{error.message}</p>
        <button
          onClick={this.reset}
          className="rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-100 transition hover:bg-red-500/30"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;