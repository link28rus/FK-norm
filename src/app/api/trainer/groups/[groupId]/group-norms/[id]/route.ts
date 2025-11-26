import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calcGrade, gradeToString } from '@/lib/normCalculator'
import { convertGenderToEnglish } from '@/lib/genderConverter'
import { Prisma } from '@prisma/client'

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

    // Получаем applicableGender из GroupNorm или шаблона (приоритет у GroupNorm)
    const applicableGenderData = await prisma.$queryRaw<Array<{
      applicableGender: string | null
      templateApplicableGender: string | null
    }>>(
      Prisma.sql`
        SELECT 
          gn."applicableGender",
          t."applicableGender" as "templateApplicableGender"
        FROM "group_norms" gn
        LEFT JOIN "norm_templates" t ON t.id = gn."templateId"
        WHERE gn.id = ${id}::text
        LIMIT 1
      `
    )

    const applicableGender = (applicableGenderData?.[0]?.applicableGender || applicableGenderData?.[0]?.templateApplicableGender || 'ALL') as 'ALL' | 'MALE' | 'FEMALE'

    const groupNorm = await prisma.groupNorm.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            unit: true,
            direction: true,
            classFrom: true,
            classTo: true,
          },
        },
        boundaries: true,
        group: {
          select: {
            id: true,
            name: true,
            class: true, // Важно: обязательно получаем класс группы
            athletes: {
              where: {
                isActive: true, // Только активные ученики
              },
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

    // Фильтруем учеников по applicableGender, если нужно
    if (applicableGender !== 'ALL') {
      const filteredAthletes = groupNorm.group.athletes.filter(athlete => {
        const athleteGenderEnglish = convertGenderToEnglish(athlete.gender)
        if (applicableGender === 'MALE') {
          return athleteGenderEnglish === 'MALE'
        }
        if (applicableGender === 'FEMALE') {
          return athleteGenderEnglish === 'FEMALE'
        }
        return true
      })
      // Обновляем список учеников в группе
      groupNorm.group.athletes = filteredAthletes
      // Фильтруем также существующие нормы
      groupNorm.norms = groupNorm.norms.filter(norm => 
        filteredAthletes.some(a => a.id === norm.athleteId)
      )
    }

    // Добавляем applicableGender в ответ
    ;(groupNorm as any).applicableGender = applicableGender
    if (groupNorm.template) {
      ;(groupNorm.template as any).applicableGender = applicableGenderData?.[0]?.templateApplicableGender || 'ALL'
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

    // Получаем GroupNorm с шаблоном (включая applicableGender из шаблона)
    const groupNorm = await prisma.groupNorm.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            unit: true,
            direction: true,
          },
        },
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

    // Получаем applicableGender один раз для всех норм
    const applicableGenderData = await prisma.$queryRaw<Array<{
      applicableGender: string | null
      templateApplicableGender: string | null
    }>>(
      Prisma.sql`
        SELECT 
          gn."applicableGender",
          t."applicableGender" as "templateApplicableGender"
        FROM "group_norms" gn
        LEFT JOIN "norm_templates" t ON t.id = gn."templateId"
        WHERE gn.id = ${id}::text
        LIMIT 1
      `
    )
    const applicableGender = (applicableGenderData?.[0]?.applicableGender || applicableGenderData?.[0]?.templateApplicableGender || 'ALL') as 'ALL' | 'MALE' | 'FEMALE'

    console.log('[POST group-norms/[id]] GroupNorm data:', {
      groupNormId: id,
      groupId: group.id,
      groupClass: group.class,
      groupName: group.name,
      templateId: template.id,
      templateName: template.name,
      templateDirection: template.direction,
      useCustomBoundaries: groupNorm.useCustomBoundaries,
      applicableGender,
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
          // Проверяем наличие класса группы
          if (!group.class) {
            console.warn('[POST group-norms/[id]] Group class is not set:', {
              groupId: group.id,
              groupName: group.name,
              groupClass: group.class,
              message: 'Класс группы не указан. Необходимо указать класс группы для автоматического расчета оценки.',
            })
          }
          
          if (group.class !== null && group.class !== undefined) {
            // Проверяем, что у ученика указан пол (нужен для applicableGender === 'ALL')
            const athleteGender = convertGenderToEnglish(athlete.gender)
            
            if (athleteGender || applicableGender !== 'ALL') {
              console.log('[POST group-norms/[id]] Calculating grade:', {
                value: normData.value,
                athleteGender: athlete.gender,
                applicableGender,
                class: group.class,
                templateId: template.id,
                groupNormId: id,
              })
              
              calculatedGrade = await calcGrade({
                value: normData.value,
                gender: athlete.gender, // Фактический пол ученика
                class: group.class,
                templateId: template.id,
                groupNormId: id,
                applicableGender, // Для кого норматив по полу (функция сама определит, какой пол использовать)
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

/**
 * PATCH - обновить метаданные группового норматива (дата, период, переопределения)
 * 
 * Позволяет изменить:
 * - testDate - дата зачёта
 * - period - период норматива ('START_OF_YEAR' | 'END_OF_YEAR' | 'REGULAR')
 * - nameOverride - переопределение названия
 * - unitOverride - переопределение единицы измерения
 * 
 * При изменении периода проверяется, что не создаётся конфликт с существующими нормативами.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; id: string }> | { groupId: string; id: string } }
) {
  try {
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
    const existingGroupNorm = await prisma.groupNorm.findFirst({
      where: {
        id,
        group: user.role === 'ADMIN'
          ? { id: groupId }
          : {
              id: groupId,
              trainerId: profile.id,
            },
      },
      include: {
        group: {
          select: {
            id: true,
            schoolYear: true,
          },
        },
        template: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!existingGroupNorm) {
      return NextResponse.json(
        { error: 'Групповой норматив не найден' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { testDate, period, nameOverride, unitOverride, applicableGender } = body

    // Подготавливаем данные для обновления
    const updateData: any = {}

    if (testDate !== undefined) {
      updateData.testDate = new Date(testDate)
    }

    if (applicableGender !== undefined) {
      // Валидация applicableGender
      const validGenders = ['ALL', 'MALE', 'FEMALE']
      if (validGenders.includes(applicableGender)) {
        // Используем raw SQL для обновления, так как Prisma Client может не знать о поле до регенерации
        await prisma.$executeRaw(Prisma.sql`
          UPDATE "group_norms"
          SET "applicableGender" = ${applicableGender}::"NormApplicableGender",
              "updatedAt" = NOW()
          WHERE id = ${id}::text
        `)
      } else {
        return NextResponse.json(
          { error: `Недопустимое значение applicableGender. Допустимые значения: ${validGenders.join(', ')}` },
          { status: 400 }
        )
      }
    }

    if (period !== undefined) {
      // Валидация периода
      const validPeriods = ['START_OF_YEAR', 'END_OF_YEAR', 'REGULAR']
      if (!validPeriods.includes(period)) {
        return NextResponse.json(
          { error: `Недопустимое значение period. Допустимые значения: ${validPeriods.join(', ')}` },
          { status: 400 }
        )
      }

      // Если период меняется, проверяем, нет ли конфликта
      // Используем SQL напрямую, так как Prisma Client еще не знает о поле period до регенерации
      const currentPeriod = (existingGroupNorm as any).period || 'REGULAR'
      if (period !== currentPeriod) {
        const conflictingGroupNorm = await prisma.$queryRaw<any[]>`
          SELECT gn.* FROM "group_norms" gn
          INNER JOIN "groups" g ON g.id = gn."groupId"
          WHERE gn."groupId" = ${groupId}::text
            AND gn."templateId" = ${existingGroupNorm.templateId}::text
            AND gn."period" = ${period}::"NormPeriod"
            AND g."schoolYear" = ${existingGroupNorm.group.schoolYear}::text
            AND gn.id != ${id}::text
          LIMIT 1
        `

        if (conflictingGroupNorm && conflictingGroupNorm.length > 0) {
          const periodNames: Record<string, string> = {
            START_OF_YEAR: 'начала года',
            END_OF_YEAR: 'конца года',
            REGULAR: 'обычный',
          }
          return NextResponse.json(
            { 
              error: `Норматив для ${periodNames[period] || 'этого периода'} уже существует для этой группы и шаблона в учебном году ${existingGroupNorm.group.schoolYear}.`,
              conflictingGroupNormId: conflictingGroupNorm[0]?.id,
            },
            { status: 409 } // 409 Conflict
          )
        }
      }

      ;(updateData as any).period = period
    }

    if (nameOverride !== undefined) {
      updateData.nameOverride = nameOverride || null
    }

    if (unitOverride !== undefined) {
      updateData.unitOverride = unitOverride || null
    }

    // Если нечего обновлять
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Нет данных для обновления' },
        { status: 400 }
      )
    }

    // Обновляем групповой норматив
    // Используем as any для обхода ограничений Prisma Client до регенерации
    const updatedGroupNorm = await prisma.groupNorm.update({
      where: { id },
      data: updateData as any,
      include: {
        template: true,
        boundaries: true,
        group: {
          select: {
            id: true,
            name: true,
            schoolYear: true,
          },
        },
      },
    }) as any

    return NextResponse.json({ success: true, groupNorm: updatedGroupNorm })
  } catch (error: any) {
    console.error('Update group norm error:', error)
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
