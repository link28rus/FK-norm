import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getGroupControlResults, ControlResultEntry } from '@/lib/controlResults'

interface GroupStatAgg {
  sum: number
  count: number
  bestValue: number | null
  bestStudentId: string | null
}

interface GroupStatItem {
  groupId: string
  groupName: string
  templateId: string
  templateName: string
  avgValue: number
  bestValue: number
  bestStudentId: string
  bestStudentName: string
}

interface ParallelTopProgressItem {
  groupId: string
  groupName: string
  studentId: string
  studentName: string
  templateId: string
  templateName: string
  startValue: number
  endValue: number
  progress: number
}

/**
 * Утилита для определения, какой результат лучше
 * @param direction - Направление норматива: 'LOWER_IS_BETTER' (время) или 'HIGHER_IS_BETTER' (метры, разы)
 * @param candidateValue - Кандидат на лучший результат
 * @param currentBestValue - Текущий лучший результат
 * @returns true, если candidateValue лучше currentBestValue
 */
function isBetterResult(
  direction: 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER',
  candidateValue: number,
  currentBestValue: number
): boolean {
  if (direction === 'LOWER_IS_BETTER') {
    // Для времени: меньше значение = лучше результат
    return candidateValue < currentBestValue
  } else {
    // Для метров/количества: больше значение = лучше результат
    return candidateValue > currentBestValue
  }
}

/**
 * GET - получить отчёт по лучшим результатам контрольных нормативов для параллели (класса)
 * 
 * Сравнивает несколько групп одного класса (например, 2А, 2Б, 2В) между собой:
 * - groupStats: статистика по каждой группе для каждого норматива (среднее значение, лучший результат)
 * - topProgress: топ прогресса учеников по всей параллели
 * 
 * @param grade - Номер класса (2, 3, 4 и т.д.)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ grade: string }> | { grade: string } }
) {
  try {
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14/15)
    const resolvedParams = await Promise.resolve(params)
    const grade = resolvedParams.grade

    // Приводим grade к числу и проверяем валидность
    const gradeNumber = parseInt(grade, 10)
    if (isNaN(gradeNumber) || gradeNumber < 1 || gradeNumber > 11) {
      return NextResponse.json(
        { error: 'Неверный номер класса. Ожидается число от 1 до 11' },
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

    // Получаем query-параметры
    const { searchParams } = new URL(req.url)
    const schoolYear = searchParams.get('schoolYear')

    // Находим все группы указанного класса, к которым тренер имеет доступ
    const groups = await prisma.group.findMany({
      where: user.role === 'ADMIN'
        ? {
            class: gradeNumber,
          }
        : {
            class: gradeNumber,
            trainerId: profile.id,
          },
      select: {
        id: true,
        name: true,
        class: true,
        schoolYear: true,
      },
      orderBy: {
        name: 'asc', // Сортируем по названию группы (2А, 2Б, 2В и т.д.)
      },
    })

    // Если групп нет, возвращаем пустые результаты
    if (groups.length === 0) {
      return NextResponse.json({
        groupStats: [],
        topProgress: [],
      })
    }

    // Собираем агрегированные результаты по всем группам
    const allAggregated: Array<{
      groupId: string
      groupName: string
      studentId: string
      templateId: string
      start?: ControlResultEntry | null
      end?: ControlResultEntry | null
      current: ControlResultEntry | null
    }> = []

    // Map для быстрого доступа к названию группы по ID
    const groupNameMap = new Map<string, string>()
    for (const group of groups) {
      groupNameMap.set(group.id, group.name)
    }

    // Собираем результаты для каждой группы
    for (const group of groups) {
      // Используем schoolYear из query или из группы
      const targetSchoolYear = schoolYear || group.schoolYear || undefined
      
      const aggregatedForGroup = await getGroupControlResults(group.id, targetSchoolYear)

      for (const entry of aggregatedForGroup) {
        if (entry.current) {
          allAggregated.push({
            groupId: group.id,
            groupName: group.name,
            studentId: entry.studentId,
            templateId: entry.templateId,
            start: entry.start,
            end: entry.end,
            current: entry.current,
          })
        }
      }
    }

    // Если нет агрегированных результатов, возвращаем пустые массивы
    if (allAggregated.length === 0) {
      return NextResponse.json({
        groupStats: [],
        topProgress: [],
      })
    }

    // Собираем уникальные ID учеников и шаблонов
    const studentIds = [...new Set(allAggregated.map(a => a.studentId))]
    const templateIds = [...new Set(allAggregated.map(a => a.templateId))]

    // Загружаем данные об учениках и шаблонах одним запросом
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
      },
    })

    // Создаём Map для быстрого доступа
    const studentMap = new Map(students.map(s => [s.id, s]))
    const templateMap = new Map(templates.map(t => [t.id, t]))

    // Расчёт groupStats: сравнение групп по нормативам
    const statsByGroupAndTemplate = new Map<string, GroupStatAgg>()
    const groupTemplateInfo = new Map<string, { groupId: string; groupName: string; templateId: string }>()

    for (const entry of allAggregated) {
      if (!entry.current || entry.current.value === null) {
        continue
      }

      const template = templateMap.get(entry.templateId)
      if (!template) {
        continue
      }

      const key = `${entry.groupId}_${entry.templateId}`
      const currentValue = entry.current.value

      // Сохраняем информацию о группе и шаблоне
      if (!groupTemplateInfo.has(key)) {
        groupTemplateInfo.set(key, {
          groupId: entry.groupId,
          groupName: entry.groupName,
          templateId: entry.templateId,
        })
      }

      // Инициализируем статистику, если её ещё нет
      if (!statsByGroupAndTemplate.has(key)) {
        statsByGroupAndTemplate.set(key, {
          sum: 0,
          count: 0,
          bestValue: null,
          bestStudentId: null,
        })
      }

      const stat = statsByGroupAndTemplate.get(key)!

      // Накапливаем сумму и счётчик для среднего
      stat.sum += currentValue
      stat.count += 1

      // Обновляем лучший результат
      if (
        stat.bestValue === null ||
        isBetterResult(
          template.direction as 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER',
          currentValue,
          stat.bestValue
        )
      ) {
        stat.bestValue = currentValue
        stat.bestStudentId = entry.studentId
      }
    }

    // Формируем массив groupStats
    const groupStats: GroupStatItem[] = []

    for (const [key, stat] of statsByGroupAndTemplate.entries()) {
      const info = groupTemplateInfo.get(key)
      if (!info) {
        continue
      }

      const template = templateMap.get(info.templateId)
      const bestStudent = stat.bestStudentId ? studentMap.get(stat.bestStudentId) : null

      if (!template || !bestStudent || stat.bestValue === null || stat.count === 0) {
        continue
      }

      groupStats.push({
        groupId: info.groupId,
        groupName: info.groupName,
        templateId: info.templateId,
        templateName: template.name,
        avgValue: stat.sum / stat.count,
        bestValue: stat.bestValue,
        bestStudentId: stat.bestStudentId!,
        bestStudentName: bestStudent.fullName,
      })
    }

    // Сортируем groupStats по названию группы и шаблона для удобства
    groupStats.sort((a, b) => {
      if (a.groupName !== b.groupName) {
        return a.groupName.localeCompare(b.groupName)
      }
      return a.templateName.localeCompare(b.templateName)
    })

    // Расчёт topProgress по всей параллели
    const topProgress: ParallelTopProgressItem[] = []

    for (const entry of allAggregated) {
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
        groupId: entry.groupId,
        groupName: entry.groupName,
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

    // Ограничиваем топ-50
    const topProgressLimited = topProgress.slice(0, 50)

    return NextResponse.json({
      groupStats,
      topProgress: topProgressLimited,
    })
  } catch (error: any) {
    console.error('[grades-control-best] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

