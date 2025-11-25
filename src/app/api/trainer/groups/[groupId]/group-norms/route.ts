import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить групповые нормативы
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

    // Проверяем доступ к группе
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

    const groupNorms = await prisma.groupNorm.findMany({
      where: { groupId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            unit: true,
            direction: true,
          },
        },
        _count: {
          select: {
            norms: true,
          },
        },
      },
      orderBy: { testDate: 'desc' },
    })

    return NextResponse.json({ groupNorms })
  } catch (error: any) {
    console.error('[GroupNorms GET] ERROR:', error)
    console.error('[GroupNorms GET] Error message:', error?.message)
    console.error('[GroupNorms GET] Error stack:', error?.stack)
    return NextResponse.json(
      { error: error?.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST - создать групповой норматив из шаблона
export async function POST(
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

    // Проверяем доступ к группе
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
      include: {
        athletes: true,
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { templateId, testDate, nameOverride, unitOverride, useCustomBoundaries, boundaries } = body

    if (!templateId || !testDate) {
      return NextResponse.json(
        { error: 'templateId и testDate обязательны' },
        { status: 400 }
      )
    }

    // Проверяем существование шаблона
    const template = await prisma.normTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }

    // Проверяем, подходит ли шаблон для класса группы
    if (group.class !== null && (group.class < template.classFrom || group.class > template.classTo)) {
      return NextResponse.json(
        { error: `Шаблон предназначен для классов ${template.classFrom}-${template.classTo}, а группа имеет класс ${group.class}` },
        { status: 400 }
      )
    }

    // Создаем групповой норматив
    const groupNorm = await prisma.$transaction(async (tx) => {
      const newGroupNorm = await tx.groupNorm.create({
        data: {
          groupId,
          templateId,
          testDate: new Date(testDate),
          nameOverride: nameOverride || null,
          unitOverride: unitOverride || null,
          useCustomBoundaries: useCustomBoundaries || false,
        },
      })

      // Если используются кастомные границы, создаем их
      if (useCustomBoundaries && boundaries && Array.isArray(boundaries) && boundaries.length > 0) {
        await tx.groupNormBoundary.createMany({
          data: boundaries.map((b: any) => ({
            groupNormId: newGroupNorm.id,
            grade: b.grade,
            gender: b.gender,
            class: b.class,
            fromValue: b.fromValue,
            toValue: b.toValue,
          })),
        })
      }

      return newGroupNorm
    })

    // Возвращаем созданный норматив с шаблоном
    const result = await prisma.groupNorm.findUnique({
      where: { id: groupNorm.id },
      include: {
        template: true,
        boundaries: true,
      },
    })

    return NextResponse.json({ success: true, groupNorm: result })
  } catch (error: any) {
    console.error('Create group norm error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

