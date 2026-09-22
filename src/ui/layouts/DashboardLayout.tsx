'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../components/organisms/Header';
import { Sidebar } from '../components/organisms/Sidebar';
import { QuickNote } from '../components/organisms/QuickNote';
import { ErrorBoundary } from '@/core/errorBoundary';
import { useAuthStore } from '@/state/authStore';

const emptySubscribe = () => () => undefined;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // true فقط در کلاینت؛ روی سرور false است تا هیدریشن به‌هم نریزد.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const authed = mounted && isAuthenticated;

  useEffect(() => {
    if (mounted && !authed) router.replace('/login');
  }, [mounted, authed, router]);

  const handleMenuClick = () => setSidebarOpen(true);
  const handleClose = () => setSidebarOpen(false);

  if (!mounted || !user) {
    return (
      <div className="min-h-screen grid place-items-center" dir="rtl">
        <div
          className="h-10 w-10 rounded-xl animate-pulse grid place-items-center text-white font-black"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}
        >
          O
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <Header onMenuClick={handleMenuClick} />

      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} onClose={handleClose} />

        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <ErrorBoundary scope="DashboardContent">{children}</ErrorBoundary>
        </main>
      </div>

      <QuickNote />
    </div>
  );
}

export default DashboardLayout;