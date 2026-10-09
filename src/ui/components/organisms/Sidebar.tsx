'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Icon, type IconName } from '../atoms/Icon';
import { Chip } from '../atoms/Chip';
import { useSettingsStore } from '@/state/settingsStore';
import { useNewsStore } from '@/state/newsStore';
import { useCategoryLabels } from '@/ui/hooks/useCategoryLabels';
import type { AppPathname } from '@/i18n/routing';

const emptySubscribe = () => () => undefined;

interface NavItem { href: AppPathname; labelKey: string; icon: IconName }

const NAV: NavItem[] = [
  { href: '/', labelKey: 'nav.dashboard', icon: 'chart' },
  { href: '/news', labelKey: 'nav.news', icon: 'sparkles' },
  { href: '/notes', labelKey: 'nav.notes', icon: 'note' },
  { href: '/analytics', labelKey: 'nav.analytics', icon: 'chart' },
  { href: '/settings', labelKey: 'nav.settings', icon: 'settings' },
] as const;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const t = useTranslations();
  const { categories } = useCategoryLabels();
  const pathname = usePathname();
  const pinned = useSettingsStore((s) => s.pinnedCategories);
  const togglePin = useSettingsStore((s) => s.togglePinnedCategory);
  const activeCategory = useNewsStore((s) => s.activeCategory);
  const setCategory = useNewsStore((s) => s.setCategory);

  // FIX — Performance: the unstable subscribe callback (inline arrow) caused
  // unsubscribe/resubscribe on every render; moved to module scope for a stable ref.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Overlay for the drawer */}
      {open && (
        <div
          className="orbit-sidebar-overlay"
          onClick={onClose}
          role="presentation"
        />
      )}

      {/* RTL drawer: closed by default, opened by the header hamburger */}
      <aside
        className={`orbit-sidebar${open ? ' is-open' : ''}`}
        aria-label={t('sidebar.navigation')}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
            padding: 16,
          }}
        >
          <div className="orbit-sidebar-header">
            <span className="orbit-sidebar-title">{t('sidebar.menu')}</span>
            <button
              type="button"
              className="orbit-sidebar-close"
              onClick={onClose}
              aria-label={t('sidebar.closeMenu')}
              title={t('sidebar.closeMenu')}
            >
              <Icon name="close" size={19} />
            </button>
          </div>

          {/* لینک‌ها */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map((item) => {
              // FIX — navigation conflict: on the client next-intl strips the locale prefix from
              // usePathname (e.g. /fa/<fa-notes> -> /notes). Comparing against item.href without a
              // trailing slash never marked Home active. Slash normalization fixed it.
              const normalize = (p: string) => (p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p);
              const active = mounted && normalize(pathname) === normalize(item.href);
              return (
                        <Link
                   key={item.href}
                   href={item.href}
                   prefetch={true}
                   onClick={onClose}
                          style={{
                     position: 'relative',
                     display: 'flex',
                     alignItems: 'center',
                     gap: 12,
                     padding: '10px 12px',
                     borderRadius: 12,
                     fontSize: 14,
                     fontWeight: active ? 700 : 500,
                     textDecoration: 'none',
                     color: active ? 'var(--orbit-text)' : 'var(--orbit-text-secondary)',
                     background: active
                       ? 'linear-gradient(to left, rgba(124,58,237,0.2), rgba(6,182,212,0.1))'
                : 'transparent',
                     border: active ? '1px solid var(--orbit-border)' : '1px solid transparent',
                     boxShadow: active ? '0 0 16px rgba(124,58,237,0.12)' : 'none',
                     transition: 'background-color 200ms ease, color 200ms ease, transform 150ms ease',
                   }}
                   className="hover:!bg-white/[0.06] hover:!text-[color:var(--orbit-text)] active:scale-[0.98]"
                 >
                   {active && (
                     <span
                style={{
                  position: 'absolute',
                         insetInlineEnd: -1,
                  top: 6,
                         bottom: 6,
                  width: 3,
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, #7C3AED, #06B6D4)',
                       }}
                     />
                   )}
                   <Icon name={item.icon} size={18} />
                   <span>{t(item.labelKey as never)}</span>
                        </Link>
              );
            })}
          </nav>

          <div style={{ marginTop: 32 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--orbit-text-muted)',
                marginBottom: 12,
                padding: '0 4px',
              }}
            >
              {t('sidebar.categories')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip active={mounted && activeCategory === 'all'} onClick={() => setCategory('all')}>
                {t('sidebar.all')}
              </Chip>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  color={c.color}
                  active={mounted && activeCategory === c.id}
                  onClick={() => setCategory(c.id)}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 32 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--orbit-text-muted)',
                marginBottom: 12,
                padding: '0 4px',
              }}
            >
              {t('sidebar.pinned')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {categories.map((c) => (
                       <label
                  key={c.id}
                         className="transition-colors duration-150 hover:!bg-white/[0.05]"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: 'pointer',
                    color: 'var(--orbit-text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={mounted && pinned.includes(c.id)}
                    onChange={() => togglePin(c.id)}
                    style={{ accentColor: '#7C3AED' }}
                  />
                  <span style={{ color: c.color }}>{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div
              style={{
                marginTop: 'auto',
                paddingTop: 24,
                borderTop: '1px solid var(--orbit-border)',
                fontSize: 11,
                textAlign: 'center',
                color: 'var(--orbit-text-muted)',
                letterSpacing: '0.05em',
              }}
            >
              {t('sidebar.version')}
            </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;