'use client'

import { useState, useEffect } from 'react'

interface NormTemplate {
  id: string
  name: string
  description?: string | null
  unit: string
  classFrom: number
  classTo: number
  direction: string
  ownerTrainerId?: string | null
  isPublic: boolean
  isActive: boolean
  _count?: {
    boundaries: number
    groupNorms: number
  }
}

interface NormTemplateBoundary {
  id: string
  grade: number
  gender: string
  class: number
  fromValue: number
  toValue: number
}

export default function NormTemplatesTrainer() {
  const [templates, setTemplates] = useState<NormTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NormTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: '',
    class: 2, // Одно поле для класса
    direction: 'LOWER_IS_BETTER' as 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER',
    boundaries: [] as NormTemplateBoundary[],
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [overlapWarnings, setOverlapWarnings] = useState<Record<string, string[]>>({})

  useEffect(() => {
    loadTemplates()
  }, [])

  // Проверка пересечений диапазонов
  useEffect(() => {
    if (!showForm) return

    const warnings: Record<string, string[]> = {}
    const classes = [formData.class]
    const genders: ('MALE' | 'FEMALE')[] = ['MALE', 'FEMALE']

    classes.forEach(classValue => {
      genders.forEach(gender => {
        const classGenderKey = `${classValue}-${gender}`
        const boundariesForClassGender = formData.boundaries.filter(
          b => b.class === classValue && b.gender === gender && b.fromValue > 0 && b.toValue > 0
        ).sort((a, b) => a.fromValue - b.fromValue)

        for (let i = 0; i < boundariesForClassGender.length; i++) {
          for (let j = i + 1; j < boundariesForClassGender.length; j++) {
            const b1 = boundariesForClassGender[i]
            const b2 = boundariesForClassGender[j]

            if (
              (b1.fromValue <= b2.fromValue && b1.toValue > b2.fromValue) ||
              (b2.fromValue <= b1.fromValue && b2.toValue > b1.fromValue)
            ) {
              const key = `${classGenderKey}-${b1.grade}-${b2.grade}`
              if (!warnings[classGenderKey]) warnings[classGenderKey] = []
              warnings[classGenderKey].push(
                `Диапазоны для оценок ${b1.grade} и ${b2.grade} пересекаются`
              )
            }
          }
        }
      })
    })

    setOverlapWarnings(warnings)
  }, [formData.boundaries, formData.class, showForm])

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/trainer/norm-templates')
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError('Ошибка загрузки шаблонов')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/trainer/norm-templates/${id}`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      const template = data.template

      const boundaries: NormTemplateBoundary[] = (template.boundaries || []).map((b: any) => ({
        id: b.id,
        grade: b.grade,
        gender: b.gender,
        class: b.class,
        fromValue: b.fromValue,
        toValue: b.toValue,
      }))

      setFormData({
        name: template.name,
        description: template.description || '',
        unit: template.unit,
        class: template.classFrom,
        direction: template.direction,
        boundaries,
      })
      setEditingTemplate(template)
      setShowForm(true)
    } catch (err) {
      setError('Ошибка загрузки шаблона')
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = 'Название обязательно'
    }

    if (!formData.unit) {
      errors.unit = 'Единица измерения обязательна'
    }

    if (!formData.class || formData.class < 1 || formData.class > 11) {
      errors.class = 'Класс должен быть от 1 до 11'
    }

    const requiredBoundaries = [5, 4, 3, 2]
    const genders: ('MALE' | 'FEMALE')[] = ['MALE', 'FEMALE']
    const missingBoundaries: string[] = []

    genders.forEach(gender => {
      requiredBoundaries.forEach(grade => {
        const boundary = formData.boundaries.find(
          b => b.class === formData.class && b.gender === gender && b.grade === grade
        )
        if (!boundary || !boundary.fromValue || !boundary.toValue) {
          missingBoundaries.push(`${gender === 'MALE' ? 'Мальчики' : 'Девочки'}, оценка ${grade}`)
        }
      })
    })

    if (missingBoundaries.length > 0) {
      errors.boundaries = `Не заполнены границы для: ${missingBoundaries.join(', ')}`
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setValidationErrors({})

    if (!validateForm()) {
      return
    }

    try {
      const url = editingTemplate
        ? `/api/trainer/norm-templates/${editingTemplate.id}`
        : '/api/trainer/norm-templates'

      const method = editingTemplate ? 'PUT' : 'POST'

      // При сохранении устанавливаем classFrom = class, classTo = class
      const submitData = {
        ...formData,
        classFrom: formData.class,
        classTo: formData.class,
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка сохранения шаблона')
        return
      }

      setShowForm(false)
      setEditingTemplate(null)
      setFormData({
        name: '',
        description: '',
        unit: '',
        class: 2,
        direction: 'LOWER_IS_BETTER',
        boundaries: [],
      })
      setValidationErrors({})
      setOverlapWarnings({})
      loadTemplates()
    } catch (err) {
      setError('Ошибка сохранения шаблона')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон? Это действие нельзя отменить.')) return

    try {
      const response = await fetch(`/api/trainer/norm-templates/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Ошибка удаления')
        return
      }

      loadTemplates()
    } catch (err) {
      setError('Ошибка удаления шаблона')
    }
  }

  const initializeBoundaries = () => {
    const genders: ('MALE' | 'FEMALE')[] = ['MALE', 'FEMALE']
    const grades = [5, 4, 3, 2]

    const newBoundaries: NormTemplateBoundary[] = []
    genders.forEach(gender => {
      grades.forEach(grade => {
        const existing = formData.boundaries.find(
          b => b.class === formData.class && b.gender === gender && b.grade === grade
        )
        if (!existing) {
          newBoundaries.push({
            id: `temp-${formData.class}-${gender}-${grade}`,
            grade,
            gender,
            class: formData.class,
            fromValue: 0,
            toValue: 0,
          })
        }
      })
    })

    setFormData({
      ...formData,
      boundaries: [...formData.boundaries, ...newBoundaries],
    })
  }

  const updateBoundary = (id: string, field: 'fromValue' | 'toValue', value: number) => {
    setFormData({
      ...formData,
      boundaries: formData.boundaries.map(b =>
        b.id === id ? { ...b, [field]: value } : b
      ),
    })
  }

  const getBoundary = (classValue: number, gender: string, grade: number) => {
    return formData.boundaries.find(
      b => b.class === classValue && b.gender === gender && b.grade === grade
    )
  }

  const isFieldEmpty = (classValue: number, gender: string, grade: number): boolean => {
    const boundary = getBoundary(classValue, gender, grade)
    return !boundary || !boundary.fromValue || !boundary.toValue
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка шаблонов...</div>
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-title font-semibold text-heading">
            {editingTemplate ? 'Редактировать личный шаблон' : 'Создать личный шаблон'}
          </h2>
          <button
            onClick={() => {
              setShowForm(false)
              setEditingTemplate(null)
              setFormData({
                name: '',
                description: '',
                unit: '',
                class: 2,
                direction: 'LOWER_IS_BETTER',
                boundaries: [],
              })
              setValidationErrors({})
              setOverlapWarnings({})
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Отмена
          </button>
        </div>

        {/* Информационный блок вверху */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Вы создаёте шаблон норматива.</strong> Его можно будет использовать при добавлении нормативов в группы.
          </p>
          <p className="text-sm text-blue-700 mt-2">
            Пороговые значения оценок заполняются отдельно для мальчиков и девочек.
          </p>
          <p className="text-sm text-blue-700 mt-1">
            💡 Это личный шаблон — он будет доступен только вам и не будет виден другим тренерам.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {validationErrors.boundaries && (
          <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
            <div className="text-sm text-yellow-800">{validationErrors.boundaries}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow">
          {/* Блок 1: Основная информация */}
          <div className="border-b pb-6">
            <h3 className="text-subtitle font-semibold text-heading mb-4">🔹 Основная информация</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название норматива *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    setValidationErrors({ ...validationErrors, name: '' })
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                    validationErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Например: Бег 30 м с высокого старта"
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  rows={2}
                  placeholder="Дополнительная информация о нормативе (необязательно)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Единица измерения *
                  </label>
                  <select
                    required
                    value={formData.unit}
                    onChange={(e) => {
                      setFormData({ ...formData, unit: e.target.value })
                      setValidationErrors({ ...validationErrors, unit: '' })
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                      validationErrors.unit ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Выберите...</option>
                    <option value="сек">сек (секунды)</option>
                    <option value="м">м (метры)</option>
                    <option value="раз">раз (количество)</option>
                    <option value="без учета времени">без учета времени</option>
                  </select>
                  {validationErrors.unit && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.unit}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Направление результата *
                  </label>
                  <select
                    required
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="LOWER_IS_BETTER">Чем меньше — тем лучше (время)</option>
                    <option value="HIGHER_IS_BETTER">Чем больше — тем лучше (метры, количество)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Блок 2: Класс */}
          <div className="border-b pb-6">
            <h3 className="text-subtitle font-semibold text-heading mb-4">🔹 Класс для которого действует шаблон</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Класс норматива *
              </label>
              <input
                type="number"
                required
                min="1"
                max="11"
                value={formData.class}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 2
                  setFormData(prev => ({
                    ...prev,
                    class: value,
                    boundaries: prev.boundaries.filter(b => b.class !== value),
                  }))
                  setValidationErrors({ ...validationErrors, class: '' })
                }}
                className={`w-32 px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                  validationErrors.class ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {validationErrors.class && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.class}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                При создании норматива для группы класс будет автоматически подставлен из названия группы
              </p>
            </div>
          </div>

          {/* Блок 3: Границы оценок */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-subtitle font-semibold text-heading">🔹 Границы оценок</h3>
              <button
                type="button"
                onClick={initializeBoundaries}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Инициализировать таблицу
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <div className="grid grid-cols-2 gap-6">
                  {/* Мальчики */}
                  <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <h4 className="text-base font-semibold text-heading mb-3">Мальчики</h4>
                    <table className="min-w-full border-collapse border border-gray-300 bg-white">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border border-gray-300">Оценка</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border border-gray-300">От</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border border-gray-300">До</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[5, 4, 3, 2].map(grade => {
                          const boundary = getBoundary(formData.class, 'MALE', grade)
                          const isEmpty = isFieldEmpty(formData.class, 'MALE', grade)
                          return (
                            <tr key={grade} className={isEmpty ? 'bg-yellow-50' : ''}>
                              <td className="px-4 py-2 border border-gray-300 font-medium text-center">{grade}</td>
                              <td className="px-4 py-2 border border-gray-300">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={boundary?.fromValue || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value)
                                    if (!isNaN(val)) {
                                      const bid = boundary?.id || `temp-${formData.class}-MALE-${grade}`
                                      if (!boundary) {
                                        setFormData({
                                          ...formData,
                                          boundaries: [...formData.boundaries, {
                                            id: bid,
                                            grade,
                                            gender: 'MALE',
                                            class: formData.class,
                                            fromValue: val,
                                            toValue: 0,
                                          }],
                                        })
                                      } else {
                                        updateBoundary(bid, 'fromValue', val)
                                      }
                                    }
                                  }}
                                  className={`w-full px-2 py-1 border rounded text-sm ${
                                    isEmpty ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                                  }`}
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="px-4 py-2 border border-gray-300">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={boundary?.toValue || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value)
                                    if (!isNaN(val)) {
                                      const bid = boundary?.id || `temp-${formData.class}-MALE-${grade}`
                                      if (!boundary) {
                                        setFormData({
                                          ...formData,
                                          boundaries: [...formData.boundaries, {
                                            id: bid,
                                            grade,
                                            gender: 'MALE',
                                            class: formData.class,
                                            fromValue: 0,
                                            toValue: val,
                                          }],
                                        })
                                      } else {
                                        updateBoundary(bid, 'toValue', val)
                                      }
                                    }
                                  }}
                                  className={`w-full px-2 py-1 border rounded text-sm ${
                                    isEmpty ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                                  }`}
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {overlapWarnings[`${formData.class}-MALE`] && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        {overlapWarnings[`${formData.class}-MALE`].map((w, i) => (
                          <p key={i}>{w}</p>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-xs text-gray-600">
                      <strong>«От»</strong> — нижняя граница диапазона (минимальное значение). <strong>«До»</strong> — верхняя граница диапазона (максимальное значение). Результат ученика должен входить в этот диапазон включительно (от «От» до «До»), чтобы получить указанную оценку.
                    </p>
                  </div>

                  {/* Девочки */}
                  <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <h4 className="text-base font-semibold text-heading mb-3">Девочки</h4>
                    <table className="min-w-full border-collapse border border-gray-300 bg-white">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border border-gray-300">Оценка</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border border-gray-300">От</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border border-gray-300">До</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[5, 4, 3, 2].map(grade => {
                          const boundary = getBoundary(formData.class, 'FEMALE', grade)
                          const isEmpty = isFieldEmpty(formData.class, 'FEMALE', grade)
                          return (
                            <tr key={grade} className={isEmpty ? 'bg-yellow-50' : ''}>
                              <td className="px-4 py-2 border border-gray-300 font-medium text-center">{grade}</td>
                              <td className="px-4 py-2 border border-gray-300">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={boundary?.fromValue || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value)
                                    if (!isNaN(val)) {
                                      const bid = boundary?.id || `temp-${formData.class}-FEMALE-${grade}`
                                      if (!boundary) {
                                        setFormData({
                                          ...formData,
                                          boundaries: [...formData.boundaries, {
                                            id: bid,
                                            grade,
                                            gender: 'FEMALE',
                                            class: formData.class,
                                            fromValue: val,
                                            toValue: 0,
                                          }],
                                        })
                                      } else {
                                        updateBoundary(bid, 'fromValue', val)
                                      }
                                    }
                                  }}
                                  className={`w-full px-2 py-1 border rounded text-sm ${
                                    isEmpty ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                                  }`}
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="px-4 py-2 border border-gray-300">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={boundary?.toValue || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value)
                                    if (!isNaN(val)) {
                                      const bid = boundary?.id || `temp-${formData.class}-FEMALE-${grade}`
                                      if (!boundary) {
                                        setFormData({
                                          ...formData,
                                          boundaries: [...formData.boundaries, {
                                            id: bid,
                                            grade,
                                            gender: 'FEMALE',
                                            class: formData.class,
                                            fromValue: 0,
                                            toValue: val,
                                          }],
                                        })
                                      } else {
                                        updateBoundary(bid, 'toValue', val)
                                      }
                                    }
                                  }}
                                  className={`w-full px-2 py-1 border rounded text-sm ${
                                    isEmpty ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                                  }`}
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {overlapWarnings[`${formData.class}-FEMALE`] && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        {overlapWarnings[`${formData.class}-FEMALE`].map((w, i) => (
                          <p key={i}>{w}</p>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-xs text-gray-600">
                      <strong>«От»</strong> — нижняя граница диапазона (минимальное значение). <strong>«До»</strong> — верхняя граница диапазона (максимальное значение). Результат ученика должен входить в этот диапазон включительно (от «От» до «До»), чтобы получить указанную оценку.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Блок "Как настраивать шаблон" */}
          <div className="border-t pt-6 bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-lg">
            <h3 className="text-subtitle font-semibold text-heading mb-4">📖 Как заполнять границы оценок</h3>
            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <p className="font-medium mb-3">Правила заполнения:</p>
                <p className="mb-2">Каждая строка таблицы — это диапазон результата, которому соответствует определённая оценка.</p>
                <p className="mb-3">Вы заполняете два поля:</p>
                <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                  <li><strong>«От»</strong> — нижняя граница результата (минимальное значение)</li>
                  <li><strong>«До»</strong> — верхняя граница результата (максимальное значение)</li>
                </ul>
                <p className="mb-3 bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                  <strong>📌 Важно:</strong> Результат ученика считается попадающим в диапазон, если он включительно входит в границы «От» и «До».
                </p>
              </div>
              <div className="mt-4 p-4 bg-white border border-gray-200 rounded">
                <p className="font-medium mb-3">Пример заполнения (для норматива «Бег 30 м», мальчики):</p>
                <p className="text-xs text-gray-700 mb-3">
                  Допустим, по нормативам:
                </p>
                <ul className="list-none space-y-2 mb-4 text-xs text-gray-700">
                  <li>• Оценка <strong>5</strong> ставится, если результат от <strong>1</strong> до <strong>6,2</strong> сек включительно</li>
                  <li>• Оценка <strong>4</strong> — если от <strong>6,3</strong> до <strong>6,8</strong> сек включительно</li>
                  <li>• Оценка <strong>3</strong> — если от <strong>6,9</strong> до <strong>7,2</strong> сек включительно</li>
                  <li>• Оценка <strong>2</strong> — если от <strong>7,3</strong> до <strong>15</strong> сек включительно</li>
                </ul>
                <p className="text-xs text-gray-700 mb-2 font-medium">Тогда таблица должна быть заполнена так:</p>
                <div className="bg-gray-50 border border-gray-300 rounded p-3 text-xs">
                  <div className="space-y-2">
                    <div><strong>Оценка 5:</strong> От: <strong>1</strong> • До: <strong>6,2</strong></div>
                    <div><strong>Оценка 4:</strong> От: <strong>6,3</strong> • До: <strong>6,8</strong></div>
                    <div><strong>Оценка 3:</strong> От: <strong>6,9</strong> • До: <strong>7,2</strong></div>
                    <div><strong>Оценка 2:</strong> От: <strong>7,3</strong> • До: <strong>15</strong></div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                  <strong>✨ Краткое правило:</strong> «От» — нижняя граница диапазона (минимальное значение). «До» — верхняя граница диапазона (максимальное значение). Результат ученика должен входить в этот диапазон включительно, чтобы получить указанную оценку.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-6 border-t">
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingTemplate(null)
                setValidationErrors({})
                setOverlapWarnings({})
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    )
  }

  // Фильтруем шаблоны: показываем только личные (ownerTrainerId != null) и общие (isPublic = true)
  const personalTemplates = templates.filter(t => t.ownerTrainerId !== null && !t.isPublic)
  const publicTemplates = templates.filter(t => t.isPublic && t.ownerTrainerId === null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-heading mb-2">Мои шаблоны нормативов</h1>
          <p className="text-sm text-secondary">
            Управление личными шаблонами нормативов. Вы также можете использовать общие шаблоны, созданные администратором.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          Создать личный шаблон
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Личные шаблоны */}
      <div>
        <h2 className="text-title font-semibold text-heading mb-4">Личные шаблоны</h2>
        {personalTemplates.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-500 text-center">
              У вас пока нет личных шаблонов. Создайте первый шаблон.
            </p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Единица
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Классы
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Направление
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Границы
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
                {personalTemplates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.classFrom}–{template.classTo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.direction === 'LOWER_IS_BETTER' ? 'Меньше = лучше' : 'Больше = лучше'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template._count?.boundaries || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        template.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {template.isActive ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => loadTemplate(template.id)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
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
        )}
      </div>

      {/* Общие шаблоны (только просмотр) */}
      {publicTemplates.length > 0 && (
        <div>
          <h2 className="text-title font-semibold text-heading mb-4">Общие шаблоны (только просмотр)</h2>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Единица
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Классы
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Направление
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Границы
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {publicTemplates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.classFrom}–{template.classTo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.direction === 'LOWER_IS_BETTER' ? 'Меньше = лучше' : 'Больше = лучше'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template._count?.boundaries || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
