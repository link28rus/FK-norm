import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить список личных шаблонов тренера и общих шаблонов
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Получаем профиль тренера
    let profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })

    if (user.role === 'ADMIN' && !profile) {
      profile = await prisma.trainerProfile.create({
        data: {
          userId: user.id,
          fullName: user.email.split('@')[0],
          phone: null,
        },
      })
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      )
    }

    // Правила доступа:
    // - Для тренера: (isPublic = true) OR (ownerTrainerId = currentTrainerId)
    // - Для админа: все шаблоны (без фильтра по владельцу)
    let whereClause: any = {
      isActive: true,
    }

    if (user.role === 'TRAINER') {
      whereClause.OR = [
        { isPublic: true },
        { ownerTrainerId: profile.id },
      ]
    }

    const templates = await prisma.normTemplate.findMany({
      where: whereClause,
      orderBy: [
        { isPublic: 'desc' }, // Сначала общие шаблоны
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
    console.error('Get trainer norm templates error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST - создать личный шаблон тренера
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Получаем профиль тренера
    let profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })

    if (user.role === 'ADMIN' && !profile) {
      profile = await prisma.trainerProfile.create({
        data: {
          userId: user.id,
          fullName: user.email.split('@')[0],
          phone: null,
        },
      })
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description, unit, classFrom, classTo, direction, boundaries, applicableGender } = body

    if (!name || !unit || classFrom === undefined || classTo === undefined || !direction) {
      return NextResponse.json(
        { error: 'Обязательные поля: name, unit, classFrom, classTo, direction' },
        { status: 400 }
      )
    }

    // Валидация direction
    if (direction !== 'LOWER_IS_BETTER' && direction !== 'HIGHER_IS_BETTER') {
      return NextResponse.json(
        { error: 'direction должен быть LOWER_IS_BETTER или HIGHER_IS_BETTER' },
        { status: 400 }
      )
    }

    // Валидация applicableGender
    const validGenders = ['ALL', 'MALE', 'FEMALE']
    const finalApplicableGender = applicableGender && validGenders.includes(applicableGender)
      ? applicableGender
      : 'ALL' // По умолчанию для всех

    // Валидация классов
    if (classFrom < 1 || classTo < 1 || classFrom > classTo) {
      return NextResponse.json(
        { error: 'Неверный диапазон классов' },
        { status: 400 }
      )
    }

    // Тренер может создать только личный шаблон
    // Админ может создать как общий, так и личный (в этом случае ownerTrainerId берется из профиля)
    const ownerTrainerId = user.role === 'TRAINER' ? profile.id : null
    const isPublic = user.role === 'ADMIN' ? (body.isPublic === true) : false

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
          applicableGender: finalApplicableGender as any,
          ownerTrainerId,
          isPublic,
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
    console.error('Create trainer norm template error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}



