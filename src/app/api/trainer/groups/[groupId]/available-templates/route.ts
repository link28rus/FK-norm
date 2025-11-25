import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить доступные шаблоны для группы (с учетом класса группы)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const groupId = resolvedParams.groupId

    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Получаем группу
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

    const group = await prisma.group.findFirst({
      where: user.role === 'ADMIN'
        ? { id: groupId }
        : {
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

    // Получаем профиль тренера для проверки прав доступа
    let trainerProfile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })

    if (user.role === 'ADMIN' && !trainerProfile) {
      trainerProfile = await prisma.trainerProfile.create({
        data: {
          userId: user.id,
          fullName: user.email.split('@')[0],
          phone: null,
        },
      })
    }

    // Формируем условия выборки шаблонов
    let whereClause: any = {
      isActive: true,
    }

    // Правила доступа:
    // - Для тренера: (isPublic = true) OR (ownerTrainerId = currentTrainerId)
    // - Для админа: все шаблоны (без фильтра по владельцу)
    if (user.role === 'TRAINER' && trainerProfile) {
      whereClause.OR = [
        { isPublic: true },
        { ownerTrainerId: trainerProfile.id },
      ]
    }

    // Если у группы указан класс, добавляем фильтр по классу
    if (group.class !== null && group.class !== undefined) {
      if (whereClause.OR) {
        // Если есть OR условие, оборачиваем в AND
        whereClause = {
          AND: [
            whereClause,
            {
              classFrom: { lte: group.class },
              classTo: { gte: group.class },
            },
          ],
        }
      } else {
        whereClause.AND = [
          { classFrom: { lte: group.class } },
          { classTo: { gte: group.class } },
        ]
      }
    }

    const templates = await prisma.normTemplate.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
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
          },
        },
      },
    })

    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error('[AvailableTemplates GET] ERROR:', error)
    console.error('[AvailableTemplates GET] Error message:', error?.message)
    console.error('[AvailableTemplates GET] Error stack:', error?.stack)
    return NextResponse.json(
      { error: error?.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

