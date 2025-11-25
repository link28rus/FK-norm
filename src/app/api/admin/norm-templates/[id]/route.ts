import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить шаблон с границами
export async function GET(
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

    const template = await prisma.normTemplate.findUnique({
      where: { id: params.id },
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
            { grade: 'desc' }, // От лучшей к худшей
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

    return NextResponse.json({ template })
  } catch (error: any) {
    console.error('Get norm template error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT - обновить шаблон
export async function PUT(
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

    const body = await request.json()
    const { name, description, unit, classFrom, classTo, direction, isActive, boundaries, ownerTrainerId, isPublic } = body

    // Валидация: если шаблон общий, ownerTrainerId должен быть null
    if (isPublic === true && ownerTrainerId !== null && ownerTrainerId !== undefined) {
      return NextResponse.json(
        { error: 'Общий шаблон не может иметь владельца (ownerTrainerId должен быть null)' },
        { status: 400 }
      )
    }

    // Обновляем шаблон и границы в транзакции
    const template = await prisma.$transaction(async (tx) => {
      // Обновляем шаблон
      const updateData: any = {}
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (unit !== undefined) updateData.unit = unit
      if (classFrom !== undefined) updateData.classFrom = classFrom
      if (classTo !== undefined) updateData.classTo = classTo
      if (direction !== undefined) updateData.direction = direction
      if (isActive !== undefined) updateData.isActive = isActive
      if (ownerTrainerId !== undefined) {
        updateData.ownerTrainerId = ownerTrainerId === null || ownerTrainerId === '' ? null : ownerTrainerId
      }
      if (isPublic !== undefined) updateData.isPublic = isPublic

      const updatedTemplate = await tx.normTemplate.update({
        where: { id: params.id },
        data: updateData,
      })

      // Если переданы границы, обновляем их
      if (boundaries !== undefined && Array.isArray(boundaries)) {
        // Удаляем все старые границы
        await tx.normTemplateBoundary.deleteMany({
          where: { templateId: params.id },
        })

        // Создаем новые границы
        if (boundaries.length > 0) {
          await tx.normTemplateBoundary.createMany({
            data: boundaries.map((b: any) => ({
              templateId: params.id,
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
        where: { id: params.id },
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
    console.error('Update norm template error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE - удалить шаблон
export async function DELETE(
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

    // Проверяем, используется ли шаблон в групповых нормативах
    const groupNormsCount = await prisma.groupNorm.count({
      where: { templateId: params.id },
    })

    if (groupNormsCount > 0) {
      return NextResponse.json(
        { error: 'Шаблон используется в групповых нормативах. Удаление невозможно.' },
        { status: 400 }
      )
    }

    // Удаляем шаблон (границы удалятся каскадно)
    await prisma.normTemplate.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete norm template error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

