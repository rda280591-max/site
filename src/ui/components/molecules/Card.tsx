import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

const PADDING = { sm: 'p-3', md: 'p-5', lg: 'p-7' } as const;

export function Card({
  children,
  className = '',
  title,
  subtitle,
  action,
  footer,
  padding = 'md',
  glow,
  interactive,
  onClick,
}: Props) {
  const hasHeader = title || subtitle || action;

  /*
   * FIX UI — blur دوبل: کلاس orbit-glass (در globals.css) خودش
   * background/backdrop-filter/border را دارد؛ نگه‌داشتن همین‌ها در
   * inline style باعث می‌شد backdrop-filter دو بار اعمال و رندر شود.
   * حالا فقط transition/boxShadow اینلاین است و بقیه به CSS واگذار شد.
   */
  return (
    <div
      onClick={onClick}
      className={['orbit-glass rounded-2xl', interactive ? 'cursor-pointer orbit-hover-lift' : '', className].join(' ')}
      style={{
        boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
        ...(glow ? { boxShadow: '0 0 24px rgba(124, 58, 237, 0.35)' } : {}),
      }}
    >
      {hasHeader && (
        <div
          className={`flex items-start justify-between gap-4 ${PADDING[padding]} pb-3`}
          style={{ borderBottom: '1px solid var(--orbit-border)' }}
        >
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-bold truncate" style={{ color: 'var(--orbit-text)' }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-xs truncate" style={{ color: 'var(--orbit-text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={PADDING[padding]}>{children}</div>
      {footer && (
        <div className={`${PADDING[padding]} pt-3`} style={{ borderTop: '1px solid var(--orbit-border)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;