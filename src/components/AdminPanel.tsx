'use client'

import { useState, useEffect } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState, Badge, Alert, Input, Button, InfoCard, useToast } from '@/components/ui'

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
  const toast = useToast()
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null)
  const [activeUntilUserId, setActiveUntilUserId] = useState<string | null>(null)
  const [activeUntilDate, setActiveUntilDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; fullName?: string }>({})

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
    setFieldErrors({})

    // Валидация
    const errors: { email?: string; fullName?: string } = {}
    if (!formData.email.trim()) {
      errors.email = 'Укажите email'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Некорректный email'
    }
    if (!formData.fullName.trim()) {
      errors.fullName = 'Укажите ФИО'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/admin/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания тренера')
        setSubmitting(false)
        return
      }

      // Показываем пароль, если он был сгенерирован
      if (data.password) {
        setNewPassword(data.password)
        setResetPasswordId(data.trainer.id)
      }

      setShowAddForm(false)
      setFormData({ email: '', fullName: '', phone: '', password: '' })
      setSubmitting(false)
      toast.success('Тренер успешно создан!')
      loadTrainers()
    } catch (err) {
      setError('Ошибка создания тренера')
      setSubmitting(false)
    }
  }

  // Старая функция toggle-block больше не используется, заменена на handleBlockUntil/handleUnblock

  const handleResetPassword = async (id: string) => {
    setError('')
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
      toast.success('Пароль успешно сброшен!')
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
      toast.success('Пользователь успешно удалён!')
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
      toast.success(`Роль успешно изменена на ${newRole === 'ADMIN' ? 'администратора' : 'тренера'}!`)
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
      toast.success('Срок действия успешно установлен!')
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
      toast.success('Ограничение успешно снято!')
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
    <div>
        <div className="mb-4 no-print">
          <h1 className="h1">Админ-панель</h1>
        </div>
        <div className="mb-6 no-print">
          <div className="flex justify-between items-center">
            <h2 className="h2">Тренеры</h2>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant={showAddForm ? 'secondary' : 'primary'}
            >
              {showAddForm ? 'Отмена' : 'Добавить тренера'}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="error" message={error} className="mb-4" />
        )}

        {newPassword && resetPasswordId && (
          <Alert
            variant="success"
            title="Новый пароль для тренера:"
            className="mb-4"
            onClose={() => {
              setNewPassword(null)
              setResetPasswordId(null)
            }}
          >
            <div className="mt-2">
              <div className="text-lg font-mono bg-white p-2 rounded border border-green-300">
                {newPassword}
              </div>
            </div>
          </Alert>
        )}

        {showAddForm && (
          <InfoCard title="Добавить тренера" className="mb-6">
            <form onSubmit={handleAddTrainer} className="space-y-4">
              {error && (
                <Alert variant="error" message={error} />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  required
                  error={fieldErrors.email}
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    if (fieldErrors.email) {
                      setFieldErrors({ ...fieldErrors, email: undefined })
                    }
                  }}
                  disabled={submitting}
                />
                <Input
                  label="ФИО"
                  type="text"
                  required
                  error={fieldErrors.fullName}
                  value={formData.fullName}
                  onChange={(e) => {
                    setFormData({ ...formData, fullName: e.target.value })
                    if (fieldErrors.fullName) {
                      setFieldErrors({ ...fieldErrors, fullName: undefined })
                    }
                  }}
                  disabled={submitting}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Телефон"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  disabled={submitting}
                />
                <Input
                  label="Пароль (оставьте пустым для автогенерации)"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  disabled={submitting}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submitting}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? 'Создание...' : 'Создать'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAddForm(false)
                    setFormData({ email: '', fullName: '', phone: '', password: '' })
                    setFieldErrors({})
                  }}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  Отмена
                </Button>
              </div>
            </form>
          </InfoCard>
        )}

        {loading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="hidden lg:table-cell">Дата создания</TableHead>
                <TableHead align="right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainers.length === 0 ? (
                <TableEmptyState
                  colSpan={7}
                  message="Тренеры пока не добавлены"
                  actionLabel="Добавить тренера"
                  onAction={() => setShowAddForm(true)}
                />
              ) : (
                trainers.map((trainer) => {
                  const status = getStatus(trainer)
                  const hasActiveUntil = trainer.activeUntil !== null && trainer.activeUntil !== undefined
                  const activeUntilDate = trainer.activeUntil ? new Date(trainer.activeUntil) : null
                  const now = new Date()
                  now.setHours(0, 0, 0, 0)
                  const isExpired = activeUntilDate && now > activeUntilDate
                  
                  return (
                    <TableRow key={trainer.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{trainer.trainerProfile?.fullName || '—'}</span>
                          <span className="text-xs text-secondary md:hidden mt-1">{trainer.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-secondary hidden md:table-cell">
                        {trainer.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={trainer.role === 'ADMIN' ? 'info' : 'default'}>
                          {trainer.role === 'ADMIN' ? 'Администратор' : 'Тренер'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={status.text === 'Активен' ? 'success' : status.text === 'Заблокирован' ? 'danger' : 'default'}>
                            {status.text}
                          </Badge>
                          {hasActiveUntil && !isExpired && activeUntilDate && (
                            <div className="text-xs text-secondary">
                              Активен до {activeUntilDate.toLocaleDateString('ru-RU')}
                            </div>
                          )}
                          {hasActiveUntil && isExpired && (
                            <div className="text-xs text-danger">
                              Срок действия истёк
                            </div>
                          )}
                          {!hasActiveUntil && (
                            <div className="text-xs text-secondary">
                              Без ограничения по дате
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-secondary hidden lg:table-cell">
                        {formatDate(trainer.createdAt)}
                      </TableCell>
                          <TableCell align="right">
                            <div className="flex flex-wrap gap-2 justify-end">
                              {trainer.role !== 'ADMIN' && (
                                <Button
                                  onClick={() => handleChangeRole(trainer.id, trainer.role)}
                                  variant="secondary"
                                  size="sm"
                                  className="w-full sm:w-auto text-xs"
                                >
                                  <span className="hidden sm:inline">Назначить админом</span>
                                  <span className="sm:hidden">Админ</span>
                                </Button>
                              )}
                              {trainer.role === 'ADMIN' && (
                                <Button
                                  onClick={() => handleChangeRole(trainer.id, trainer.role)}
                                  variant="secondary"
                                  size="sm"
                                  className="w-full sm:w-auto text-xs"
                                >
                                  <span className="hidden sm:inline">Снять админа</span>
                                  <span className="sm:hidden">Снять</span>
                                </Button>
                              )}
                              <Button
                                onClick={() => {
                                  setActiveUntilUserId(trainer.id)
                                  if (trainer.activeUntil) {
                                    const date = new Date(trainer.activeUntil)
                                    setActiveUntilDate(date.toISOString().split('T')[0])
                                  } else {
                                    setActiveUntilDate('')
                                  }
                                }}
                                variant="secondary"
                                size="sm"
                                className="w-full sm:w-auto text-xs"
                              >
                                {hasActiveUntil ? 'Изменить срок' : 'Ограничить по дате'}
                              </Button>
                              {hasActiveUntil && (
                                <Button
                                  onClick={() => handleRemoveActiveUntil(trainer.id)}
                                  variant="secondary"
                                  size="sm"
                                  className="w-full sm:w-auto text-xs"
                                >
                                  Снять ограничение
                                </Button>
                              )}
                              <Button
                                onClick={() => handleResetPassword(trainer.id)}
                                variant="secondary"
                                size="sm"
                                className="w-full sm:w-auto text-xs"
                              >
                                <span className="hidden sm:inline">Сбросить пароль</span>
                                <span className="sm:hidden">Пароль</span>
                              </Button>
                              <Button
                                onClick={() => handleDeleteUser(trainer.id)}
                                variant="danger"
                                size="sm"
                                className="w-full sm:w-auto text-xs"
                              >
                                Удалить
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
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
                    <h3 className="h3">
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
                    <Input
                      label="Аккаунт активен до (дата включительно)"
                      type="date"
                      required
                      value={activeUntilDate}
                      onChange={(e) => setActiveUntilDate(e.target.value)}
                    />
                    <p className="mt-2 text-xs text-secondary">
                      Пользователь будет активен до указанной даты включительно. После этой даты доступ будет автоматически заблокирован.
                    </p>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                  <Button
                    type="button"
                    onClick={() => handleSetActiveUntil(activeUntilUserId)}
                    variant="primary"
                  >
                    Сохранить
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleRemoveActiveUntil(activeUntilUserId)}
                    variant="secondary"
                  >
                    Снять ограничение
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setActiveUntilUserId(null)
                      setActiveUntilDate('')
                    }}
                    variant="secondary"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

