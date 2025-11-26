'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Alert from './Alert'
import { cn } from '@/lib/utils'

export interface Toast {
  id: string
  variant: 'success' | 'error' | 'warning' | 'info'
  message: string
  title?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    }
    
    setToasts((prev) => [...prev, newToast])
    
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const success = useCallback((message: string, title?: string) => {
    showToast({ variant: 'success', message, title })
  }, [showToast])

  const error = useCallback((message: string, title?: string) => {
    showToast({ variant: 'error', message, title })
  }, [showToast])

  const warning = useCallback((message: string, title?: string) => {
    showToast({ variant: 'warning', message, title })
  }, [showToast])

  const info = useCallback((message: string, title?: string) => {
    showToast({ variant: 'info', message, title })
  }, [showToast])

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const container = typeof window !== 'undefined' ? document.body : null

  if (!container) return null

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto animate-[fadeInSlide_0.3s_ease-out]"
        >
          <Alert
            variant={toast.variant}
            title={toast.title}
            message={toast.message}
            onClose={() => onRemove(toast.id)}
            className="shadow-lg"
          />
        </div>
      ))}
    </div>,
    container
  )
}

