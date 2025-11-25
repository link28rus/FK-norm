'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, InputPassword, Alert } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

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
          <div className="space-y-4">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <InputPassword
              id="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
            <Alert variant="danger" className="whitespace-pre-line">
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={loading}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </div>
    </div>
  )
}

