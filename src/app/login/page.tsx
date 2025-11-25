'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  // Проверяем localStorage при загрузке страницы
  useEffect(() => {
    let mounted = true

    // Проверяем реальную аутентификацию через API, а не только localStorage
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { 
          method: 'GET',
          credentials: 'include' // Важно: отправляем cookies
        })
        
        if (response.ok && mounted) {
          const data = await response.json()
          if (data.user) {
            // Пользователь действительно залогинен, перенаправляем
            if (data.user.role === 'ADMIN') {
              router.replace('/admin')
            } else if (data.user.role === 'TRAINER') {
              router.replace('/trainer')
            } else {
              router.replace('/')
            }
            return
          }
        } else if (response.status === 401) {
          // 401 - это нормально, пользователь не залогинен
          // Просто продолжаем показывать форму логина
        }
      } catch (err) {
        // Игнорируем ошибки проверки (сетевые ошибки и т.д.)
        console.debug('Auth check error (ignored):', err)
      }

      if (mounted) {
        // Если не залогинен, загружаем сохранённый email из localStorage
        const savedEmail = localStorage.getItem('auth_email')
        if (savedEmail) {
          setEmail(savedEmail)
        }
        setCheckingAuth(false)
      }
    }

    checkAuth()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || 'Ошибка входа'
        setError(errorMessage)
        
        // Если это ошибка подключения к БД, показываем дополнительную информацию
        if (data.code === 'DATABASE_NOT_CONNECTED') {
          setError(
            errorMessage + 
            '\n\nДля настройки базы данных:\n' +
            '1. Настройте DATABASE_URL в .env файле\n' +
            '2. Выполните: npm run prisma:migrate\n' +
            '3. Создайте администратора: npm run create-admin'
          )
        }
        
        setLoading(false)
        return
      }

      // Сохраняем в localStorage, если включён чекбокс "Оставаться в системе"
      if (rememberMe) {
        localStorage.setItem('auth_isLoggedIn', 'true')
        localStorage.setItem('auth_email', email)
      } else {
        // Очищаем, если чекбокс не включён
        localStorage.removeItem('auth_isLoggedIn')
        localStorage.removeItem('auth_email')
      }

      // Перенаправляем в зависимости от роли
      if (data.user.role === 'ADMIN') {
        router.push('/admin')
      } else if (data.user.role === 'TRAINER') {
        router.push('/trainer')
      } else {
        router.push('/')
      }
    } catch (err) {
      setError('Ошибка соединения с сервером')
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="text-gray-500">Проверка аутентификации...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Вход в систему
          </h2>
          <p className="mt-2 text-center text-sm text-gray-700 font-medium">
            Учёт нормативов по физической культуре
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 bg-white rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm font-medium"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="appearance-none rounded-none block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 bg-white rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowPassword(!showPassword)
                }}
                className="absolute right-0 flex items-center justify-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none z-[30] pointer-events-auto"
                style={{ 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  width: '2.5rem',
                  height: '100%'
                }}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                {showPassword ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Чекбокс "Оставаться в системе" */}
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 block text-sm text-gray-700"
              >
                Оставаться в системе
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800 whitespace-pre-line">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

