import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

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

    // Получаем текущее состояние
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
    })

    if (!trainer || trainer.role !== 'TRAINER') {
      return NextResponse.json(
        { error: 'Тренер не найден' },
        { status: 404 }
      )
    }

    // Переключаем статус блокировки
    const updatedTrainer = await prisma.user.update({
      where: { id: trainerId },
      data: { isBlocked: !trainer.isBlocked },
    })

    return NextResponse.json({
      success: true,
      isBlocked: updatedTrainer.isBlocked,
    })
  } catch (error) {
    console.error('Toggle block error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}




