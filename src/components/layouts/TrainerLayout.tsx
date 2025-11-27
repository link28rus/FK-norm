'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import Header from '@/components/Header'

interface TrainerLayoutProps {
  children: React.ReactNode
  userRole?: string
  userFullName?: string
}

export default function TrainerLayout({
  children,
  userRole,
  userFullName,
}: TrainerLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const menuItems = [
    {
      href: '/trainer',
      label: 'Профиль',
      active: pathname === '/trainer',
    },
    {
      href: '/trainer/groups',
      label: 'Группы',
      active: pathname?.startsWith('/trainer/groups'),
    },
    {
      href: '/trainer/norm-templates',
      label: 'Шаблоны нормативов',
      active: pathname?.startsWith('/trainer/norm-templates'),
    },
    {
      href: '/trainer/control-best',
      label: 'Лучшие результаты контрольных замеров',
      active: pathname?.startsWith('/trainer/control-best'),
    },
  ]

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      localStorage.removeItem('auth_isLoggedIn')
      localStorage.removeItem('auth_email')
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      localStorage.removeItem('auth_isLoggedIn')
      localStorage.removeItem('auth_email')
      router.push('/login')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        userFullName={userFullName}
        userRole={userRole}
        showAdminPanelLink={userRole === 'ADMIN'}
      />

      {/* Навигационное меню */}
      <nav className="bg-white shadow-sm border-b border-gray-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {menuItems.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                  ${
                    item.active
                      ? 'border-indigo-500 text-indigo-600 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

