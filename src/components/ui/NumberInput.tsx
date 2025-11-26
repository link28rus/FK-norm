'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string | boolean
  label?: string
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const inputId = id || `number-input-${Math.random().toString(36).substr(2, 9)}`
    
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-heading mb-1.5"
          >
            {label}
            {props.required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type="number"
          className={cn(
            'block w-full rounded-md border border-neutral-300 shadow-sm',
            'px-3 py-2 text-heading text-sm',
            'bg-white',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
            'disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed',
            'placeholder:text-neutral-500',
            error && 'border-danger focus:border-danger focus:ring-danger',
            className
          )}
          {...props}
        />
        {error && typeof error === 'string' && (
          <p className="mt-1.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

NumberInput.displayName = 'NumberInput'

export default NumberInput




