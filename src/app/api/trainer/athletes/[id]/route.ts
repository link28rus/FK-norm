import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить учащегося по ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Для ADMIN разрешаем доступ ко всем ученикам, для TRAINER - только к своим
    // Убираем фильтр по isActive, чтобы можно было просматривать выбывших учеников
    const athlete = await prisma.athlete.findFirst({
      where: user.role === 'ADMIN'
        ? { id: params.id }
        : {
            id: params.id,
            group: {
              trainerId: profile.id,
            },
          },
      include: {
        norms: {
          // Загружаем ВСЕ нормативы ученика (индивидуальные, групповые, контрольные)
          // НЕ фильтруем по normType, groupNormId, period - показываем все нормативы
          include: {
            template: {
              select: {
                id: true,
                name: true,
                unit: true,
                direction: true,
              },
            },
            groupNorm: {
              select: {
                id: true,
                period: true,
              },
            },
          },
          orderBy: { date: 'asc' },
        },
        group: {
          select: {
            name: true,
            schoolYear: true,
          },
        },
      },
    })

    if (!athlete) {
      return NextResponse.json(
        { error: 'Учащийся не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({ athlete })
  } catch (error) {
    console.error('Get athlete error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT - обновить учащегося
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Проверяем, что учащийся принадлежит этому тренеру через группу
    const athlete = await prisma.athlete.findFirst({
      where: {
        id: params.id,
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

    const body = await request.json()
    const { fullName, birthDate, gender, notes, groupId, uinGto, height, weight, shoeSize } = body

    if (!fullName || fullName.trim() === '') {
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

    // Валидация антропометрических данных
    if (height !== undefined && height !== null) {
      const heightNum = typeof height === 'string' ? parseInt(height, 10) : height
      if (isNaN(heightNum) || heightNum < 50 || heightNum > 250) {
        return NextResponse.json(
          { error: 'Рост должен быть от 50 до 250 см' },
          { status: 400 }
        )
      }
    }

    if (weight !== undefined && weight !== null) {
      const weightNum = typeof weight === 'string' ? parseInt(weight, 10) : weight
      if (isNaN(weightNum) || weightNum < 10 || weightNum > 200) {
        return NextResponse.json(
          { error: 'Вес должен быть от 10 до 200 кг' },
          { status: 400 }
        )
      }
    }

    if (shoeSize !== undefined && shoeSize !== null) {
      const shoeSizeNum = typeof shoeSize === 'string' ? parseFloat(shoeSize) : shoeSize
      if (isNaN(shoeSizeNum) || shoeSizeNum < 15 || shoeSizeNum > 50) {
        return NextResponse.json(
          { error: 'Размер обуви должен быть от 15 до 50' },
          { status: 400 }
        )
      }
    }

    // Если указана новая группа, проверяем, что она принадлежит тренеру (или ADMIN имеет доступ)
    if (groupId && groupId !== athlete.groupId) {
      const newGroup = await prisma.group.findFirst({
        where: user.role === 'ADMIN'
          ? { id: groupId }
          : {
              id: groupId,
              trainerId: profile.id,
            },
        select: { schoolYear: true },
      })

      if (!newGroup) {
        return NextResponse.json(
          { error: 'Группа не найдена или нет доступа' },
          { status: 404 }
        )
      }

      // Обновляем schoolYear при смене группы
      const updateData: any = {
        fullName: fullName.trim(),
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        notes: notes || null,
        uinGto: uinGto && uinGto.trim() !== '' ? uinGto.trim() : null,
        height: height !== undefined && height !== null ? (typeof height === 'string' ? parseInt(height, 10) : height) : null,
        weight: weight !== undefined && weight !== null ? (typeof weight === 'string' ? parseInt(weight, 10) : weight) : null,
        shoeSize: shoeSize !== undefined && shoeSize !== null ? (typeof shoeSize === 'string' ? parseFloat(shoeSize) : shoeSize) : null,
        groupId: groupId,
        schoolYear: newGroup.schoolYear,
      }

      const updatedAthlete = await prisma.athlete.update({
        where: { id: params.id },
        data: updateData,
        include: {
          group: {
            select: {
              name: true,
              schoolYear: true,
            },
          },
        },
      })

      return NextResponse.json({ success: true, athlete: updatedAthlete })
    }

    // Если группа не меняется, обновляем только остальные поля
    const updatedAthlete = await prisma.athlete.update({
      where: { id: params.id },
      data: {
        fullName: fullName.trim(),
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        notes: notes || null,
        uinGto: uinGto && uinGto.trim() !== '' ? uinGto.trim() : null,
        height: height !== undefined && height !== null ? (typeof height === 'string' ? parseInt(height, 10) : height) : null,
        weight: weight !== undefined && weight !== null ? (typeof weight === 'string' ? parseInt(weight, 10) : weight) : null,
        shoeSize: shoeSize !== undefined && shoeSize !== null ? (typeof shoeSize === 'string' ? parseFloat(shoeSize) : shoeSize) : null,
      },
      include: {
        group: {
          select: {
            name: true,
            schoolYear: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, athlete: updatedAthlete })
  } catch (error) {
    console.error('Update athlete error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE - удалить учащегося
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Проверяем, что учащийся принадлежит этому тренеру через группу
    const athlete = await prisma.athlete.findFirst({
      where: {
        id: params.id,
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

    // Soft delete: помечаем ученика как неактивного вместо физического удаления
    await prisma.athlete.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete athlete error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

