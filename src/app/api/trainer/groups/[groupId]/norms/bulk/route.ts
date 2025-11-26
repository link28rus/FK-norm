import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// POST - создать нормативы для нескольких учащихся группы
export async function POST(
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

    const body = await request.json()
    const { type, date, unit, defaultValue, athletes } = body

    if (!type || !date || !athletes || !Array.isArray(athletes)) {
      return NextResponse.json(
        { error: 'Тип норматива, дата и список учащихся обязательны' },
        { status: 400 }
      )
    }

    // Проверяем, что все учащиеся принадлежат этой группе
    const athleteIds = athletes.map((a: any) => a.athleteId).filter(Boolean)
    const validAthletes = await prisma.athlete.findMany({
      where: {
        id: { in: athleteIds },
        groupId: params.groupId,
        isActive: true, // Только активные ученики
      },
    })

    if (validAthletes.length !== athleteIds.length) {
      return NextResponse.json(
        { error: 'Некоторые учащиеся не найдены в этой группе' },
        { status: 400 }
      )
    }

    // Создаём нормативы для включённых учащихся
    const normsToCreate = athletes
      .filter((a: any) => a.included && a.athleteId)
      .map((a: any) => {
        // Валидация оценки: должно быть одно из значений ["-", "2", "3", "4", "5", "Б", "О"]
        const validGrades = ['-', '2', '3', '4', '5', 'Б', 'О']
        const grade = a.grade && validGrades.includes(a.grade) ? a.grade : '-'
        
        return {
          athleteId: a.athleteId,
          type,
          normType: 'GROUP', // Групповые нормативы
          value: a.value ? parseFloat(a.value) : (defaultValue ? parseFloat(defaultValue) : null),
          unit: unit || null,
          status: grade, // Сохраняем оценку в поле status
          date: new Date(date),
          comment: null,
        }
      })

    if (normsToCreate.length === 0) {
      return NextResponse.json(
        { error: 'Не выбрано ни одного учащегося' },
        { status: 400 }
      )
    }

    // Создаём нормативы
    const createdNorms = await prisma.$transaction(
      normsToCreate.map((data) => prisma.norm.create({ data }))
    )

    return NextResponse.json({
      success: true,
      count: createdNorms.length,
      norms: createdNorms,
    })
  } catch (error) {
    console.error('Bulk create norms error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

