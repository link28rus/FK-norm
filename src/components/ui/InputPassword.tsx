'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

export interface InputPasswordProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | boolean
  label?: string
  showToggle?: boolean
}

const InputPassword = React.forwardRef<HTMLInputElement, InputPasswordProps>(
  ({ className, error, label, id, showToggle = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const inputId = id || `input-password-${Math.random().toString(36).substr(2, 9)}`
    
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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            className={cn(
              'block w-full rounded-md border border-neutral-300 shadow-sm',
              'px-3 py-2 text-heading text-sm',
              showToggle && 'pr-10',
              'bg-white',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
              'disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed',
              'placeholder:text-neutral-500',
              error && 'border-danger focus:border-danger focus:ring-danger',
              className
            )}
            {...props}
          />
          {showToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowPassword(!showPassword)
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className="absolute right-0 flex items-center justify-center pr-3 text-neutral-500 hover:text-neutral-700 focus:outline-none z-[30] pointer-events-auto"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                width: '2.5rem',
                height: '100%',
              }}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
        {error && typeof error === 'string' && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
      </div>
    )
  }
)

InputPassword.displayName = 'InputPassword'

export default InputPassword

