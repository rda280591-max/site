'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { createLogger } from '@/core/logger';
import { normalizeError, type OrbitError } from '@/core/errors';

const log = createLogger('ui.errorBoundary');

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
    log.error(`Render error in area "${this.props.scope ?? 'unknown'}"`, {
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

    return <BoundaryFallback error={error} onReset={this.reset} />;
  }
}

/**
 /* Translated version of the error state.
 *
 * متن از دیکشنری زبان می‌آید (نه متن ثابت فارسی) و dir هم از خود <html> ارث
 * می‌رسد؛ پس در حالت انگلیسی «absolute English» و LTR است.
 */
function BoundaryFallback({ error, onReset }: { error: OrbitError; onReset: () => void }) {
  const t = useTranslations('error');
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-lg font-bold text-red-300">{t('title')}</h2>
      <p className="max-w-md text-sm text-red-200/80">{error.message}</p>
      <button
        onClick={onReset}
        className="rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-100 transition hover:bg-red-500/30"
      >
        {t('retry')}
      </button>
    </div>
  );
}

export default ErrorBoundary;
