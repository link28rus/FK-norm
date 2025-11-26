'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'outline'
  size?: 'sm' | 'md'
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-neutral-200 text-neutral-900',
      success: 'bg-success-light text-success-text',
      danger: 'bg-danger-light text-danger-text',
      warning: 'bg-warning-light text-warning-text',
      info: 'bg-info-light text-info-text',
      outline: 'border border-neutral-300 bg-white text-neutral-900',
    }
    
    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
    }
    
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-md',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

export default Badge


