import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { extractClassFromGroupName } from '@/lib/groupClassExtractor'

// GET - получить группу по ID
export async function GET(
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

    // Для ADMIN разрешаем доступ ко всем группам, для TRAINER - только к своим
    const group = await prisma.group.findFirst({
      where: user.role === 'ADMIN'
        ? { id: params.groupId }
        : {
            id: params.groupId,
            trainerId: profile.id,
          },
      include: {
        _count: {
          select: {
            athletes: true,
            lessons: true,
          },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Get group error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT - обновить группу
export async function PUT(
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

    // Для ADMIN разрешаем доступ ко всем группам, для TRAINER - только к своим
    const group = await prisma.group.findFirst({
      where: user.role === 'ADMIN'
        ? { id: params.groupId }
        : {
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
    const { name, description, schoolYear } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Название группы обязательно' },
        { status: 400 }
      )
    }

    if (schoolYear !== undefined && !schoolYear) {
      return NextResponse.json(
        { error: 'Учебный год обязателен' },
        { status: 400 }
      )
    }

    // Автоматически определяем класс из названия группы (если название изменяется)
    const extractedClass = name ? extractClassFromGroupName(name) : null

    const updateData: any = {
      name: name || undefined,
      description: description !== undefined ? description : null,
    }
    
    if (schoolYear !== undefined) {
      updateData.schoolYear = schoolYear
    }

    // Если название группы изменяется, автоматически обновляем класс
    if (name && extractedClass !== null) {
      updateData.class = extractedClass
      console.log('[Groups PUT] Auto-detecting class from name:', {
        name,
        extractedClass,
        groupId: params.groupId,
      })
    } else if (name && extractedClass === null) {
      // Если класс не удалось определить, устанавливаем null
      updateData.class = null
      console.warn('[Groups PUT] Could not extract class from name:', {
        name,
        groupId: params.groupId,
      })
    }

    const updatedGroup = await prisma.group.update({
      where: { id: params.groupId },
      data: updateData,
    })

    return NextResponse.json({ success: true, group: updatedGroup })
  } catch (error) {
    console.error('Update group error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE - удалить группу
export async function DELETE(
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

    await prisma.group.delete({
      where: { id: params.groupId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete group error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

