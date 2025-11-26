'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import Header from '@/components/Header'

interface AdminLayoutProps {
  children: React.ReactNode
  userFullName?: string
}

export default function AdminLayout({
  children,
  userFullName,
}: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const menuItems = [
    {
      href: '/admin',
      label: 'Панель управления',
      active: pathname === '/admin',
    },
    {
      href: '/admin/norm-templates',
      label: 'Шаблоны нормативов',
      active: pathname === '/admin/norm-templates',
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
        userRole="ADMIN"
        showTrainerCabinetLink={true}
      />

      {/* Навигационное меню */}
      <nav className="bg-white shadow-sm border-b border-gray-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="overflow-x-auto">
            <div className="flex space-x-4 sm:space-x-8">
              {menuItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
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
        </div>
      </nav>

      <main>{children}</main>
    </div>
  )
}


