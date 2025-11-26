'use client'

import { useState, useEffect } from 'react'
import { Button, Alert, InfoCard, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '@/components/ui'
import { ProgressChart } from './ProgressChart'

interface GroupProgressReportProps {
  groupId: string
  defaultYear?: string
}

interface GroupProgressReportData {
  group: {
    id: string
    name: string
    academicYear: string
  }
  norms: Array<{
    normId: string
    templateId: string
    name: string
    unit: string | null
    direction: string
    results: Array<{
      athleteId: string
      fullName: string
      startValue: number | null
      endValue: number | null
      delta: number | null
    }>
    summary: {
      improvedCount: number
      worsenedCount: number
      sameCount: number
      noDataCount: number
    }
  }>
}

export default function GroupProgressReport({ groupId, defaultYear }: GroupProgressReportProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState<GroupProgressReportData | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear || '')
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(false)

  useEffect(() => {
    // Загружаем информацию о группе для получения текущего учебного года при первой загрузке
    if (!selectedYear && !defaultYear) {
      loadGroupInfo()
    } else if (defaultYear && !selectedYear) {
      setSelectedYear(defaultYear)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  useEffect(() => {
    if (selectedYear) {
      loadReport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, selectedYear])

  const loadGroupInfo = async () => {
    setLoadingGroupInfo(true)
    try {
      const groupResponse = await fetch(`/api/trainer/groups/${groupId}`)
      if (groupResponse.ok) {
        const groupData = await groupResponse.json()
        if (groupData.group?.schoolYear) {
          setSelectedYear(groupData.group.schoolYear)
        } else {
          setError('Не удалось определить учебный год группы')
          setLoading(false)
        }
      } else {
        setError('Ошибка загрузки информации о группе')
        setLoading(false)
      }
    } catch (err) {
      console.error('Ошибка загрузки группы:', err)
      setError('Ошибка загрузки информации о группе')
      setLoading(false)
    } finally {
      setLoadingGroupInfo(false)
    }
  }

  const loadReport = async () => {
    if (!selectedYear) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/reports/norms-progress?year=${encodeURIComponent(selectedYear)}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка загрузки отчёта' }))
        throw new Error(errorData.error || 'Ошибка загрузки отчёта')
      }
      const data = await response.json()
      setReport(data.report)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки отчёта')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const formatDelta = (delta: number | null, direction: string, unit: string | null) => {
    if (delta === null) return '-'
    const sign = delta > 0 ? '+' : ''
    const value = `${sign}${delta.toFixed(2)}`
    const colorClass = delta > 0 
      ? (direction === 'LOWER_IS_BETTER' ? 'text-red-600' : 'text-green-600')
      : delta < 0
      ? (direction === 'LOWER_IS_BETTER' ? 'text-green-600' : 'text-red-600')
      : 'text-gray-600'
    return <span className={colorClass}>{value} {unit || ''}</span>
  }

  const formatValue = (value: number | null, unit: string | null) => {
    if (value === null) return '-'
    return `${value.toFixed(2)} ${unit || ''}`.trim()
  }

  // Генерируем опции учебных годов (последние 5 лет)
  const getYearOptions = (): string[] => {
    const currentYear = new Date().getFullYear()
    const years: string[] = []
    for (let i = 0; i < 5; i++) {
      const year = currentYear - i
      years.push(`${year}/${year + 1}`)
    }
    return years
  }

  if (loading || loadingGroupInfo) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-secondary">Загрузка...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Заголовок для печати */}
      {report && (
        <div className="print-only mb-4 text-center">
          <h1 className="h1">
            Отчёт о прогрессе группы {report.group.name}
          </h1>
          <p className="text-lg text-gray-700 mt-1">
            Учебный год: {report.group.academicYear}
          </p>
        </div>
      )}

      {/* Заголовок страницы и контролы */}
      <div className="mb-6 no-print">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h2 className="h2">Прогресс по нормативам</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Выберите учебный год</option>
              {getYearOptions().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <Button
              onClick={handlePrint}
              variant="primary"
              size="sm"
            >
              Печать отчёта
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {!selectedYear && (
        <InfoCard>
          <p className="text-center text-secondary">
            Выберите учебный год для просмотра отчёта о прогрессе
          </p>
        </InfoCard>
      )}

      {report && report.norms.length === 0 && (
        <InfoCard>
          <p className="text-center text-secondary">
            Нет данных о нормативах начала и конца года для выбранного учебного года
          </p>
        </InfoCard>
      )}

      {report && report.norms.length > 0 && (
        <div className="space-y-8">
          {report.norms.map((norm) => (
            <InfoCard key={norm.normId} className="print:break-inside-avoid">
              <h3 className="h3 mb-4">
                {norm.name} {norm.unit && `(${norm.unit})`}
              </h3>

              {/* График прогресса */}
              <div className="mb-6 print:hidden" style={{ minHeight: '300px' }}>
                <ProgressChart
                  summary={norm.summary}
                  normName={norm.name}
                />
              </div>

              {/* Таблица результатов */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ученик</TableHead>
                      <TableHead className="text-right">Начало года</TableHead>
                      <TableHead className="text-right">Конец года</TableHead>
                      <TableHead className="text-right">Изменение</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {norm.results.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-secondary">
                          Нет данных
                        </TableCell>
                      </TableRow>
                    ) : (
                      norm.results.map((result) => (
                        <TableRow key={result.athleteId}>
                          <TableCell className="font-medium">
                            {result.fullName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatValue(result.startValue, norm.unit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatValue(result.endValue, norm.unit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatDelta(result.delta, norm.direction, norm.unit)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Сводка */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-secondary">Улучшили</div>
                    <div className="text-lg font-semibold text-green-600">
                      {norm.summary.improvedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-secondary">Ухудшили</div>
                    <div className="text-lg font-semibold text-red-600">
                      {norm.summary.worsenedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-secondary">Без изменений</div>
                    <div className="text-lg font-semibold text-gray-600">
                      {norm.summary.sameCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-secondary">Нет данных</div>
                    <div className="text-lg font-semibold text-gray-400">
                      {norm.summary.noDataCount}
                    </div>
                  </div>
                </div>
              </div>
            </InfoCard>
          ))}
        </div>
      )}
    </div>
  )
}

