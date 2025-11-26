'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input, Select, Textarea, Button, Alert, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState, InfoCard, useToast } from '@/components/ui'

interface Group {
  id: string
  name: string
  description?: string
  schoolYear: string
  class?: number | null
}

interface Athlete {
  id: string
  fullName: string
  birthDate?: string
  gender?: string
  notes?: string
  uinGto?: string | null
}

export default function GroupDetailPage({
  groupId,
  userFullName,
  userRole,
}: {
  groupId: string
  userFullName?: string
  userRole?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [group, setGroup] = useState<Group | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    gender: '',
    notes: '',
    uinGto: '',
  })
  const [submittingAthlete, setSubmittingAthlete] = useState(false)
  const [athleteFieldErrors, setAthleteFieldErrors] = useState<{ fullName?: string; gender?: string }>({})

  useEffect(() => {
    loadGroup()
    loadAthletes()
  }, [groupId])

  const loadGroup = async () => {
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setGroup(data.group)
    } catch (err) {
      setError('Ошибка загрузки группы')
    } finally {
      setLoading(false)
    }
  }

  const loadAthletes = async () => {
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/athletes`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setAthletes(data.athletes)
    } catch (err) {
      setError('Ошибка загрузки учащихся')
    }
  }

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAthleteFieldErrors({})

    // Валидация
    const errors: { fullName?: string; gender?: string } = {}
    if (!formData.fullName.trim()) {
      errors.fullName = 'Укажите ФИО ученика'
    }
    if (!formData.gender) {
      errors.gender = 'Выберите пол'
    }

    if (Object.keys(errors).length > 0) {
      setAthleteFieldErrors(errors)
      return
    }

    setSubmittingAthlete(true)

    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/athletes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания')
        setSubmittingAthlete(false)
        return
      }

      setShowAddForm(false)
      setFormData({ fullName: '', birthDate: '', gender: '', notes: '', uinGto: '' })
      setSubmittingAthlete(false)
      toast.success('Ученик успешно добавлен!')
      loadAthletes()
    } catch (err) {
      setError('Ошибка создания учащегося')
      setSubmittingAthlete(false)
    }
  }

  const handleDeleteAthlete = async (id: string) => {
    if (!confirm('Удалить учащегося?')) return

    try {
      const response = await fetch(
        `/api/trainer/groups/${groupId}/athletes/${id}`,
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error('Ошибка удаления')
      toast.success('Ученик успешно удалён!')
      loadAthletes()
    } catch (err) {
      setError('Ошибка удаления учащегося')
    }
  }

  const handleImportFile = async (file: File) => {
    setError('')

    // Проверяем расширение файла
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      setError('Файл должен быть в формате Excel (.xlsx или .xls)')
      return
    }

    // Создаём FormData
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/athletes/import`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка импорта файла')
        return
      }

      // Успешный импорт
      toast.success(data.message || `Успешно импортировано ${data.imported} учеников`)

      // Если есть ошибки в некоторых строках, показываем их
      if (data.errors && data.errors.length > 0) {
        const errorsText = data.errors
          .map((e: { row: number; error: string }) => `Строка ${e.row}: ${e.error}`)
          .join('\n')
        console.warn('Ошибки при импорте:', errorsText)
      }

      // Обновляем список учеников
      loadAthletes()
    } catch (err) {
      setError('Ошибка соединения с сервером')
      console.error('Import error:', err)
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
      <div className="flex items-center justify-center py-12">
        <div className="text-secondary">Загрузка...</div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-secondary">Группа не найдена</div>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <Alert variant="error" message={error} className="mb-4" />
      )}

      {/* Вкладка: Ученики */}
      <div>
        <div className="mb-6 no-print">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h2 className="h2">Ученики</h2>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <a
                href={`/api/trainer/groups/${groupId}/athletes/template`}
                download="4A.xlsx"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline text-center sm:text-left"
                title="Скачать шаблон Excel"
              >
                📥 Скачать шаблон
              </a>
              <Button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.xlsx,.xls'
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    await handleImportFile(file)
                  }
                  input.click()
                }}
                variant="primary"
                size="sm"
                className="w-full sm:w-auto"
              >
                Добавить из файла
              </Button>
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                variant={showAddForm ? 'secondary' : 'primary'}
                size="sm"
                className="w-full sm:w-auto"
              >
                {showAddForm ? 'Отмена' : 'Добавить ученика'}
              </Button>
            </div>
          </div>
        </div>

        {showAddForm && (
          <div className="mb-6">
            <InfoCard title="Добавить ученика">
              <form onSubmit={handleAddAthlete} className="space-y-4">
                <Input
                  label="ФИО"
                  type="text"
                  required
                  error={athleteFieldErrors.fullName}
                  value={formData.fullName}
                  onChange={(e) => {
                    setFormData({ ...formData, fullName: e.target.value })
                    if (athleteFieldErrors.fullName) {
                      setAthleteFieldErrors({ ...athleteFieldErrors, fullName: undefined })
                    }
                  }}
                  disabled={submittingAthlete}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Дата рождения"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) =>
                      setFormData({ ...formData, birthDate: e.target.value })
                    }
                    disabled={submittingAthlete}
                  />
                  <Select
                    label="Пол"
                    required
                    error={athleteFieldErrors.gender}
                    options={[
                      { value: '', label: 'Не указан' },
                      { value: 'М', label: 'Мужской' },
                      { value: 'Ж', label: 'Женский' },
                    ]}
                    value={formData.gender}
                    onChange={(e) => {
                      setFormData({ ...formData, gender: e.target.value })
                      if (athleteFieldErrors.gender) {
                        setAthleteFieldErrors({ ...athleteFieldErrors, gender: undefined })
                      }
                    }}
                    disabled={submittingAthlete}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    УИН ГТО
                  </label>
                  <input
                    type="text"
                    name="uinGto"
                    value={formData.uinGto ?? ""}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, ""); // только цифры
                      
                      // автоформатирование в формат 00-00-0000000
                      if (v.length > 2) v = v.slice(0, 2) + "-" + v.slice(2);
                      if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
                      if (v.length > 13) v = v.slice(0, 13);
                      
                      setFormData({ ...formData, uinGto: v });
                    }}
                    placeholder="00-00-0000000"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={submittingAthlete}
                  />
                </div>
                <Textarea
                  label="Примечания"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  disabled={submittingAthlete}
                />
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={submittingAthlete}
                    disabled={submittingAthlete}
                  >
                    {submittingAthlete ? 'Создание...' : 'Создать'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddForm(false)}
                    disabled={submittingAthlete}
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            </InfoCard>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Возраст</TableHead>
              <TableHead align="right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {athletes.length === 0 ? (
              <TableEmptyState
                colSpan={3}
                message="Ученики не добавлены"
                actionLabel="Добавить ученика"
                onAction={() => setShowAddForm(true)}
              />
            ) : (
              athletes.map((athlete) => (
                <TableRow key={athlete.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/trainer/athletes/${athlete.id}`}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      {athlete.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-secondary">
                    {calculateAge(athlete.birthDate)
                      ? `${calculateAge(athlete.birthDate)} лет`
                      : '—'}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Button
                        onClick={() =>
                          router.push(`/trainer/athletes/${athlete.id}`)
                        }
                        variant="secondary"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        Открыть
                      </Button>
                      <Button
                        onClick={() => handleDeleteAthlete(athlete.id)}
                        variant="danger"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        Удалить
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
