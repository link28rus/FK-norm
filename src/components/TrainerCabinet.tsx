'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from './Header'

interface Profile {
  id: string
  userId: string
  fullName: string
  phone?: string
  notes?: string
  email: string
}

interface Athlete {
  id: string
  fullName: string
  birthDate?: string
  gender?: string
  groupName?: string
  notes?: string
  createdAt: string
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

type Tab = 'profile' | 'groups' | 'group-detail' | 'athlete-detail'

interface TrainerCabinetProps {
  userRole?: string
}

export default function TrainerCabinet({ userRole }: TrainerCabinetProps = {}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [athleteNorms, setAthleteNorms] = useState<Norm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [showAddAthlete, setShowAddAthlete] = useState(false)
  const [showAddNorm, setShowAddNorm] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Формы
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    notes: '',
  })

  const [athleteForm, setAthleteForm] = useState({
    fullName: '',
    birthDate: '',
    gender: '',
    groupName: '',
    notes: '',
  })

  const [normForm, setNormForm] = useState({
    type: '',
    value: '',
    unit: '',
    status: 'Сдано',
    date: new Date().toISOString().split('T')[0],
    comment: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    loadProfile()
    loadAthletes()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/trainer/profile')
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setProfile(data.profile)
      setProfileForm({
        fullName: data.profile.fullName,
        phone: data.profile.phone || '',
        notes: data.profile.notes || '',
      })
    } catch (err) {
      setError('Ошибка загрузки профиля')
    } finally {
      setLoading(false)
    }
  }

  const loadAthletes = async () => {
    try {
      const response = await fetch('/api/trainer/athletes')
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setAthletes(data.athletes)
    } catch (err) {
      setError('Ошибка загрузки учащихся')
    }
  }

  const loadAthleteDetail = async (id: string) => {
    try {
      const response = await fetch(`/api/trainer/athletes/${id}`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setSelectedAthlete(data.athlete)
      setAthleteNorms(data.athlete.norms || [])
      setActiveTab('athlete-detail')
    } catch (err) {
      setError('Ошибка загрузки данных учащегося')
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await fetch('/api/trainer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка обновления')
        return
      }

      setProfile(data.profile)
      setEditingProfile(false)
    } catch (err) {
      setError('Ошибка обновления профиля')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка смены пароля')
        return
      }

      setChangingPassword(false)
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      alert('Пароль успешно изменён')
    } catch (err) {
      setError('Ошибка смены пароля')
    }
  }

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await fetch('/api/trainer/athletes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(athleteForm),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания')
        return
      }

      setShowAddAthlete(false)
      const newGroupName = selectedGroup || athleteForm.groupName
      setAthleteForm({
        fullName: '',
        birthDate: '',
        gender: '',
        groupName: '',
        notes: '',
      })
      loadAthletes()
      // Если мы на странице группы, остаёмся на ней
      if (selectedGroup) {
        setActiveTab('group-detail')
      }
    } catch (err) {
      setError('Ошибка создания учащегося')
    }
  }

  const handleDeleteAthlete = async (id: string) => {
    if (!confirm('Удалить учащегося?')) return

    try {
      const response = await fetch(`/api/trainer/athletes/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Ошибка удаления')
      loadAthletes()
      if (selectedAthlete?.id === id) {
        setSelectedAthlete(null)
        // Если мы на странице группы, остаёмся на ней, иначе возвращаемся к списку групп
        if (selectedGroup) {
          setActiveTab('group-detail')
        } else {
          setActiveTab('athletes')
        }
      }
    } catch (err) {
      setError('Ошибка удаления учащегося')
    }
  }

  const handleAddNorm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAthlete) return
    setError('')

    try {
      const response = await fetch('/api/trainer/norms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...normForm,
          athleteId: selectedAthlete.id,
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
      loadAthleteDetail(selectedAthlete.id)
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
      if (selectedAthlete) {
        loadAthleteDetail(selectedAthlete.id)
      }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Кабинет тренера" userFullName={profile?.fullName} userRole={userRole} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 no-print">
          <h1 className="text-3xl font-bold text-heading">Кабинет тренера</h1>
        </div>
        {/* Табы */}
        <div className="border-b border-gray-200 mb-6 no-print">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Профиль
            </button>
            <button
              onClick={() => router.push('/trainer/groups')}
              className="py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Группы
            </button>
            <button
              onClick={() => router.push('/trainer/norm-templates')}
              className="py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Мои шаблоны
            </button>
            {selectedGroup && activeTab === 'group-detail' && (
              <button
                onClick={() => setActiveTab('group-detail')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'group-detail'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {selectedGroup}
              </button>
            )}
            {selectedAthlete && (
              <button
                onClick={() => setActiveTab('athlete-detail')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'athlete-detail'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {selectedAthlete.fullName}
              </button>
            )}
          </nav>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Профиль */}
        {activeTab === 'profile' && profile && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-title font-semibold text-heading">Профиль тренера</h2>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Редактировать
                  </button>
                )}
              </div>

              {editingProfile ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      disabled
                      value={profile.email}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      ФИО *
                    </label>
                    <input
                      type="text"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={profileForm.fullName}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, fullName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Телефон
                    </label>
                    <input
                      type="tel"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Примечания
                    </label>
                    <textarea
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={profileForm.notes}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, notes: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProfile(false)
                        setProfileForm({
                          fullName: profile.fullName,
                          phone: profile.phone || '',
                          notes: profile.notes || '',
                        })
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{profile.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ФИО</dt>
                    <dd className="mt-1 text-sm text-gray-900">{profile.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Телефон</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {profile.phone || '-'}
                    </dd>
                  </div>
                  {profile.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">
                        Примечания
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            {/* Смена пароля */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-title font-semibold text-heading">Смена пароля</h2>
                {!changingPassword && (
                  <button
                    onClick={() => setChangingPassword(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Сменить пароль
                  </button>
                )}
              </div>

              {changingPassword && (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Текущий пароль *
                    </label>
                    <input
                      type="password"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={passwordForm.oldPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          oldPassword: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Новый пароль *
                    </label>
                    <input
                      type="password"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Подтвердите пароль *
                    </label>
                    <input
                      type="password"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChangingPassword(false)
                        setPasswordForm({
                          oldPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        })
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Список групп (главная страница раздела) */}
        {activeTab === 'athletes' && (
          <div>
            <h2 className="text-xl font-semibold text-heading mb-6">Учащиеся</h2>

            {(() => {
              // Группируем учащихся по группам
              const groupedAthletes = athletes.reduce((acc, athlete) => {
                const groupName = athlete.groupName || 'Без группы'
                if (!acc[groupName]) {
                  acc[groupName] = []
                }
                acc[groupName].push(athlete)
                return acc
              }, {} as Record<string, typeof athletes>)

              const groups = Object.keys(groupedAthletes).sort()

              if (athletes.length === 0) {
                return (
                  <div className="bg-white shadow rounded-lg p-6">
                    <p className="text-center text-gray-500">Нет групп</p>
                  </div>
                )
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((groupName) => (
                    <div
                      key={groupName}
                      className="bg-white shadow rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-heading">
                          {groupName}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {groupedAthletes[groupName].length} чел.
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedGroup(groupName)
                          setActiveTab('group-detail')
                        }}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        Открыть
                      </button>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Страница группы с учащимися */}
        {activeTab === 'group-detail' && selectedGroup && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <button
                  onClick={() => {
                    setSelectedGroup(null)
                    setActiveTab('athletes')
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 mb-2"
                >
                  ← Назад к группам
                </button>
                <h2 className="text-title font-semibold text-heading">
                  Группа: {selectedGroup}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowAddAthlete(!showAddAthlete)
                  setAthleteForm({
                    ...athleteForm,
                    groupName: selectedGroup,
                  })
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {showAddAthlete ? 'Отмена' : 'Добавить учащегося'}
              </button>
            </div>

            {showAddAthlete && (
              <div className="mb-6 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-heading mb-4">
                  Добавить учащегося в группу {selectedGroup}
                </h3>
                <form onSubmit={handleAddAthlete} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      ФИО *
                    </label>
                    <input
                      type="text"
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={athleteForm.fullName}
                      onChange={(e) =>
                        setAthleteForm({ ...athleteForm, fullName: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Дата рождения
                      </label>
                      <input
                        type="date"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                        value={athleteForm.birthDate}
                        onChange={(e) =>
                          setAthleteForm({ ...athleteForm, birthDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Пол
                      </label>
                      <select
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                        value={athleteForm.gender}
                        onChange={(e) =>
                          setAthleteForm({ ...athleteForm, gender: e.target.value })
                        }
                      >
                        <option value="">Не указан</option>
                        <option value="М">Мужской</option>
                        <option value="Ж">Женский</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Группа/класс
                    </label>
                    <input
                      type="text"
                      readOnly
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 text-gray-600 px-3 py-2 border"
                      value={selectedGroup}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Примечания
                    </label>
                    <textarea
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={athleteForm.notes}
                      onChange={(e) =>
                        setAthleteForm({ ...athleteForm, notes: e.target.value })
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

            {/* Список учащихся группы */}
            {(() => {
              const groupAthletes = athletes.filter(
                (athlete) => (athlete.groupName || 'Без группы') === selectedGroup
              )

              if (groupAthletes.length === 0) {
                return (
                  <div className="bg-white shadow rounded-lg p-6">
                    <p className="text-center text-gray-500">
                      В этой группе пока нет учащихся
                    </p>
                  </div>
                )
              }

              return (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ФИО
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Возраст
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupAthletes.map((athlete) => (
                          <tr key={athlete.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {athlete.fullName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {calculateAge(athlete.birthDate)
                                ? `${calculateAge(athlete.birthDate)} лет`
                                : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                              <button
                                onClick={() => loadAthleteDetail(athlete.id)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Открыть
                              </button>
                              <button
                                onClick={() => handleDeleteAthlete(athlete.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Удалить
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Карточка учащегося */}
        {activeTab === 'athlete-detail' && selectedAthlete && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-heading mb-4">
                {selectedAthlete.fullName}
              </h2>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Дата рождения
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {selectedAthlete.birthDate
                      ? new Date(selectedAthlete.birthDate).toLocaleDateString('ru-RU')
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Возраст</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {calculateAge(selectedAthlete.birthDate)
                      ? `${calculateAge(selectedAthlete.birthDate)} лет`
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Пол</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {selectedAthlete.gender || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Группа/класс</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {selectedAthlete.groupName || '-'}
                  </dd>
                </div>
                {selectedAthlete.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">
                      Примечания
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {selectedAthlete.notes}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-title font-semibold text-heading">Нормативы</h2>
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
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Тип норматива *
                      </label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                        value={normForm.type}
                        onChange={(e) =>
                          setNormForm({ ...normForm, type: e.target.value })
                        }
                        placeholder="Например: Подтягивания"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Статус *
                      </label>
                      <select
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
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
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Значение
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                        value={normForm.value}
                        onChange={(e) =>
                          setNormForm({ ...normForm, value: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Единица измерения
                      </label>
                      <input
                        type="text"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                        value={normForm.unit}
                        onChange={(e) =>
                          setNormForm({ ...normForm, unit: e.target.value })
                        }
                        placeholder="раз, сек, м"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Дата *
                      </label>
                      <input
                        type="date"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                        value={normForm.date}
                        onChange={(e) =>
                          setNormForm({ ...normForm, date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Комментарий
                    </label>
                    <textarea
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
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
                    {athleteNorms.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          Нет нормативов
                        </td>
                      </tr>
                    ) : (
                      athleteNorms.map((norm) => (
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
        )}
      </main>
    </div>
  )
}

