'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import JournalTable from './JournalTable'
import { Button } from '@/components/ui'

interface JournalPageProps {
  groupId: string
  userFullName?: string
  userRole?: string
}

interface Group {
  id: string
  name: string
  schoolYear: string
}

export default function JournalPage({ groupId, userFullName, userRole }: JournalPageProps) {
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)

  useEffect(() => {
    loadGroup()
  }, [groupId])

  const loadGroup = async () => {
    try {
      const response = await fetch(`/api/trainer/groups/${groupId}`)
      if (!response.ok) throw new Error('Ошибка загрузки')
      const data = await response.json()
      setGroup(data.group)
    } catch (err) {
      console.error('Ошибка загрузки группы:', err)
    }
  }

  const printJournal = () => {
    window.print()
  }

  return (
    <div>
      {/* Заголовок для печати */}
      {group && (
        <div className="print-only mb-4 text-center">
          <h1 className="h1">
            Журнал группы {group.name}
          </h1>
          <p className="text-lg text-gray-700 mt-1">
            Учебный год: {group.schoolYear}
          </p>
        </div>
      )}

      {/* Заголовок страницы */}
      <div className="mb-6 no-print">
        <h2 className="h2">Журнал</h2>
      </div>

      {/* Кнопки управления */}
      <div className="mb-4 flex gap-3 no-print">
        <Button
          onClick={printJournal}
          variant="primary"
          size="sm"
        >
          Печать отчёта
        </Button>
      </div>

      <JournalTable groupId={groupId} />
    </div>
  )
}

