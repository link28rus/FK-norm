'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'danger' | 'warning' | 'info'
  title?: string
  onClose?: () => void
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, children, onClose, ...props }, ref) => {
    const variants = {
      success: 'bg-success-light text-success-text border-success',
      danger: 'bg-danger-light text-danger-text border-danger',
      warning: 'bg-warning-light text-warning-text border-warning',
      info: 'bg-info-light text-info-text border-info',
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-md border p-4',
          variants[variant],
          className
        )}
        {...props}
      >
        <div className="flex items-start">
          <div className="flex-1">
            {title && (
              <h4 className="text-sm font-semibold mb-1">{title}</h4>
            )}
            <div className="text-sm">{children}</div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-4 flex-shrink-0 text-current opacity-70 hover:opacity-100 focus:outline-none"
              aria-label="Закрыть"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }
)

Alert.displayName = 'Alert'

export default Alert

