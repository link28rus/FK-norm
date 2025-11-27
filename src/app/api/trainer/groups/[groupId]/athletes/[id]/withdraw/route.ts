import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST - отметить ученика как выбывшего из группы
 * Устанавливает isActive = false и заполняет exitReason, exitDate
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; id: string }> | { groupId: string; id: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const { groupId, id: athleteId } = resolvedParams

    const user = await getCurrentUser(req)

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

    // Проверяем, что группа принадлежит этому тренеру (для ADMIN разрешаем доступ ко всем группам)
    const group = await prisma.group.findFirst({
      where: user.role === 'ADMIN'
        ? { id: groupId }
        : {
            id: groupId,
            trainerId: profile.id,
          },
      select: {
        id: true,
        trainerId: true,
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Группа не найдена или нет доступа' },
        { status: 404 }
      )
    }

    // Проверяем, что ученик принадлежит этой группе
    const athlete = await prisma.athlete.findFirst({
      where: {
        id: athleteId,
        groupId: groupId,
      },
    })

    if (!athlete) {
      return NextResponse.json(
        { error: 'Ученик не найден в этой группе' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const exitReason = (body.exitReason ?? '').trim()
    const exitDateRaw = body.exitDate as string | undefined

    if (!exitReason) {
      return NextResponse.json(
        { error: 'Причина выбытия обязательна' },
        { status: 400 }
      )
    }

    const exitDate = exitDateRaw ? new Date(exitDateRaw) : new Date()

    // Обновляем ученика: помечаем как неактивного и заполняем данные о выбытии
    const updated = await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        isActive: false,
        exitReason,
        exitDate,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[STUDENT_WITHDRAW] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка при обработке выбытия ученика' },
      { status: 500 }
    )
  }
}

