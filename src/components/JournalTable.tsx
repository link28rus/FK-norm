'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import JournalLegend from './JournalLegend'

interface Athlete {
  id: string
  fullName: string
}

interface Lesson {
  id: string
  date: string
  topic?: string
}

interface DayData {
  day: number
  lesson: Lesson | null
  marks: Record<string, { code: string | null; code2: string | null }> // athleteId -> { code, code2 }
}

interface JournalData {
  athletes: Athlete[]
  days: DayData[]
  year: number
  month: number
}

const MARK_VALUES = ['', 'Н/Ф', 'Н', 'Б', '2', '3', '4', '5', 'О']

export default function JournalTable({ groupId }: { groupId: string }) {
  const [data, setData] = useState<JournalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [editingMarks, setEditingMarks] = useState<{
    day: number
    athleteId: string
    code: string | null
    code2: string | null
  } | null>(null)
  
  // Refs для управления запросами и debounce
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingRequestRef = useRef<Map<string, Promise<any>>>(new Map())
  
  // Локальное состояние для оптимистичного обновления UI
  const [optimisticMarks, setOptimisticMarks] = useState<Map<string, { code: string | null; code2: string | null }>>(new Map())

  const loadJournal = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/trainer/groups/${groupId}/journal?year=${selectedYear}&month=${selectedMonth}`
      )
      if (!response.ok) throw new Error('Ошибка загрузки')
      const journalData = await response.json()
      
      // Преобразуем старые данные (если есть) в новый формат
      if (journalData.days) {
        journalData.days = journalData.days.map((dayData: any) => {
          const marks: Record<string, { code: string | null; code2: string | null }> = {}
          Object.keys(dayData.marks || {}).forEach((athleteId) => {
            const mark = dayData.marks[athleteId]
            if (typeof mark === 'string' || mark === null) {
              // Старый формат: только code
              marks[athleteId] = { code: mark, code2: null }
            } else if (mark && typeof mark === 'object') {
              // Новый формат: { code, code2 }
              marks[athleteId] = {
                code: mark.code || null,
                code2: mark.code2 || null,
              }
            }
          })
          return {
            ...dayData,
            marks,
          }
        })
      }
      
      setData(journalData)
    } catch (err) {
      setError('Ошибка загрузки журнала')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJournal()
    // Очищаем optimistic marks при смене месяца/года
    setOptimisticMarks(new Map())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, selectedYear, selectedMonth])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      // Отменяем все pending запросы
      pendingRequestRef.current.clear()
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Очищаем debounce таймер
      clearDebounce()
    }
  }, [])

  // Формируем уникальный ключ для запроса
  const getRequestKey = (day: number, athleteId: string) => `${day}-${athleteId}`

  // Отменяем предыдущий запрос для той же ячейки
  const cancelPendingRequest = (key: string) => {
    if (pendingRequestRef.current.has(key)) {
      abortControllerRef.current?.abort()
      pendingRequestRef.current.delete(key)
    }
  }

  // Очищаем debounce таймер
  const clearDebounce = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }

  const handleMarkChange = useCallback(async (
    day: number,
    athleteId: string,
    newCode: string | null
  ) => {
    if (!data) return

    setError('')
    const requestKey = getRequestKey(day, athleteId)

    // Оптимистичное обновление UI сразу
    const dayData = data.days.find((d) => d.day === day)
    const currentMarks = dayData?.marks[athleteId] || { code: null, code2: null }
    
    // Создаем новый объект для оптимистичного обновления
    const optimisticMark = {
      code: newCode,
      code2: currentMarks.code2, // Сохраняем вторую оценку
    }
    
    // Обновляем локальное состояние оптимистично
    setOptimisticMarks(prev => {
      const newMap = new Map(prev)
      newMap.set(requestKey, optimisticMark)
      return newMap
    })

    // Обновляем состояние данных оптимистично
    setData(prevData => {
      if (!prevData) return prevData
      const updatedDays = prevData.days.map((d) => {
        if (d.day === day) {
          const updatedMarks = { ...d.marks }
          updatedMarks[athleteId] = optimisticMark
          return {
            ...d,
            marks: updatedMarks,
          }
        }
        return d
      })
      return { ...prevData, days: updatedDays }
    })

    // Отменяем предыдущий запрос для этой ячейки
    cancelPendingRequest(requestKey)
    
    // Очищаем предыдущий debounce
    clearDebounce()

    // Создаем новый AbortController для этого запроса
    abortControllerRef.current = new AbortController()
    const abortSignal = abortControllerRef.current.signal

    // Debounce: ждем 300ms перед отправкой запроса
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Формируем дату для этого дня в локальной временной зоне
        // Используем явное форматирование без конвертации в UTC, чтобы избежать смещения дня
        const dateString = `${data.year}-${String(data.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        // Получаем актуальные оценки из текущего состояния
        const currentDayData = data.days.find((d) => d.day === day)
        const marksToSave = currentDayData?.marks[athleteId] || optimisticMark

        // Создаем промис для отслеживания
        const savePromise = fetch(
          `/api/trainer/groups/${groupId}/journal/marks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: dateString,
              athleteId,
              code: newCode,
              code2: marksToSave.code2, // Используем актуальную вторую оценку
            }),
            signal: abortSignal,
          }
        ).then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Ошибка сохранения')
          }
          return response.json()
        })

        // Сохраняем промис для отслеживания
        pendingRequestRef.current.set(requestKey, savePromise)

        const result = await savePromise

        // Удаляем из pending после завершения
        pendingRequestRef.current.delete(requestKey)

        // Обновляем локальное состояние с ответом от сервера
        setData(prevData => {
          if (!prevData) return prevData
          const updatedDays = prevData.days.map((d) => {
            if (d.day === day) {
              const updatedMarks = { ...d.marks }
              updatedMarks[athleteId] = {
                code: result.lessonMark?.code ?? newCode,
                code2: result.lessonMark?.code2 ?? marksToSave.code2,
              }
              return {
                ...d,
                lesson: result.lesson || d.lesson, // Обновляем урок, если он был создан
                marks: updatedMarks,
              }
            }
            return d
          })
          return { ...prevData, days: updatedDays }
        })

        // Удаляем из optimistic marks после успешного сохранения
        setOptimisticMarks(prev => {
          const newMap = new Map(prev)
          newMap.delete(requestKey)
          return newMap
        })

      } catch (err: any) {
        // Удаляем из pending в случае ошибки
        pendingRequestRef.current.delete(requestKey)

        // Если это не отмена запроса, показываем ошибку
        if (err.name !== 'AbortError') {
          setError(err.message || 'Ошибка сохранения оценки')
          
          // Откатываем оптимистичное обновление при ошибке - перезагружаем данные
          setOptimisticMarks(prev => {
            const newMap = new Map(prev)
            newMap.delete(requestKey)
            return newMap
          })
          
          // Перезагружаем данные из сервера
          const reloadDate = new Date(data.year, data.month - 1, day)
          const reloadDateString = reloadDate.toISOString().split('T')[0]
          
          // Обновляем только затронутую ячейку, получая данные с сервера
          fetch(
            `/api/trainer/groups/${groupId}/journal?year=${data.year}&month=${data.month}`
          )
            .then(res => res.json())
            .then(journalData => {
              setData(prevData => {
                if (!prevData) return prevData
                // Обновляем только данные из ответа сервера
                const updatedDays = prevData.days.map((d) => {
                  const serverDayData = journalData.days.find((sd: DayData) => sd.day === d.day)
                  if (serverDayData) {
                    return {
                      ...d,
                      marks: { ...d.marks, ...serverDayData.marks },
                      lesson: serverDayData.lesson || d.lesson,
                    }
                  }
                  return d
                })
                return { ...prevData, days: updatedDays }
              })
            })
            .catch(() => {
              // В случае ошибки загрузки, просто очищаем optimistic mark
              // Пользователь увидит старое значение
            })
        }
      }
    }, 300) // Debounce 300ms

  }, [data, groupId, selectedYear, selectedMonth])

  const handleDoubleClick = (day: number, athleteId: string) => {
    if (!data) return
    const dayData = data.days.find((d) => d.day === day)
    const marks = dayData?.marks[athleteId] || { code: null, code2: null }
    setEditingMarks({
      day,
      athleteId,
      code: marks.code,
      code2: marks.code2,
    })
  }

  const handleSaveMarks = async () => {
    if (!data || !editingMarks) return

    setError('')
    const requestKey = getRequestKey(editingMarks.day, editingMarks.athleteId)
    
    // Отменяем предыдущий запрос для этой ячейки
    cancelPendingRequest(requestKey)
    
    // Очищаем debounce если есть
    clearDebounce()
    
    // Создаем новый AbortController
    abortControllerRef.current = new AbortController()
    const abortSignal = abortControllerRef.current.signal

    try {
      // Формируем дату в локальной временной зоне без конвертации в UTC
      const dateString = `${data.year}-${String(data.month).padStart(2, '0')}-${String(editingMarks.day).padStart(2, '0')}`

      // Оптимистичное обновление
      const optimisticMark = {
        code: editingMarks.code,
        code2: editingMarks.code2,
      }
      
      setOptimisticMarks(prev => {
        const newMap = new Map(prev)
        newMap.set(requestKey, optimisticMark)
        return newMap
      })

      // Обновляем локальное состояние оптимистично
      setData(prevData => {
        if (!prevData) return prevData
        const updatedDays = prevData.days.map((dayData) => {
          if (dayData.day === editingMarks.day) {
            const updatedMarks = { ...dayData.marks }
            updatedMarks[editingMarks.athleteId] = optimisticMark
            return {
              ...dayData,
              marks: updatedMarks,
            }
          }
          return dayData
        })
        return { ...prevData, days: updatedDays }
      })

      // Создаем промис для отслеживания
      const savePromise = fetch(
        `/api/trainer/groups/${groupId}/journal/marks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: dateString,
            athleteId: editingMarks.athleteId,
            code: editingMarks.code,
            code2: editingMarks.code2,
          }),
          signal: abortSignal,
        }
      ).then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Ошибка сохранения')
        }
        return response.json()
      })

      pendingRequestRef.current.set(requestKey, savePromise)

      const result = await savePromise

      // Удаляем из pending после завершения
      pendingRequestRef.current.delete(requestKey)

      // Обновляем локальное состояние с ответом от сервера
      setData(prevData => {
        if (!prevData) return prevData
        const updatedDays = prevData.days.map((dayData) => {
          if (dayData.day === editingMarks.day) {
            const updatedMarks = { ...dayData.marks }
            updatedMarks[editingMarks.athleteId] = {
              code: result.lessonMark?.code ?? editingMarks.code,
              code2: result.lessonMark?.code2 ?? editingMarks.code2,
            }
            return {
              ...dayData,
              lesson: result.lesson || dayData.lesson,
              marks: updatedMarks,
            }
          }
          return dayData
        })
        return { ...prevData, days: updatedDays }
      })

      // Удаляем из optimistic marks
      setOptimisticMarks(prev => {
        const newMap = new Map(prev)
        newMap.delete(requestKey)
        return newMap
      })

      setEditingMarks(null)
    } catch (err: any) {
      // Удаляем из pending в случае ошибки
      pendingRequestRef.current.delete(requestKey)

      if (err.name !== 'AbortError') {
        setError(err.message || 'Ошибка сохранения оценки')
        
        // Откатываем оптимистичное обновление
        setOptimisticMarks(prev => {
          const newMap = new Map(prev)
          newMap.delete(requestKey)
          return newMap
        })
        
        // Перезагружаем данные с сервера
        fetch(
          `/api/trainer/groups/${groupId}/journal?year=${data.year}&month=${data.month}`
        )
          .then(res => res.json())
          .then(journalData => {
            setData(prevData => {
              if (!prevData) return prevData
              const updatedDays = prevData.days.map((d) => {
                const serverDayData = journalData.days.find((sd: DayData) => sd.day === d.day)
                if (serverDayData) {
                  return {
                    ...d,
                    marks: { ...d.marks, ...serverDayData.marks },
                    lesson: serverDayData.lesson || d.lesson,
                  }
                }
                return d
              })
              return { ...prevData, days: updatedDays }
            })
          })
          .catch(() => {
            // В случае ошибки просто оставляем старое состояние
          })
      }
    }
  }

  const formatMarkDisplay = (code: string | null, code2: string | null): string => {
    if (!code2 || code2 === '' || code2 === null) {
      return code || '—'
    }
    const mark1 = code || '—'
    const mark2 = code2 || '—'
    return `${mark1}/${mark2}`
  }

  const getNextMark = (currentMark: string | null): string | null => {
    const currentIndex = MARK_VALUES.indexOf(currentMark || '')
    const nextIndex = (currentIndex + 1) % MARK_VALUES.length
    return nextIndex === 0 ? null : MARK_VALUES[nextIndex]
  }

  const getMarkColorClass = (mark: string | null): string => {
    if (!mark) return 'bg-gray-50 text-gray-400 border-gray-200'
    
    if (mark === 'Н/Ф' || mark === 'Н' || mark === 'Б' || mark === '2') {
      return 'bg-red-50 text-red-900 border-red-300 font-semibold'
    }
    
    if (mark === 'О') {
      return 'bg-blue-50 text-blue-900 border-blue-300 font-semibold'
    }
    
    if (mark === '4' || mark === '5') {
      return 'bg-green-50 text-green-900 border-green-300 font-semibold'
    }
    
    return 'bg-yellow-50 text-yellow-900 border-yellow-300 font-semibold'
  }

  const getDayOfWeek = (day: number): string => {
    if (!data) return ''
    const date = new Date(data.year, data.month - 1, day)
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    return dayNames[date.getDay()]
  }

  // Проверяем, является ли день выходным (суббота или воскресенье)
  const isWeekend = (day: number): boolean => {
    if (!data) return false
    const date = new Date(data.year, data.month - 1, day)
    const dayOfWeek = date.getDay()
    // 0 = воскресенье, 6 = суббота
    return dayOfWeek === 0 || dayOfWeek === 6
  }


  const months = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ]

  if (loading) {
    return <div className="text-center py-8">Загрузка журнала...</div>
  }

  if (!data) {
    return <div className="text-center py-8 text-gray-500">Нет данных</div>
  }

  const monthName = months[selectedMonth - 1]

  return (
    <div>
      {/* Подзаголовок для печати */}
      <div className="print-only mb-4 text-center">
        <p className="text-lg font-semibold text-gray-900">
          {monthName} {selectedYear}
        </p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex items-center gap-4">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
          >
            {months.map((month, index) => (
              <option key={index} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 px-3 py-2 border"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(
              (year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 no-print">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Таблица журнала по дням месяца */}
      <div className="bg-white shadow rounded-lg journal-table-wrapper">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="sticky top-0 z-50 bg-gray-50 shadow-sm">
              <tr>
                <th className="sticky left-0 z-50 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  ФИО
                </th>
                {data.days.map((dayData) => {
                  const hasLesson = dayData.lesson !== null
                  const weekend = isWeekend(dayData.day)
                  
                  // Подсвечиваем только выходные дни
                  let headerClassName = 'px-2 py-3 text-center text-xs font-medium min-w-[50px]'
                  if (weekend) {
                    // Подсветка для выходных дней (суббота и воскресенье)
                    headerClassName += ' bg-orange-50 text-orange-700 border-b-2 border-orange-300'
                  } else {
                    // Обычный стиль для будних дней
                    headerClassName += ' bg-gray-50 text-gray-500'
                  }
                  
                  return (
                    <th
                      key={dayData.day}
                      className={headerClassName}
                      title={hasLesson && dayData.lesson?.topic ? dayData.lesson.topic : undefined}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{dayData.day}</span>
                        <span className="text-xs mt-1">{getDayOfWeek(dayData.day)}</span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.athletes.length === 0 ? (
                <tr>
                  <td
                    colSpan={data.days.length + 1}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Нет учеников в группе
                  </td>
                </tr>
              ) : (
                data.athletes.map((athlete) => (
                  <tr key={athlete.id}>
                    <td className="sticky left-0 z-40 bg-white px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">
                      {athlete.fullName}
                    </td>
                    {data.days.map((dayData) => {
                      const requestKey = getRequestKey(dayData.day, athlete.id)
                      // Проверяем, есть ли оптимистичное обновление
                      const optimisticMark = optimisticMarks.get(requestKey)
                      const marks = optimisticMark || dayData.marks[athlete.id] || { code: null, code2: null }
                      const currentMark = marks.code
                      const displayText = formatMarkDisplay(marks.code, marks.code2)

                      return (
                        <td
                          key={dayData.day}
                          className="px-2 py-2 text-center text-sm"
                        >
                          {/* Кнопка для экрана */}
                          <button
                            onClick={() =>
                              handleMarkChange(dayData.day, athlete.id, getNextMark(currentMark))
                            }
                            onDoubleClick={(e) => {
                              e.preventDefault()
                              handleDoubleClick(dayData.day, athlete.id)
                            }}
                            className={`w-full py-1 px-1 rounded border text-xs font-medium transition-colors no-print relative ${
                              currentMark
                                ? getMarkColorClass(currentMark)
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                            }`}
                            title="Клик для изменения первой оценки, двойной клик для редактирования обеих оценок"
                          >
                            {displayText}
                            {marks.code2 && marks.code2 !== '' && marks.code2 !== null && (
                              <span className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full" />
                            )}
                          </button>
                          {/* Отображение для печати (без кнопки) */}
                          <span className="print-only text-sm font-medium">
                            {displayText}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Легенда */}
      <JournalLegend />

      {data.days.filter((d) => d.lesson !== null).length === 0 && (
        <div className="mt-4 text-center text-gray-500 no-print">
          Нет уроков за выбранный месяц. Кликните по клетке дня, чтобы создать урок и поставить оценку.
        </div>
      )}

      {/* Модалка для редактирования двух оценок */}
      {editingMarks && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-heading mb-4">
              Оценки за урок
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Оценка 1:
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingMarks({
                        ...editingMarks,
                        code: getNextMark(editingMarks.code),
                      })
                    }}
                    className={`flex-1 py-2 px-4 rounded border text-sm font-medium transition-colors ${
                      editingMarks.code
                        ? getMarkColorClass(editingMarks.code)
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {editingMarks.code || '—'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Оценка 2:
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingMarks({
                        ...editingMarks,
                        code2: getNextMark(editingMarks.code2),
                      })
                    }}
                    className={`flex-1 py-2 px-4 rounded border text-sm font-medium transition-colors ${
                      editingMarks.code2
                        ? getMarkColorClass(editingMarks.code2)
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {editingMarks.code2 || '—'}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setEditingMarks(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveMarks}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
