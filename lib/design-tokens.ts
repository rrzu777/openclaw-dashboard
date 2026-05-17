/**
 * Design Tokens - OpenClaw Dashboard
 * Estilo: Clean & Minimal (Linear/Vercel inspired)
 */

// ─────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────
export const colors = {
  // Primary accent (used for actions, links, highlights)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb', // Main primary
    700: '#1d4ed8', // Hover
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Semantic colors
  success: '#10b981', // green-500
  warning: '#f59e0b', // amber-500
  error: '#ef4444', // red-500
  info: '#3b82f6', // blue-500

  // Neutrals
  gray: {
    50: '#f9fafb', // Page background
    100: '#f3f4f6',
    200: '#e5e7eb', // Borders
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280', // Muted text
    600: '#4b5563', // Secondary text
    700: '#374151',
    800: '#1f2937',
    900: '#111827', // Main text
  },

  // Surface colors
  surface: {
    bg: '#f9fafb', // gray-50
    card: '#ffffff',
    cardHover: '#f9fafb',
  },

  // Text colors
  text: {
    primary: '#111827', // gray-900
    secondary: '#4b5563', // gray-600
    muted: '#6b7280', // gray-500
    disabled: '#9ca3af', // gray-400
  },
};

// ─────────────────────────────────────────────────────────────
// SPACING (multiples of 4px)
// ─────────────────────────────────────────────────────────────
export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem', // 48px
};

// ─────────────────────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────────────────────
export const radius = {
  none: '0',
  sm: '0.375rem', // 6px
  md: '0.5rem', // 8px (default for cards)
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
  full: '9999px',
};

// ─────────────────────────────────────────────────────────────
// TYPOGRAPHY SCALE
// ─────────────────────────────────────────────────────────────
export const typography = {
  xs: { fontSize: '0.75rem', lineHeight: '1rem' }, // 12px
  sm: { fontSize: '0.875rem', lineHeight: '1.25rem' }, // 14px
  base: { fontSize: '1rem', lineHeight: '1.5rem' }, // 16px
  lg: { fontSize: '1.125rem', lineHeight: '1.75rem' }, // 18px
  xl: { fontSize: '1.25rem', lineHeight: '1.75rem' }, // 20px
  '2xl': { fontSize: '1.5rem', lineHeight: '2rem' }, // 24px
  '3xl': { fontSize: '1.875rem', lineHeight: '2.25rem' }, // 30px
};

// ─────────────────────────────────────────────────────────────
// FONT WEIGHTS
// ─────────────────────────────────────────────────────────────
export const fontWeights = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

// ─────────────────────────────────────────────────────────────
// SHADOWS (sutil, solo cuando necesario)
// ─────────────────────────────────────────────────────────────
export const shadows = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

// ─────────────────────────────────────────────────────────────
// TRANSITIONS
// ─────────────────────────────────────────────────────────────
export const transitions = {
  fast: 'transition-all duration-150 ease-in-out',
  base: 'transition-all duration-200 ease-in-out',
  slow: 'transition-all duration-300 ease-in-out',
};

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
export const containerMaxWidth = 'max-w-7xl';
export const sidebarWidth = 'w-64';
export const headerHeight = 'h-16';
