import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// POST - создать новый норматив
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
    const { athleteId, type, value, unit, status, date, comment } = body

    if (!athleteId || !type || !status) {
      return NextResponse.json(
        { error: 'ID учащегося, тип и статус обязательны' },
        { status: 400 }
      )
    }

    // Проверяем, что учащийся принадлежит этому тренеру через группу
    const athlete = await prisma.athlete.findFirst({
      where: {
        id: athleteId,
        group: {
          trainerId: profile.id,
        },
      },
    })

    if (!athlete) {
      return NextResponse.json(
        { error: 'Учащийся не найден' },
        { status: 404 }
      )
    }

    const norm = await prisma.norm.create({
      data: {
        athleteId,
        type,
        normType: 'INDIVIDUAL', // Нормативы из карточки ученика - индивидуальные
        value: value ? parseFloat(value) : null,
        unit: unit || null,
        status,
        date: date ? new Date(date) : new Date(),
        comment: comment || null,
      },
    })

    return NextResponse.json({ success: true, norm })
  } catch (error) {
    console.error('Create norm error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

