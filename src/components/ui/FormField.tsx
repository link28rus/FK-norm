'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label?: string
  required?: boolean
  error?: string | boolean
  hint?: string
  children: React.ReactNode
  className?: string
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, required, error, hint, children, className }, ref) => {
    return (
      <div ref={ref} className={cn('w-full', className)}>
        {label && (
          <label className="block text-sm font-semibold text-heading mb-1.5">
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        {children}
        {error && typeof error === 'string' && (
          <p className="mt-1.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-secondary">{hint}</p>
        )}
      </div>
    )
  }
)

FormField.displayName = 'FormField'

export default FormField




