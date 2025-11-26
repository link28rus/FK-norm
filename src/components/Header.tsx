'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface HeaderProps {
  title?: string
  userFullName?: string
  showTrainerCabinetLink?: boolean
  userRole?: string
  showAdminPanelLink?: boolean
}

export default function Header({ title, userFullName, showTrainerCabinetLink = false, userRole, showAdminPanelLink = false }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  // Автоматически определяем, нужно ли показывать ссылку на кабинет тренера
  const shouldShowTrainerLink = showTrainerCabinetLink || (pathname?.startsWith('/trainer') && pathname !== '/trainer')
  
  // Показываем ссылку на админ-панель для ADMIN на страницах тренера
  const shouldShowAdminLink = showAdminPanelLink || (userRole === 'ADMIN' && pathname?.startsWith('/trainer'))

  // Не показываем заголовок на всех страницах (заголовки отображаются локально на каждой странице)
  const shouldShowTitle = false

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      
      // Очищаем localStorage при выходе
      localStorage.removeItem('auth_isLoggedIn')
      localStorage.removeItem('auth_email')
      
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      // Всё равно очищаем localStorage и перенаправляем
      localStorage.removeItem('auth_isLoggedIn')
      localStorage.removeItem('auth_email')
      router.push('/login')
      setLoading(false)
    }
  }

  const handleTrainerCabinetClick = () => {
    router.push('/trainer')
  }

  const handleAdminPanelClick = () => {
    router.push('/admin')
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-1 min-w-0">
            {shouldShowTitle && (
              <h1 className="h1 truncate">{title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {shouldShowAdminLink && (
              <button
                onClick={handleAdminPanelClick}
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors whitespace-nowrap"
              >
                <span className="hidden sm:inline">Админ-панель</span>
                <span className="sm:hidden">Админ</span>
              </button>
            )}
            {shouldShowTrainerLink && (
              <button
                onClick={handleTrainerCabinetClick}
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors whitespace-nowrap"
              >
                <span className="hidden sm:inline">Кабинет тренера</span>
                <span className="sm:hidden">Кабинет</span>
              </button>
            )}
            {userFullName && (
              <span className="text-xs sm:text-sm font-medium text-gray-700 hidden md:inline truncate max-w-[120px] lg:max-w-none">
                {userFullName}
              </span>
            )}
            <button
              onClick={handleLogout}
              disabled={loading}
              className="px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {loading ? 'Выход...' : 'Выйти'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

