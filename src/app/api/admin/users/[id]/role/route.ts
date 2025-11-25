import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// PATCH - изменить роль пользователя
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Проверяем, что не меняем роль самому себе
    if (currentUser.id === params.id) {
      return NextResponse.json(
        { error: 'Нельзя изменить роль самому себе' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { role } = body

    if (!role || (role !== 'ADMIN' && role !== 'TRAINER')) {
      return NextResponse.json(
        { error: 'Недопустимая роль. Допустимые значения: ADMIN, TRAINER' },
        { status: 400 }
      )
    }

    // Проверяем, что пользователь существует
    const userToUpdate = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    // Обновляем роль
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { role },
    })

    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error('Update user role error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}




