import { ReactNode, HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

/**
 * Card component - Base container for all sections
 * Style: Clean & Minimal (border-focused, subtle shadows)
 */
export function Card({
  children,
  variant = 'default',
  padding = 'md',
  hover = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        // Base styles
        'bg-white rounded-lg border border-gray-200',
        
        // Variants
        variant === 'default' && 'shadow-sm',
        variant === 'elevated' && 'shadow-md',
        variant === 'bordered' && 'border-2',
        
        // Padding
        padding === 'none' && 'p-0',
        padding === 'sm' && 'p-3',
        padding === 'md' && 'p-4',
        padding === 'lg' && 'p-6',
        
        // Hover state
        hover && 'hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200',
        
        // Custom className
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Header - Consistent header for cards
 */
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-3 pb-3 border-b border-gray-200',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon && <span className="text-gray-500">{icon}</span>}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Card Content - Wrapper for card body content
 */
interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardContent({ children, className, ...props }: CardContentProps) {
  return (
    <div className={clsx('pt-3', className)} {...props}>
      {children}
    </div>
  );
}
