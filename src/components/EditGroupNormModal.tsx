'use client'

import { useState, useEffect } from 'react'

interface NormData {
  normId?: string
  athleteId: string
  athleteName: string
  value: number | null
  grade: string // Оценка: "-", "2", "3", "4", "5", "Б", "О"
}

interface EditGroupNormModalProps {
  groupId: string
  type: string
  date: string
  unit: string | null
  norms: NormData[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditGroupNormModal({
  groupId,
  type,
  date,
  unit,
  norms: initialNorms,
  isOpen,
  onClose,
  onSuccess,
}: EditGroupNormModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [norms, setNorms] = useState<NormData[]>([])
  const [normDate, setNormDate] = useState(date)

  const gradeCycle = ['-', '2', '3', '4', '5', 'Б', 'О']

  // Инициализируем данные при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      // Преобразуем status в grade при инициализации
      // Если status содержит валидную оценку из gradeCycle - используем её
      // Иначе (старые значения типа "Сдано", "Не сдано" и т.п.) - ставим "-"
      setNorms(
        initialNorms.map((norm) => {
          const currentStatus = norm.status || ''
          const grade = gradeCycle.includes(currentStatus) ? currentStatus : '-'
          return {
            ...norm,
            grade,
          }
        })
      )
      setNormDate(date)
    }
  }, [isOpen, initialNorms, date])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/norms/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          date: normDate,
          originalDate: date, // Старая дата для поиска нормативов
          norms: norms.map((norm) => ({
            normId: norm.normId,
            athleteId: norm.athleteId,
            value: norm.value,
            grade: norm.grade || '-', // Отправляем оценку вместо статуса
            delete: false,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка обновления нормативов')
        setLoading(false)
        return
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError('Ошибка соединения с сервером')
      setLoading(false)
    }
  }

  const updateNorm = (athleteId: string, field: 'value' | 'grade', value: string | number | null) => {
    setNorms((prev) =>
      prev.map((norm) =>
        norm.athleteId === athleteId
          ? { ...norm, [field]: value }
          : norm
      )
    )
  }

  const handleGradeClick = (athleteId: string) => {
    setNorms((prev) => {
      const norm = prev.find((n) => n.athleteId === athleteId)
      if (!norm) return prev

      const currentGrade = norm.grade || '-'
      const currentIndex = gradeCycle.indexOf(currentGrade)
      const nextIndex = (currentIndex + 1) % gradeCycle.length
      const nextGrade = gradeCycle[nextIndex]

      return prev.map((n) =>
        n.athleteId === athleteId ? { ...n, grade: nextGrade } : n
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

  const handleDeleteNorm = async (athleteId: string) => {
    if (!confirm('Удалить норматив для этого ученика?')) return

    const norm = norms.find(n => n.athleteId === athleteId)
    if (!norm || !norm.normId) {
      setError('Норматив не найден')
      return
    }

    try {
      const response = await fetch(`/api/trainer/norms/${norm.normId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Ошибка удаления норматива')
        return
      }

      // Удаляем из локального состояния
      setNorms((prev) => prev.filter((n) => n.athleteId !== athleteId))
    } catch (err) {
      setError('Ошибка удаления норматива')
    }
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
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-heading">
                    Редактировать норматив
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {type} • {new Date(date).toLocaleDateString('ru-RU')}
                    {unit && ` • ${unit}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams({
                        type,
                        date: normDate,
                      })
                      const printUrl = `/trainer/groups/${groupId}/norms/print?${params.toString()}`
                      window.open(printUrl, '_blank')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Печать отчёта
                  </button>
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
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}

              {/* Поле даты зачёта */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Дата зачёта *
                </label>
                <input
                  type="date"
                  required
                  className="mt-1 block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                  value={normDate}
                  onChange={(e) => setNormDate(e.target.value)}
                />
              </div>

              {/* Таблица учащихся */}
              <div className="mb-4">
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ФИО
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Значение
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Оценка
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {norms.map((norm) => (
                        <tr key={norm.athleteId}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {norm.athleteName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              step="0.01"
                              className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-2 py-1 border text-sm"
                              value={norm.value ?? ''}
                              onChange={(e) =>
                                updateNorm(
                                  norm.athleteId,
                                  'value',
                                  e.target.value === '' ? null : parseFloat(e.target.value)
                                )
                              }
                              placeholder="—"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => handleGradeClick(norm.athleteId)}
                              className={`w-12 h-8 border rounded flex items-center justify-center text-sm font-medium transition-colors hover:opacity-80 cursor-pointer ${getGradeColorClass(norm.grade)}`}
                              title="Клик для изменения оценки"
                            >
                              {norm.grade || '-'}
                            </button>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDeleteNorm(norm.athleteId)}
                              className="text-red-600 hover:text-red-900 text-sm"
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
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
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
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

