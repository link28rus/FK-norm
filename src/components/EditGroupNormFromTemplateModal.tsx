'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { calcGrade, gradeToString } from '@/lib/normCalculator'
import { convertGenderToEnglish } from '@/lib/genderConverter'

interface Athlete {
  id: string
  fullName: string
  gender?: string | null
}

interface GroupNormData {
  id: string
  templateId: string
  testDate: string
  nameOverride?: string | null
  unitOverride?: string | null
  useCustomBoundaries: boolean
  template: {
    id: string
    name: string
    unit: string
    direction: string
  }
  boundaries?: Array<{
    grade: number
    gender: string
    class: number
    fromValue: number
    toValue: number
  }>
  group: {
    class: number | null
    athletes: Athlete[]
  }
  norms: Array<{
    id: string
    athleteId: string
    value: number | null
    status: string
    athlete: {
      id: string
      fullName: string
      gender?: string | null
    }
  }>
}

interface EditGroupNormFromTemplateModalProps {
  groupId: string
  groupNormId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditGroupNormFromTemplateModal({
  groupId,
  groupNormId,
  isOpen,
  onClose,
  onSuccess,
}: EditGroupNormFromTemplateModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [groupNorm, setGroupNorm] = useState<GroupNormData | null>(null)
  const [norms, setNorms] = useState<Array<{
    athleteId: string
    athleteName: string
    gender: string | null
    value: number | null
    grade: string
    calculating: boolean
    saving: boolean
    error: string | null
  }>>([])
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const savingAthletes = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen && groupNormId) {
      loadGroupNorm()
    }
  }, [isOpen, groupNormId])

  const loadGroupNorm = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/trainer/groups/${groupId}/group-norms/${groupNormId}`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()

      const groupNormData = data.groupNorm
      setGroupNorm(groupNormData)

      console.log('[EditGroupNormFromTemplateModal] Loaded groupNorm:', {
        id: groupNormData.id,
        templateId: groupNormData.templateId,
        templateName: groupNormData.template?.name,
        templateDirection: groupNormData.template?.direction,
        templateClassFrom: groupNormData.template?.classFrom,
        templateClassTo: groupNormData.template?.classTo,
        useCustomBoundaries: groupNormData.useCustomBoundaries,
        boundariesCount: groupNormData.boundaries?.length || 0,
        groupClass: groupNormData.group.class,
        groupId: groupNormData.group.id,
        groupName: groupNormData.group.name,
        athletesCount: groupNormData.group.athletes.length,
        existingNormsCount: groupNormData.norms.length,
      })

      // Проверяем наличие класса группы
      if (!groupNormData.group.class) {
        console.error('[EditGroupNormFromTemplateModal] Group class is not set!', {
          groupId: groupNormData.group.id,
          groupName: groupNormData.group.name,
          templateClassFrom: groupNormData.template?.classFrom,
          templateClassTo: groupNormData.template?.classTo,
        })
        setError('Не удалось определить класс группы. В названии группы отсутствует цифра. Укажите цифру школьного класса в названии, например: "2 А", "3 Б", "5 Г". Без корректного класса автоматический расчёт оценок по нормативам работать не сможет.')
      }

      // Инициализируем нормы для всех учащихся группы
      const athletesMap = new Map(
        groupNormData.group.athletes.map((a: Athlete) => [a.id, a])
      )

      // Создаем массив норм для всех учащихся
      const normsList = groupNormData.group.athletes.map((athlete: Athlete) => {
        const existingNorm = groupNormData.norms.find(
          (n: any) => n.athleteId === athlete.id
        )
        return {
          athleteId: athlete.id,
          athleteName: athlete.fullName,
          gender: athlete.gender || null,
          value: existingNorm?.value || null,
          grade: existingNorm?.status || '-',
          calculating: false,
          saving: false,
          error: null,
        }
      })

      console.log('[EditGroupNormFromTemplateModal] Loaded norms:', {
        groupNormId: groupNormData.id,
        athletesCount: groupNormData.group.athletes.length,
        existingNormsCount: groupNormData.norms.length,
        normsListCount: normsList.length,
        sampleNorm: normsList[0],
        sampleAthlete: groupNormData.group.athletes[0],
      })

      setNorms(normsList)
    } catch (err: any) {
      console.error('[EditGroupNormFromTemplateModal] Load error:', err)
      setError('Ошибка загрузки норматива')
    } finally {
      setLoading(false)
    }
  }

  // Автосохранение результата и пересчет оценки
  const autoSaveResult = useCallback(async (
    athleteId: string,
    value: number | null,
    immediate: boolean = false
  ) => {
    if (!groupNorm) return

    // Если уже сохраняем этого ученика, отменяем предыдущий таймер
    if (debounceTimers.current[athleteId]) {
      clearTimeout(debounceTimers.current[athleteId])
      delete debounceTimers.current[athleteId]
    }

    // Если немедленное сохранение (onBlur), не используем debounce
    if (immediate) {
      performSave(athleteId, value)
      return
    }

    // Используем debounce 600ms
    debounceTimers.current[athleteId] = setTimeout(() => {
      performSave(athleteId, value)
      delete debounceTimers.current[athleteId]
    }, 600)
  }, [groupNorm, groupId, groupNormId])

  // Функция выполнения сохранения
  const performSave = useCallback(async (athleteId: string, value: number | null) => {
    if (!groupNorm) return

    // Проверяем, не сохраняем ли уже этого ученика
    if (savingAthletes.current.has(athleteId)) {
      return
    }

    savingAthletes.current.add(athleteId)

    // Устанавливаем флаг сохранения
    setNorms(prev =>
      prev.map(n =>
        n.athleteId === athleteId ? { ...n, saving: true, error: null } : n
      )
    )

    try {
      const response = await fetch(
        `/api/trainer/groups/${groupId}/group-norms/${groupNormId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            norms: [{
              athleteId,
              value,
              // Не передаем status, чтобы backend сам рассчитал
            }],
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка сохранения результата')
      }

      // Обновляем оценку из ответа API
      if (data.norms && data.norms.length > 0) {
        const savedNorm = data.norms[0]
        // API возвращает status как рассчитанную оценку
        const savedGrade = savedNorm.status || '-'

        setNorms(prev =>
          prev.map(n =>
            n.athleteId === athleteId
              ? {
                  ...n,
                  value: savedNorm.value !== null && savedNorm.value !== undefined ? savedNorm.value : n.value,
                  grade: savedGrade,
                  saving: false,
                  error: null,
                }
              : n
          )
        )

        console.log('[EditGroupNormFromTemplateModal] Auto-saved and grade calculated:', {
          athleteId,
          value: savedNorm.value,
          grade: savedGrade,
          status: savedNorm.status,
        })
      } else {
        // Если нормы не вернулись, просто снимаем флаг сохранения
        setNorms(prev =>
          prev.map(n =>
            n.athleteId === athleteId
              ? { ...n, saving: false, error: null }
              : n
          )
        )
      }
    } catch (err: any) {
      console.error('[EditGroupNormFromTemplateModal] Auto-save error:', err)
      setNorms(prev =>
        prev.map(n =>
          n.athleteId === athleteId
            ? {
                ...n,
                saving: false,
                error: err.message || 'Ошибка сохранения',
              }
            : n
        )
      )
    } finally {
      savingAthletes.current.delete(athleteId)
    }
  }, [groupId, groupNormId, groupNorm])

  // Обработчик изменения значения (с debounce)
  const handleValueChange = useCallback((
    athleteId: string,
    value: number | null
  ) => {
    // Сразу обновляем значение в UI
    setNorms(prev =>
      prev.map(n =>
        n.athleteId === athleteId ? { ...n, value, error: null } : n
      )
    )

    // Запускаем автосохранение с debounce (даже для null значений)
    autoSaveResult(athleteId, value, false)
  }, [autoSaveResult])

  // Обработчик потери фокуса (немедленное сохранение)
  const handleValueBlur = useCallback((
    athleteId: string,
    value: number | null
  ) => {
    // Отменяем debounce и сохраняем сразу
    if (debounceTimers.current[athleteId]) {
      clearTimeout(debounceTimers.current[athleteId])
      delete debounceTimers.current[athleteId]
    }

    // Сохраняем даже если значение null (чтобы сбросить результат)
    autoSaveResult(athleteId, value, true)
  }, [autoSaveResult])

  const handleGradeChange = async (athleteId: string, grade: string) => {
    // Сразу обновляем в UI
    setNorms(prev =>
      prev.map(n =>
        n.athleteId === athleteId ? { ...n, grade } : n
      )
    )

    // Сохраняем изменение оценки вручную
    const norm = norms.find(n => n.athleteId === athleteId)
    if (norm && groupNorm) {
      try {
        const response = await fetch(
          `/api/trainer/groups/${groupId}/group-norms/${groupNormId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              norms: [{
                athleteId,
                value: norm.value,
                status: grade, // Явно указываем оценку
              }],
            }),
          }
        )

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Ошибка сохранения оценки')
        }
      } catch (err: any) {
        console.error('[EditGroupNormFromTemplateModal] Grade save error:', err)
        // Восстанавливаем предыдущую оценку при ошибке
        setNorms(prev =>
          prev.map(n =>
            n.athleteId === athleteId ? { ...n, error: err.message || 'Ошибка сохранения оценки' } : n
          )
        )
      }
    }
  }

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    // Дожидаемся завершения всех автосохранений
    const maxWaitTime = 2000 // 2 секунды максимум
    const startTime = Date.now()
    while (savingAthletes.current.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Подготавливаем данные для отправки (все актуальные значения и оценки)
    const normsToSave = norms.map(n => ({
      athleteId: n.athleteId,
      value: n.value,
      status: n.grade && n.grade !== '-' ? n.grade : undefined,
    }))

    console.log('[EditGroupNormFromTemplateModal] Final submit (results are already saved):', {
      groupNormId,
      normsCount: normsToSave.length,
    })

    // Все результаты уже сохранены через автосохранение
    // Эта кнопка нужна только для финального подтверждения/закрытия модалки
    try {
      // Перезагружаем данные для проверки
      await loadGroupNorm()
      
      onSuccess()
      onClose()
    } catch (err) {
      setError('Ошибка соединения с сервером')
    } finally {
      setSaving(false)
    }
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

  const gradeCycle = ['-', '2', '3', '4', '5', 'Б', 'О']

  if (!isOpen) return null

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">Загрузка норматива...</div>
        </div>
      </div>
    )
  }

  if (!groupNorm) {
    return null
  }

  const normName = groupNorm.nameOverride || groupNorm.template.name
  const normUnit = groupNorm.unitOverride || groupNorm.template.unit

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-heading">
                    {normName}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Дата зачёта: {new Date(groupNorm.testDate).toLocaleDateString('ru-RU')}
                    {normUnit && ` • Единица: ${normUnit}`}
                  </p>
                </div>
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

              {!groupNorm.group.class ? (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Не удалось определить класс группы.</strong> В названии группы отсутствует цифра. Укажите цифру школьного класса в названии, например: "2 А", "3 Б", "5 Г".
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Без корректного класса автоматический расчёт оценок по нормативам работать не сможет.
                  </p>
                </div>
              ) : (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Класс определён автоматически.</strong> Система определяет школьный класс на основании названия группы. Проверьте, корректно ли указано название группы — от этого зависит автоматический расчёт оценок по нормативам.
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Определённый класс: <strong>{groupNorm.group.class}</strong>. Шаблон: {groupNorm.template.classFrom}-{groupNorm.template.classTo} класс.
                  </p>
                </div>
              )}

              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>Автоматическое сохранение и расчет оценок:</strong> При вводе результата значение сохраняется автоматически (через 600ms после окончания ввода или при потере фокуса). Оценка рассчитывается и отображается мгновенно. Вы можете изменить оценку вручную, кликнув по ней.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Учащийся
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Пол
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Результат
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Оценка
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {norms.map((norm) => (
                      <tr key={norm.athleteId}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {norm.athleteName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {norm.gender === 'М' || norm.gender === 'MALE' ? 'М' : norm.gender === 'Ж' || norm.gender === 'FEMALE' ? 'Ж' : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1 max-w-32">
                              <input
                                type="number"
                                step="0.01"
                                value={norm.value || ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value)
                                  handleValueChange(norm.athleteId, val)
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value)
                                  handleValueBlur(norm.athleteId, val)
                                }}
                                placeholder="Введите результат"
                                className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm ${
                                  norm.error
                                    ? 'border-red-300 bg-red-50'
                                    : norm.saving
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-gray-300'
                                }`}
                              />
                              {/* Индикация сохранения */}
                              {norm.saving && (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              )}
                              {norm.error && !norm.saving && (
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                  <span className="text-red-500 text-xs">⚠</span>
                                </div>
                              )}
                            </div>
                            {norm.saving && (
                              <span className="text-xs text-blue-600" title="Сохранение...">
                                💾
                              </span>
                            )}
                            {norm.error && !norm.saving && (
                              <span className="text-xs text-red-600" title={norm.error}>
                                ⚠
                              </span>
                            )}
                          </div>
                          {norm.error && !norm.saving && (
                            <p className="mt-1 text-xs text-red-600">{norm.error}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const currentIndex = gradeCycle.indexOf(norm.grade || '-')
                              const nextIndex = (currentIndex + 1) % gradeCycle.length
                              handleGradeChange(norm.athleteId, gradeCycle[nextIndex])
                            }}
                            className={`px-3 py-1 rounded border text-sm font-medium transition-colors ${getGradeColorClass(norm.grade)}`}
                          >
                            {norm.grade || '—'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={saving || savingAthletes.current.size > 0}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving || savingAthletes.current.size > 0 ? 'Сохранение...' : 'Готово'}
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

