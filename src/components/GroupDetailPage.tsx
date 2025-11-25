'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from './Header'
import BulkNormModal from './BulkNormModal'
import EditGroupNormModal from './EditGroupNormModal'
import EditGroupModal from './EditGroupModal'
import CreateNormFromTemplateModal from './CreateNormFromTemplateModal'
import EditGroupNormFromTemplateModal from './EditGroupNormFromTemplateModal'

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
}

type Tab = 'students' | 'norms' | 'individual-norms'

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
  const [group, setGroup] = useState<Group | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('students')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkNormModal, setShowBulkNormModal] = useState(false)
  const [showCreateFromTemplateModal, setShowCreateFromTemplateModal] = useState(false)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [groupNorms, setGroupNorms] = useState<any[]>([])
  const [loadingNorms, setLoadingNorms] = useState(false)
  const [individualNorms, setIndividualNorms] = useState<any[]>([])
  const [loadingIndividualNorms, setLoadingIndividualNorms] = useState(false)
  const [editingNorm, setEditingNorm] = useState<{
    type: string
    date: string
    unit: string | null
    norms: any[]
    isFromTemplate?: boolean
    groupNormId?: string
  } | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    gender: '',
    notes: '',
  })

  useEffect(() => {
    loadGroup()
    loadAthletes()
  }, [groupId])

  useEffect(() => {
    if (activeTab === 'norms') {
      loadGroupNorms()
    } else if (activeTab === 'individual-norms') {
      loadIndividualNorms()
    }
  }, [groupId, activeTab])

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

    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/athletes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания')
        return
      }

      setShowAddForm(false)
      setFormData({ fullName: '', birthDate: '', gender: '', notes: '' })
      loadAthletes()
    } catch (err) {
      setError('Ошибка создания учащегося')
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
      loadAthletes()
    } catch (err) {
      setError('Ошибка удаления учащегося')
    }
  }

  const handleImportFile = async (file: File) => {
    setError('')
    setSuccessMessage('')

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
      setSuccessMessage(data.message || `Успешно импортировано ${data.imported} учеников`)
      setTimeout(() => setSuccessMessage(''), 5000)

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

  const loadGroupNorms = async () => {
    setLoadingNorms(true)
    try {
      // Загружаем обычные нормативы
      const normsResponse = await fetch(`/api/trainer/groups/${groupId}/norms`)
      if (!normsResponse.ok) throw new Error('Ошибка загрузки нормативов')
      const normsData = await normsResponse.json()

      // Загружаем нормативы из шаблонов
      const groupNormsResponse = await fetch(`/api/trainer/groups/${groupId}/group-norms`)
      if (!groupNormsResponse.ok) throw new Error('Ошибка загрузки нормативов из шаблонов')
      const groupNormsData = await groupNormsResponse.json()

      // Объединяем нормативы
      const allNorms = [
        ...(normsData.norms || []).map((n: any) => ({ ...n, isFromTemplate: false })),
        ...(groupNormsData.groupNorms || []).map((gn: any) => ({
          type: gn.template.name,
          date: gn.testDate,
          unit: gn.unitOverride || gn.template.unit,
          count: gn._count?.norms || 0,
          isFromTemplate: true,
          groupNormId: gn.id,
          templateId: gn.templateId,
        })),
      ]

      // Сортируем по дате (новые сверху)
      allNorms.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA
      })

      setGroupNorms(allNorms)
    } catch (err) {
      setError('Ошибка загрузки нормативов')
    } finally {
      setLoadingNorms(false)
    }
  }

  const loadIndividualNorms = async () => {
    setLoadingIndividualNorms(true)
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/norms/individual`)
      if (!response.ok) throw new Error('Ошибка загрузки индивидуальных нормативов')
      const data = await response.json()
      setIndividualNorms(data.norms || [])
    } catch (err) {
      setError('Ошибка загрузки индивидуальных нормативов')
    } finally {
      setLoadingIndividualNorms(false)
    }
  }

  const handleDeleteIndividualNorm = async (normId: string) => {
    if (!confirm('Удалить этот индивидуальный норматив?')) return

    try {
      const response = await fetch(`/api/trainer/norms/${normId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Ошибка удаления')
      loadIndividualNorms()
      setSuccessMessage('Норматив успешно удалён!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError('Ошибка удаления норматива')
    }
  }

  const handleDeleteGroupNorm = async (type: string, date: string, isFromTemplate?: boolean, groupNormId?: string) => {
    if (!confirm('Удалить этот норматив для всех учащихся группы?')) return

    setError('')
    
    // Если это норматив из шаблона, удаляем через GroupNorm API
    if (isFromTemplate && groupNormId) {
      try {
        const response = await fetch(`/api/trainer/groups/${groupId}/group-norms/${groupNormId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Ошибка удаления норматива')
          return
        }

        // Обновляем список нормативов
        await loadGroupNorms()
        setSuccessMessage(`Норматив успешно удалён (удалено записей: ${data.deletedCount || 0})`)
        setTimeout(() => setSuccessMessage(''), 5000)
        return
      } catch (err) {
        setError('Ошибка удаления норматива')
        console.error('Delete norm error:', err)
        return
      }
    }

    // Для обычных нормативов используем старый API
    const url = `/api/trainer/groups/${groupId}/norms/delete?type=${encodeURIComponent(type)}&date=${encodeURIComponent(date)}`
    console.log('Delete norm request:', { groupId, type, date, url })
    try {
      console.log('Sending DELETE request to:', url)
      const response = await fetch(url, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Отключаем кеш
      })

      console.log('Response status:', response.status, response.statusText)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok && response.status === 404) {
        const text = await response.text()
        console.error('404 response body:', text)
        setError('Маршрут не найден. Проверьте консоль сервера.')
        return
      }

      const data = await response.json()
      console.log('Response data:', data)

      if (!response.ok) {
        setError(data.error || 'Ошибка удаления')
        return
      }

      // Проверяем, что удаление действительно произошло
      if (data.success && data.deletedCount > 0) {
        // Обновляем список нормативов
        await loadGroupNorms()
        setSuccessMessage(`Норматив успешно удалён (удалено записей: ${data.deletedCount})`)
        setTimeout(() => setSuccessMessage(''), 5000)
      } else {
        setError('Норматив не был удалён')
      }
    } catch (err) {
      setError('Ошибка удаления норматива')
      console.error('Delete norm error:', err)
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

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Группа не найдена</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Группа: ${group.name}`} userFullName={userFullName} userRole={userRole} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Кнопка возврата к списку групп */}
        <div className="mb-4 no-print">
          <button
            onClick={() => router.push('/trainer/groups')}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Вернуться к группам
          </button>
        </div>

        {/* Заголовок и информация о группе */}
        <div className="mb-4 no-print">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-heading">Группа: {group.name}</h1>
            <button
              onClick={() => setShowEditGroupModal(true)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              title="Редактировать группу"
            >
              ✏️ Редактировать
            </button>
          </div>
          <p className="mt-1 text-sm text-blue-600 font-semibold">
            учебный год {group.schoolYear}
          </p>
        </div>

        {group.description && (
          <p className="mb-6 text-gray-600 no-print">{group.description}</p>
        )}

        {/* Табы */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('students')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'students'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Ученики
            </button>
            <button
              onClick={() => router.push(`/trainer/groups/${groupId}/journal`)}
              className="py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Журнал
            </button>
            <button
              onClick={() => setActiveTab('norms')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'norms'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Нормативы
            </button>
            <button
              onClick={() => setActiveTab('individual-norms')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'individual-norms'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Индивидуальные нормативы
            </button>
          </nav>
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

        {/* Вкладка: Ученики */}
        {activeTab === 'students' && (
          <div>
            <div className="mb-6 flex justify-between items-center no-print">
              <h2 className="text-title font-semibold text-heading">Ученики</h2>
              <div className="flex gap-3 items-center">
                <a
                  href={`/api/trainer/groups/${groupId}/athletes/template`}
                  download="4A.xlsx"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  title="Скачать шаблон Excel"
                >
                  📥 Скачать шаблон
                </a>
                <button
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
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Добавить учеников из файла
                </button>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {showAddForm ? 'Отмена' : 'Добавить ученика'}
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="mb-6 bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-heading mb-4">
                  Добавить ученика
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
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
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
                        value={formData.birthDate}
                        onChange={(e) =>
                          setFormData({ ...formData, birthDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Пол
                      </label>
                      <select
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                        value={formData.gender}
                        onChange={(e) =>
                          setFormData({ ...formData, gender: e.target.value })
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
                      Примечания
                    </label>
                    <textarea
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
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
                    {athletes.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          Нет учеников
                        </td>
                      </tr>
                    ) : (
                      athletes.map((athlete) => (
                        <tr key={athlete.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Link
                              href={`/trainer/athletes/${athlete.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {athlete.fullName}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {calculateAge(athlete.birthDate)
                              ? `${calculateAge(athlete.birthDate)} лет`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button
                              onClick={() =>
                                router.push(`/trainer/athletes/${athlete.id}`)
                              }
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Вкладка: Нормативы */}
        {activeTab === 'norms' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-title font-semibold text-heading">Нормативы группы</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateFromTemplateModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Добавить по шаблону
                </button>
                <button
                  onClick={() => setShowBulkNormModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Добавить вручную
                </button>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <p className="text-gray-600 mb-2">
                Используйте кнопку выше, чтобы добавить норматив для всех учащихся группы одновременно.
              </p>
              <p className="text-gray-500 text-sm">
                Для просмотра и редактирования нормативов отдельных учеников откройте карточку ученика из вкладки "Ученики".
              </p>
            </div>

            {/* Таблица нормативов */}
            {loadingNorms ? (
              <div className="text-center py-8 text-gray-500">Загрузка нормативов...</div>
            ) : groupNorms.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-6">
                <p className="text-gray-500 text-center">
                  Нормативы для этой группы пока не добавлены.
                </p>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Вид норматива
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Дата зачёта
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Единица измерения
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Количество учащихся
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {groupNorms.map((normGroup, index) => (
                        <tr key={`${normGroup.type}-${normGroup.date}-${index}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {normGroup.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(normGroup.date).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {normGroup.unit || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {normGroup.count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            {normGroup.isFromTemplate && (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded mr-2">
                                Из шаблона
                              </span>
                            )}
                            <button
                              onClick={() => {
                                if (normGroup.isFromTemplate && normGroup.groupNormId) {
                                  // Открываем редактор нормативов из шаблона
                                  setEditingNorm({
                                    type: normGroup.type,
                                    date: normGroup.date,
                                    unit: normGroup.unit,
                                    norms: [],
                                    isFromTemplate: true,
                                    groupNormId: normGroup.groupNormId,
                                  })
                                } else {
                                  // Открываем обычный редактор
                                  setEditingNorm({
                                    type: normGroup.type,
                                    date: normGroup.date,
                                    unit: normGroup.unit,
                                    norms: normGroup.norms || [],
                                    isFromTemplate: false,
                                  })
                                }
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Открыть
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteGroupNorm(
                                  normGroup.type,
                                  normGroup.date,
                                  normGroup.isFromTemplate,
                                  normGroup.groupNormId
                                )
                              }
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
            )}

            <CreateNormFromTemplateModal
              groupId={groupId}
              groupClass={group?.class || null}
              isOpen={showCreateFromTemplateModal}
              onClose={() => {
                setShowCreateFromTemplateModal(false)
                setSuccessMessage('')
              }}
              onSuccess={() => {
                setSuccessMessage('Норматив успешно создан из шаблона!')
                setTimeout(() => setSuccessMessage(''), 5000)
                loadGroupNorms()
              }}
            />

            <BulkNormModal
              groupId={groupId}
              athletes={athletes}
              isOpen={showBulkNormModal}
              onClose={() => {
                setShowBulkNormModal(false)
                setSuccessMessage('')
              }}
              onSuccess={() => {
                setSuccessMessage('Нормативы успешно созданы для выбранных учащихся!')
                setTimeout(() => setSuccessMessage(''), 5000)
                loadGroupNorms()
              }}
            />

            {editingNorm && editingNorm.isFromTemplate && editingNorm.groupNormId && (
              <EditGroupNormFromTemplateModal
                groupId={groupId}
                groupNormId={editingNorm.groupNormId}
                isOpen={!!editingNorm}
                onClose={() => setEditingNorm(null)}
                onSuccess={() => {
                  loadGroupNorms()
                  setSuccessMessage('Нормативы успешно обновлены!')
                  setTimeout(() => setSuccessMessage(''), 5000)
                }}
              />
            )}

            {editingNorm && !editingNorm.isFromTemplate && (
              <EditGroupNormModal
                groupId={groupId}
                type={editingNorm.type}
                date={editingNorm.date}
                unit={editingNorm.unit}
                norms={editingNorm.norms.map((n: any) => ({
                  normId: n.id,
                  athleteId: n.athleteId,
                  athleteName: n.athleteName,
                  value: n.value,
                  status: n.status,
                }))}
                isOpen={!!editingNorm}
                onClose={() => setEditingNorm(null)}
                onSuccess={() => {
                  loadGroupNorms()
                  setSuccessMessage('Нормативы успешно обновлены!')
                  setTimeout(() => setSuccessMessage(''), 5000)
                }}
              />
            )}
          </div>
        )}

        {/* Вкладка: Индивидуальные нормативы */}
        {activeTab === 'individual-norms' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-heading mb-4">
                Индивидуальные нормативы
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Нормативы, созданные из карточек учеников. Для создания нового норматива откройте карточку ученика.
              </p>
            </div>

            {loadingIndividualNorms ? (
              <div className="text-center py-8 text-gray-500">Загрузка нормативов...</div>
            ) : individualNorms.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-6">
                <p className="text-gray-500 text-center">
                  Индивидуальные нормативы для этой группы пока не добавлены.
                </p>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ученик
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Вид норматива
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Дата зачёта
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ед. изм.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Значение
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Статус
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {individualNorms.map((norm) => (
                        <tr key={norm.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {norm.athleteName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {norm.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(norm.date).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {norm.unit || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {norm.value !== null ? norm.value : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {norm.status}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button
                              onClick={() => router.push(`/trainer/athletes/${norm.athleteId}`)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Открыть
                            </button>
                            <button
                              onClick={() => handleDeleteIndividualNorm(norm.id)}
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
            )}
          </div>
        )}

        {/* Модальное окно редактирования группы */}
        <EditGroupModal
          groupId={groupId}
          groupName={group.name}
          groupDescription={group.description}
          isOpen={showEditGroupModal}
          onClose={() => setShowEditGroupModal(false)}
          onSuccess={() => {
            loadGroup()
            setSuccessMessage('Группа успешно обновлена!')
            setTimeout(() => setSuccessMessage(''), 3000)
          }}
        />
      </main>
    </div>
  )
}

