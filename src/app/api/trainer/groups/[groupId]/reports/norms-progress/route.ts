import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * Тип для отчёта о прогрессе группы по нормативам
 */
type GroupProgressReport = {
  group: {
    id: string
    name: string
    academicYear: string
  }
  norms: Array<{
    normId: string // ID GroupNorm для начала года (для идентификации пары)
    templateId: string
    name: string
    unit: string | null
    direction: string // "LOWER_IS_BETTER" | "HIGHER_IS_BETTER"
    results: Array<{
      athleteId: string
      fullName: string
      startValue: number | null
      endValue: number | null
      delta: number | null // endValue - startValue
    }>
    summary: {
      improvedCount: number
      worsenedCount: number
      sameCount: number
      noDataCount: number // Ученики без данных на начало или конец
    }
  }>
}

/**
 * GET - получить отчёт о прогрессе группы по нормативам за учебный год
 * 
 * Эндпоинт сопоставляет результаты нормативов на начало и конец учебного года
 * для каждого ученика и каждого норматива, вычисляет разницу и статистику.
 * 
 * Query параметры:
 * - year (опционально) - учебный год в формате "YYYY/YYYY" (например, "2024/2025").
 *   Если не указан, используется учебный год группы.
 * 
 * Возвращает:
 * - Информацию о группе
 * - Для каждого норматива: результаты всех учеников, сравнение начала и конца года,
 *   статистику (сколько улучшили/ухудшили/без изменений)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const { groupId } = resolvedParams

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

    // Получаем группу и проверяем доступ
    const group = await prisma.group.findFirst({
      where: user.role === 'ADMIN'
        ? { id: groupId }
        : {
            id: groupId,
            trainerId: profile.id,
          },
      include: {
        athletes: {
          orderBy: { fullName: 'asc' },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    // Определяем учебный год
    const { searchParams } = new URL(request.url)
    const requestedYear = searchParams.get('year')
    const academicYear = requestedYear || group.schoolYear

    // Получаем все групповые нормативы для этой группы за указанный учебный год
    // Нас интересуют только нормативы с периодом START_OF_YEAR и END_OF_YEAR
    const groupNorms = await prisma.groupNorm.findMany({
      where: {
        groupId,
        group: {
          schoolYear: academicYear,
        },
        period: {
          in: ['START_OF_YEAR', 'END_OF_YEAR'],
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
          include: {
            athlete: {
              select: {
                id: true,
                fullName: true,
              },
            },
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
      }
    }

    // Формируем отчёт для каждого шаблона норматива
    const normsReport: GroupProgressReport['norms'] = []

    for (const [templateId, { startNorm, endNorm }] of normsByTemplate.entries()) {
      // Пропускаем шаблоны, для которых нет пары (начало или конец)
      if (!startNorm || !endNorm) {
        continue
      }

      const template = startNorm.template
      const normName = startNorm.nameOverride || template.name
      const normUnit = startNorm.unitOverride || template.unit

      // Создаём мапу результатов для быстрого поиска
      const startResults = new Map<string, number | null>()
      const endResults = new Map<string, number | null>()

      for (const norm of startNorm.norms) {
        startResults.set(norm.athleteId, norm.value)
      }

      for (const norm of endNorm.norms) {
        endResults.set(norm.athleteId, norm.value)
      }

      // Формируем результаты для всех учеников группы
      const results: GroupProgressReport['norms'][0]['results'] = []

      for (const athlete of group.athletes) {
        const startValue = startResults.get(athlete.id) ?? null
        const endValue = endResults.get(athlete.id) ?? null

        // Вычисляем delta (разница между концом и началом)
        let delta: number | null = null
        if (startValue !== null && endValue !== null) {
          delta = endValue - startValue
        }

        results.push({
          athleteId: athlete.id,
          fullName: athlete.fullName,
          startValue,
          endValue,
          delta,
        })
      }

      // Вычисляем статистику (improved, worsened, same, noData)
      let improvedCount = 0
      let worsenedCount = 0
      let sameCount = 0
      let noDataCount = 0

      for (const result of results) {
        // Если нет данных на начало или конец - считаем как noData
        if (result.startValue === null || result.endValue === null || result.delta === null) {
          noDataCount++
          continue
        }

        // Определяем, улучшил ли ученик результат
        // Для LOWER_IS_BETTER (бег, время) - улучшение = отрицательная delta (меньше времени = лучше)
        // Для HIGHER_IS_BETTER (прыжки, подтягивания) - улучшение = положительная delta (больше = лучше)
        if (template.direction === 'LOWER_IS_BETTER') {
          if (result.delta < 0) {
            improvedCount++ // Улучшил (уменьшил время)
          } else if (result.delta > 0) {
            worsenedCount++ // Ухудшил (увеличил время)
          } else {
            sameCount++ // Без изменений (delta = 0)
          }
        } else if (template.direction === 'HIGHER_IS_BETTER') {
          if (result.delta > 0) {
            improvedCount++ // Улучшил (увеличил результат)
          } else if (result.delta < 0) {
            worsenedCount++ // Ухудшил (уменьшил результат)
          } else {
            sameCount++ // Без изменений (delta = 0)
          }
        } else {
          // Если direction неизвестен или имеет другое значение, считаем по абсолютному значению
          // В этом случае лучше оставить без изменений, но для безопасности считаем любое изменение
          if (result.delta === 0) {
            sameCount++
          } else {
            // Если direction неизвестен, не можем определить улучшение/ухудшение
            // Считаем как noData или same (на усмотрение, сейчас как noData)
            noDataCount++
          }
        }
      }

      normsReport.push({
        normId: startNorm.id, // ID норматива начала года для идентификации пары
        templateId,
        name: normName,
        unit: normUnit,
        direction: template.direction,
        results,
        summary: {
          improvedCount,
          worsenedCount,
          sameCount,
          noDataCount,
        },
      })
    }

    // Формируем итоговый отчёт
    const report: GroupProgressReport = {
      group: {
        id: group.id,
        name: group.name,
        academicYear,
      },
      norms: normsReport,
    }

    return NextResponse.json({ report })
  } catch (error: any) {
    console.error('Get norms progress report error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

/**
 * TODO: Тесты для эндпоинта отчёта о прогрессе
 * 
 * Unit/Integration тесты должны покрывать следующие сценарии:
 * 
 * 1. Успешное получение отчёта:
 *    - Группа существует и принадлежит тренеру
 *    - Есть нормативы с периодом START_OF_YEAR и END_OF_YEAR для одного и того же шаблона
 *    - Для всех учеников есть результаты на начало и конец года
 *    - Delta вычисляется корректно (endValue - startValue)
 *    - Summary подсчитывается правильно (improved, worsened, same, noData)
 * 
 * 2. Учёт направления норматива (direction):
 *    - Для LOWER_IS_BETTER: улучшение = отрицательная delta
 *    - Для HIGHER_IS_BETTER: улучшение = положительная delta
 * 
 * 3. Обработка отсутствующих данных:
 *    - Ученик не сдавал норматив на начало года (startValue = null)
 *    - Ученик не сдавал норматив на конец года (endValue = null)
 *    - Оба значения null (noDataCount увеличивается)
 * 
 * 4. Фильтрация нормативов:
 *    - Пропускаются шаблоны, для которых нет пары (START_OF_YEAR или END_OF_YEAR отсутствует)
 *    - Учитываются только нормативы за указанный учебный год
 * 
 * 5. Авторизация и доступ:
 *    - Тренер может получить отчёт только для своих групп
 *    - Администратор может получить отчёт для любой группы
 *    - Неавторизованный пользователь получает 403
 * 
 * 6. Параметры запроса:
 *    - Если year не указан, используется schoolYear группы
 *    - Если year указан, используется он для фильтрации
 * 
 * 7. Граничные случаи:
 *    - Группа без учеников (пустой массив results)
 *    - Группа без нормативов (пустой массив norms)
 *    - Все значения одинаковые (delta = 0 для всех)
 *    - Все значения улучшились/ухудшились
 */

