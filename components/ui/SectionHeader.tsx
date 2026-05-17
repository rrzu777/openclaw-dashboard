import { ReactNode, HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: 'default' | 'compact';
}

/**
 * Section Header - Consistent headers for all sections
 * Style: Clean & Minimal (clear hierarchy, subtle)
 */
export function SectionHeader({
  title,
  description,
  icon,
  action,
  variant = 'default',
  className,
  ...props
}: SectionHeaderProps) {
  if (variant === 'compact') {
    return (
      <div
        className={clsx(
          'flex items-center justify-between gap-2',
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex items-start justify-between gap-3 pb-3 border-b border-gray-200',
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-2 flex-1">
        {icon && (
          <span className="text-gray-500 mt-0.5 shrink-0">{icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
