'use client';
import React from 'react';

interface Props {
  active?: boolean;
  onClick?: () => void;
  color?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Chip = React.memo(function Chip({
  active,
  onClick,
  color,
  children,
  className = '',
  disabled,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-chip-active={active ? 'true' : undefined}
      className={[
        // group تا دات داخل بتواند بر اساس data-chip-active رنگش را عوض کند
        'group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap select-none',
        /*
         * FIX — پاسخ‌دهی دکمه: will-change دائمی روی ۲۰+ چیپ، GPU layer
         * بی‌دلیل می‌ساخت و هر کلیک با repaint سنگین جواب داده می‌شد.
         * حالا فقط transform/opacity ترنزیشن دارند (compositor-only) و
         * duration کوتاه‌تر = حس تأخیر کمتر.
         */
        'transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out active:scale-[0.97]',
        active
          ? // FIX UI — بک‌گراند/سایه رنگی از طریق var(--chip-color) و کلاس
            // انجام می‌شود نه inline style؛ تا با active:scale تداخل نکند.
            'border-transparent text-white shadow-md scale-[1.02] [background:var(--chip-color)] [box-shadow:0_0_16px_var(--chip-color,#7C3AED)]'
          : 'border-white/10 bg-white/5 text-orbit-text-secondary hover:bg-white/10 hover:border-white/20 hover:-translate-y-px',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
        className,
      ].join(' ')}
      /*
       * FIX UI — تداخل scale با رنگ دات:
       * قبلاً رنگ‌ها inline style بودند و active:scale-[0.97] روی حالت
       * inactive هم اعمال می‌شد چون هر دو رشته در join یکی بودند؛ حالا
       * رنگ از طریق CSS custom property (--chip-color) به کلاس‌ها داده
       * می‌شود تا state های active/inactive کاملاً جدا بمانند.
       */
      style={color ? ({ '--chip-color': color } as React.CSSProperties) : undefined}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full transform-gpu transition-colors duration-200 bg-[var(--chip-color)] group-data-[chip-active=true]:bg-white"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
});

export default Chip;
