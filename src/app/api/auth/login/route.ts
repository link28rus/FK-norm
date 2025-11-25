import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, generateToken, setAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      )
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      )
    }

    // Проверяем, не заблокирован ли пользователь
    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Ваш аккаунт заблокирован' },
        { status: 403 }
      )
    }

    // Проверяем срок действия аккаунта
    const now = new Date()
    now.setHours(0, 0, 0, 0) // Сбрасываем время для сравнения только дат
    
    if (user.activeUntil) {
      const activeUntilDate = new Date(user.activeUntil)
      activeUntilDate.setHours(0, 0, 0, 0)
      
      // Если текущая дата больше activeUntil, срок действия истёк
      if (now > activeUntilDate) {
        return NextResponse.json(
          { error: `Срок действия вашего аккаунта истёк (${activeUntilDate.toLocaleDateString('ru-RU')})` },
          { status: 403 }
        )
      }
    }

    // Проверяем пароль
    const isPasswordValid = await comparePassword(password, user.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      )
    }

    // Генерируем токен
    const token = generateToken(user.id, user.role)

    // Создаём ответ
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    })

    // Устанавливаем cookie
    setAuthCookie(response, token)

    return response
  } catch (error: any) {
    console.error('Login error:', error)
    
    // Проверяем, является ли ошибка ошибкой подключения к БД
    if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database')) {
      return NextResponse.json(
        { 
          error: 'База данных не подключена. Пожалуйста, настройте DATABASE_URL в .env файле и выполните миграции.',
          code: 'DATABASE_NOT_CONNECTED'
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

