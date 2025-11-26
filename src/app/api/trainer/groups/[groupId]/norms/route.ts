import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить нормативы группы, сгруппированные по type+date
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
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    // Получаем нормативы учащихся этой группы
    // Включаем GROUP нормативы и старые нормативы без normType (для обратной совместимости)
    // ИСКЛЮЧАЕМ нормативы, которые связаны с GroupNorm (они отображаются отдельно)
    // Старые нормативы могут иметь normType = null или вообще не иметь этого поля
    const allNorms = await prisma.norm.findMany({
      where: {
        athlete: {
          groupId: params.groupId,
          isActive: true, // Только активные ученики
        },
        groupNormId: null, // Исключаем нормативы из шаблонов (они отображаются отдельно)
      },
      include: {
        athlete: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { type: 'asc' },
      ],
    })

    // Фильтруем: включаем GROUP нормативы и старые нормативы без normType
    const norms = allNorms.filter(
      (norm) => norm.normType === 'GROUP' || norm.normType === null || norm.normType === undefined
    )

    // Группируем нормативы по type+date
    const groupedNorms: Record<string, {
      type: string
      date: string
      unit: string | null
      count: number
      norms: Array<{
        id: string
        athleteId: string
        athleteName: string
        value: number | null
        status: string
      }>
    }> = {}

    norms.forEach((norm) => {
      const dateStr = new Date(norm.date).toISOString().split('T')[0]
      const key = `${norm.type}|${dateStr}`
      
      if (!groupedNorms[key]) {
        groupedNorms[key] = {
          type: norm.type,
          date: dateStr,
          unit: norm.unit,
          count: 0,
          norms: [],
        }
      }

      groupedNorms[key].count++
      groupedNorms[key].norms.push({
        id: norm.id,
        athleteId: norm.athlete.id,
        athleteName: norm.athlete.fullName,
        value: norm.value,
        status: norm.status,
      })
    })

    // Преобразуем в массив
    const result = Object.values(groupedNorms).map((group) => ({
      ...group,
      norms: group.norms.sort((a, b) => a.athleteName.localeCompare(b.athleteName)),
    }))

    return NextResponse.json({ norms: result })
  } catch (error) {
    console.error('Get group norms error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

