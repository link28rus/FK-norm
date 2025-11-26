'use client'

import { Button } from '@/components/ui'
import { Card } from '@/components/ui'

export interface GroupCardProps {
  name: string
  schoolYear: string
  schoolName?: string | null
  studentsCount: number
  lessonsCount: number
  onOpen: () => void
  onDelete: () => void
}

export default function GroupCard({
  name,
  schoolYear,
  schoolName,
  studentsCount,
  lessonsCount,
  onOpen,
  onDelete,
}: GroupCardProps) {
  return (
    <Card padding="none" className="flex flex-col h-full hover:shadow-lg transition-shadow w-full">
      <div className="flex-1 p-4 sm:p-6">
        <div className="mb-4">
          <h3 className="text-lg sm:text-xl font-semibold text-heading mb-1">
            {name}
          </h3>
          <p className="text-xs text-indigo-600 font-medium mb-2">
            {schoolYear}
          </p>
          {schoolName && (
            <p className="text-sm text-secondary">
              {schoolName}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm text-secondary mb-4">
          <span>Учащихся: <strong className="text-heading">{studentsCount}</strong></span>
          <span>Уроков: <strong className="text-heading">{lessonsCount}</strong></span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 p-4 sm:p-6 pt-4 border-t border-gray-200">
        <Button
          onClick={onOpen}
          variant="primary"
          className="flex-1 w-full sm:w-auto"
        >
          Открыть
        </Button>
        <Button
          onClick={onDelete}
          variant="danger"
          size="md"
          className="w-full sm:w-auto"
        >
          Удалить
        </Button>
      </div>
    </Card>
  )
}

