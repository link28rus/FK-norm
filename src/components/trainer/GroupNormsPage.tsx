'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BulkNormModal from '../BulkNormModal'
import EditGroupNormModal from '../EditGroupNormModal'
import CreateNormFromTemplateModal from '../CreateNormFromTemplateModal'
import EditGroupNormFromTemplateModal from '../EditGroupNormFromTemplateModal'
import { Button, Alert, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState, Badge, InfoCard, useToast } from '@/components/ui'

interface GroupNormsPageProps {
  groupId: string
  userFullName?: string
  userRole?: string
}

interface Group {
  id: string
  name: string
  class?: number | null
}

interface Athlete {
  id: string
  fullName: string
}

interface GroupNorm {
  type: string
  date: string
  unit: string | null
  count: number
  eligibleAthletesCount?: number // Количество учеников, которые могут сдавать этот норматив (с учетом applicableGender)
  applicableGender?: 'ALL' | 'MALE' | 'FEMALE' // Для кого норматив по полу
  isFromTemplate?: boolean
  groupNormId?: string
  templateId?: string
  norms?: any[]
  period?: 'START_OF_YEAR' | 'END_OF_YEAR' | 'REGULAR' // Период норматива
}

export default function GroupNormsPage({
  groupId,
  userFullName,
  userRole,
}: GroupNormsPageProps) {
  const router = useRouter()
  const toast = useToast()
  const [group, setGroup] = useState<Group | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [groupNorms, setGroupNorms] = useState<GroupNorm[]>([])
  const [loadingNorms, setLoadingNorms] = useState(false)
  const [showBulkNormModal, setShowBulkNormModal] = useState(false)
  const [showCreateFromTemplateModal, setShowCreateFromTemplateModal] = useState(false)
  const [editingNorm, setEditingNorm] = useState<{
    type: string
    date: string
    unit: string | null
    norms: any[]
    isFromTemplate?: boolean
    groupNormId?: string
  } | null>(null)

  useEffect(() => {
    loadGroup()
    loadAthletes()
    loadGroupNorms()
  }, [groupId])

  const loadGroup = async () => {
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setGroup(data.group)
    } catch (err) {
      setError('Ошибка загрузки группы')
    } finally {
      setLoading(false)
    }
  }

  const loadAthletes = async () => {
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}/athletes`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setAthletes(data.athletes)
    } catch (err) {
      console.error('Ошибка загрузки учащихся:', err)
    }
  }

  const loadGroupNorms = async () => {
    setLoadingNorms(true)
    try {
      // Загружаем обычные нормативы
      const normsResponse = await fetch(`/api/trainer/groups/${groupId}/norms`)
      if (!normsResponse.ok) throw new Error('Ошибка загрузки нормативов')
      const normsData = await normsResponse.json()

      // Загружаем нормативы из шаблонов
      const groupNormsResponse = await fetch(`/api/trainer/groups/${groupId}/group-norms`)
      if (!groupNormsResponse.ok) throw new Error('Ошибка загрузки нормативов из шаблонов')
      const groupNormsData = await groupNormsResponse.json()

      // Объединяем нормативы
      const allNorms = [
        ...(normsData.norms || []).map((n: any) => ({ 
          ...n, 
          isFromTemplate: false,
          applicableGender: 'ALL' as const, // Обычные нормативы по умолчанию для всех
        })),
        ...(groupNormsData.groupNorms || []).map((gn: any) => ({
          type: gn.template.name,
          date: gn.testDate,
          unit: gn.unitOverride || gn.template.unit,
          count: gn._count?.norms || 0,
          eligibleAthletesCount: gn.eligibleAthletesCount ?? 0, // Количество учеников, которые могут сдавать норматив
          applicableGender: (gn.applicableGender || gn.template?.applicableGender || 'ALL') as 'ALL' | 'MALE' | 'FEMALE', // Для кого норматив по полу
          isFromTemplate: true,
          groupNormId: gn.id,
          templateId: gn.templateId,
          period: gn.period || 'REGULAR', // Период норматива
        })),
      ]

      // Сортируем по дате (новые сверху)
      allNorms.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA
      })

      setGroupNorms(allNorms)
    } catch (err) {
      setError('Ошибка загрузки нормативов')
    } finally {
      setLoadingNorms(false)
    }
  }

  const handleDeleteGroupNorm = async (
    type: string,
    date: string,
    isFromTemplate?: boolean,
    groupNormId?: string
  ) => {
    if (!confirm('Удалить этот норматив для всех учащихся группы?')) return

    setError('')

    // Если это норматив из шаблона, удаляем через GroupNorm API
    if (isFromTemplate && groupNormId) {
      try {
        const response = await fetch(`/api/trainer/groups/${groupId}/group-norms/${groupNormId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Ошибка удаления норматива')
          return
        }

        await loadGroupNorms()
        toast.success(`Норматив успешно удалён (удалено записей: ${data.deletedCount || 0})`)
        return
      } catch (err) {
        setError('Ошибка удаления норматива')
        console.error('Delete norm error:', err)
        return
      }
    }

    // Для обычных нормативов используем старый API
    const url = `/api/trainer/groups/${groupId}/norms/delete?type=${encodeURIComponent(type)}&date=${encodeURIComponent(date)}`
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка удаления')
        return
      }

      if (data.success && data.deletedCount > 0) {
        await loadGroupNorms()
        toast.success(`Норматив успешно удалён (удалено записей: ${data.deletedCount})`)
      } else {
        setError('Норматив не был удалён')
      }
    } catch (err) {
      setError('Ошибка удаления норматива')
      console.error('Delete norm error:', err)
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
    <div className="space-y-6">
      {error && (
        <Alert variant="error" message={error} />
      )}

      {/* Заголовок и кнопки действий */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="h2">Нормативы группы</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setShowCreateFromTemplateModal(true)}
            variant="primary"
            size="sm"
            className="w-full sm:w-auto"
          >
            Добавить по шаблону
          </Button>
          <Button
            onClick={() => setShowBulkNormModal(true)}
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
          >
            Добавить вручную
          </Button>
        </div>
      </div>

      {/* Информационный блок */}
      {groupNorms.length > 0 && (
        <InfoCard>
          <p className="text-secondary mb-2">
            Используйте кнопку выше, чтобы добавить норматив для всех учащихся группы одновременно.
          </p>
          <p className="text-secondary text-sm">
            Для просмотра и редактирования нормативов отдельных учеников откройте карточку ученика из вкладки "Ученики".
          </p>
        </InfoCard>
      )}

      {/* Таблица нормативов */}
      {loadingNorms ? (
        <InfoCard>
          <div className="text-center py-8">
            <div className="text-secondary">Загрузка нормативов...</div>
          </div>
        </InfoCard>
      ) : groupNorms.length === 0 ? (
        <InfoCard>
          <div className="text-center py-8">
            <h3 className="h3 mb-2 text-heading">
              Нормативы для этой группы ещё не добавлены
            </h3>
            <p className="text-secondary mb-6">
              Добавьте норматив для всех учащихся группы одновременно, используя шаблон или создав его вручную.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button
                onClick={() => setShowCreateFromTemplateModal(true)}
                variant="primary"
              >
                Добавить по шаблону
              </Button>
              <Button
                onClick={() => setShowBulkNormModal(true)}
                variant="secondary"
              >
                Добавить вручную
              </Button>
            </div>
          </div>
        </InfoCard>
      ) : (() => {
        // Разделяем нормативы по applicableGender
        const commonNorms = groupNorms.filter(n => (n.applicableGender ?? 'ALL') === 'ALL')
        const maleOnlyNorms = groupNorms.filter(n => n.applicableGender === 'MALE')
        const femaleOnlyNorms = groupNorms.filter(n => n.applicableGender === 'FEMALE')

        // Функция для отрисовки таблицы нормативов
        const renderNormsTable = (norms: GroupNorm[]) => {
          if (norms.length === 0) return null

          return (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Вид норматива</TableHead>
                  <TableHead className="hidden md:table-cell">Дата зачёта</TableHead>
                  <TableHead className="hidden lg:table-cell">Единица измерения</TableHead>
                  <TableHead className="hidden md:table-cell">Количество учащихся</TableHead>
                  <TableHead align="right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {norms.map((normGroup, index) => {
                  // Проверяем, есть ли ученики, которые могут сдавать этот норматив
                  const eligibleCount = normGroup.isFromTemplate 
                    ? (normGroup.eligibleAthletesCount ?? 0)
                    : normGroup.count
                  const hasEligibleStudents = eligibleCount > 0

                  return (
                    <TableRow key={`${normGroup.type}-${normGroup.date}-${index}`}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span>{normGroup.type}</span>
                            {normGroup.applicableGender && normGroup.applicableGender !== 'ALL' && (
                              <Badge 
                                variant={normGroup.applicableGender === 'MALE' ? 'info' : 'outline'} 
                                size="sm"
                              >
                                {normGroup.applicableGender === 'MALE' ? 'Мальчики' : 'Девочки'}
                              </Badge>
                            )}
                            {normGroup.applicableGender === 'ALL' && (
                              <Badge variant="default" size="sm">
                                Общий
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 items-center">
                            {normGroup.isFromTemplate && (
                              <Badge variant="success" size="sm" className="w-fit">
                                Из шаблона
                              </Badge>
                            )}
                            {normGroup.period && normGroup.period !== 'REGULAR' && (
                              <Badge 
                                variant={normGroup.period === 'START_OF_YEAR' ? 'info' : 'warning'} 
                                size="sm" 
                                className="w-fit"
                              >
                                {normGroup.period === 'START_OF_YEAR' ? 'Начало года' : 'Конец года'}
                              </Badge>
                            )}
                          </div>
                          {!hasEligibleStudents && normGroup.isFromTemplate && (
                            <p className="text-xs text-yellow-600 mt-1">
                              ⚠ Нет учеников, которые могут сдавать этот норматив (ограничение по полу).
                            </p>
                          )}
                          <span className="text-xs text-secondary md:hidden">
                            {new Date(normGroup.date).toLocaleDateString('ru-RU')}
                            {normGroup.unit && ` · ${normGroup.unit}`}
                            {` · ${normGroup.count} уч.`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-secondary hidden md:table-cell">
                        {new Date(normGroup.date).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-secondary hidden lg:table-cell">
                        {normGroup.unit || '—'}
                      </TableCell>
                      <TableCell className="text-secondary hidden md:table-cell">
                        <div className="flex flex-col">
                          <span>{normGroup.count}</span>
                          {!hasEligibleStudents && normGroup.isFromTemplate && (
                            <span className="text-xs text-yellow-600">
                              (нет подходящих учеников)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            onClick={() => {
                              if (normGroup.isFromTemplate && normGroup.groupNormId) {
                                setEditingNorm({
                                  type: normGroup.type,
                                  date: normGroup.date,
                                  unit: normGroup.unit,
                                  norms: [],
                                  isFromTemplate: true,
                                  groupNormId: normGroup.groupNormId,
                                })
                              } else {
                                setEditingNorm({
                                  type: normGroup.type,
                                  date: normGroup.date,
                                  unit: normGroup.unit,
                                  norms: normGroup.norms || [],
                                  isFromTemplate: false,
                                })
                              }
                            }}
                            variant="secondary"
                            size="sm"
                            className="w-full sm:w-auto"
                            disabled={!hasEligibleStudents && normGroup.isFromTemplate}
                          >
                            Открыть
                          </Button>
                          <Button
                            onClick={() =>
                              handleDeleteGroupNorm(
                                normGroup.type,
                                normGroup.date,
                                normGroup.isFromTemplate,
                                normGroup.groupNormId
                              )
                            }
                            variant="danger"
                            size="sm"
                            className="w-full sm:w-auto"
                          >
                            Удалить
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )
        }

        return (
          <div className="space-y-6">
            {/* Общие нормативы */}
            {commonNorms.length > 0 && (
              <div>
                <h3 className="h3 mb-3 font-semibold">Общие нормативы</h3>
                <InfoCard>
                  {renderNormsTable(commonNorms)}
                </InfoCard>
              </div>
            )}

            {/* Нормативы для мальчиков */}
            {maleOnlyNorms.length > 0 && (
              <div>
                <h3 className="h3 mb-3 font-semibold">Нормативы для мальчиков</h3>
                <InfoCard>
                  {renderNormsTable(maleOnlyNorms)}
                </InfoCard>
              </div>
            )}

            {/* Нормативы для девочек */}
            {femaleOnlyNorms.length > 0 && (
              <div>
                <h3 className="h3 mb-3 font-semibold">Нормативы для девочек</h3>
                <InfoCard>
                  {renderNormsTable(femaleOnlyNorms)}
                </InfoCard>
              </div>
            )}
          </div>
        )
      })()}

      <CreateNormFromTemplateModal
        groupId={groupId}
        groupClass={group?.class || null}
        groupName={group?.name || null}
        isOpen={showCreateFromTemplateModal}
        onClose={() => {
          setShowCreateFromTemplateModal(false)
        }}
        onSuccess={() => {
          toast.success('Норматив успешно создан из шаблона!')
          loadGroupNorms()
        }}
      />

      <BulkNormModal
        groupId={groupId}
        athletes={athletes}
        isOpen={showBulkNormModal}
        onClose={() => {
          setShowBulkNormModal(false)
        }}
        onSuccess={() => {
          toast.success('Нормативы успешно созданы для выбранных учащихся!')
          loadGroupNorms()
        }}
      />

      {editingNorm && editingNorm.isFromTemplate && editingNorm.groupNormId && (
        <EditGroupNormFromTemplateModal
          groupId={groupId}
          groupNormId={editingNorm.groupNormId}
          isOpen={!!editingNorm}
          onClose={() => setEditingNorm(null)}
          onSuccess={() => {
            loadGroupNorms()
            toast.success('Нормативы успешно обновлены!')
          }}
        />
      )}

      {editingNorm && !editingNorm.isFromTemplate && (
        <EditGroupNormModal
          groupId={groupId}
          type={editingNorm.type}
          date={editingNorm.date}
          unit={editingNorm.unit}
          norms={editingNorm.norms.map((n: any) => ({
            normId: n.id,
            athleteId: n.athleteId,
            athleteName: n.athleteName,
            value: n.value,
            status: n.status,
          }))}
          isOpen={!!editingNorm}
          onClose={() => setEditingNorm(null)}
          onSuccess={() => {
            loadGroupNorms()
            toast.success('Нормативы успешно обновлены!')
          }}
        />
      )}
    </div>
  )
}

