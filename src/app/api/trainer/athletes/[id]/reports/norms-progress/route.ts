import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * Тип для отчёта о прогрессе ученика по нормативам
 */
type AthleteNormProgressReport = {
  athlete: {
    id: string
    fullName: string
    groupName: string
    academicYear: string
  }
  norms: Array<{
    normId: string // ID GroupNorm для начала года (для идентификации пары)
    templateId: string
    name: string
    unit: string | null
    direction: string // "LOWER_IS_BETTER" | "HIGHER_IS_BETTER"
    startValue: number | null
    endValue: number | null
    delta: number | null // endValue - startValue
    startDate: string | null // Дата зачёта на начало года
    endDate: string | null // Дата зачёта на конец года
    intermediateResults?: Array<{
      // Опционально: промежуточные измерения (если запрошены)
      value: number | null
      date: string
      status: string
    }>
  }>
}

/**
 * GET - получить отчёт о прогрессе ученика по нормативам за учебный год
 * 
 * Эндпоинт сопоставляет результаты нормативов на начало и конец учебного года
 * для конкретного ученика, вычисляет разницу и показывает динамику.
 * 
 * Query параметры:
 * - year (опционально) - учебный год в формате "YYYY/YYYY" (например, "2024/2025").
 *   Если не указан, используется учебный год группы ученика.
 * - includeIntermediate (опционально) - если указан как "true", включает промежуточные
 *   измерения (нормативы с period = REGULAR) между началом и концом года
 * 
 * Возвращает:
 * - Информацию об ученике (id, fullName, groupName, academicYear)
 * - Для каждого норматива: результаты на начало и конец года, delta, даты зачётов
 * 
 * Использование на фронтенде:
 * Этот эндпоинт предназначен для отображения на странице "Прогресс ученика".
 * Пример использования:
 * 
 * ```typescript
 * const response = await fetch(`/api/trainer/athletes/${athleteId}/reports/norms-progress?year=2024/2025`)
 * const { report } = await response.json()
 * 
 * // Отобразить информацию об ученике
 * console.log(report.athlete.fullName, report.athlete.groupName)
 * 
 * // Отобразить прогресс по каждому нормативу
 * report.norms.forEach(norm => {
 *   console.log(`${norm.name}: начало ${norm.startValue}, конец ${norm.endValue}, изменение ${norm.delta}`)
 * })
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const { id: athleteId } = resolvedParams

    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Проверяем доступ к ученику
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

    // Получаем ученика и проверяем доступ
    const athlete = await prisma.athlete.findFirst({
      where: user.role === 'ADMIN'
        ? { id: athleteId }
        : {
            id: athleteId,
            group: {
              trainerId: profile.id,
            },
          },
      include: {
        group: {
          select: {
            id: true,
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

    // Определяем учебный год и опции
    const { searchParams } = new URL(request.url)
    const requestedYear = searchParams.get('year')
    const includeIntermediate = searchParams.get('includeIntermediate') === 'true'
    const academicYear = requestedYear || athlete.group.schoolYear

    // Получаем все групповые нормативы для группы ученика за указанный учебный год
    // Нас интересуют нормативы с периодом START_OF_YEAR и END_OF_YEAR
    // Если запрошены промежуточные, также получаем REGULAR
    const periodFilter = includeIntermediate
      ? ['START_OF_YEAR', 'END_OF_YEAR', 'REGULAR']
      : ['START_OF_YEAR', 'END_OF_YEAR']

    const groupNorms = await prisma.groupNorm.findMany({
      where: {
        groupId: athlete.groupId,
        group: {
          schoolYear: academicYear,
        },
        period: {
          in: periodFilter as any,
        },
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            unit: true,
            direction: true,
          },
        },
        norms: {
          where: {
            athleteId, // Получаем только результаты этого ученика
          },
        },
      },
      orderBy: {
        testDate: 'asc',
      },
    })

    // Группируем нормативы по templateId и периоду
    const normsByTemplate = new Map<string, {
      startNorm?: typeof groupNorms[0]
      endNorm?: typeof groupNorms[0]
      intermediateNorms?: Array<typeof groupNorms[0]>
    }>()

    for (const groupNorm of groupNorms) {
      const key = groupNorm.templateId
      if (!normsByTemplate.has(key)) {
        normsByTemplate.set(key, {})
      }

      const entry = normsByTemplate.get(key)!
      if (groupNorm.period === 'START_OF_YEAR') {
        entry.startNorm = groupNorm
      } else if (groupNorm.period === 'END_OF_YEAR') {
        entry.endNorm = groupNorm
      } else if (groupNorm.period === 'REGULAR' && includeIntermediate) {
        if (!entry.intermediateNorms) {
          entry.intermediateNorms = []
        }
        entry.intermediateNorms.push(groupNorm)
      }
    }

    // Формируем отчёт для каждого шаблона норматива
    const normsReport: AthleteNormProgressReport['norms'] = []

    for (const [templateId, { startNorm, endNorm, intermediateNorms }] of normsByTemplate.entries()) {
      // Пропускаем шаблоны, для которых нет пары (начало или конец)
      if (!startNorm || !endNorm) {
        continue
      }

      const template = startNorm.template
      const normName = startNorm.nameOverride || template.name
      const normUnit = startNorm.unitOverride || template.unit

      // Получаем результат на начало года (должен быть только один, так как фильтруем по athleteId)
      const startNormResult = startNorm.norms.find(n => n.athleteId === athleteId)
      const startValue = startNormResult?.value ?? null
      const startDate = startNorm.testDate ? new Date(startNorm.testDate).toISOString().split('T')[0] : null

      // Получаем результат на конец года
      const endNormResult = endNorm.norms.find(n => n.athleteId === athleteId)
      const endValue = endNormResult?.value ?? null
      const endDate = endNorm.testDate ? new Date(endNorm.testDate).toISOString().split('T')[0] : null

      // Вычисляем delta (разница между концом и началом)
      let delta: number | null = null
      if (startValue !== null && endValue !== null) {
        delta = endValue - startValue
      }

      // Собираем промежуточные результаты (если запрошены)
      const intermediateResults: Array<{
        value: number | null
        date: string
        status: string
      }> = []

      if (includeIntermediate && intermediateNorms && startDate && endDate) {
        // Сортируем промежуточные нормативы по дате
        const sortedIntermediate = [...intermediateNorms].sort((a, b) => 
          a.testDate.getTime() - b.testDate.getTime()
        )

        // Фильтруем только те промежуточные нормативы, которые между началом и концом года
        const startDateObj = new Date(startDate)
        const endDateObj = new Date(endDate)

        for (const intermediateNorm of sortedIntermediate) {
          const normDate = new Date(intermediateNorm.testDate)
          
          // Включаем только нормативы, которые между началом и концом года
          if (normDate >= startDateObj && normDate <= endDateObj) {
            const intermediateResult = intermediateNorm.norms.find(n => n.athleteId === athleteId)
            if (intermediateResult) {
              intermediateResults.push({
                value: intermediateResult.value,
                date: intermediateNorm.testDate.toISOString().split('T')[0],
                status: intermediateResult.status,
              })
            }
          }
        }
      }

      normsReport.push({
        normId: startNorm.id, // ID норматива начала года для идентификации пары
        templateId,
        name: normName,
        unit: normUnit,
        direction: template.direction,
        startValue,
        endValue,
        delta,
        startDate,
        endDate,
        ...(includeIntermediate && intermediateResults.length > 0 ? { intermediateResults } : {}),
      })
    }

    // Формируем итоговый отчёт
    const report: AthleteNormProgressReport = {
      athlete: {
        id: athlete.id,
        fullName: athlete.fullName,
        groupName: athlete.group.name,
        academicYear,
      },
      norms: normsReport,
    }

    return NextResponse.json({ report })
  } catch (error: any) {
    console.error('Get athlete norms progress report error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

/**
 * TODO: Тесты для эндпоинта отчёта о прогрессе ученика
 * 
 * Unit/Integration тесты должны покрывать следующие сценарии:
 * 
 * 1. Успешное получение отчёта:
 *    - Ученик существует и принадлежит тренеру
 *    - Есть нормативы с периодом START_OF_YEAR и END_OF_YEAR для одного и того же шаблона
 *    - Для ученика есть результаты на начало и конец года
 *    - Delta вычисляется корректно (endValue - startValue)
 * 
 * 2. Обработка отсутствующих данных:
 *    - Ученик не сдавал норматив на начало года (startValue = null)
 *    - Ученик не сдавал норматив на конец года (endValue = null)
 *    - Оба значения null (delta = null)
 * 
 * 3. Фильтрация нормативов:
 *    - Пропускаются шаблоны, для которых нет пары (START_OF_YEAR или END_OF_YEAR отсутствует)
 *    - Учитываются только нормативы за указанный учебный год
 *    - Учитываются только результаты конкретного ученика
 * 
 * 4. Авторизация и доступ:
 *    - Тренер может получить отчёт только для своих учеников
 *    - Администратор может получить отчёт для любого ученика
 *    - Неавторизованный пользователь получает 403
 * 
 * 5. Параметры запроса:
 *    - Если year не указан, используется schoolYear группы ученика
 *    - Если year указан, используется он для фильтрации
 * 
 * 6. Граничные случаи:
 *    - Ученик без нормативов (пустой массив norms)
 *    - Ученик в группе без групповых нормативов начала/конца года
 *    - Все значения одинаковые (delta = 0 для всех)
 */
