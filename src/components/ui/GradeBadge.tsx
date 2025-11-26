'use client'

import React from 'react'
import Badge from './Badge'
import { cn } from '@/lib/utils'

export interface GradeBadgeProps {
  grade: string | number | null | undefined
  className?: string
}

export default function GradeBadge({ grade, className }: GradeBadgeProps) {
  // Нормализуем оценку
  const normalizedGrade = grade?.toString().trim() || '-'

  // Специальные случаи
  if (normalizedGrade === '-' || normalizedGrade === '' || normalizedGrade === 'null' || normalizedGrade === 'undefined') {
    return (
      <span className={cn('text-sm text-secondary', className)}>
        —
      </span>
    )
  }

  // Буквенные обозначения
  if (normalizedGrade === 'Б') {
    return (
      <Badge variant="warning" className={className}>
        Б
      </Badge>
    )
  }

  if (normalizedGrade === 'О') {
    return (
      <Badge variant="info" className={className}>
        О
      </Badge>
    )
  }

  // Числовые оценки
  const numericGrade = parseInt(normalizedGrade, 10)

  if (isNaN(numericGrade)) {
    return (
      <span className={cn('text-sm text-heading', className)}>
        {normalizedGrade}
      </span>
    )
  }

  // Определяем вариант в зависимости от оценки
  let variant: 'success' | 'info' | 'warning' | 'danger' | 'default' = 'default'

  if (numericGrade === 5) {
    variant = 'success' // Зелёный
  } else if (numericGrade === 4) {
    variant = 'info' // Синий (можно сделать немного зеленоватым)
  } else if (numericGrade === 3) {
    variant = 'warning' // Жёлтый
  } else if (numericGrade <= 2 && numericGrade > 0) {
    variant = 'danger' // Красный
  }

  return (
    <Badge variant={variant} className={className}>
      {numericGrade}
    </Badge>
  )
}

