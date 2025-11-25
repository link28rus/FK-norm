'use client'

import { useState, useEffect } from 'react'

interface Group {
  id: string
  name: string
  schoolYear: string
}

interface EditAthleteModalProps {
  athleteId: string
  athleteFullName: string
  athleteBirthDate?: string | null
  athleteGender?: string | null
  athleteNotes?: string | null
  athleteGroupId: string
  athleteSchoolYear: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditAthleteModal({
  athleteId,
  athleteFullName,
  athleteBirthDate,
  athleteGender,
  athleteNotes,
  athleteGroupId,
  athleteSchoolYear,
  isOpen,
  onClose,
  onSuccess,
}: EditAthleteModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  
  const [fullName, setFullName] = useState(athleteFullName)
  const [birthDate, setBirthDate] = useState(
    athleteBirthDate ? new Date(athleteBirthDate).toISOString().split('T')[0] : ''
  )
  const [gender, setGender] = useState(athleteGender || '')
  const [notes, setNotes] = useState(athleteNotes || '')
  const [groupId, setGroupId] = useState(athleteGroupId)

  // Инициализируем данные при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      setFullName(athleteFullName)
      setBirthDate(
        athleteBirthDate ? new Date(athleteBirthDate).toISOString().split('T')[0] : ''
      )
      setGender(athleteGender || '')
      setNotes(athleteNotes || '')
      setGroupId(athleteGroupId)
      setError('')
      loadGroups()
    }
  }, [isOpen, athleteFullName, athleteBirthDate, athleteGender, athleteNotes, athleteGroupId])

  const loadGroups = async () => {
    setLoadingGroups(true)
    try {
      // Загружаем группы текущего учебного года
      const response = await fetch(`/api/trainer/groups?schoolYear=${encodeURIComponent(athleteSchoolYear)}`)
      if (!response.ok) throw new Error('Ошибка загрузки групп')
      const data = await response.json()
      setGroups(data.groups || [])
    } catch (err) {
      setError('Ошибка загрузки списка групп')
    } finally {
      setLoadingGroups(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Валидация
    if (!fullName.trim()) {
      setError('ФИО обязательно')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/trainer/athletes/${athleteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          birthDate: birthDate || null,
          gender: gender || null,
          notes: notes.trim() || null,
          groupId: groupId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка обновления данных ученика')
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Центрирование модального окна */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* Модальное окно */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg leading-6 font-medium text-heading mb-4">
                Редактирование данных ученика
              </h3>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    ФИО *
                  </label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Дата рождения
                  </label>
                  <input
                    type="date"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Пол
                  </label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Не указан</option>
                    <option value="М">Мужской</option>
                    <option value="Ж">Женский</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Группа
                  </label>
                  {loadingGroups ? (
                    <div className="mt-1 text-sm text-gray-500">Загрузка групп...</div>
                  ) : (
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      disabled={loading}
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Примечание
                  </label>
                  <textarea
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={loading}
                    placeholder="Дополнительная информация о ученике"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

