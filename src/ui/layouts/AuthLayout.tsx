import React from 'react';
import { BRAND } from '@/core/config';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl" style={{ backgroundImage: 'var(--orbit-glow)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center text-white font-black text-2xl mb-3"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}>O</div>
          <h1 className="text-xl font-black tracking-widest">{BRAND.name}</h1>
          <p className="text-xs text-orbit-text-muted mt-1">{BRAND.tagline}</p>
        </div>
        <div className="orbit-glass rounded-2xl p-6">{children}</div>
      </div>
    </div>
  );
}
export default AuthLayout;