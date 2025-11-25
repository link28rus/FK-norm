'use client'

import { useState, useEffect } from 'react'

interface Athlete {
  id: string
  fullName: string
}

interface BulkNormModalProps {
  groupId: string
  athletes: Athlete[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface AthleteNormData {
  athleteId: string
  included: boolean
  value: string
  grade: string // Оценка: "-", "2", "3", "4", "5", "Б", "О"
}

export default function BulkNormModal({
  groupId,
  athletes,
  isOpen,
  onClose,
  onSuccess,
}: BulkNormModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    type: '',
    date: new Date().toISOString().split('T')[0],
    unit: '',
    defaultValue: '',
  })
  const [athletesData, setAthletesData] = useState<AthleteNormData[]>([])

  const gradeCycle = ['-', '2', '3', '4', '5', 'Б', 'О']

  // Инициализируем данные учащихся при открытии модального окна
  useEffect(() => {
    if (isOpen && athletes.length > 0) {
      setAthletesData(
        athletes.map((athlete) => ({
          athleteId: athlete.id,
          included: true,
          value: '',
          grade: '-', // По умолчанию прочерк
        }))
      )
    }
  }, [isOpen, athletes])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/norms/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          date: formData.date,
          unit: formData.unit || null,
          defaultValue: formData.defaultValue || null,
          athletes: athletesData.map((a) => ({
            athleteId: a.athleteId,
            included: a.included,
            value: a.value,
            grade: a.grade || '-', // Отправляем оценку вместо статуса
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания нормативов')
        setLoading(false)
        return
      }

      // Успешно создано
      setFormData({
        type: '',
        date: new Date().toISOString().split('T')[0],
        unit: '',
        defaultValue: '',
      })
      setAthletesData([])
      onSuccess()
      onClose()
    } catch (err) {
      setError('Ошибка соединения с сервером')
      setLoading(false)
    }
  }

  const toggleAthlete = (athleteId: string) => {
    setAthletesData((prev) =>
      prev.map((a) =>
        a.athleteId === athleteId ? { ...a, included: !a.included } : a
      )
    )
  }

  const updateAthleteData = (athleteId: string, field: 'value' | 'grade', value: string) => {
    setAthletesData((prev) =>
      prev.map((a) => (a.athleteId === athleteId ? { ...a, [field]: value } : a))
    )
  }

  const handleGradeClick = (athleteId: string) => {
    setAthletesData((prev) => {
      const athlete = prev.find((a) => a.athleteId === athleteId)
      if (!athlete) return prev

      const currentGrade = athlete.grade || '-'
      const currentIndex = gradeCycle.indexOf(currentGrade)
      const nextIndex = (currentIndex + 1) % gradeCycle.length
      const nextGrade = gradeCycle[nextIndex]

      return prev.map((a) =>
        a.athleteId === athleteId ? { ...a, grade: nextGrade } : a
      )
    })
  }

  const getGradeColorClass = (grade: string): string => {
    if (grade === '-' || !grade) {
      return 'bg-gray-50 text-gray-400 border-gray-200'
    }
    
    if (grade === '2' || grade === 'Б') {
      return 'bg-red-50 text-red-900 border-red-300 font-semibold'
    }
    
    if (grade === '4' || grade === '5') {
      return 'bg-green-50 text-green-900 border-green-300 font-semibold'
    }
    
    if (grade === '3') {
      return 'bg-yellow-50 text-yellow-900 border-yellow-300 font-semibold'
    }
    
    if (grade === 'О') {
      return 'bg-blue-50 text-blue-900 border-blue-300 font-semibold'
    }
    
    return 'bg-gray-50 text-gray-400 border-gray-200'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-heading">
                  Добавить норматив для группы
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Закрыть</span>
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}

              {/* Общие поля */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-heading mb-1">
                    Вид норматива *
                  </label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-heading px-3 py-2 border"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    placeholder="Например: Бег 100м"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-heading mb-1">
                    Дата зачёта *
                  </label>
                  <input
                    type="date"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-heading px-3 py-2 border"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-heading mb-1">
                    Единица измерения
                  </label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-heading px-3 py-2 border"
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                    placeholder="Например: сек, раз, м"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-heading mb-1">
                    Значение по умолчанию
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-heading px-3 py-2 border"
                    value={formData.defaultValue}
                    onChange={(e) =>
                      setFormData({ ...formData, defaultValue: e.target.value })
                    }
                    placeholder="Опционально"
                  />
                </div>
              </div>

              {/* Таблица учащихся */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-heading mb-2">
                  Учащиеся группы:
                </h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Включить
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ФИО
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Значение
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Оценка
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {athletes.map((athlete) => {
                        const athleteData = athletesData.find(
                          (a) => a.athleteId === athlete.id
                        )
                        if (!athleteData) return null

                        return (
                          <tr key={athlete.id}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={athleteData.included}
                                onChange={() => toggleAthlete(athlete.id)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-heading">
                              {athlete.fullName}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!athleteData.included}
                                className={`w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-heading px-2 py-1 border text-sm ${
                                  !athleteData.included
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : ''
                                }`}
                                value={athleteData.value}
                                onChange={(e) =>
                                  updateAthleteData(athlete.id, 'value', e.target.value)
                                }
                                placeholder={formData.defaultValue || '—'}
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <button
                                type="button"
                                onClick={() => handleGradeClick(athlete.id)}
                                disabled={!athleteData.included}
                                className={`w-12 h-8 border rounded flex items-center justify-center text-sm font-medium transition-colors ${
                                  !athleteData.included
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : getGradeColorClass(athleteData.grade) + ' hover:opacity-80 cursor-pointer'
                                }`}
                                title="Клик для изменения оценки"
                              >
                                {athleteData.grade || '-'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Блок с обозначениями */}
                <div className="mt-4 text-sm text-gray-600">
                  <p className="font-semibold mb-1">Обозначения:</p>
                  <p>Б — болен (уважительная причина отсутствия).</p>
                  <p>О — освобождён от выполнения норматива.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {loading ? 'Создание...' : 'Создать нормативы'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

