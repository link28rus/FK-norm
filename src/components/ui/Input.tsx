'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | boolean
  label?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, type = 'text', ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
    
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-heading mb-1"
          >
            {label}
            {props.required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            'block w-full rounded-md border border-neutral-300 shadow-sm',
            'px-3 py-2 text-heading text-sm',
            'bg-white',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            'disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed',
            'placeholder:text-neutral-500',
            error && 'border-danger focus:border-danger focus:ring-danger',
            className
          )}
          {...props}
        />
        {error && typeof error === 'string' && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input

