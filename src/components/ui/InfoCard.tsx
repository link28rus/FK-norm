'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface InfoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  actions?: React.ReactNode
}

const InfoCard = React.forwardRef<HTMLDivElement, InfoCardProps>(
  ({ className, title, actions, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white rounded-xl shadow-sm',
          'p-4 md:p-5',
          'w-full',
          className
        )}
        {...props}
      >
        {(title || actions) && (
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-4">
            {title && (
              <h3 className="h3 m-0">
                {title}
              </h3>
            )}
            {actions && (
              <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                {actions}
              </div>
            )}
          </div>
        )}
        <div className="text-sm">
          {children}
        </div>
      </div>
    )
  }
)

InfoCard.displayName = 'InfoCard'

export default InfoCard


