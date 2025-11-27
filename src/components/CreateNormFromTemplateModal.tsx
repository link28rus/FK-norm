'use client'

import { useState, useEffect } from 'react'
import { Button, Select, Alert } from '@/components/ui'

interface NormTemplate {
  id: string
  name: string
  unit: string
  classFrom: number
  classTo: number
  direction: string
  applicableGender?: 'ALL' | 'MALE' | 'FEMALE'
  ownerTrainerId?: string | null
  isPublic: boolean
  ownerTrainer?: {
    id: string
    fullName: string
  } | null
}

interface CreateNormFromTemplateModalProps {
  groupId: string
  groupClass: number | null
  groupName: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

/**
 * Очищает имя шаблона от пометок в квадратных скобках
 * Убирает всё в квадратных скобках: [Личный – ...] или [ .... ]
 */
function cleanTemplateName(name: string): string {
  // Убираем всё в квадратных скобках: [Личный – ...] или [ .... ]
  return name.replace(/\[.*?\]\s*/g, "").trim()
}

export default function CreateNormFromTemplateModal({
  groupId,
  groupClass,
  groupName,
  isOpen,
  onClose,
  onSuccess,
}: CreateNormFromTemplateModalProps) {
  const [templates, setTemplates] = useState<NormTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0])
  const [nameOverride, setNameOverride] = useState('')
  const [unitOverride, setUnitOverride] = useState('')
  const [useCustomBoundaries, setUseCustomBoundaries] = useState(false)
  const [period, setPeriod] = useState<'START_OF_YEAR' | 'END_OF_YEAR' | 'REGULAR'>('REGULAR')

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen, groupId])

  const loadTemplates = async () => {
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/available-templates`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setTemplates(data.templates)
    } catch (err) {
      setError('Ошибка загрузки шаблонов')
    }
  }

  // Вычисляем номер класса группы с fallback'ами
  // Поля из Prisma schema:
  // - Group.class: Int? - номер класса группы (2, 3, 4, ...)
  const rawGroupClass = groupClass

  let groupClassNumber: number | null = rawGroupClass ?? null

  // Fallback: если нет явного числа, пробуем извлечь из названия группы
  if (groupClassNumber == null && groupName && typeof groupName === 'string') {
    const match = groupName.match(/\d+/)
    if (match) {
      groupClassNumber = Number(match[0])
    }
  }

  // Предупреждение, если не удалось определить класс
  if (groupClassNumber == null) {
    console.warn('[CreateNormFromTemplateModal] Не удалось определить номер класса для группы:', {
      groupId,
      groupClass,
      groupName,
    })
  }

  // Фильтруем шаблоны по номеру класса (строгое равенство)
  // Поля из Prisma schema:
  // - NormTemplate.classFrom: Int - начальный класс
  // - NormTemplate.classTo: Int - конечный класс
  // Шаблон виден, если classFrom === classTo === groupClassNumber
  let templatesForGroup = templates

  if (groupClassNumber != null) {
    templatesForGroup = templates.filter((t) => {
      const from = t.classFrom
      const to = t.classTo ?? t.classFrom
      // Шаблон подходит, только если from == to == номер класса группы (строгое равенство)
      return from === groupClassNumber && to === groupClassNumber
    })
  }

  const selectedTemplate = templatesForGroup.find(t => t.id === selectedTemplateId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!selectedTemplateId) {
      setError('Выберите шаблон')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/group-norms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          testDate,
          nameOverride: nameOverride || null,
          unitOverride: unitOverride || null,
          useCustomBoundaries,
          boundaries: useCustomBoundaries ? [] : undefined, // TODO: добавить редактор границ
          period, // Период норматива
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка создания норматива')
        setLoading(false)
        return
      }

      onSuccess()
      onClose()
      // Сброс формы
      setSelectedTemplateId('')
      setTestDate(new Date().toISOString().split('T')[0])
      setNameOverride('')
      setUnitOverride('')
      setUseCustomBoundaries(false)
      setPeriod('REGULAR')
    } catch (err) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="h3">
                  Создать норматив из шаблона
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
                <Alert variant="error" message={error} className="mb-4" />
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Шаблон норматива *
                  </label>
                  <select
                    required
                    value={selectedTemplateId}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value)
                      const template = templatesForGroup.find(t => t.id === e.target.value)
                      if (template) {
                        setUnitOverride(template.unit)
                        setNameOverride('')
                      }
                    }}
                    disabled={templatesForGroup.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Выберите шаблон...</option>
                    {templatesForGroup.length === 0 ? (
                      <option value="" disabled>
                        Нет шаблонов для этого класса
                      </option>
                    ) : (
                      (() => {
                        // Разделяем шаблоны на группы по applicableGender
                        const commonTemplates = templatesForGroup.filter(t => (t.applicableGender ?? 'ALL') === 'ALL')
                        const maleTemplates = templatesForGroup.filter(t => t.applicableGender === 'MALE')
                        const femaleTemplates = templatesForGroup.filter(t => t.applicableGender === 'FEMALE')

                        return (
                          <>
                            {commonTemplates.length > 0 && (
                              <optgroup label="Общие нормативы (мальчики и девочки)">
                                {commonTemplates.map((template) => {
                                  // Убираем пометки в квадратных скобках и классы из названия (если есть)
                                  const pureName = cleanTemplateName(template.name).replace(/\(классы.*?\)/gi, "").trim()
                                  return (
                                    <option key={template.id} value={template.id}>
                                      {pureName} (классы {template.classFrom}-{template.classTo})
                                    </option>
                                  )
                                })}
                              </optgroup>
                            )}
                            {maleTemplates.length > 0 && (
                              <optgroup label="Нормативы только для мальчиков">
                                {maleTemplates.map((template) => {
                                  // Убираем пометки в квадратных скобках и классы из названия (если есть)
                                  const pureName = cleanTemplateName(template.name).replace(/\(классы.*?\)/gi, "").trim()
                                  return (
                                    <option key={template.id} value={template.id}>
                                      {pureName} (классы {template.classFrom}-{template.classTo})
                                    </option>
                                  )
                                })}
                              </optgroup>
                            )}
                            {femaleTemplates.length > 0 && (
                              <optgroup label="Нормативы только для девочек">
                                {femaleTemplates.map((template) => {
                                  // Убираем пометки в квадратных скобках и классы из названия (если есть)
                                  const pureName = cleanTemplateName(template.name).replace(/\(классы.*?\)/gi, "").trim()
                                  return (
                                    <option key={template.id} value={template.id}>
                                      {pureName} (классы {template.classFrom}-{template.classTo})
                                    </option>
                                  )
                                })}
                              </optgroup>
                            )}
                          </>
                        )
                      })()
                    )}
                  </select>
                  {templates.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-500">
                      Нет доступных шаблонов. Создайте шаблоны в админ-панели.
                    </p>
                  ) : templatesForGroup.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-500">
                      Нет шаблонов для этого класса.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">
                      Шаблоны сгруппированы по тому, кто сдаёт норматив: общие, только для мальчиков и только для девочек.
                    </p>
                  )}
                </div>

                {selectedTemplate && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Дата зачёта *
                      </label>
                      <input
                        type="date"
                        required
                        value={testDate}
                        onChange={(e) => setTestDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Период норматива
                      </label>
                      <Select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as 'START_OF_YEAR' | 'END_OF_YEAR' | 'REGULAR')}
                        options={[
                          { value: 'REGULAR', label: 'Обычный норматив' },
                          { value: 'START_OF_YEAR', label: 'Контрольный замер начала года' },
                          { value: 'END_OF_YEAR', label: 'Контрольный замер конца года' },
                        ]}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Используйте «Контрольный замер начала/конца года» для контрольных нормативов. 
                        Для каждого периода и шаблона может быть только один норматив в учебном году.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Название (переопределить)
                      </label>
                      <input
                        type="text"
                        value={nameOverride}
                        onChange={(e) => setNameOverride(e.target.value)}
                        placeholder={selectedTemplate.name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Если не указано, используется название из шаблона
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Единица измерения (переопределить)
                      </label>
                      <input
                        type="text"
                        value={unitOverride}
                        onChange={(e) => setUnitOverride(e.target.value)}
                        placeholder={selectedTemplate.unit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Если не указано, используется единица из шаблона
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={useCustomBoundaries}
                          onChange={(e) => setUseCustomBoundaries(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Использовать свои границы оценок для этой группы
                        </span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500 ml-6">
                        Если включено, можно будет настроить границы оценок отдельно для этой группы
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                disabled={loading || !selectedTemplateId || templatesForGroup.length === 0}
                className="w-full sm:w-auto"
              >
                {loading ? 'Создание...' : 'Создать'}
              </Button>
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Отмена
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

