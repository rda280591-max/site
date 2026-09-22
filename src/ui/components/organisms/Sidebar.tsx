'use client';
import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '../atoms/Icon';
import { Chip } from '../atoms/Chip';
import { useSettingsStore } from '@/state/settingsStore';
import { useNewsStore } from '@/state/newsStore';
import { NEWS_CATEGORIES } from '@/core/config';

interface NavItem { href: string; label: string; icon: IconName }

const NAV: NavItem[] = [
  { href: '/', label: 'داشبورد', icon: 'chart' },
  { href: '/news', label: 'فید خبری', icon: 'sparkles' },
  { href: '/notes', label: 'یادداشت‌ها', icon: 'note' },
  { href: '/analytics', label: 'تحلیل‌ها', icon: 'chart' },
  { href: '/settings', label: 'تنظیمات', icon: 'settings' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const pinned = useSettingsStore((s) => s.pinnedCategories);
  const togglePin = useSettingsStore((s) => s.togglePinnedCategory);
  const activeCategory = useNewsStore((s) => s.activeCategory);
  const setCategory = useNewsStore((s) => s.setCategory);

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

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
        aria-label="ناوبری اصلی"
        aria-hidden={!open}
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
            <span className="orbit-sidebar-title">منو</span>
            <button
              type="button"
              className="orbit-sidebar-close"
              onClick={onClose}
              aria-label="بستن منو"
              title="بستن منو"
            >
              <Icon name="close" size={19} />
            </button>
          </div>

          {/* لینک‌ها */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map((item) => {
              const active = mounted && pathname === item.href;
              return (
                        <Link
                   key={item.href}
                   href={item.href}
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
                   <span>{item.label}</span>
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
              دسته‌ها
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip active={mounted && activeCategory === 'all'} onClick={() => setCategory('all')}>
                همه
              </Chip>
              {NEWS_CATEGORIES.map((c) => (
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
              ثابت‌شده
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {NEWS_CATEGORIES.map((c) => (
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
            ORBIT v0.1
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;