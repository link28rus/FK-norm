'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from './Header'
import { extractClassFromGroupName } from '@/lib/groupClassExtractor'
import { Button, Input, Select, Textarea, Alert, Card } from '@/components/ui'

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

    if (!formData.schoolYear) {
      setError('Учебный год обязателен')
      return
    }

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
      
      // Перезагружаем группы в зависимости от выбранного года
      if (selectedSchoolYear === 'all') {
        loadGroups()
      } else {
        loadGroups(selectedSchoolYear)
      }
    } catch (err) {
      setError('Ошибка создания группы')
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Группы" userFullName={userFullName} userRole={userRole} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 no-print">
          <h1 className="text-3xl font-bold text-heading">Группы</h1>
          {selectedSchoolYear !== 'all' && (
            <p className="mt-1 text-sm text-blue-600 font-semibold">
              учебный год {selectedSchoolYear}
            </p>
          )}
        </div>
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="schoolYear" className="text-sm font-medium text-gray-700">
                Учебный год:
              </label>
                          <select
                            id="schoolYear"
                            value={selectedSchoolYear}
                            onChange={(e) => setSelectedSchoolYear(e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-heading px-3 py-2 border text-sm"
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
                    ? getCurrentSchoolYear() // Используем текущий учебный год
                    : selectedSchoolYear
                  setFormData({ 
                    name: '', 
                    description: '', 
                    schoolYear: defaultYear
                  })
                  setDetectedClass(null) // Сбрасываем определенный класс при открытии формы
                } else {
                  // При закрытии формы сбрасываем на текущий учебный год
                  setFormData({ 
                    name: '', 
                    description: '', 
                    schoolYear: getCurrentSchoolYear()
                  })
                }
              }}
              variant={showAddForm ? 'secondary' : 'primary'}
            >
              {showAddForm ? 'Отмена' : 'Добавить группу'}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        {showAddForm && (
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-heading mb-4">
              Добавить группу
            </h3>
            <form onSubmit={handleAddGroup} className="space-y-4">
              <Select
                label="Учебный год"
                required
                options={schoolYearOptions.map((year) => ({ value: year, label: year }))}
                value={formData.schoolYear}
                onChange={(e) =>
                  setFormData({ ...formData, schoolYear: e.target.value })
                }
              />
              <Input
                label="Название группы"
                type="text"
                required
                value={formData.name}
                onChange={(e) => {
                  const newName = e.target.value
                  setFormData({ ...formData, name: newName })
                  setDetectedClass(extractClassFromGroupName(newName))
                }}
                placeholder="Например: 2 А, 3 Б, 5 Г"
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
              <Button type="submit" variant="primary">
                Создать
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
                <div className="col-span-full bg-white shadow rounded-lg p-6">
                  <p className="text-center text-gray-500">Нет групп</p>
                </div>
              )
            }

            return (
              <div className="space-y-6">
                {trainerGroups.map((trainerGroup) => (
                  <div key={trainerGroup.trainerId} className="space-y-3">
                    <h3 className="text-lg font-semibold text-heading mb-2">
                      Тренер: {trainerGroup.trainerName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {trainerGroup.groups.map((group) => (
                        <div
                          key={group.id}
                          className="bg-white shadow rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-heading">
                                {group.name}
                              </h3>
                              <p className="text-xs text-indigo-600 font-medium mt-1">
                                {group.schoolYear}
                              </p>
                              {group.description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {group.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                            <span>Учащихся: {group._count.athletes}</span>
                            <span>Уроков: {group._count.lessons}</span>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => router.push(`/trainer/groups/${group.id}`)}
                              variant="primary"
                              className="flex-1"
                            >
                              Открыть
                            </Button>
                            <Button
                              onClick={() => handleDeleteGroup(group.id)}
                              variant="danger"
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          // Для TRAINER показываем как обычно (без группировки)
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.length === 0 ? (
                <div className="col-span-full bg-white shadow rounded-lg p-6">
                  <p className="text-center text-gray-500">Нет групп</p>
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="bg-white shadow rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-heading">
                          {group.name}
                        </h3>
                        <p className="text-xs text-indigo-600 font-medium mt-1">
                          {group.schoolYear}
                        </p>
                        {group.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {group.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                      <span>Учащихся: {group._count.athletes}</span>
                      <span>Уроков: {group._count.lessons}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => router.push(`/trainer/groups/${group.id}`)}
                        variant="primary"
                        className="flex-1"
                      >
                        Открыть
                      </Button>
                      <Button
                        onClick={() => handleDeleteGroup(group.id)}
                        variant="danger"
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })()}
      </main>
    </div>
  )
}

