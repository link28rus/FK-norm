import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить список учащихся тренера
export async function GET(request: NextRequest) {
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

    // Получаем всех учащихся через группы тренера
    const groups = await prisma.group.findMany({
      where: { trainerId: profile.id },
      select: { id: true },
    })
    
    const groupIds = groups.map((g) => g.id)
    
    // Если у тренера нет групп, возвращаем пустой массив
    if (groupIds.length === 0) {
      return NextResponse.json({ athletes: [] })
    }
    
    const athletes = await prisma.athlete.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    })

    // Преобразуем данные для обратной совместимости
    const formattedAthletes = athletes.map((athlete) => ({
      id: athlete.id,
      fullName: athlete.fullName,
      birthDate: athlete.birthDate?.toISOString(),
      gender: athlete.gender,
      groupName: athlete.group?.name || null,
      notes: athlete.notes,
      createdAt: athlete.createdAt.toISOString(),
    }))

    return NextResponse.json({ athletes: formattedAthletes })
  } catch (error) {
    console.error('Get athletes error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST - создать нового учащегося
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { fullName, birthDate, gender, groupId, notes } = body

    if (!fullName || !groupId) {
      return NextResponse.json(
        { error: 'ФИО и группа обязательны' },
        { status: 400 }
      )
    }

    // Проверяем, что группа принадлежит этому тренеру
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        trainerId: profile.id,
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    const athlete = await prisma.athlete.create({
      data: {
        groupId,
        fullName,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        notes: notes || null,
      },
    })

    return NextResponse.json({ success: true, athlete })
  } catch (error) {
    console.error('Create athlete error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

