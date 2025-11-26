'use client'

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState, Badge, Button } from '@/components/ui'

export interface NormTemplate {
  id: string
  name: string
  description?: string | null
  unit: string
  classFrom: number
  classTo: number
  direction: string
  applicableGender?: string
  ownerTrainerId?: string | null
  isPublic: boolean
  isActive: boolean
  ownerTrainer?: {
    id: string
    fullName: string
  } | null
  _count?: {
    boundaries: number
    groupNorms: number
  }
}

interface TemplatesTableProps {
  templates: NormTemplate[]
  showTypeColumn?: boolean // Показывать ли колонку "Тип" (для админа)
  showStatusColumn?: boolean // Показывать ли колонку "Статус" (по умолчанию true)
  showApplicableGenderColumn?: boolean // Показывать ли колонку "Кто сдаёт" (по умолчанию false)
  emptyMessage?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
  onEdit: (templateId: string) => void
  onDelete: (templateId: string) => void
}

export default function TemplatesTable({
  templates,
  showTypeColumn = false,
  showStatusColumn = true,
  showApplicableGenderColumn = false,
  emptyMessage = 'Шаблоны нормативов пока не созданы',
  emptyActionLabel,
  onEmptyAction,
  onEdit,
  onDelete,
}: TemplatesTableProps) {
  // Вычисляем количество колонок: Название, Единица, Классы, Направление, [Тип], [Кто сдаёт], Границы, [Статус], Действия
  let colSpan = 6 // Название, Единица, Классы, Направление, Границы, Действия (базовые)
  if (showTypeColumn) colSpan += 1
  if (showApplicableGenderColumn) colSpan += 1
  if (showStatusColumn) colSpan += 1

  const renderApplicableGenderBadge = (applicableGender?: string) => {
    switch (applicableGender) {
      case 'ALL':
        return (
          <Badge variant="default">
            Мальчики и девочки
          </Badge>
        )
      case 'MALE':
        return (
          <Badge variant="info">
            Только мальчики
          </Badge>
        )
      case 'FEMALE':
        return (
          <Badge variant="outline">
            Только девочки
          </Badge>
        )
      default:
        return (
          <Badge variant="default">
            Мальчики и девочки
          </Badge>
        )
    }
  }

  if (templates.length === 0) {
    return (
      <TableEmptyState
        colSpan={colSpan}
        message={emptyMessage}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Название</TableHead>
          <TableHead>Единица</TableHead>
          <TableHead>Классы</TableHead>
          <TableHead>Направление</TableHead>
          {showTypeColumn && <TableHead>Тип</TableHead>}
          {showApplicableGenderColumn && <TableHead>Кто сдаёт</TableHead>}
          <TableHead>Границы</TableHead>
          {showStatusColumn && <TableHead>Статус</TableHead>}
          <TableHead align="right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell className="font-medium">
              {template.name}
            </TableCell>
            <TableCell className="text-secondary">
              {template.unit}
            </TableCell>
            <TableCell className="text-secondary">
              {template.classFrom}–{template.classTo}
            </TableCell>
            <TableCell className="text-secondary">
              {template.direction === 'LOWER_IS_BETTER' ? 'Меньше = лучше' : 'Больше = лучше'}
            </TableCell>
            {showTypeColumn && (
              <TableCell>
                {template.ownerTrainerId ? (
                  <Badge variant="info">
                    Личный {template.ownerTrainer?.fullName ? `(${template.ownerTrainer.fullName})` : ''}
                  </Badge>
                ) : template.isPublic ? (
                  <Badge variant="success">
                    Общий
                  </Badge>
                ) : (
                  <Badge variant="default">
                    Личный
                  </Badge>
                )}
              </TableCell>
            )}
            {showApplicableGenderColumn && (
              <TableCell>
                {renderApplicableGenderBadge(template.applicableGender)}
              </TableCell>
            )}
            <TableCell className="text-secondary">
              {template._count?.boundaries || 0}
            </TableCell>
            {showStatusColumn && (
              <TableCell>
                <Badge variant={template.isActive ? 'success' : 'default'}>
                  {template.isActive ? 'Активен' : 'Неактивен'}
                </Badge>
              </TableCell>
            )}
            <TableCell align="right">
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => onEdit(template.id)}
                  variant="secondary"
                  size="sm"
                >
                  Редактировать
                </Button>
                <Button
                  onClick={() => onDelete(template.id)}
                  variant="danger"
                  size="sm"
                >
                  Удалить
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

