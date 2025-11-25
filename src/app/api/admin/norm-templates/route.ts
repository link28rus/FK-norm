import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить список шаблонов нормативов
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const templates = await prisma.normTemplate.findMany({
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
      include: {
        ownerTrainer: {
          select: {
            id: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            boundaries: true,
            groupNorms: true,
          },
        },
      },
    })

    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error('Get norm templates error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST - создать новый шаблон норматива
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
    const { name, description, unit, classFrom, classTo, direction, boundaries, ownerTrainerId, isPublic } = body

    if (!name || !unit || classFrom === undefined || classTo === undefined || !direction) {
      return NextResponse.json(
        { error: 'Обязательные поля: name, unit, classFrom, classTo, direction' },
        { status: 400 }
      )
    }

    // Валидация: если шаблон общий, ownerTrainerId должен быть null
    if (isPublic === true && ownerTrainerId !== null && ownerTrainerId !== undefined) {
      return NextResponse.json(
        { error: 'Общий шаблон не может иметь владельца (ownerTrainerId должен быть null)' },
        { status: 400 }
      )
    }

    // Определяем ownerTrainerId и isPublic
    let finalOwnerTrainerId: string | null = null
    let finalIsPublic: boolean = false

    if (isPublic === true) {
      // Общий шаблон
      finalOwnerTrainerId = null
      finalIsPublic = true
    } else if (ownerTrainerId) {
      // Личный шаблон для указанного тренера
      finalOwnerTrainerId = ownerTrainerId
      finalIsPublic = false
    } else {
      // По умолчанию создаем общий шаблон (для обратной совместимости)
      finalOwnerTrainerId = null
      finalIsPublic = true
    }

    // Валидация direction
    if (direction !== 'LOWER_IS_BETTER' && direction !== 'HIGHER_IS_BETTER') {
      return NextResponse.json(
        { error: 'direction должен быть LOWER_IS_BETTER или HIGHER_IS_BETTER' },
        { status: 400 }
      )
    }

    // Валидация классов
    if (classFrom < 1 || classTo < 1 || classFrom > classTo) {
      return NextResponse.json(
        { error: 'Неверный диапазон классов' },
        { status: 400 }
      )
    }

    // Создаем шаблон с границами в транзакции
    const template = await prisma.$transaction(async (tx) => {
      const newTemplate = await tx.normTemplate.create({
        data: {
          name,
          description: description || null,
          unit,
          classFrom,
          classTo,
          direction,
          ownerTrainerId: finalOwnerTrainerId,
          isPublic: finalIsPublic,
          isActive: true,
        },
      })

      // Создаем границы, если они переданы
      if (boundaries && Array.isArray(boundaries) && boundaries.length > 0) {
        await tx.normTemplateBoundary.createMany({
          data: boundaries.map((b: any) => ({
            templateId: newTemplate.id,
            grade: b.grade,
            gender: b.gender,
            class: b.class,
            fromValue: b.fromValue,
            toValue: b.toValue,
          })),
        })
      }

      return newTemplate
    })

    return NextResponse.json({ success: true, template })
  } catch (error: any) {
    console.error('Create norm template error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

