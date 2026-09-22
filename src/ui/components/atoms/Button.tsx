'use client';
import React from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-l from-violet-600 to-cyan-500 text-white shadow-[0_6px_20px_rgba(124,58,237,0.35)] hover:shadow-[0_8px_28px_rgba(124,58,237,0.5)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95',
  secondary: 'bg-white/5 text-orbit-text border border-white/10 hover:bg-white/10 hover:border-white/20 active:bg-white/[0.07]',
  ghost: 'bg-transparent text-orbit-text hover:bg-white/5 active:bg-white/[0.03]',
  danger: 'bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 hover:border-red-500/45',
  glass: 'orbit-glass text-orbit-text hover:bg-white/10 shadow-lg hover:-translate-y-0.5 active:translate-y-0',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-2xl',
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, iconLeft, iconRight, fullWidth, className = '', children, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={['inline-flex items-center justify-center font-medium','transition-all duration-200 select-none','disabled:opacity-50 disabled:cursor-not-allowed','focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',VARIANT_CLASSES[variant],SIZE_CLASSES[size],fullWidth ? 'w-full' : '',className].join(' ')}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : (iconLeft && <span className="shrink-0">{iconLeft}</span>)}
      {children && <span className="truncate">{children}</span>}
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
});
export default Button;