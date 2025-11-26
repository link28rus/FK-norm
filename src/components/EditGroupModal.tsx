'use client'

import { useState, useEffect } from 'react'
import { extractClassFromGroupName, canExtractClassFromGroupName } from '@/lib/groupClassExtractor'
import { Input, Textarea, Button, Alert } from '@/components/ui'

interface EditGroupModalProps {
  groupId: string
  groupName: string
  groupDescription?: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditGroupModal({
  groupId,
  groupName,
  groupDescription,
  isOpen,
  onClose,
  onSuccess,
}: EditGroupModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({})
  const [name, setName] = useState(groupName)
  const [description, setDescription] = useState(groupDescription || '')
  const [detectedClass, setDetectedClass] = useState<number | null>(extractClassFromGroupName(groupName))

  // Инициализируем данные при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      setName(groupName)
      setDescription(groupDescription || '')
      setError('')
    }
  }, [isOpen, groupName, groupDescription])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    // Валидация
    if (!name.trim()) {
      setFieldErrors({ name: 'Укажите название группы' })
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/trainer/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка обновления группы')
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
              <h3 className="h3 mb-4">
                Редактирование группы
              </h3>

              {error && (
                <Alert variant="error" message={error} className="mb-4" />
              )}

              <div className="space-y-4">
                <Input
                  label="Название группы"
                  type="text"
                  required
                  error={fieldErrors.name}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setDetectedClass(extractClassFromGroupName(e.target.value))
                    if (fieldErrors.name) {
                      setFieldErrors({})
                    }
                  }}
                  disabled={loading}
                  placeholder="Например: 2 А, 3 Б, 5 Г"
                />
                {/* Информация об автоматическом определении класса */}
                {detectedClass !== null ? (
                  <div className="mt-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Класс определён автоматически.</strong> Система определяет школьный класс на основании названия группы. Проверьте, корректно ли указано название группы — от этого зависит автоматический расчёт оценок по normативам.
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Определённый класс: <strong>{detectedClass}</strong>
                    </p>
                  </div>
                ) : name.trim() ? (
                  <div className="mt-2 p-3 rounded-md bg-yellow-50 border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <strong>Не удалось определить класс группы.</strong> В названии группы отсутствует цифра. Укажите цифру школьного класса в названии, например: "2 А", "3 Б", "5 Г".
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Без корректного класса автоматический расчёт оценок по normативам работать не сможет.
                    </p>
                  </div>
                ) : null}

                <Textarea
                  label="Комментарий / школа"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  placeholder="Например: МБОУ СОШ с.Восточное"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                disabled={loading}
                className="sm:w-auto w-full"
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="sm:w-auto w-full"
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
