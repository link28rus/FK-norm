import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить список учащихся группы
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const { groupId } = resolvedParams

    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Если ADMIN и нет TrainerProfile - создаём автоматически
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

    // Проверяем, что группа принадлежит этому тренеру (для ADMIN разрешаем доступ ко всем группам)
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

    // Проверяем query-параметр для включения выбывших учеников
    const { searchParams } = new URL(request.url)
    const includeWithdrawn = searchParams.get('includeWithdrawn') === 'true'

    // Формируем условие where
    const whereCondition: any = { groupId }
    
    if (!includeWithdrawn) {
      // По умолчанию показываем только активных
      whereCondition.isActive = true
    }
    // Если includeWithdrawn=true, возвращаем всех (активных и неактивных)

    const athletes = await prisma.athlete.findMany({
      where: whereCondition,
      select: {
        id: true,
        fullName: true,
        birthDate: true,
        gender: true,
        notes: true,
        uinGto: true,
        isActive: true,
        exitReason: true,
        exitDate: true,
      },
      orderBy: { fullName: 'asc' },
    })

    return NextResponse.json({ athletes })
  } catch (error) {
    console.error('Get athletes error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST - создать учащегося в группе
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const { groupId } = resolvedParams

    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Если ADMIN и нет TrainerProfile - создаём автоматически
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

    // Проверяем, что группа принадлежит этому тренеру (для ADMIN разрешаем доступ ко всем группам)
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

    const body = await request.json()
    const { fullName, birthDate, gender, notes, uinGto } = body

    if (!fullName) {
      return NextResponse.json(
        { error: 'ФИО обязательно' },
        { status: 400 }
      )
    }

    // Валидация УИН ГТО: должен быть в формате 00-00-0000000
    if (uinGto && !/^\d{2}-\d{2}-\d{7}$/.test(uinGto)) {
      return NextResponse.json(
        { error: 'УИН ГТО должен быть в формате 00-00-0000000' },
        { status: 400 }
      )
    }

    const athlete = await prisma.athlete.create({
      data: {
        groupId,
        fullName,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        notes: notes || null,
        uinGto: uinGto && uinGto.trim() !== '' ? uinGto.trim() : null,
        schoolYear: group.schoolYear,
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
