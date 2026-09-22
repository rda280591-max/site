// ORBIT — تایپوگرافی
export const FONT_FAMILY = {
  sans: "'Vazirmatn', 'Estedad', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const FONT_WEIGHT = { regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 } as const;

export const TYPE_SCALE = {
  '2xs': { size: '0.6875rem', line: '1rem' },
  xs: { size: '0.75rem', line: '1.125rem' },
  sm: { size: '0.875rem', line: '1.375rem' },
  base: { size: '1rem', line: '1.75rem' },
  lg: { size: '1.125rem', line: '1.875rem' },
  xl: { size: '1.25rem', line: '2rem' },
  '2xl': { size: '1.5rem', line: '2.25rem' },
  '3xl': { size: '1.875rem', line: '2.625rem' },
  '4xl': { size: '2.25rem', line: '3rem' },
} as const;

export const TYPOGRAPHY = { family: FONT_FAMILY, weight: FONT_WEIGHT, scale: TYPE_SCALE } as const;