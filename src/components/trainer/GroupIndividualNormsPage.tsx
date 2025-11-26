'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState, GradeBadge, useToast, Button, InfoCard } from '@/components/ui'

interface GroupIndividualNormsPageProps {
  groupId: string
  userFullName?: string
  userRole?: string
}

interface IndividualNorm {
  id: string
  type: string
  date: string
  unit: string | null
  value: number | null
  status: string
  athleteId: string
  athleteName: string
}

export default function GroupIndividualNormsPage({
  groupId,
  userFullName,
  userRole,
}: GroupIndividualNormsPageProps) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [individualNorms, setIndividualNorms] = useState<IndividualNorm[]>([])
  const [loadingNorms, setLoadingNorms] = useState(false)

  useEffect(() => {
    loadIndividualNorms()
  }, [groupId])

  const loadIndividualNorms = async () => {
    setLoadingNorms(true)
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/norms/individual`)
      if (!response.ok) throw new Error('Ошибка загрузки индивидуальных нормативов')
      const data = await response.json()
      setIndividualNorms(data.norms || [])
    } catch (err) {
      setError('Ошибка загрузки индивидуальных нормативов')
    } finally {
      setLoadingNorms(false)
      setLoading(false)
    }
  }

  const handleDeleteIndividualNorm = async (normId: string) => {
    if (!confirm('Удалить этот индивидуальный норматив?')) return

    try {
      const response = await fetch(`/api/trainer/norms/${normId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Ошибка удаления')
      toast.success('Норматив успешно удалён!')
      loadIndividualNorms()
    } catch (err) {
      setError('Ошибка удаления норматива')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-secondary">Загрузка...</div>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <Alert variant="error" message={error} className="mb-4" />
      )}

      <div className="mb-6">
        <h2 className="h2 mb-4">
          Индивидуальные нормативы
        </h2>
        <p className="text-sm text-secondary mb-4">
          Нормативы, созданные из карточек учеников. Для создания нового норматива откройте карточку ученика.
        </p>
      </div>

      {loadingNorms ? (
        <InfoCard>
          <div className="text-center py-8">
            <div className="text-secondary">Загрузка нормативов...</div>
          </div>
        </InfoCard>
      ) : individualNorms.length === 0 ? (
        <InfoCard>
          <div className="text-center py-8">
            <h3 className="h3 mb-2 text-heading">
              Индивидуальные нормативы для этой группы пока не добавлены
            </h3>
            <p className="text-secondary mb-6">
              Добавьте индивидуальные нормативы через карточки учеников.
            </p>
            <Button
              onClick={() => router.push(`/trainer/groups/${groupId}`)}
              variant="primary"
              className="w-full sm:w-auto"
            >
              Перейти к ученикам
            </Button>
          </div>
        </InfoCard>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ученик</TableHead>
              <TableHead className="hidden md:table-cell">Вид норматива</TableHead>
              <TableHead className="hidden lg:table-cell">Дата зачёта</TableHead>
              <TableHead className="hidden lg:table-cell">Ед. изм.</TableHead>
              <TableHead className="hidden md:table-cell">Значение</TableHead>
              <TableHead>Оценка</TableHead>
              <TableHead align="right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {individualNorms.map((norm) => (
              <TableRow key={norm.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <span>{norm.athleteName}</span>
                    <span className="text-xs text-secondary md:hidden">
                      {norm.type}
                      {norm.value !== null && ` · ${norm.value}${norm.unit ? norm.unit : ''}`}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {norm.type}
                </TableCell>
                <TableCell className="text-secondary hidden lg:table-cell">
                  {new Date(norm.date).toLocaleDateString('ru-RU')}
                </TableCell>
                <TableCell className="text-secondary hidden lg:table-cell">
                  {norm.unit || '—'}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {norm.value !== null ? norm.value : '—'}
                </TableCell>
                <TableCell>
                  <GradeBadge grade={norm.status} />
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-2 flex-wrap">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/trainer/athletes/${norm.athleteId}`)}
                      className="w-full sm:w-auto"
                    >
                      Открыть
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteIndividualNorm(norm.id)}
                      className="w-full sm:w-auto"
                    >
                      Удалить
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

