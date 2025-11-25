import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// PUT - обновить учащегося
export async function PUT(
  request: NextRequest,
  { params }: { params: { groupId: string; id: string } }
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

    // Проверяем, что учащийся принадлежит этой группе
    const athlete = await prisma.athlete.findFirst({
      where: {
        id: params.id,
        groupId: params.groupId,
      },
    })

    if (!athlete) {
      return NextResponse.json(
        { error: 'Учащийся не найден' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { fullName, birthDate, gender, notes } = body

    const updatedAthlete = await prisma.athlete.update({
      where: { id: params.id },
      data: {
        fullName: fullName || undefined,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        notes: notes || null,
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
  { params }: { params: { groupId: string; id: string } }
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

    // Проверяем, что учащийся принадлежит этой группе
    const athlete = await prisma.athlete.findFirst({
      where: {
        id: params.id,
        groupId: params.groupId,
      },
    })

    if (!athlete) {
      return NextResponse.json(
        { error: 'Учащийся не найден' },
        { status: 404 }
      )
    }

    await prisma.athlete.delete({
      where: { id: params.id },
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

