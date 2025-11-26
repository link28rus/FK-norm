import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить индивидуальные нормативы группы
export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      )
    }

    // Проверяем, что группа принадлежит этому тренеру
    const group = await prisma.group.findFirst({
      where: {
        id: params.groupId,
        trainerId: profile.id,
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    // Получаем только индивидуальные нормативы учащихся этой группы
    const norms = await prisma.norm.findMany({
      where: {
        athlete: {
          groupId: params.groupId,
          isActive: true, // Только активные ученики
        },
        normType: 'INDIVIDUAL', // Только индивидуальные нормативы
      },
      include: {
        athlete: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { athlete: { fullName: 'asc' } },
        { type: 'asc' },
      ],
    })

    // Преобразуем в формат для таблицы
    const result = norms.map((norm) => ({
      id: norm.id,
      athleteId: norm.athlete.id,
      athleteName: norm.athlete.fullName,
      type: norm.type,
      date: norm.date.toISOString().split('T')[0],
      unit: norm.unit,
      value: norm.value,
      status: norm.status,
      comment: norm.comment,
    }))

    return NextResponse.json({ norms: result })
  } catch (error) {
    console.error('Get individual norms error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}




