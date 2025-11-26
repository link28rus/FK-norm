'use client'

import { Button } from '@/components/ui'

interface TemplatesLayoutProps {
  title: string
  description?: string
  actionButtonLabel: string
  onAction: () => void
  children: React.ReactNode
}

export default function TemplatesLayout({
  title,
  description,
  actionButtonLabel,
  onAction,
  children,
}: TemplatesLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="h1 mb-2">{title}</h1>
          {description && (
            <p className="text-sm text-secondary">
              {description}
            </p>
          )}
        </div>
        <Button
          onClick={onAction}
          variant="primary"
          className="w-full sm:w-auto"
        >
          {actionButtonLabel}
        </Button>
      </div>
      {children}
    </div>
  )
}

