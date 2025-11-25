'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from './Header'
import JournalTable from './JournalTable'

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
    <div className="min-h-screen bg-gray-50">
      <Header title="" userFullName={userFullName} userRole={userRole} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Заголовок для печати */}
        {group && (
          <div className="print-only mb-4 text-center">
            <h1 className="text-2xl font-bold text-heading">
              Журнал группы {group.name}
            </h1>
            <p className="text-lg text-gray-700 mt-1">
              Учебный год: {group.schoolYear}
            </p>
          </div>
        )}

        {/* Заголовок и информация о группе */}
        <div className="mb-4 no-print">
          <h1 className="text-3xl font-bold text-heading">Журнал группы</h1>
          {group && (
            <p className="mt-1 text-sm text-blue-600 font-semibold">
              {group.name} · учебный год {group.schoolYear}
            </p>
          )}
        </div>

        {/* Кнопки управления */}
        <div className="mb-4 flex gap-3 no-print">
          <button
            onClick={() => router.push(`/trainer/groups/${groupId}`)}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Вернуться к группе
          </button>
          <button
            onClick={printJournal}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Печать отчёта
          </button>
        </div>

        <JournalTable groupId={groupId} />
      </main>
    </div>
  )
}

