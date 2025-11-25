'use client'

import { useState, useEffect } from 'react'
import Header from './Header'

interface Trainer {
  id: string
  email: string
  role: string
  isBlocked: boolean
  activeUntil?: string | null
  createdAt: string
  trainerProfile?: {
    fullName: string
    phone?: string
  }
}

export default function AdminPanel() {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null)
  const [activeUntilUserId, setActiveUntilUserId] = useState<string | null>(null)
  const [activeUntilDate, setActiveUntilDate] = useState('')

  // Форма добавления тренера
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    phone: '',
    password: '',
  })

  useEffect(() => {
    loadTrainers()
  }, [])

  const loadTrainers = async () => {
    try {
      const response = await fetch('/api/admin/trainers')
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setTrainers(data.trainers)
    } catch (err) {
      setError('Ошибка загрузки списка тренеров')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await fetch('/api/admin/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания тренера')
        return
      }

      // Показываем пароль, если он был сгенерирован
      if (data.password) {
        setNewPassword(data.password)
        setResetPasswordId(data.trainer.id)
      }

      setShowAddForm(false)
      setFormData({ email: '', fullName: '', phone: '', password: '' })
      loadTrainers()
    } catch (err) {
      setError('Ошибка создания тренера')
    }
  }

  // Старая функция toggle-block больше не используется, заменена на handleBlockUntil/handleUnblock

  const handleResetPassword = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/trainers/${id}/reset-password`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка сброса пароля')
        return
      }

      setNewPassword(data.password)
      setResetPasswordId(id)
    } catch (err) {
      setError('Ошибка сброса пароля')
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Вы действительно хотите удалить пользователя?')) return

    setError('')
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка удаления пользователя')
        return
      }

      loadTrainers()
    } catch (err) {
      setError('Ошибка удаления пользователя')
    }
  }

  const handleChangeRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'TRAINER' : 'ADMIN'
    const action = newRole === 'ADMIN' ? 'назначить администратором' : 'снять роль администратора'
    
    if (!confirm(`Вы действительно хотите ${action} этого пользователя?`)) return

    setError('')
    try {
      const response = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка изменения роли')
        return
      }

      loadTrainers()
    } catch (err) {
      setError('Ошибка изменения роли')
    }
  }

  const handleSetActiveUntil = async (id: string) => {
    if (!activeUntilDate) {
      setError('Выберите дату окончания срока действия')
      return
    }

    setError('')
    try {
      console.log('Sending activeUntil:', activeUntilDate)
      const response = await fetch(`/api/admin/users/${id}/active-until`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUntil: activeUntilDate }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('API error:', data)
        setError(data.error || data.details || 'Ошибка установки срока действия')
        return
      }

      setActiveUntilUserId(null)
      setActiveUntilDate('')
      await loadTrainers()
    } catch (err: any) {
      console.error('Request error:', err)
      setError(err.message || 'Ошибка установки срока действия')
    }
  }

  const handleRemoveActiveUntil = async (id: string) => {
    setError('')
    try {
      const response = await fetch(`/api/admin/users/${id}/active-until`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUntil: null }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка снятия ограничения')
        return
      }

      loadTrainers()
    } catch (err) {
      setError('Ошибка снятия ограничения')
    }
  }

  const getStatus = (trainer: Trainer): { text: string; color: string } => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    // Ручная блокировка
    if (trainer.isBlocked) {
      return {
        text: 'Заблокирован (вручную)',
        color: 'bg-red-100 text-red-800',
      }
    }
    
    // Проверяем срок действия
    if (trainer.activeUntil) {
      const activeUntilDate = new Date(trainer.activeUntil)
      activeUntilDate.setHours(0, 0, 0, 0)
      
      // Срок действия истёк
      if (now > activeUntilDate) {
        return {
          text: 'Срок действия истёк',
          color: 'bg-red-100 text-red-800',
        }
      }
      
      // Активен до указанной даты
      return {
        text: `Активен до ${activeUntilDate.toLocaleDateString('ru-RU')}`,
        color: 'bg-yellow-100 text-yellow-800',
      }
    }
    
    // Без ограничений
    return {
      text: 'Активен',
      color: 'bg-green-100 text-green-800',
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Админ-панель" showTrainerCabinetLink={true} userRole="ADMIN" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 no-print">
          <h1 className="text-3xl font-bold text-heading">Админ-панель</h1>
        </div>
        <div className="mb-6 space-y-4 no-print">
          <div className="flex gap-4">
            <a
              href="/admin/norm-templates"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Шаблоны нормативов
            </a>
          </div>
          <div className="flex justify-between items-center">
            <h2 className="text-title font-semibold text-heading">Тренеры</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {showAddForm ? 'Отмена' : 'Добавить тренера'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {newPassword && resetPasswordId && (
          <div className="mb-4 rounded-md bg-green-50 p-4 border border-green-200">
            <div className="text-sm font-medium text-green-800 mb-2">
              Новый пароль для тренера:
            </div>
            <div className="text-lg font-mono bg-white p-2 rounded border border-green-300 mb-2">
              {newPassword}
            </div>
            <button
              onClick={() => {
                setNewPassword(null)
                setResetPasswordId(null)
              }}
              className="text-sm text-green-700 hover:text-green-900 underline"
            >
              Закрыть
            </button>
          </div>
        )}

        {showAddForm && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-heading mb-4">Добавить тренера</h3>
            <form onSubmit={handleAddTrainer} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-heading mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-heading px-3 py-2"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-heading mb-1">
                  ФИО *
                </label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-heading px-3 py-2"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-heading mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-heading px-3 py-2"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-heading mb-1">
                  Пароль (оставьте пустым для автогенерации)
                </label>
                <input
                  type="password"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-heading px-3 py-2"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Создать
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ФИО
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Роль
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата создания
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trainers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Нет пользователей
                      </td>
                    </tr>
                  ) : (
                    trainers.map((trainer) => {
                      const status = getStatus(trainer)
                      const hasActiveUntil = trainer.activeUntil !== null && trainer.activeUntil !== undefined
                      const activeUntilDate = trainer.activeUntil ? new Date(trainer.activeUntil) : null
                      const now = new Date()
                      now.setHours(0, 0, 0, 0)
                      const isExpired = activeUntilDate && now > activeUntilDate
                      
                      return (
                        <tr key={trainer.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-heading">
                            {trainer.trainerProfile?.fullName || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {trainer.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                trainer.role === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {trainer.role === 'ADMIN' ? 'Администратор' : 'Тренер'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}`}>
                                {status.text}
                              </span>
                              {hasActiveUntil && !isExpired && activeUntilDate && (
                                <div className="text-xs text-gray-500">
                                  Активен до {activeUntilDate.toLocaleDateString('ru-RU')}
                                </div>
                              )}
                              {hasActiveUntil && isExpired && (
                                <div className="text-xs text-red-500">
                                  Срок действия истёк
                                </div>
                              )}
                              {!hasActiveUntil && (
                                <div className="text-xs text-gray-500">
                                  Без ограничения по дате
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(trainer.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex flex-wrap gap-2 justify-end">
                              {trainer.role !== 'ADMIN' && (
                                <button
                                  onClick={() => handleChangeRole(trainer.id, trainer.role)}
                                  className="text-purple-600 hover:text-purple-900"
                                >
                                  Назначить админом
                                </button>
                              )}
                              {trainer.role === 'ADMIN' && (
                                <button
                                  onClick={() => handleChangeRole(trainer.id, trainer.role)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Снять админа
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setActiveUntilUserId(trainer.id)
                                  if (trainer.activeUntil) {
                                    const date = new Date(trainer.activeUntil)
                                    setActiveUntilDate(date.toISOString().split('T')[0])
                                  } else {
                                    setActiveUntilDate('')
                                  }
                                }}
                                className="text-orange-600 hover:text-orange-900"
                              >
                                {hasActiveUntil ? 'Изменить срок действия' : 'Ограничить по дате...'}
                              </button>
                              {hasActiveUntil && (
                                <button
                                  onClick={() => handleRemoveActiveUntil(trainer.id)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Снять ограничение
                                </button>
                              )}
                              <button
                                onClick={() => handleResetPassword(trainer.id)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Сбросить пароль
                              </button>
                              <button
                                onClick={() => handleDeleteUser(trainer.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Модальное окно установки срока действия */}
        {activeUntilUserId && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={() => {
                  setActiveUntilUserId(null)
                  setActiveUntilDate('')
                }}
              />
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-heading">
                      Срок действия аккаунта
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveUntilUserId(null)
                        setActiveUntilDate('')
                      }}
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
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-heading mb-1">
                      Аккаунт активен до (дата включительно) *
                    </label>
                    <input
                      type="date"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-heading px-3 py-2 border"
                      value={activeUntilDate}
                      onChange={(e) => setActiveUntilDate(e.target.value)}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Пользователь будет активен до указанной даты включительно. После этой даты доступ будет автоматически заблокирован.
                    </p>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={() => handleSetActiveUntil(activeUntilUserId)}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveActiveUntil(activeUntilUserId)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Снять ограничение
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveUntilUserId(null)
                      setActiveUntilDate('')
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

