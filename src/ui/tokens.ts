// ORBIT — توکن‌های طراحی
export const COLORS = {
  bg: { base: '#070B14', elevated: '#0C1220', overlay: '#121A2C', glass: 'rgba(18, 26, 44, 0.55)' },
  text: { primary: '#E7ECF5', secondary: '#A6B0C3', muted: '#6B7690', inverted: '#070B14' },
  border: { subtle: 'rgba(255,255,255,0.06)', strong: 'rgba(255,255,255,0.12)', glow: 'rgba(124,58,237,0.45)' },
  accent: {
    primary: '#7C3AED', secondary: '#06B6D4', tertiary: '#10B981',
    warning: '#F59E0B', danger: '#EF4444', success: '#22C55E',
  },
  gradient: {
    brand: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
    glow: 'radial-gradient(circle at 50% 0%, rgba(124,58,237,0.35), transparent 70%)',
  },
} as const;

export const SPACING = { 0:'0px',1:'4px',2:'8px',3:'12px',4:'16px',5:'20px',6:'24px',8:'32px',10:'40px',12:'48px',16:'64px' } as const;
export const RADIUS = { sm:'8px', md:'12px', lg:'16px', xl:'20px', '2xl':'24px', pill:'9999px' } as const;
export const SHADOWS = {
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 4px 12px rgba(0,0,0,0.35)',
  lg: '0 12px 32px rgba(0,0,0,0.45)',
  glow: '0 0 24px rgba(124,58,237,0.35)',
} as const;
export const MOTION = {
  fast: '150ms ease-out', base: '220ms ease-out', slow: '360ms ease-out',
  spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;
export const GLASS = {
  backdrop: 'blur(18px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(18, 26, 44, 0.55)',
} as const;
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;

export const tokens = { colors: COLORS, spacing: SPACING, radius: RADIUS, shadows: SHADOWS, motion: MOTION, glass: GLASS, breakpoints: BREAKPOINTS } as const;