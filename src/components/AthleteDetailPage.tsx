'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import EditAthleteModal from './EditAthleteModal'
import { Input, NumberInput, Select, Textarea, Button, Alert, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState, GradeBadge, InfoCard, useToast } from '@/components/ui'

interface Athlete {
  id: string
  fullName: string
  birthDate?: string
  gender?: string
  notes?: string
  uinGto?: string | null
  groupId: string
  schoolYear?: string
  height?: number | null
  weight?: number | null
  shoeSize?: number | null
  isActive?: boolean
  exitDate?: string | null
  exitReason?: string | null
  group?: {
    name: string
    schoolYear?: string
  }
  norms: Norm[]
}

interface Norm {
  id: string
  type: string
  value?: number
  unit?: string
  status: string
  date: string
  comment?: string
  normType?: string
  groupNormId?: string | null
  template?: {
    id: string
    name: string
    unit: string
    direction: string
  } | null
  groupNorm?: {
    id: string
    period: 'START_OF_YEAR' | 'END_OF_YEAR' | 'REGULAR' | null
  } | null
}

type NormDisplayType = 'INDIVIDUAL' | 'GROUP' | 'CONTROL_START' | 'CONTROL_END'

function getNormType(norm: Norm): NormDisplayType {
  // Если есть groupNorm и period, определяем тип контрольного замера
  if (norm.groupNorm?.period === 'START_OF_YEAR') return 'CONTROL_START'
  if (norm.groupNorm?.period === 'END_OF_YEAR') return 'CONTROL_END'
  // Если есть groupNormId, но period REGULAR или null - это групповой норматив
  if (norm.groupNormId) return 'GROUP'
  // Иначе - индивидуальный
  return 'INDIVIDUAL'
}

function getNormTypeLabel(norm: Norm): string {
  const type = getNormType(norm)
  switch (type) {
    case 'INDIVIDUAL':
      return 'Индивид.'
    case 'GROUP':
      return 'Общий'
    case 'CONTROL_START':
      return 'Контр. (начало)'
    case 'CONTROL_END':
      return 'Контр. (конец)'
    default:
      return '—'
  }
}

export default function AthleteDetailPage({
  athleteId,
  userFullName,
  userRole,
}: {
  athleteId: string
  userFullName?: string
  userRole?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddNorm, setShowAddNorm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ type?: string; status?: string }>({})
  const [normForm, setNormForm] = useState({
    type: '',
    value: '',
    unit: '',
    status: '-', // Оценка: "-", "2", "3", "4", "5", "Б", "О"
    date: new Date().toISOString().split('T')[0],
    comment: '',
  })

  useEffect(() => {
    loadAthlete()
  }, [athleteId])

  const loadAthlete = async () => {
    try {
      const response = await fetch(`/api/trainer/athletes/${athleteId}`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setAthlete(data.athlete)
    } catch (err) {
      setError('Ошибка загрузки данных учащегося')
    } finally {
      setLoading(false)
    }
  }

  const handleAddNorm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!athlete) return
    
    // Не позволяем добавлять нормативы для выбывших учеников
    if (athlete.isActive === false) {
      setError('Нельзя добавлять нормативы для выбывшего ученика')
      return
    }
    
    setError('')
    setFieldErrors({})

    // Валидация
    const errors: { type?: string; status?: string } = {}
    if (!normForm.type.trim()) {
      errors.type = 'Укажите тип норматива'
    }
    if (!normForm.status || normForm.status === '-') {
      errors.status = 'Выберите оценку'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/trainer/norms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...normForm,
          athleteId: athlete.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания')
        return
      }

      setShowAddNorm(false)
      setNormForm({
        type: '',
        value: '',
        unit: '',
        status: '-',
        date: new Date().toISOString().split('T')[0],
        comment: '',
      })
      setSubmitting(false)
      toast.success('Норматив успешно добавлен!')
      loadAthlete()
    } catch (err) {
      setError('Ошибка создания норматива')
      setSubmitting(false)
    }
  }

  const handleDeleteNorm = async (id: string) => {
    if (!confirm('Удалить норматив?')) return

    try {
      const response = await fetch(`/api/trainer/norms/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Ошибка удаления')
      toast.success('Норматив успешно удалён!')
      loadAthlete()
    } catch (err) {
      setError('Ошибка удаления норматива')
    }
  }

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Загрузка...</div>
      </div>
    )
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Учащийся не найден</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" message={error} />
      )}

      {/* Кнопка возврата к группе — для быстрого возврата тренера на страницу группы */}
      {athlete.groupId && (
        <div className="mb-4">
          <Button
            onClick={() => router.push(`/trainer/groups/${athlete.groupId}`)}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            ← Назад к группе
          </Button>
        </div>
      )}

      {/* Заголовок страницы */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="h1">
              {athlete.fullName}
              {athlete.isActive === false && (
                <span className="ml-2 text-base font-normal text-gray-500">(выбыл)</span>
              )}
            </h1>
            {athlete.group && (
              <p className="mt-1 text-sm text-secondary">
                {athlete.group.name} · учебный год {athlete.group.schoolYear || athlete.schoolYear}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => router.push(`/trainer/athletes/${athleteId}/progress`)}
              variant="primary"
              size="sm"
            >
              Прогресс по нормативам
            </Button>
            <Link
              href={`/trainer/athletes/${athleteId}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="no-print rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Печать карточки
            </Link>
          </div>
        </div>
      </div>

      {/* Данные учащегося */}
      <InfoCard
        title="Данные ученика"
        actions={
          athlete.isActive !== false && (
            <Button
              onClick={() => setShowEditModal(true)}
              variant="secondary"
              size="sm"
            >
              Редактировать
            </Button>
          )
        }
      >
          <dl className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-start">
              <dt className="text-sm font-medium text-secondary w-full sm:w-32 flex-shrink-0 mb-1 sm:mb-0">Дата рождения</dt>
              <dd className="text-sm text-heading">
                {athlete.birthDate
                  ? new Date(athlete.birthDate).toLocaleDateString('ru-RU')
                  : '—'}
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start">
              <dt className="text-sm font-medium text-secondary w-full sm:w-32 flex-shrink-0 mb-1 sm:mb-0">Возраст</dt>
              <dd className="text-sm text-heading">
                {calculateAge(athlete.birthDate)
                  ? `${calculateAge(athlete.birthDate)} лет`
                  : '—'}
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start">
              <dt className="text-sm font-medium text-secondary w-full sm:w-32 flex-shrink-0 mb-1 sm:mb-0">Пол</dt>
              <dd className="text-sm text-heading">{athlete.gender || '—'}</dd>
            </div>
            {athlete.group && (
              <div className="flex flex-col sm:flex-row sm:items-start">
                <dt className="text-sm font-medium text-secondary w-full sm:w-32 flex-shrink-0 mb-1 sm:mb-0">Группа</dt>
                <dd className="text-sm text-heading">{athlete.group.name}</dd>
              </div>
            )}
            {athlete.uinGto && (
              <div className="flex flex-col sm:flex-row sm:items-start">
                <dt className="text-sm font-medium text-secondary w-full sm:w-32 flex-shrink-0 mb-1 sm:mb-0">УИН ГТО</dt>
                <dd className="text-sm text-heading">{athlete.uinGto}</dd>
              </div>
            )}
            {(athlete.height !== null && athlete.height !== undefined) || 
             (athlete.weight !== null && athlete.weight !== undefined) || 
             (athlete.shoeSize !== null && athlete.shoeSize !== undefined) ? (
              <div className="pt-2 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8">
                  {athlete.height !== null && athlete.height !== undefined && (
                    <div>
                      <span className="text-sm font-medium text-secondary">Рост:</span>{' '}
                      <span className="text-sm text-heading">{athlete.height} см</span>
                    </div>
                  )}
                  {athlete.weight !== null && athlete.weight !== undefined && (
                    <div>
                      <span className="text-sm font-medium text-secondary">Вес:</span>{' '}
                      <span className="text-sm text-heading">{athlete.weight} кг</span>
                    </div>
                  )}
                  {athlete.shoeSize !== null && athlete.shoeSize !== undefined && (
                    <div>
                      <span className="text-sm font-medium text-secondary">Размер обуви:</span>{' '}
                      <span className="text-sm text-heading">{athlete.shoeSize}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            {athlete.notes && (
              <div className="flex flex-col sm:flex-row sm:items-start pt-2 border-t border-gray-200">
                <dt className="text-sm font-medium text-secondary w-full sm:w-32 flex-shrink-0 mb-1 sm:mb-0">Примечания</dt>
                <dd className="text-sm text-heading">{athlete.notes}</dd>
              </div>
            )}
          </dl>
        </InfoCard>

        {/* Форма добавления норматива */}
        {showAddNorm && (
          <InfoCard title="Добавить норматив">
            <form onSubmit={handleAddNorm} className="space-y-4">
              {error && (
                <Alert variant="error" message={error} />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Тип норматива"
                  type="text"
                  required
                  error={fieldErrors.type}
                  value={normForm.type}
                  onChange={(e) => {
                    setNormForm({ ...normForm, type: e.target.value })
                    if (fieldErrors.type) {
                      setFieldErrors({ ...fieldErrors, type: undefined })
                    }
                  }}
                  placeholder="Например: Подтягивания"
                  disabled={submitting}
                />
                <Select
                  label="Оценка"
                  required
                  error={fieldErrors.status}
                  options={[
                    { value: '-', label: '— (не указана)' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: '4' },
                    { value: '5', label: '5' },
                    { value: 'Б', label: 'Б (больной)' },
                    { value: 'О', label: 'О (освобожден)' },
                  ]}
                  value={normForm.status}
                  onChange={(e) => {
                    setNormForm({ ...normForm, status: e.target.value })
                    if (fieldErrors.status) {
                      setFieldErrors({ ...fieldErrors, status: undefined })
                    }
                  }}
                  disabled={submitting}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberInput
                  label="Значение"
                  step="0.01"
                  value={normForm.value}
                  onChange={(e) =>
                    setNormForm({ ...normForm, value: e.target.value })
                  }
                  disabled={submitting}
                />
                <Input
                  label="Единица измерения"
                  type="text"
                  value={normForm.unit}
                  onChange={(e) =>
                    setNormForm({ ...normForm, unit: e.target.value })
                  }
                  placeholder="раз, сек, м"
                  disabled={submitting}
                />
                <Input
                  label="Дата"
                  type="date"
                  required
                  value={normForm.date}
                  onChange={(e) =>
                    setNormForm({ ...normForm, date: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>
              <Textarea
                label="Комментарий"
                rows={2}
                value={normForm.comment}
                onChange={(e) =>
                  setNormForm({ ...normForm, comment: e.target.value })
                }
                disabled={submitting}
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submitting}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? 'Добавление...' : 'Добавить'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddNorm(false)}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  Отмена
                </Button>
              </div>
            </form>
          </InfoCard>
        )}

      {/* Все нормативы */}
      <InfoCard
          title="Нормативы"
          actions={
            !showAddNorm && athlete.isActive !== false && (
              <Button
                onClick={() => setShowAddNorm(true)}
                variant="primary"
                size="sm"
              >
                Добавить индивидуальный норматив
              </Button>
            )
          }
        >
          {(() => {
            // Используем все нормативы (индивидуальные, групповые, контрольные)
            const allNorms = athlete.norms

            if (allNorms.length === 0) {
              return (
                <div className="text-center py-8">
                  <h3 className="h3 mb-2 text-heading">
                    Нормативы ещё не добавлены
                  </h3>
                  <p className="text-secondary mb-6">
                    Добавьте индивидуальный норматив для этого ученика.
                  </p>
                  {athlete.isActive !== false && (
                    <Button
                      onClick={() => setShowAddNorm(true)}
                      variant="primary"
                    >
                      Добавить индивидуальный норматив
                    </Button>
                  )}
                </div>
              )
            }

            return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип</TableHead>
                    <TableHead>Норматив</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Результат</TableHead>
                    <TableHead>Ед. изм.</TableHead>
                    <TableHead>Оценка</TableHead>
                    <TableHead className="hidden lg:table-cell">Комментарий</TableHead>
                    <TableHead align="right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allNorms.map((norm) => {
                    // Используем название из template, если оно есть, иначе type
                    const normName = norm.template?.name || norm.type
                    // Используем unit из template, если он есть, иначе unit из norm
                    const normUnit = norm.template?.unit || norm.unit
                    const typeLabel = getNormTypeLabel(norm)
                    
                    return (
                    <TableRow key={norm.id}>
                      <TableCell className="font-medium text-sm">
                        {typeLabel}
                      </TableCell>
                      <TableCell className="font-medium">
                        {normName}
                      </TableCell>
                      <TableCell className="text-secondary">
                        {new Date(norm.date).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-secondary">
                        {norm.value !== null && norm.value !== undefined
                          ? norm.value
                          : '—'}
                      </TableCell>
                      <TableCell className="text-secondary">
                        {normUnit || '—'}
                      </TableCell>
                      <TableCell>
                        <GradeBadge grade={norm.status} />
                      </TableCell>
                      <TableCell className="text-secondary hidden lg:table-cell">
                        {norm.comment || '—'}
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {/* Удаление доступно только для индивидуальных нормативов */}
                          {getNormType(norm) === 'INDIVIDUAL' && (
                            <Button
                              onClick={() => handleDeleteNorm(norm.id)}
                              variant="danger"
                              size="sm"
                              className="w-full sm:w-auto"
                            >
                              Удалить
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )
          })()}
      </InfoCard>

      {/* Модальное окно редактирования ученика */}
        <EditAthleteModal
          athleteId={athlete.id}
          athleteFullName={athlete.fullName}
          athleteBirthDate={athlete.birthDate}
          athleteGender={athlete.gender}
          athleteNotes={athlete.notes}
          athleteUinGto={athlete.uinGto}
          athleteHeight={athlete.height}
          athleteWeight={athlete.weight}
          athleteShoeSize={athlete.shoeSize}
          athleteGroupId={athlete.groupId}
          athleteSchoolYear={athlete.group?.schoolYear || athlete.schoolYear || '2024/2025'}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            loadAthlete()
            toast.success('Данные ученика успешно обновлены!')
          }}
        />
    </div>
  )
}

