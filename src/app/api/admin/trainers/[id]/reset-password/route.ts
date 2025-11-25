import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hashPassword, generateRandomPassword } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const trainerId = params.id

    // Проверяем, что тренер существует
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
    })

    if (!trainer || trainer.role !== 'TRAINER') {
      return NextResponse.json(
        { error: 'Тренер не найден' },
        { status: 404 }
      )
    }

    // Генерируем новый пароль
    const newPassword = generateRandomPassword(12)
    const passwordHash = await hashPassword(newPassword)

    // Обновляем пароль
    await prisma.user.update({
      where: { id: trainerId },
      data: { passwordHash },
    })

    return NextResponse.json({
      success: true,
      password: newPassword, // Возвращаем пароль для показа админу
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}




