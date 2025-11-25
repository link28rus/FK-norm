import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// PUT - обновить нормативы группы (для конкретного type+date)
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

    const body = await request.json()
    const { type, date, originalDate, norms } = body

    if (!type || !date || !norms || !Array.isArray(norms)) {
      return NextResponse.json(
        { error: 'Тип, дата и список нормативов обязательны' },
        { status: 400 }
      )
    }

    const normDate = new Date(date)
    normDate.setHours(0, 0, 0, 0)

    // Используем originalDate для поиска существующих нормативов, если она указана
    const searchDate = originalDate ? new Date(originalDate) : normDate
    searchDate.setHours(0, 0, 0, 0)

    // Проверяем, что все нормативы принадлежат этой группе и имеют правильный type+date
    const existingNorms = await prisma.norm.findMany({
      where: {
        athlete: {
          groupId: params.groupId,
        },
        type,
        date: searchDate,
      },
      include: {
        athlete: true,
      },
    })

    // Если дата изменилась, сначала обновляем дату у всех нормативов этого группового норматива
    if (originalDate && originalDate !== date) {
      await prisma.norm.updateMany({
        where: {
          athlete: {
            groupId: params.groupId,
          },
          type,
          date: searchDate,
        },
        data: {
          date: normDate,
        },
      })
    }

    // Обновляем или создаём нормативы
    const updates = norms.map(async (normData: {
      normId?: string
      athleteId: string
      value: string | number | null
      grade?: string // Оценка вместо status
      status?: string // Для обратной совместимости
      delete?: boolean
    }) => {
      if (normData.delete) {
        // Удаляем норматив
        if (normData.normId) {
          await prisma.norm.delete({
            where: { id: normData.normId },
          })
        }
        return null
      }

      const value = normData.value === '' || normData.value === null 
        ? null 
        : parseFloat(String(normData.value))

      // Валидация оценки: должно быть одно из значений ["-", "2", "3", "4", "5", "Б", "О"]
      const validGrades = ['-', '2', '3', '4', '5', 'Б', 'О']
      const grade = normData.grade && validGrades.includes(normData.grade) 
        ? normData.grade 
        : (normData.status && validGrades.includes(normData.status) 
          ? normData.status 
          : '-')

      if (normData.normId) {
        // Обновляем существующий (включая дату, если она изменилась)
        return await prisma.norm.update({
          where: { id: normData.normId },
          data: {
            value,
            status: grade, // Сохраняем оценку в поле status
            date: normDate, // Обновляем дату
          },
        })
      } else {
        // Создаём новый (если был удалён, но потом решили вернуть)
        return await prisma.norm.create({
          data: {
            athleteId: normData.athleteId,
            type,
            normType: 'GROUP', // Групповые нормативы
            value,
            unit: existingNorms[0]?.unit || null,
            status: grade, // Сохраняем оценку в поле status
            date: normDate,
          },
        })
      }
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update group norms error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

