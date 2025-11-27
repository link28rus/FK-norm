import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getGroupControlResults, GroupControlAggregatedResult, ControlResultEntry } from '@/lib/controlResults'

/**
 * Утилита для определения, какой результат лучше
 * @param direction - Направление норматива: 'LOWER_IS_BETTER' (время) или 'HIGHER_IS_BETTER' (метры, разы)
 * @param candidateValue - Кандидат на лучший результат
 * @param currentBestValue - Текущий лучший результат
 * @returns true, если candidateValue лучше currentBestValue
 */
function isBetterResult(direction: 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER', candidateValue: number, currentBestValue: number): boolean {
  if (direction === 'LOWER_IS_BETTER') {
    // Для времени: меньше значение = лучше результат
    return candidateValue < currentBestValue
  } else {
    // Для метров/количества: больше значение = лучше результат
    return candidateValue > currentBestValue
  }
}

interface BestByNormItem {
  templateId: string
  templateName: string
  studentId: string
  studentName: string
  value: number
}

interface TopProgressItem {
  studentId: string
  studentName: string
  templateId: string
  templateName: string
  startValue: number
  endValue: number
  progress: number // знак с учётом направления: положительное = улучшение
}

/**
 * GET - получить отчёт по лучшим результатам контрольных нормативов для группы
 * 
 * Возвращает:
 * - bestByNorm: лучший результат по каждому нормативу (шаблону)
 * - topProgress: топ прогресса учеников (у кого больше всего улучшение между началом и концом года)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const groupId = resolvedParams.groupId

    // Проверяем валидность groupId
    if (!groupId || typeof groupId !== 'string') {
      return NextResponse.json(
        { error: 'Неверный ID группы' },
        { status: 400 }
      )
    }

    // Проверяем права доступа
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

    // Проверяем доступ к группе
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
        { error: 'Группа не найдена или нет доступа' },
        { status: 404 }
      )
    }

    // Получаем query-параметры (schoolYear не используется напрямую, но можно передать)
    const { searchParams } = new URL(req.url)
    const schoolYear = searchParams.get('schoolYear')

    // Вызываем бизнес-логику для получения агрегированных результатов
    const aggregated = await getGroupControlResults(groupId, schoolYear || undefined)

    if (aggregated.length === 0) {
      return NextResponse.json({
        bestByNorm: [],
        topProgress: [],
      })
    }

    // Собираем уникальные ID учеников и шаблонов
    const studentIds = [...new Set(aggregated.map(a => a.studentId))]
    const templateIds = [...new Set(aggregated.map(a => a.templateId))]

    // Загружаем данные об учениках и шаблонах
    const students = await prisma.athlete.findMany({
      where: {
        id: { in: studentIds },
        isActive: true, // Только активные ученики
      },
      select: {
        id: true,
        fullName: true,
      },
    })

    const templates = await prisma.normTemplate.findMany({
      where: {
        id: { in: templateIds },
      },
      select: {
        id: true,
        name: true,
        direction: true, // LOWER_IS_BETTER или HIGHER_IS_BETTER
        unit: true,
      },
    })

    // Создаём Map для быстрого доступа
    const studentMap = new Map(students.map(s => [s.id, s]))
    const templateMap = new Map(templates.map(t => [t.id, t]))

    // Формируем bestByNorm: лучший результат по каждому нормативу
    const bestByNormMap = new Map<string, BestByNormItem>()

    for (const entry of aggregated) {
      // Пропускаем, если нет текущего результата
      if (!entry.current || entry.current.value === null) {
        continue
      }

      const student = studentMap.get(entry.studentId)
      const template = templateMap.get(entry.templateId)

      // Пропускаем, если не найдены ученик или шаблон
      if (!student || !template) {
        continue
      }

      const currentValue = entry.current.value
      const existingBest = bestByNormMap.get(entry.templateId)

      // Если для этого шаблона ещё нет лучшего результата или текущий результат лучше
      if (!existingBest || isBetterResult(template.direction as 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER', currentValue, existingBest.value)) {
        bestByNormMap.set(entry.templateId, {
          templateId: entry.templateId,
          templateName: template.name,
          studentId: entry.studentId,
          studentName: student.fullName,
          value: currentValue,
        })
      }
    }

    const bestByNorm = Array.from(bestByNormMap.values())

    // Формируем topProgress: топ прогресса между началом и концом года
    const topProgress: TopProgressItem[] = []

    for (const entry of aggregated) {
      // Пропускаем, если нет и start, и end
      if (!entry.start || !entry.end || entry.start.value === null || entry.end.value === null) {
        continue
      }

      const student = studentMap.get(entry.studentId)
      const template = templateMap.get(entry.templateId)

      // Пропускаем, если не найдены ученик или шаблон
      if (!student || !template) {
        continue
      }

      const startValue = entry.start.value
      const endValue = entry.end.value

      // Рассчитываем прогресс с учётом направления норматива
      let progress: number
      if (template.direction === 'LOWER_IS_BETTER') {
        // Для времени: прогресс = start - end (положительное = улучшение, т.к. время уменьшилось)
        progress = startValue - endValue
      } else {
        // Для метров/количества: прогресс = end - start (положительное = улучшение, т.к. значение увеличилось)
        progress = endValue - startValue
      }

      topProgress.push({
        studentId: entry.studentId,
        studentName: student.fullName,
        templateId: entry.templateId,
        templateName: template.name,
        startValue,
        endValue,
        progress,
      })
    }

    // Сортируем topProgress по прогрессу по убыванию (лучшие результаты сначала)
    topProgress.sort((a, b) => b.progress - a.progress)

    // Ограничиваем топ-20 (или возвращаем все, если меньше 20)
    const topProgressLimited = topProgress.slice(0, 20)

    return NextResponse.json({
      bestByNorm,
      topProgress: topProgressLimited,
    })
  } catch (error: any) {
    console.error('[control-best] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

