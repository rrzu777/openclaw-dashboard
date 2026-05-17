import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
}

/**
 * Button component - Consistent button styles
 * Style: Clean & Minimal (subtle, focus on clarity)
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconOnly = false,
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const baseStyles = clsx(
    // Base
    'inline-flex items-center justify-center gap-2',
    'font-medium rounded-md',
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    
    // Size
    size === 'sm' && 'text-xs px-2.5 py-1.5',
    size === 'md' && 'text-sm px-3 py-2',
    size === 'lg' && 'text-base px-4 py-2.5',
    
    // Icon only (square button)
    iconOnly && size === 'sm' && 'p-1.5',
    iconOnly && size === 'md' && 'p-2',
    iconOnly && size === 'lg' && 'p-2.5',
    
    // Variants
    variant === 'primary' && clsx(
      'bg-blue-600 text-white',
      'hover:bg-blue-700',
      'focus:ring-blue-500',
      'border border-transparent'
    ),
    
    variant === 'secondary' && clsx(
      'bg-white text-gray-700',
      'hover:bg-gray-50 hover:text-gray-900',
      'focus:ring-gray-400',
      'border border-gray-300'
    ),
    
    variant === 'ghost' && clsx(
      'bg-transparent text-gray-600',
      'hover:bg-gray-100 hover:text-gray-900',
      'focus:ring-gray-400',
      'border border-transparent'
    ),
    
    variant === 'danger' && clsx(
      'bg-red-600 text-white',
      'hover:bg-red-700',
      'focus:ring-red-500',
      'border border-transparent'
    ),
    
    className
  );

  return (
    <button
      className={baseStyles}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {icon && !loading && <span className={iconOnly ? '' : 'shrink-0'}>{icon}</span>}
      {!iconOnly && children}
    </button>
  );
}
