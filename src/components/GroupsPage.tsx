'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { extractClassFromGroupName } from '@/lib/groupClassExtractor'
import { Button, Input, Select, Textarea, Alert, Card } from '@/components/ui'
import GroupCard from './trainer/GroupCard'

interface Group {
  id: string
  name: string
  description?: string
  schoolYear: string
  createdAt: string
  trainerId: string
  trainer?: {
    id: string
    fullName: string
  } | null
  _count: {
    athletes: number
    lessons: number
  }
}

// Функция для определения текущего учебного года
function getCurrentSchoolYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // getMonth() возвращает 0-11, поэтому +1

  if (month >= 9) {
    // Сентябрь-декабрь: учебный год начинается в текущем году
    return `${year}/${year + 1}`
  } else {
    // Январь-август: учебный год начался в прошлом году
    return `${year - 1}/${year}`
  }
}

// Функция для генерации списка учебных годов (от -5 до +5 от текущего учебного года)
function getSchoolYearOptions(): string[] {
  const current = getCurrentSchoolYear() // "2025/2026"
  const [startStr] = current.split('/')
  const startYear = Number(startStr)
  
  const years: string[] = []
  for (let y = startYear - 5; y <= startYear + 5; y++) {
    years.push(`${y}/${y + 1}`)
  }
  
  return years
}

export default function GroupsPage({ userFullName, userRole }: { userFullName?: string; userRole?: string }) {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(getCurrentSchoolYear())
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schoolYear: getCurrentSchoolYear(), // Значение по умолчанию - текущий учебный год
  })
  const [detectedClass, setDetectedClass] = useState<number | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ schoolYear?: string; name?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  
  // Динамически генерируем список учебных годов
  const schoolYearOptions = getSchoolYearOptions()

  useEffect(() => {
    // При первой загрузке устанавливаем текущий учебный год и загружаем группы
    const currentYear = getCurrentSchoolYear()
    setSelectedSchoolYear(currentYear)
    loadGroups(currentYear)
  }, [])

  useEffect(() => {
    if (selectedSchoolYear === 'all') {
      loadGroups()
    } else if (selectedSchoolYear) {
      loadGroups(selectedSchoolYear)
    }
  }, [selectedSchoolYear])

  const loadGroups = async (schoolYear?: string) => {
    try {
      const url = schoolYear 
        ? `/api/trainer/groups?schoolYear=${encodeURIComponent(schoolYear)}`
        : '/api/trainer/groups'
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      
      setGroups(data.groups)
    } catch (err) {
      setError('Ошибка загрузки групп')
    } finally {
      setLoading(false)
    }
  }

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    // Валидация
    const errors: { schoolYear?: string; name?: string } = {}
    if (!formData.schoolYear) {
      errors.schoolYear = 'Выберите учебный год'
    }
    if (!formData.name.trim()) {
      errors.name = 'Укажите название группы'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/trainer/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания группы')
        return
      }

      setShowAddForm(false)
      setFormData({ name: '', description: '', schoolYear: getCurrentSchoolYear() })
      setDetectedClass(null) // Сбрасываем определенный класс
      setSubmitting(false)
      
      // Перезагружаем группы в зависимости от выбранного года
      if (selectedSchoolYear === 'all') {
        loadGroups()
      } else {
        loadGroups(selectedSchoolYear)
      }
    } catch (err) {
      setError('Ошибка создания группы')
      setSubmitting(false)
    }
  }

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Удалить группу? Все учащиеся и данные будут удалены.')) return

    try {
      const response = await fetch(`/api/trainer/groups/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Ошибка удаления')
      loadGroups()
    } catch (err) {
      setError('Ошибка удаления группы')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-secondary">Загрузка...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Заголовок и контролы */}
      <div className="mb-6 no-print">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="h1 mb-1">Группы</h1>
            {selectedSchoolYear !== 'all' && (
              <p className="text-sm text-blue-600 font-semibold">
                учебный год {selectedSchoolYear}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <label htmlFor="schoolYear" className="text-sm font-medium text-heading whitespace-nowrap">
                Учебный год:
              </label>
              <select
                id="schoolYear"
                value={selectedSchoolYear}
                onChange={(e) => setSelectedSchoolYear(e.target.value)}
                className="flex-1 sm:flex-initial rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-heading px-3 py-2 border text-sm min-w-[140px]"
              >
                <option value="all">Все годы</option>
                {schoolYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => {
                setShowAddForm(!showAddForm)
                if (!showAddForm) {
                  const defaultYear = selectedSchoolYear === 'all' 
                    ? getCurrentSchoolYear()
                    : selectedSchoolYear
                  setFormData({ 
                    name: '', 
                    description: '', 
                    schoolYear: defaultYear
                  })
                  setDetectedClass(null)
                } else {
                  setFormData({ 
                    name: '', 
                    description: '', 
                    schoolYear: getCurrentSchoolYear()
                  })
                }
              }}
              variant={showAddForm ? 'secondary' : 'primary'}
              className="w-full sm:w-auto"
            >
              {showAddForm ? 'Отмена' : 'Добавить группу'}
            </Button>
          </div>
        </div>
      </div>

        {error && (
          <Alert variant="error" message={error} className="mb-4" />
        )}

        {showAddForm && (
          <Card className="mb-6">
            <h3 className="h3 mb-4">
              Добавить группу
            </h3>
            <form onSubmit={handleAddGroup} className="space-y-4">
              <Select
                label="Учебный год"
                required
                error={fieldErrors.schoolYear}
                options={schoolYearOptions.map((year) => ({ value: year, label: year }))}
                value={formData.schoolYear}
                onChange={(e) => {
                  setFormData({ ...formData, schoolYear: e.target.value })
                  if (fieldErrors.schoolYear) {
                    setFieldErrors({ ...fieldErrors, schoolYear: undefined })
                  }
                }}
                disabled={submitting}
              />
              <Input
                label="Название группы"
                type="text"
                required
                error={fieldErrors.name}
                value={formData.name}
                onChange={(e) => {
                  const newName = e.target.value
                  setFormData({ ...formData, name: newName })
                  setDetectedClass(extractClassFromGroupName(newName))
                  if (fieldErrors.name) {
                    setFieldErrors({ ...fieldErrors, name: undefined })
                  }
                }}
                placeholder="Например: 2 А, 3 Б, 5 Г"
                disabled={submitting}
              />
              {/* Информация об автоматическом определении класса */}
              {detectedClass !== null ? (
                <div className="mt-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Класс определён автоматически.</strong> Система определяет школьный класс на основании названия группы. Проверьте, корректно ли указано название группы — от этого зависит автоматический расчёт оценок по normативам.
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Определённый класс: <strong>{detectedClass}</strong>
                  </p>
                </div>
              ) : formData.name.trim() ? (
                <div className="mt-2 p-3 rounded-md bg-yellow-50 border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <strong>Не удалось определить класс группы.</strong> В названии группы отсутствует цифра. Укажите цифру школьного класса в названии, например: "2 А", "3 Б", "5 Г".
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Без корректного класса автоматический расчёт оценок по normативам работать не сможет.
                  </p>
                </div>
              ) : null}
              <Textarea
                label="Описание"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
              <Button 
                type="submit" 
                variant="primary"
                isLoading={submitting}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? 'Создание...' : 'Создать'}
              </Button>
            </form>
          </Card>
        )}

        {(() => {
          // Для ADMIN группируем по тренерам, для TRAINER показываем как обычно
          if (userRole === 'ADMIN') {
            // Группируем группы по тренерам
            const groupedByTrainer = groups.reduce((acc, group) => {
              const trainerKey = group.trainer?.id || 'no-trainer'
              const trainerName = group.trainer?.fullName || 'Без тренера'
              
              if (!acc[trainerKey]) {
                acc[trainerKey] = {
                  trainerId: trainerKey,
                  trainerName,
                  groups: [],
                }
              }
              acc[trainerKey].groups.push(group)
              return acc
            }, {} as Record<string, { trainerId: string; trainerName: string; groups: Group[] }>)

            // Преобразуем в массив и сортируем (группы без тренера в конец)
            const trainerGroups = Object.values(groupedByTrainer).sort((a, b) => {
              if (a.trainerId === 'no-trainer') return 1
              if (b.trainerId === 'no-trainer') return -1
              return a.trainerName.localeCompare(b.trainerName)
            })

            if (groups.length === 0) {
              return (
                <div className="col-span-full">
                  <Card className="text-center py-12">
                    <h3 className="text-lg font-semibold text-heading mb-2">
                      Групп пока нет
                    </h3>
                    <p className="text-secondary mb-6 max-w-md mx-auto">
                      {selectedSchoolYear === 'all' 
                        ? 'Для начала работы создайте группу учащихся.'
                        : `Для учебного года ${selectedSchoolYear} ещё не создано ни одной группы.`
                      }
                    </p>
                    <Button
                      onClick={() => {
                        setShowAddForm(true)
                        if (selectedSchoolYear !== 'all') {
                          setFormData({ 
                            name: '', 
                            description: '', 
                            schoolYear: selectedSchoolYear
                          })
                        }
                      }}
                      variant="primary"
                    >
                      Добавить группу
                    </Button>
                  </Card>
                </div>
              )
            }

            return (
              <div className="space-y-6">
                {trainerGroups.map((trainerGroup) => (
                  <div key={trainerGroup.trainerId} className="space-y-4">
                    <h3 className="h3">
                      Тренер: {trainerGroup.trainerName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {trainerGroup.groups.map((group) => (
                        <GroupCard
                          key={group.id}
                          name={group.name}
                          schoolYear={group.schoolYear}
                          schoolName={group.description}
                          studentsCount={group._count.athletes}
                          lessonsCount={group._count.lessons}
                          onOpen={() => router.push(`/trainer/groups/${group.id}`)}
                          onDelete={() => handleDeleteGroup(group.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          // Для TRAINER показываем как обычно (без группировки)
          if (groups.length === 0) {
            return (
              <Card className="text-center py-12">
                <h3 className="text-lg font-semibold text-heading mb-2">
                  Групп пока нет
                </h3>
                <p className="text-secondary mb-6 max-w-md mx-auto">
                  {selectedSchoolYear === 'all' 
                    ? 'Для начала работы создайте группу учащихся.'
                    : `Для учебного года ${selectedSchoolYear} ещё не создано ни одной группы.`
                  }
                </p>
                <Button
                  onClick={() => {
                    setShowAddForm(true)
                    if (selectedSchoolYear !== 'all') {
                      setFormData({ 
                        name: '', 
                        description: '', 
                        schoolYear: selectedSchoolYear
                      })
                    }
                  }}
                  variant="primary"
                >
                  Добавить группу
                </Button>
              </Card>
            )
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  name={group.name}
                  schoolYear={group.schoolYear}
                  schoolName={group.description}
                  studentsCount={group._count.athletes}
                  lessonsCount={group._count.lessons}
                  onOpen={() => router.push(`/trainer/groups/${group.id}`)}
                  onDelete={() => handleDeleteGroup(group.id)}
                />
              ))}
            </div>
          )
        })()}
    </div>
  )
}

