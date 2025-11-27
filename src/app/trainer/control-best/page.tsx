"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Mode = "group" | "grade"

interface GroupSummary {
  id: string
  name: string
  class?: number | null
}

interface GroupBestByNormItem {
  templateId: string
  templateName: string
  studentId: string
  studentName: string
  value: number
}

interface GroupTopProgressItem {
  studentId: string
  studentName: string
  templateId: string
  templateName: string
  startValue: number
  endValue: number
  progress: number
}

interface GroupReportData {
  bestByNorm: GroupBestByNormItem[]
  topProgress: GroupTopProgressItem[]
}

interface GradeGroupStatItem {
  groupId: string
  groupName: string
  templateId: string
  templateName: string
  avgValue: number
  bestValue: number
  bestStudentId: string
  bestStudentName: string
}

interface GradeTopProgressItem {
  groupId: string
  groupName: string
  studentId: string
  studentName: string
  templateId: string
  templateName: string
  startValue: number
  endValue: number
  progress: number
}

interface GradeReportData {
  groupStats: GradeGroupStatItem[]
  topProgress: GradeTopProgressItem[]
}

export default function ControlBestPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("group")
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [grades, setGrades] = useState<number[]>([])
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [groupData, setGroupData] = useState<GroupReportData | null>(null)
  const [gradeData, setGradeData] = useState<GradeReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Загрузка списка групп при первом рендере
  useEffect(() => {
    loadGroups()
  }, [])

  // Загрузка данных отчётов при изменении mode, selectedGroupId, selectedGrade
  useEffect(() => {
    if (mode === "group" && selectedGroupId) {
      loadGroupData(selectedGroupId)
    } else if (mode === "grade" && selectedGrade) {
      loadGradeData(selectedGrade)
    }
  }, [mode, selectedGroupId, selectedGrade])

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/trainer/groups')
      if (!response.ok) throw new Error('Ошибка загрузки групп')
      const data = await response.json()
      
      const groupsList: GroupSummary[] = data.groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        class: g.class,
      }))
      
      setGroups(groupsList)
      
      // Извлекаем уникальные классы и сортируем
      const uniqueGrades = [...new Set(groupsList.map(g => g.class).filter((c): c is number => c !== null && c !== undefined))].sort((a, b) => a - b)
      setGrades(uniqueGrades)
      
      // Устанавливаем значения по умолчанию
      if (groupsList.length > 0) {
        setSelectedGroupId(groupsList[0].id)
      }
      if (uniqueGrades.length > 0) {
        setSelectedGrade(uniqueGrades[0])
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки групп')
    }
  }

  const loadGroupData = async (groupId: string) => {
    setLoading(true)
    setError(null)
    setGroupData(null)
    
    try {
      const res = await fetch(`/api/trainer/groups/${groupId}/control-best`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка загрузки данных')
      }
      const data = await res.json()
      setGroupData(data)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных группы')
      setGroupData(null)
    } finally {
      setLoading(false)
    }
  }

  const loadGradeData = async (grade: number) => {
    setLoading(true)
    setError(null)
    setGradeData(null)
    
    try {
      const res = await fetch(`/api/trainer/grades/${grade}/control-best`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка загрузки данных')
      }
      const data = await res.json()
      setGradeData(data)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных параллели')
      setGradeData(null)
    } finally {
      setLoading(false)
    }
  }

  const formatProgress = (progress: number): string => {
    if (progress > 0) {
      return `+${progress.toFixed(2)}`
    }
    return progress.toFixed(2)
  }

  return (
    <div>
      <h1 className="h1 mb-6">Лучшие результаты контрольных замеров</h1>

      {/* Верхняя панель фильтров */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col gap-4">
          {/* Переключатель режима */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("group")}
              className={`
                px-4 py-2 rounded-md font-medium text-sm transition-colors
                ${
                  mode === "group"
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              По группе
            </button>
            <button
              onClick={() => setMode("grade")}
              className={`
                px-4 py-2 rounded-md font-medium text-sm transition-colors
                ${
                  mode === "grade"
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              По параллели
            </button>
          </div>

          {/* Селект группы или класса */}
          {mode === "group" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Группа
              </label>
              <select
                value={selectedGroupId || ''}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Класс
              </label>
              <select
                value={selectedGrade || ''}
                onChange={(e) => setSelectedGrade(parseInt(e.target.value, 10))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Состояние загрузки */}
      {loading && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="text-center text-gray-500">Загрузка данных…</div>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Режим "По группе" */}
      {!loading && !error && mode === "group" && groupData && (
        <div className="space-y-6">
          {/* Лучшие результаты по нормативам */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Лучшие результаты по нормативам</h2>
            {groupData.bestByNorm.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Норматив
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ученик
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Результат
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupData.bestByNorm.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.templateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.studentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.value.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">Нет данных по контрольным замерам для выбранной группы.</p>
            )}
          </div>

          {/* Топ прогресса */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Топ прогресса</h2>
            {groupData.topProgress.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ученик
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Норматив
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Было
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Стало
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Прогресс
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupData.topProgress.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.studentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.templateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.startValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.endValue.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          item.progress > 0 ? 'text-green-600' : item.progress < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {formatProgress(item.progress)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">Нет данных по контрольным замерам для выбранной группы.</p>
            )}
          </div>
        </div>
      )}

      {/* Режим "По параллели" */}
      {!loading && !error && mode === "grade" && gradeData && (
        <div className="space-y-6">
          {/* Сравнение групп по нормативам */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Сравнение групп по нормативам</h2>
            {gradeData.groupStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Группа
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Норматив
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Средний результат
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Лучший результат
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Лучший ученик
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {gradeData.groupStats.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.groupName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.templateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.avgValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.bestValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.bestStudentName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">Нет данных по контрольным замерам для выбранной параллели.</p>
            )}
          </div>

          {/* Топ прогресса по параллели */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Топ прогресса по параллели</h2>
            {gradeData.topProgress.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Группа
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ученик
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Норматив
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Было
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Стало
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Прогресс
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {gradeData.topProgress.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.groupName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.studentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.templateName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.startValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.endValue.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          item.progress > 0 ? 'text-green-600' : item.progress < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {formatProgress(item.progress)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">Нет данных по контрольным замерам для выбранной параллели.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

