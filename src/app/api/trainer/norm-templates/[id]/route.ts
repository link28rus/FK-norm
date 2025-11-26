import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить шаблон (только если он доступен тренеру)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams

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

    // Получаем шаблон
    const template = await prisma.normTemplate.findUnique({
      where: { id },
      include: {
        ownerTrainer: {
          select: {
            id: true,
            fullName: true,
          },
        },
        boundaries: {
          orderBy: [
            { class: 'asc' },
            { gender: 'asc' },
            { grade: 'desc' },
          ],
        },
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }

    // Проверяем доступ:
    // - Админ может видеть все шаблоны
    // - Тренер может видеть только общие или свои личные шаблоны
    if (user.role === 'TRAINER') {
      const hasAccess = template.isPublic === true || template.ownerTrainerId === profile.id
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Доступ запрещён' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({ template })
  } catch (error: any) {
    console.error('Get trainer norm template error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT - обновить шаблон (только если тренер владелец или админ)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams

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

    // Проверяем существующий шаблон и права доступа
    const existingTemplate = await prisma.normTemplate.findUnique({
      where: { id },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }

    // Проверяем права доступа:
    // - Тренер может редактировать только свои личные шаблоны
    // - Админ может редактировать любые шаблоны
    if (user.role === 'TRAINER') {
      if (existingTemplate.ownerTrainerId !== profile.id) {
        return NextResponse.json(
          { error: 'Вы можете редактировать только свои личные шаблоны' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { name, description, unit, classFrom, classTo, direction, isActive, boundaries, applicableGender } = body

    // Валидация: тренер не может изменить ownerTrainerId или isPublic (только админ)
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (unit !== undefined) updateData.unit = unit
    if (classFrom !== undefined) updateData.classFrom = classFrom
    if (classTo !== undefined) updateData.classTo = classTo
    if (direction !== undefined) updateData.direction = direction
    if (isActive !== undefined) updateData.isActive = isActive
    
    // Валидация и обновление applicableGender
    if (applicableGender !== undefined) {
      const validGenders = ['ALL', 'MALE', 'FEMALE']
      if (validGenders.includes(applicableGender)) {
        updateData.applicableGender = applicableGender
      } else {
        return NextResponse.json(
          { error: 'applicableGender должен быть ALL, MALE или FEMALE' },
          { status: 400 }
        )
      }
    }

    // Только админ может изменить ownerTrainerId и isPublic
    if (user.role === 'ADMIN') {
      if (body.ownerTrainerId !== undefined) {
        updateData.ownerTrainerId = body.ownerTrainerId === null || body.ownerTrainerId === '' ? null : body.ownerTrainerId
      }
      if (body.isPublic !== undefined) {
        updateData.isPublic = body.isPublic
      }

      // Валидация: если шаблон общий, ownerTrainerId должен быть null
      if (updateData.isPublic === true && updateData.ownerTrainerId !== null && updateData.ownerTrainerId !== undefined) {
        return NextResponse.json(
          { error: 'Общий шаблон не может иметь владельца (ownerTrainerId должен быть null)' },
          { status: 400 }
        )
      }
    }

    // Обновляем шаблон и границы в транзакции
    const template = await prisma.$transaction(async (tx) => {
      const updatedTemplate = await tx.normTemplate.update({
        where: { id },
        data: updateData,
      })

      // Если переданы границы, обновляем их
      if (boundaries !== undefined && Array.isArray(boundaries)) {
        // Удаляем все старые границы
        await tx.normTemplateBoundary.deleteMany({
          where: { templateId: id },
        })

        // Создаем новые границы
        if (boundaries.length > 0) {
          await tx.normTemplateBoundary.createMany({
            data: boundaries.map((b: any) => ({
              templateId: id,
              grade: b.grade,
              gender: b.gender,
              class: b.class,
              fromValue: b.fromValue,
              toValue: b.toValue,
            })),
          })
        }
      }

      // Возвращаем обновленный шаблон с границами
      return await tx.normTemplate.findUnique({
        where: { id },
        include: {
          ownerTrainer: {
            select: {
              id: true,
              fullName: true,
            },
          },
          boundaries: {
            orderBy: [
              { class: 'asc' },
              { gender: 'asc' },
              { grade: 'desc' },
            ],
          },
        },
      })
    })

    return NextResponse.json({ success: true, template })
  } catch (error: any) {
    console.error('Update trainer norm template error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE - удалить шаблон (только если тренер владелец или админ)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams

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

    // Проверяем существующий шаблон и права доступа
    const existingTemplate = await prisma.normTemplate.findUnique({
      where: { id },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }

    // Проверяем права доступа:
    // - Тренер может удалять только свои личные шаблоны
    // - Админ может удалять любые шаблоны
    if (user.role === 'TRAINER') {
      if (existingTemplate.ownerTrainerId !== profile.id) {
        return NextResponse.json(
          { error: 'Вы можете удалять только свои личные шаблоны' },
          { status: 403 }
        )
      }
    }

    // Проверяем, используется ли шаблон в групповых нормативах
    const groupNormsCount = await prisma.groupNorm.count({
      where: { templateId: id },
    })

    if (groupNormsCount > 0) {
      return NextResponse.json(
        { error: 'Шаблон используется в групповых нормативах. Удаление невозможно.' },
        { status: 400 }
      )
    }

    // Удаляем шаблон (границы удалятся каскадно)
    await prisma.normTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete trainer norm template error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}



