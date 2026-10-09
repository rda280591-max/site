'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Header } from '../components/organisms/Header';
import { Sidebar } from '../components/organisms/Sidebar';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { useAuthStore } from '@/state/authStore';
import { Button } from '../components/atoms/Button';
import type { AppLocale } from '@/i18n/routing';

const emptySubscribe = () => () => undefined;

// QuickNote is a modal and is not needed for the initial route render.
const QuickNote = dynamic(() => import('../components/organisms/QuickNote'), {
  ssr: false,
});

interface DashboardLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function DashboardLayout({
  children,
  requireAuth = true,
}: DashboardLayoutProps) {
  const t = useTranslations('common');
  const locale = useLocale() as AppLocale;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.mounted);
  const authError = useAuthStore((s) => s.error);

  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // FIX — Performance: on public pages (requireAuth=false) auth hydration is pure
  // wasted network/JS cost; it runs idle-deferred so the main thread stays free
  // during the initial load phase (lower TBT, better LCP).
  useEffect(() => {
    if (!requireAuth && 'requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback(() => void hydrate(), { timeout: 3000 });
      return () => (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
    }
    void hydrate();
  }, [hydrate, requireAuth]);

  const authed = mounted && hydrated && isAuthenticated;
  const redirected = useRef(false);
  const failed = authError !== null;

  useEffect(() => {
    if (!requireAuth) return;
    if (redirected.current) return;
    if (mounted && hydrated && !isAuthenticated && !failed) {
      redirected.current = true;
      router.replace('/login', { locale, scroll: false });
    }
  }, [requireAuth, mounted, hydrated, isAuthenticated, failed, locale, router]);

  const handleMenuClick = () => setSidebarOpen(true);
  const handleClose = () => setSidebarOpen(false);

  // Public pages render without delay
  if (!requireAuth) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header onMenuClick={handleMenuClick} />
        <div className="flex flex-1 overflow-visible">
          <Sidebar open={sidebarOpen} onClose={handleClose} />
          <main id="main-content" className="orbit-deep-dive-root flex-1 min-w-0 p-4 lg:p-6">
            <ErrorBoundary scope="DashboardContent">{children}</ErrorBoundary>
          </main>
        </div>
        <QuickNote />
      </div>
    );
  }

  if (!mounted || !hydrated) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div
          className="h-10 w-10 rounded-xl animate-pulse grid place-items-center text-white font-black"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}
          role="status"
          aria-label={t('loading')}
        >
          O
        </div>
      </div>
    );
  }

  // Network error talking to the server: the user is not thrown to login; a retry button is shown
  if (failed && !authed) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="orbit-glass w-full max-w-sm rounded-2xl p-6 text-center">
          <div className="text-3xl mb-3" aria-hidden>⚠️</div>
          <h2 className="text-sm font-bold mb-1">{t('connectionErrorTitle')}</h2>
          <p className="text-xs text-orbit-text-secondary mb-4">{t('connectionErrorBody')}</p>
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              redirected.current = false;
              void hydrate();
            }}
          >
            {t('retry')}
          </Button>
          <Link
            href="/login"
            locale={locale}
            className="mt-3 inline-block text-xs underline-offset-4 hover:underline"
            style={{ color: 'var(--orbit-secondary)' }}
          >
            {t('goToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  if (!authed || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div
          className="h-10 w-10 rounded-xl animate-pulse grid place-items-center text-white font-black"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}
          role="status"
          aria-label={t('redirecting')}
        >
          O
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onMenuClick={handleMenuClick} />
      <div className="flex flex-1 overflow-visible">
        <Sidebar open={sidebarOpen} onClose={handleClose} />
        <main id="main-content" className="orbit-deep-dive-root flex-1 min-w-0 p-4 lg:p-6">
          <ErrorBoundary scope="DashboardContent">{children}</ErrorBoundary>
        </main>
      </div>
      <QuickNote />
    </div>
  );
}

export default DashboardLayout;