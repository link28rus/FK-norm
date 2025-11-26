'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Alert, InfoCard, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { AthleteProgressChart } from './AthleteProgressChart'

interface AthleteProgressReportProps {
  athleteId: string
  defaultYear?: string
}

interface AthleteProgressReportData {
  athlete: {
    id: string
    fullName: string
    groupName: string
    academicYear: string
  }
  norms: Array<{
    normId: string
    templateId: string
    name: string
    unit: string | null
    direction: string
    startValue: number | null
    endValue: number | null
    delta: number | null
    startDate: string | null
    endDate: string | null
    intermediateResults?: Array<{
      value: number | null
      date: string
      status: string
    }>
  }>
}

export default function AthleteProgressReport({ athleteId, defaultYear }: AthleteProgressReportProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState<AthleteProgressReportData | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear || '')
  const [loadingAthleteInfo, setLoadingAthleteInfo] = useState(false)

  useEffect(() => {
    // Загружаем информацию об ученике для получения текущего учебного года при первой загрузке
    if (!selectedYear && !defaultYear) {
      loadAthleteInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId])

  useEffect(() => {
    if (selectedYear) {
      loadReport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, selectedYear])

  const loadAthleteInfo = async () => {
    setLoadingAthleteInfo(true)
    try {
      const athleteResponse = await fetch(`/api/trainer/athletes/${athleteId}`)
      if (athleteResponse.ok) {
        const athleteData = await athleteResponse.json()
        if (athleteData.athlete?.group?.schoolYear || athleteData.athlete?.schoolYear) {
          setSelectedYear(athleteData.athlete.group?.schoolYear || athleteData.athlete.schoolYear)
        } else {
          setError('Не удалось определить учебный год ученика')
          setLoading(false)
        }
      } else {
        setError('Ошибка загрузки информации об ученике')
        setLoading(false)
      }
    } catch (err) {
      console.error('Ошибка загрузки ученика:', err)
      setError('Ошибка загрузки информации об ученике')
      setLoading(false)
    } finally {
      setLoadingAthleteInfo(false)
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
      const response = await fetch(`/api/trainer/athletes/${athleteId}/reports/norms-progress?year=${encodeURIComponent(selectedYear)}`)
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

  const handleBack = () => {
    router.push(`/trainer/athletes/${athleteId}`)
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

  if (loading || loadingAthleteInfo) {
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
            Отчёт о прогрессе {report.athlete.fullName}
          </h1>
          <p className="text-lg text-gray-700 mt-1">
            Группа: {report.athlete.groupName} · Учебный год: {report.athlete.academicYear}
          </p>
        </div>
      )}

      {/* Заголовок страницы и контролы */}
      <div className="mb-6 no-print">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div>
              <h2 className="h2">Прогресс по нормативам</h2>
              {report && (
                <p className="mt-1 text-sm text-secondary">
                  {report.athlete.fullName} · {report.athlete.groupName}
                </p>
              )}
            </div>
            <Button
              onClick={handleBack}
              variant="secondary"
              size="sm"
            >
              ← Назад к ученику
            </Button>
          </div>
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
                <AthleteProgressChart
                  normName={norm.name}
                  unit={norm.unit}
                  startValue={norm.startValue}
                  endValue={norm.endValue}
                  startDate={norm.startDate}
                  endDate={norm.endDate}
                  direction={norm.direction}
                />
              </div>

              {/* Таблица результатов */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Параметр</TableHead>
                      <TableHead className="text-right">Значение</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Начало года</TableCell>
                      <TableCell className="text-right">
                        {norm.startValue !== null ? (
                          <>
                            {formatValue(norm.startValue, norm.unit)}
                            {norm.startDate && (
                              <span className="text-xs text-secondary block">
                                Дата: {new Date(norm.startDate).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                          </>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Конец года</TableCell>
                      <TableCell className="text-right">
                        {norm.endValue !== null ? (
                          <>
                            {formatValue(norm.endValue, norm.unit)}
                            {norm.endDate && (
                              <span className="text-xs text-secondary block">
                                Дата: {new Date(norm.endDate).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                          </>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Изменение</TableCell>
                      <TableCell className="text-right">
                        {formatDelta(norm.delta, norm.direction, norm.unit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Промежуточные результаты, если есть */}
              {norm.intermediateResults && norm.intermediateResults.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold mb-3">Промежуточные измерения</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead className="text-right">Значение</TableHead>
                          <TableHead className="text-right">Оценка</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {norm.intermediateResults.map((result, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {new Date(result.date).toLocaleDateString('ru-RU')}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatValue(result.value, norm.unit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {result.status}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </InfoCard>
          ))}
        </div>
      )}
    </div>
  )
}

