import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { hashPassword, generateRandomPassword } from '@/lib/auth'

// GET - получить список всех тренеров
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Получаем всех пользователей (не только тренеров, чтобы видеть админов)
    const trainers = await prisma.user.findMany({
      include: {
        trainerProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ trainers })
  } catch (error) {
    console.error('Get trainers error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST - создать нового тренера
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, fullName, phone, password } = body

    if (!email || !fullName) {
      return NextResponse.json(
        { error: 'Email и ФИО обязательны' },
        { status: 400 }
      )
    }

    // Проверяем, не существует ли уже пользователь с таким email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 }
      )
    }

    // Генерируем пароль, если не указан
    const finalPassword = password || generateRandomPassword(12)
    const passwordHash = await hashPassword(finalPassword)

    // Создаём пользователя и профиль
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        role: 'TRAINER',
        trainerProfile: {
          create: {
            fullName,
            phone: phone || null,
          },
        },
      },
      include: {
        trainerProfile: true,
      },
    })

    return NextResponse.json({
      success: true,
      trainer: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.trainerProfile?.fullName,
        phone: newUser.trainerProfile?.phone,
        isBlocked: newUser.isBlocked,
        createdAt: newUser.createdAt,
      },
      password: finalPassword, // Возвращаем пароль для показа админу
    })
  } catch (error) {
    console.error('Create trainer error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

