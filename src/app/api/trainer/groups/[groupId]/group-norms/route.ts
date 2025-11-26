import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { convertGenderToEnglish } from '@/lib/genderConverter'

// GET - получить групповые нормативы
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const groupId = resolvedParams.groupId

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

    // Получаем всех учеников группы для подсчета количества с учетом фильтрации по полу
    const groupWithAthletes = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        athletes: {
          where: {
            isActive: true, // Только активные ученики
          },
          select: {
            id: true,
            gender: true,
          },
        },
      },
    })

    const groupNorms = await prisma.groupNorm.findMany({
      where: { groupId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            unit: true,
            direction: true,
            applicableGender: true, // Возвращаем поле "для кого норматив по полу"
          },
        },
        _count: {
          select: {
            norms: true,
          },
        },
      },
      orderBy: { testDate: 'desc' }, // Сортируем по дате (новые выше)
    })

    // Получаем applicableGender для всех GroupNorm одним запросом (из GroupNorm или шаблона)
    const groupNormIds = groupNorms.map(gn => gn.id)
    const applicableGenderMap = new Map<string, 'ALL' | 'MALE' | 'FEMALE'>()
    
    if (groupNormIds.length > 0) {
      // Формируем SQL запрос с IN для списка ID
      const placeholders = groupNormIds.map((_, i) => `$${i + 1}`).join(', ')
      const applicableGenderData = await prisma.$queryRawUnsafe<Array<{
        id: string
        applicableGender: string | null
        templateApplicableGender: string | null
      }>>(
        `SELECT 
          gn.id,
          gn."applicableGender",
          t."applicableGender" as "templateApplicableGender"
        FROM "group_norms" gn
        LEFT JOIN "norm_templates" t ON t.id = gn."templateId"
        WHERE gn.id IN (${placeholders})`,
        ...groupNormIds
      )

      // Создаем карту id -> applicableGender
      for (const row of applicableGenderData) {
        const applicableGender = (row.applicableGender || 
          row.templateApplicableGender || 
          'ALL') as 'ALL' | 'MALE' | 'FEMALE'
        applicableGenderMap.set(row.id, applicableGender)
      }
    }

    // Подсчитываем количество учеников, которые могут сдавать каждый норматив
    const groupNormsWithFilteredCount = groupNorms.map((gn) => {
      // Получаем applicableGender из карты или используем значение из шаблона
      const applicableGender = applicableGenderMap.get(gn.id) || 
        (gn.template.applicableGender as 'ALL' | 'MALE' | 'FEMALE' | undefined) || 
        'ALL'

      // Подсчитываем количество учеников, которые могут сдавать этот норматив
      let eligibleAthletesCount = groupWithAthletes?.athletes.length || 0

      if (applicableGender !== 'ALL' && groupWithAthletes) {
        eligibleAthletesCount = groupWithAthletes.athletes.filter((athlete) => {
          const athleteGender = convertGenderToEnglish(athlete.gender)
          if (applicableGender === 'MALE') {
            return athleteGender === 'MALE'
          }
          if (applicableGender === 'FEMALE') {
            return athleteGender === 'FEMALE'
          }
          return true
        }).length
      }

      return {
        ...gn,
        applicableGender,
        eligibleAthletesCount, // Количество учеников, которые могут сдавать этот норматив
      }
    })

    return NextResponse.json({ groupNorms: groupNormsWithFilteredCount })
  } catch (error: any) {
    console.error('[GroupNorms GET] ERROR:', error)
    console.error('[GroupNorms GET] Error message:', error?.message)
    console.error('[GroupNorms GET] Error stack:', error?.stack)
    return NextResponse.json(
      { error: error?.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

/**
 * POST - создать групповой норматив из шаблона
 * 
 * Поддерживает создание контрольных нормативов для начала/конца учебного года.
 * 
 * Параметры запроса:
 * - templateId (обязательно) - ID шаблона норматива
 * - testDate (обязательно) - дата зачёта
 * - period (опционально) - период норматива: 'START_OF_YEAR' | 'END_OF_YEAR' | 'REGULAR' (по умолчанию 'REGULAR')
 * - nameOverride (опционально) - переопределение названия
 * - unitOverride (опционально) - переопределение единицы измерения
 * - useCustomBoundaries (опционально) - использовать кастомные границы оценок
 * - boundaries (опционально) - массив границ оценок (если useCustomBoundaries = true)
 * 
 * Бизнес-логика:
 * - Для каждой комбинации groupId + templateId + period в рамках одного учебного года (schoolYear) 
 *   не должно быть дубликатов нормативов. Если такой норматив уже существует, возвращается ошибка.
 * - Период позволяет различать нормативы: обычные (REGULAR), начало года (START_OF_YEAR) и конец года (END_OF_YEAR)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const groupId = resolvedParams.groupId

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

    const group = await prisma.group.findFirst({
      where: user.role === 'ADMIN'
        ? { id: groupId }
        : {
            id: groupId,
            trainerId: profile.id,
          },
      include: {
        athletes: {
          where: {
            isActive: true, // Только активные ученики
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

    const body = await request.json()
    const { templateId, testDate, nameOverride, unitOverride, useCustomBoundaries, boundaries, period } = body

    if (!templateId || !testDate) {
      return NextResponse.json(
        { error: 'templateId и testDate обязательны' },
        { status: 400 }
      )
    }

    // Валидация периода: должен быть одним из значений enum NormPeriod
    const validPeriods = ['START_OF_YEAR', 'END_OF_YEAR', 'REGULAR']
    const normPeriod = period && validPeriods.includes(period) ? period : 'REGULAR'

    // Проверяем существование шаблона
    const template = await prisma.normTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }

    // Проверяем, подходит ли шаблон для класса группы
    if (group.class !== null && (group.class < template.classFrom || group.class > template.classTo)) {
      return NextResponse.json(
        { error: `Шаблон предназначен для классов ${template.classFrom}-${template.classTo}, а группа имеет класс ${group.class}` },
        { status: 400 }
      )
    }

    // Проверяем, нет ли уже норматива с такой же комбинацией groupId + templateId + period для этого учебного года
    // Это предотвращает создание дубликатов контрольных нормативов
    // Используем SQL напрямую, так как Prisma Client еще не знает о поле period до регенерации
    const existingGroupNorm = await prisma.$queryRaw<any[]>`
      SELECT gn.* FROM "group_norms" gn
      INNER JOIN "groups" g ON g.id = gn."groupId"
      WHERE gn."groupId" = ${groupId}::text
        AND gn."templateId" = ${templateId}::text
        AND gn."period" = ${normPeriod}::"NormPeriod"
        AND g."schoolYear" = ${group.schoolYear}::text
      LIMIT 1
    `

    if (existingGroupNorm && existingGroupNorm.length > 0) {
      const periodNames: Record<string, string> = {
        START_OF_YEAR: 'начала года',
        END_OF_YEAR: 'конца года',
        REGULAR: 'обычный',
      }
      return NextResponse.json(
        { 
          error: `Норматив для ${periodNames[normPeriod] || 'этого периода'} уже существует для этой группы и шаблона в учебном году ${group.schoolYear}. Удалите существующий норматив или выберите другой период.`,
          existingGroupNormId: existingGroupNorm[0]?.id,
        },
        { status: 409 } // 409 Conflict
      )
    }

    // Создаем групповой норматив
    // Используем $executeRawUnsafe для создания, так как Prisma Client еще не знает о поле period до регенерации
    const groupNorm = await prisma.$transaction(async (tx) => {
      // Генерируем ID используя cuid формат (Prisma использует cuid по умолчанию)
      // Используем простую генерацию ID в формате, похожем на cuid
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 11)
      const newId = `c${timestamp}${random}`
      
      // Подготавливаем значения для SQL
      const testDateValue = new Date(testDate).toISOString()
      const nameOverrideValue = nameOverride || null
      const unitOverrideValue = unitOverride || null
      
      // Получаем applicableGender из шаблона (копируем значение из шаблона)
      // Если Prisma Client не знает о поле, используем raw SQL для получения
      const templateData = await tx.$queryRaw<Array<{ applicableGender: string }>>(
        Prisma.sql`SELECT "applicableGender" FROM "norm_templates" WHERE id = ${templateId}::text LIMIT 1`
      )
      const templateApplicableGender = templateData && templateData.length > 0 
        ? templateData[0].applicableGender 
        : 'ALL'
      
      // Создаем GroupNorm через raw SQL
      // Используем Prisma.sql для безопасной параметризации SQL запросов
      // Копируем applicableGender из шаблона при создании группового норматива
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "group_norms" (
          "id",
          "groupId",
          "templateId",
          "testDate",
          "nameOverride",
          "unitOverride",
          "useCustomBoundaries",
          "period",
          "applicableGender",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${newId}::text,
          ${groupId}::text,
          ${templateId}::text,
          ${testDateValue}::timestamp,
          ${nameOverrideValue}::text,
          ${unitOverrideValue}::text,
          ${useCustomBoundaries}::boolean,
          ${normPeriod}::"NormPeriod",
          ${templateApplicableGender}::"NormApplicableGender",
          NOW(),
          NOW()
        )
      `)

      // Если используются кастомные границы, создаем их
      if (useCustomBoundaries && boundaries && Array.isArray(boundaries) && boundaries.length > 0) {
        await tx.groupNormBoundary.createMany({
          data: boundaries.map((b: any) => ({
            groupNormId: newId,
            grade: b.grade,
            gender: b.gender,
            class: b.class,
            fromValue: b.fromValue,
            toValue: b.toValue,
          })),
        })
      }

      // Возвращаем ID созданного норматива, чтобы потом получить его с include
      return { id: newId }
    })

    // Возвращаем созданный норматив с шаблоном через Prisma
    // Используем raw SQL для получения, так как Prisma Client еще не знает о поле period
    const result = await prisma.$queryRaw<Array<any>>(
      Prisma.sql`
        SELECT 
          gn.*,
          json_build_object(
            'id', t.id,
            'name', t.name,
            'unit', t.unit,
            'direction', t.direction,
            'applicableGender', t."applicableGender"
          ) as template,
          COALESCE(
            json_agg(
              json_build_object(
                'id', b.id,
                'grade', b.grade,
                'gender', b.gender,
                'class', b.class,
                'fromValue', b."fromValue",
                'toValue', b."toValue"
              )
            ) FILTER (WHERE b.id IS NOT NULL),
            '[]'::json
          ) as boundaries
        FROM "group_norms" gn
        LEFT JOIN "norm_templates" t ON t.id = gn."templateId"
        LEFT JOIN "group_norm_boundaries" b ON b."groupNormId" = gn.id
        WHERE gn.id = ${groupNorm.id}::text
        GROUP BY gn.id, t.id, t.name, t.unit, t.direction
      `
    )

    if (!result || result.length === 0) {
      throw new Error('Не удалось получить созданный групповой норматив')
    }

    const groupNormResult = result[0]

    return NextResponse.json({ success: true, groupNorm: groupNormResult })
  } catch (error: any) {
    console.error('Create group norm error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

