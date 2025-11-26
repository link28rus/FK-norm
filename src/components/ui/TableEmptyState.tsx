'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import Button from './Button'

export interface TableEmptyStateProps {
  message?: string
  actionLabel?: string
  onAction?: () => void
  colSpan?: number
}

export default function TableEmptyState({
  message = 'Пока нет данных',
  actionLabel,
  onAction,
  colSpan = 1,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-12 text-center"
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <p className="text-sm text-secondary">
            {message}
          </p>
          {actionLabel && onAction && (
            <Button
              onClick={onAction}
              variant="primary"
              size="sm"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

