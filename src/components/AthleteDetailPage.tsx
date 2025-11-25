'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from './Header'
import EditAthleteModal from './EditAthleteModal'

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
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddNorm, setShowAddNorm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [normForm, setNormForm] = useState({
    type: '',
    value: '',
    unit: '',
    status: 'Сдано',
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
        status: 'Сдано',
        date: new Date().toISOString().split('T')[0],
        comment: '',
      })
      loadAthlete()
    } catch (err) {
      setError('Ошибка создания норматива')
    }
  }

  const handleDeleteNorm = async (id: string) => {
    if (!confirm('Удалить норматив?')) return

    try {
      const response = await fetch(`/api/trainer/norms/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Ошибка удаления')
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
    <div className="min-h-screen bg-gray-50">
      <Header title={athlete.fullName} userFullName={userFullName} userRole={userRole} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 no-print">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            ← Назад
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-800">{successMessage}</div>
          </div>
        )}

        {/* Заголовок */}
        <div className="mb-4 no-print">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-heading">{athlete.fullName}</h1>
            <button
              onClick={() => setShowEditModal(true)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              title="Редактировать данные ученика"
            >
              ✏️ Редактировать
            </button>
          </div>
          {athlete.group && (
            <p className="mt-1 text-sm text-blue-600 font-semibold">
              {athlete.group.name} · учебный год {athlete.group.schoolYear || athlete.schoolYear}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Данные учащегося */}
          <div className="bg-white shadow rounded-lg p-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              {athlete.group && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Группа</dt>
                  <dd className="mt-1 text-sm text-gray-900">{athlete.group.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Дата рождения</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {athlete.birthDate
                    ? new Date(athlete.birthDate).toLocaleDateString('ru-RU')
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Возраст</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {calculateAge(athlete.birthDate)
                    ? `${calculateAge(athlete.birthDate)} лет`
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Пол</dt>
                <dd className="mt-1 text-sm text-gray-900">{athlete.gender || '-'}</dd>
              </div>
              {athlete.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Примечания</dt>
                  <dd className="mt-1 text-sm text-gray-900">{athlete.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Нормативы */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-title font-semibold text-heading">
                Нормативы
              </h2>
              <button
                onClick={() => setShowAddNorm(!showAddNorm)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {showAddNorm ? 'Отмена' : 'Добавить норматив'}
              </button>
            </div>

            {showAddNorm && (
              <form onSubmit={handleAddNorm} className="mb-6 space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Тип норматива *
                    </label>
                    <input
                      type="text"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={normForm.type}
                      onChange={(e) =>
                        setNormForm({ ...normForm, type: e.target.value })
                      }
                      placeholder="Например: Подтягивания"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Статус *
                    </label>
                    <select
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={normForm.status}
                      onChange={(e) =>
                        setNormForm({ ...normForm, status: e.target.value })
                      }
                    >
                      <option value="Сдано">Сдано</option>
                      <option value="Не сдано">Не сдано</option>
                      <option value="Освобожден">Освобожден</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Значение
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={normForm.value}
                      onChange={(e) =>
                        setNormForm({ ...normForm, value: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Единица измерения
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={normForm.unit}
                      onChange={(e) =>
                        setNormForm({ ...normForm, unit: e.target.value })
                      }
                      placeholder="раз, сек, м"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Дата *
                    </label>
                    <input
                      type="date"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={normForm.date}
                      onChange={(e) =>
                        setNormForm({ ...normForm, date: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Комментарий
                  </label>
                  <textarea
                    rows={2}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={normForm.comment}
                    onChange={(e) =>
                      setNormForm({ ...normForm, comment: e.target.value })
                    }
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Добавить
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Тип
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Значение
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Комментарий
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {athlete.norms.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        Нет нормативов
                      </td>
                    </tr>
                  ) : (
                    athlete.norms.map((norm) => (
                      <tr key={norm.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(norm.date).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {norm.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {norm.value !== null && norm.value !== undefined
                            ? `${norm.value}${norm.unit ? ` ${norm.unit}` : ''}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              norm.status === 'Сдано'
                                ? 'bg-green-100 text-green-800'
                                : norm.status === 'Не сдано'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {norm.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {norm.comment || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeleteNorm(norm.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

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
            setSuccessMessage('Данные ученика успешно обновлены!')
            setTimeout(() => setSuccessMessage(''), 3000)
          }}
        />
      </main>
    </div>
  )
}

