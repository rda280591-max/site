'use client';
import { useRouter } from 'next/navigation';
import { Icon } from '../atoms/Icon';
import { Button } from '../atoms/Button';
import { SearchBar } from '../molecules/SearchBar';
import { BRAND } from '@/core/config';
import { useUIStore } from '@/state/uiStore';
import { useNewsStore } from '@/state/newsStore';
import { useAuthStore } from '@/state/authStore';
import { useTheme } from '@/ui/hooks/useTheme';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const openModal = useUIStore((s) => s.openModal);
  const search = useNewsStore((s) => s.search);
  const setSearch = useNewsStore((s) => s.setSearch);
  const { theme, mounted, toggleTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <header
      className="sticky top-0 orbit-glass border-b border-white/5"
      style={{ zIndex: 100, position: 'sticky', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
    >
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="منو"
          className="orbit-menu-toggle transition-all duration-200 hover:border-violet-500/30 hover:bg-white/[0.14]"
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid var(--orbit-border)',
            borderRadius: 12,
            color: 'var(--orbit-text)',
            cursor: 'pointer',
            fontSize: 22,
            padding: 0,
            zIndex: 101,
            flexShrink: 0,
          }}
        >
            <Icon name="menu" size={22} />
          </button>

        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="h-9 w-9 rounded-xl grid place-items-center text-white font-black text-sm transition-transform duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              boxShadow: '0 0 18px rgba(124,58,237,0.45)',
            }}
          >
            O
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-black tracking-widest text-orbit-text">{BRAND.name}</div>
            <div className="text-2xs text-orbit-text-muted -mt-1">مرکز فرماندهی</div>
          </div>
        </div>

        <div className="min-w-0 flex-1 max-w-2xl mx-auto">
          <SearchBar value={search} onChange={setSearch} placeholder="جستجو…" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="glass"
            size="sm"
            onClick={() => openModal('quickNote')}
            iconLeft={<Icon name="note" size={16} />}
          >
            <span className="hidden md:inline">یادداشت</span>
          </Button>

          <button
            type="button"
            onClick={toggleTheme}
            className="h-10 w-10 grid place-items-center rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:bg-white/10 hover:border-violet-500/30"
            aria-label="تغییر تم"
            suppressHydrationWarning
            style={{ color: 'var(--orbit-text)' }}
          >
                 {mounted ? (
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            ) : (
              <span className="inline-block h-[18px] w-[18px]" />
            )}
          </button>

          {mounted && user && (
            <button
              type="button"
       onClick={handleLogout}
              className="h-10 w-10 grid place-items-center rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300"
              aria-label="خروج"
              title={`خروج (${user.username})`}
              style={{ color: 'var(--orbit-text)' }}
            >
              <Icon name="logout" size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;