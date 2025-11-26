'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EditAthleteModal from './EditAthleteModal'
import { Input, NumberInput, Select, Textarea, Button, Alert, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState, GradeBadge, InfoCard, useToast } from '@/components/ui'

interface Athlete {
  id: string
  fullName: string
  birthDate?: string
  gender?: string
  notes?: string
  groupId: string
  schoolYear?: string
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

      {/* Заголовок страницы */}
      <div className="mb-4">
        <h1 className="h1">{athlete.fullName}</h1>
        {athlete.group && (
          <p className="mt-1 text-sm text-secondary">
            {athlete.group.name} · учебный год {athlete.group.schoolYear || athlete.schoolYear}
          </p>
        )}
      </div>

      {/* Данные учащегося */}
      <InfoCard
        title="Данные ученика"
        actions={
          <Button
            onClick={() => setShowEditModal(true)}
            variant="secondary"
            size="sm"
          >
            Редактировать
          </Button>
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

      {/* Индивидуальные нормативы */}
      <InfoCard
          title="Индивидуальные нормативы"
          actions={
            !showAddNorm && (
              <Button
                onClick={() => setShowAddNorm(true)}
                variant="primary"
                size="sm"
              >
                Добавить норматив
              </Button>
            )
          }
        >
          {(() => {
            // API уже фильтрует только индивидуальные нормативы, но для безопасности оставляем фильтр
            const individualNorms = athlete.norms.filter(
              (norm) => norm.normType === 'INDIVIDUAL' || !norm.normType // Для обратной совместимости
            )

            if (individualNorms.length === 0) {
              return (
                <div className="text-center py-8">
                  <h3 className="h3 mb-2 text-heading">
                    Индивидуальные нормативы ещё не добавлены
                  </h3>
                  <p className="text-secondary mb-6">
                    Добавьте индивидуальный норматив для этого ученика.
                  </p>
                  <Button
                    onClick={() => setShowAddNorm(true)}
                    variant="primary"
                  >
                    Добавить норматив
                  </Button>
                </div>
              )
            }

            return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип норматива</TableHead>
                    <TableHead>Результат ученика</TableHead>
                    <TableHead>Оценка</TableHead>
                    <TableHead className="hidden md:table-cell">Дата выполнения</TableHead>
                    <TableHead className="hidden lg:table-cell">Комментарий</TableHead>
                    <TableHead align="right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {individualNorms.map((norm) => (
                    <TableRow key={norm.id}>
                      <TableCell className="font-medium">
                        {norm.type}
                      </TableCell>
                      <TableCell className="text-secondary">
                        {norm.value !== null && norm.value !== undefined
                          ? `${norm.value}${norm.unit ? ` ${norm.unit}` : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <GradeBadge grade={norm.status} />
                      </TableCell>
                      <TableCell className="text-secondary hidden md:table-cell">
                        {new Date(norm.date).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-secondary hidden lg:table-cell">
                        {norm.comment || '—'}
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            onClick={() => handleDeleteNorm(norm.id)}
                            variant="danger"
                            size="sm"
                            className="w-full sm:w-auto"
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
          })()}
      </InfoCard>

      {/* Модальное окно редактирования ученика */}
        <EditAthleteModal
          athleteId={athlete.id}
          athleteFullName={athlete.fullName}
          athleteBirthDate={athlete.birthDate}
          athleteGender={athlete.gender}
          athleteNotes={athlete.notes}
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

