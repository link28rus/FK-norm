import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calcGrade, gradeToString } from '@/lib/normCalculator'
import { convertGenderToEnglish } from '@/lib/genderConverter'

// GET - получить групповой норматив с данными
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; id: string }> | { groupId: string; id: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const { groupId, id } = resolvedParams

    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const groupNorm = await prisma.groupNorm.findUnique({
      where: { id },
      include: {
        template: true,
        boundaries: true,
        group: {
          select: {
            id: true,
            name: true,
            class: true, // Важно: обязательно получаем класс группы
            athletes: {
              select: {
                id: true,
                fullName: true,
                gender: true,
              },
            },
          },
        },
        norms: {
          include: {
            athlete: {
              select: {
                id: true,
                fullName: true,
                gender: true,
              },
            },
          },
        },
      },
    })

    if (!groupNorm) {
      return NextResponse.json(
        { error: 'Групповой норматив не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({ groupNorm })
  } catch (error: any) {
    console.error('Get group norm error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST - обновить результаты нормативов и рассчитать оценки
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; id: string }> | { groupId: string; id: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const { groupId, id } = resolvedParams

    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { norms } = body // Массив { athleteId, value, status? }

    if (!Array.isArray(norms)) {
      return NextResponse.json(
        { error: 'norms должен быть массивом' },
        { status: 400 }
      )
    }

    const groupNorm = await prisma.groupNorm.findUnique({
      where: { id },
      include: {
        template: true,
        group: {
          select: {
            id: true,
            name: true,
            class: true, // Важно: обязательно получаем класс группы
            athletes: {
              select: {
                id: true,
                fullName: true,
                gender: true,
              },
            },
          },
        },
      },
    })

    if (!groupNorm) {
      return NextResponse.json(
        { error: 'Групповой норматив не найден' },
        { status: 404 }
      )
    }

    const group = groupNorm.group
    const template = groupNorm.template

    console.log('[POST group-norms/[id]] GroupNorm data:', {
      groupNormId: id,
      groupId: group.id,
      groupClass: group.class,
      groupName: group.name,
      templateId: template.id,
      templateName: template.name,
      templateDirection: template.direction,
      useCustomBoundaries: groupNorm.useCustomBoundaries,
      athletesCount: group.athletes.length,
    })

    // Обновляем нормативы
    const updates = await Promise.all(
      norms.map(async (normData: { athleteId: string; value: number | null; status?: string }) => {
        const athlete = group.athletes.find(a => a.id === normData.athleteId)
        if (!athlete) {
          throw new Error(`Учащийся ${normData.athleteId} не найден в группе`)
        }

        let calculatedGrade: number | null = null
        let finalStatus = normData.status

        // Если есть значение и нет явно указанной оценки, вычисляем её
        if (normData.value !== null && normData.value !== undefined && !finalStatus) {
          // Проверяем наличие класса группы и пола ученика
          if (!group.class) {
            console.warn('[POST group-norms/[id]] Group class is not set:', {
              groupId: group.id,
              groupName: group.name,
              groupClass: group.class,
              message: 'Класс группы не указан. Необходимо указать класс группы для автоматического расчета оценки.',
            })
          }
          
          if (athlete.gender && group.class !== null && group.class !== undefined) {
            // Преобразуем пол в нужный формат
            const genderEnglish = convertGenderToEnglish(athlete.gender)
            
            if (genderEnglish) {
              console.log('[POST group-norms/[id]] Calculating grade:', {
                value: normData.value,
                gender: athlete.gender,
                genderEnglish,
                class: group.class,
                templateId: template.id,
                groupNormId: id,
              })
              
              calculatedGrade = await calcGrade({
                value: normData.value,
                gender: genderEnglish,
                class: group.class,
                templateId: template.id,
                groupNormId: id,
              })
              
              console.log('[POST group-norms/[id]] Calculated grade:', calculatedGrade)
              
              if (calculatedGrade !== null) {
                finalStatus = gradeToString(calculatedGrade)
                console.log('[POST group-norms/[id]] Final status:', finalStatus)
              }
            } else {
              console.warn('[POST group-norms/[id]] Invalid gender format:', athlete.gender)
            }
          } else {
            console.warn('[POST group-norms/[id]] Missing data for calculation:', {
              hasValue: normData.value !== null && normData.value !== undefined,
              hasGender: !!athlete.gender,
              hasClass: group.class !== null,
            })
          }
        }

        // Если оценка явно указана в запросе, используем её (тренер может переопределить)
        // Но если оценка была рассчитана автоматически, она уже в finalStatus
        if (normData.status && normData.status !== '-') {
          finalStatus = normData.status
          console.log('[POST group-norms/[id]] Using explicit status from request:', normData.status)
        } else if (calculatedGrade !== null) {
          // Используем автоматически рассчитанную оценку
          console.log('[POST group-norms/[id]] Using calculated status:', finalStatus)
        }

        const normName = groupNorm.nameOverride || template.name
        const normUnit = groupNorm.unitOverride || template.unit

        // Ищем существующий норматив, связанный с этим GroupNorm
        const existingNorm = await prisma.norm.findFirst({
          where: {
            athleteId: normData.athleteId,
            groupNormId: id, // Важно: ищем только нормативы, связанные с этим GroupNorm
          },
        })

        console.log('[POST group-norms/[id]] Processing norm:', {
          athleteId: normData.athleteId,
          value: normData.value,
          status: finalStatus,
          existingNormId: existingNorm?.id,
          groupNormId: id,
        })

        if (existingNorm) {
          // Обновляем существующий норматив
          console.log('[POST group-norms/[id]] Updating existing norm:', existingNorm.id)
          return await prisma.norm.update({
            where: { id: existingNorm.id },
            data: {
              value: normData.value,
              status: finalStatus || '-',
              unit: normUnit,
              date: groupNorm.testDate,
              // Не меняем templateId и groupNormId - они должны остаться прежними
            },
          })
        } else {
          // Создаем новый норматив, связанный с GroupNorm
          console.log('[POST group-norms/[id]] Creating new norm for GroupNorm:', id)
          return await prisma.norm.create({
            data: {
              athleteId: normData.athleteId,
              type: normName,
              normType: 'GROUP',
              value: normData.value,
              unit: normUnit,
              status: finalStatus || '-',
              date: groupNorm.testDate,
              templateId: template.id,
              groupNormId: id, // Важно: связываем с GroupNorm
            },
          })
        }
      })
    )

    return NextResponse.json({ success: true, norms: updates })
  } catch (error: any) {
    console.error('Update group norm results error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE - удалить групповой норматив и все связанные с ним нормативы
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; id: string }> | { groupId: string; id: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const { groupId, id } = resolvedParams

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

    // Проверяем, что GroupNorm принадлежит этой группе
    const groupNorm = await prisma.groupNorm.findFirst({
      where: {
        id,
        group: user.role === 'ADMIN'
          ? { id: groupId }
          : {
              id: groupId,
              trainerId: profile.id,
            },
      },
    })

    if (!groupNorm) {
      return NextResponse.json(
        { error: 'Групповой норматив не найден' },
        { status: 404 }
      )
    }

    // Удаляем все нормативы, связанные с этим GroupNorm
    // Это делается каскадно через базу данных, но лучше сделать явно
    const deletedNorms = await prisma.norm.deleteMany({
      where: {
        groupNormId: id,
      },
    })

    // Удаляем сам GroupNorm
    await prisma.groupNorm.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      deletedCount: deletedNorms.count,
    })
  } catch (error: any) {
    console.error('Delete group norm error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
