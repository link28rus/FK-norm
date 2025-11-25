'use client'

import { useState, useEffect } from 'react'

interface NormTemplate {
  id: string
  name: string
  unit: string
  classFrom: number
  classTo: number
  direction: string
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
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateNormFromTemplateModal({
  groupId,
  groupClass,
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

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

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
    } catch (err) {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

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
                <h3 className="text-lg font-semibold text-heading">
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
                <div className="mb-4 rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-800">{error}</div>
                </div>
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
                      const template = templates.find(t => t.id === e.target.value)
                      if (template) {
                        setUnitOverride(template.unit)
                        setNameOverride('')
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Выберите шаблон...</option>
                    {templates.map((template) => {
                      const templateType = template.ownerTrainerId 
                        ? `[Личный${template.ownerTrainer?.fullName ? ` - ${template.ownerTrainer.fullName}` : ''}]`
                        : template.isPublic 
                        ? '[Общий]'
                        : '[Личный]'
                      return (
                        <option key={template.id} value={template.id}>
                          {templateType} {template.name} ({template.unit}, классы {template.classFrom}-{template.classTo})
                        </option>
                      )
                    })}
                  </select>
                  {templates.length === 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      Нет доступных шаблонов. Создайте шаблоны в админ-панели.
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
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading || !selectedTemplateId}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Создание...' : 'Создать'}
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

