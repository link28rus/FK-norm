import { prisma } from '@/lib/prisma'
import { convertGenderToEnglish } from './genderConverter'

type Direction = 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER'

export interface CalcGradeParams {
  value: number        // результат ученика
  gender: 'MALE' | 'FEMALE' | string | null // Фактический пол ученика (для applicableGender === 'ALL')
  class: number        // 2, 3, 4 ...
  templateId: string
  groupNormId?: string
  applicableGender?: 'ALL' | 'MALE' | 'FEMALE' // Для кого норматив по полу (если указан, переопределяет пол для расчета)
}

/**
 * Рассчитывает оценку по нормативу на основе шаблона
 * @param params - Параметры для расчета оценки
 * @returns Оценка (5, 4, 3, 2) или null, если результат вне диапазонов
 */
export async function calcGrade(params: CalcGradeParams): Promise<number | null> {
  const { value, gender: athleteGenderParam, class: classValue, templateId, groupNormId, applicableGender } = params

  try {
    // Определяем пол для расчета границ оценок
    // Если applicableGender === 'MALE' или 'FEMALE', всегда используем его (независимо от пола ученика)
    // Если applicableGender === 'ALL' или не указан, используем фактический пол ученика
    let genderForBoundaries: 'MALE' | 'FEMALE' | null = null

    if (applicableGender === 'MALE') {
      // Норматив только для мальчиков - всегда используем мужские границы
      genderForBoundaries = 'MALE'
    } else if (applicableGender === 'FEMALE') {
      // Норматив только для девочек - всегда используем женские границы
      genderForBoundaries = 'FEMALE'
    } else {
      // applicableGender === 'ALL' или не указан - используем фактический пол ученика
      const athleteGender = convertGenderToEnglish(athleteGenderParam)
      genderForBoundaries = athleteGender
    }

    if (!genderForBoundaries) {
      console.warn('[calcGrade] Gender not provided or invalid:', {
        athleteGender: athleteGenderParam,
        applicableGender,
        genderForBoundaries,
      })
      return null
    }

    const gender = genderForBoundaries // Используем для поиска границ
    // 1. Если есть groupNormId, проверить, использует ли он кастомные границы
    let boundaries: Array<{
      grade: number
      fromValue: number
      toValue: number
    }> = []

    if (groupNormId) {
      const groupNorm = await prisma.groupNorm.findUnique({
        where: { id: groupNormId },
        include: {
          boundaries: true,
        },
      })

      if (groupNorm) {
        if (groupNorm.useCustomBoundaries) {
          // Используем кастомные границы
          boundaries = groupNorm.boundaries
            .filter(b => b.gender === gender && b.class === classValue)
            .map(b => ({
              grade: b.grade,
              fromValue: b.fromValue,
              toValue: b.toValue,
            }))
        } else {
          // Используем границы из шаблона
          const templateBoundaries = await prisma.normTemplateBoundary.findMany({
            where: {
              templateId: groupNorm.templateId,
              gender,
              class: classValue,
            },
          })
          boundaries = templateBoundaries.map(b => ({
            grade: b.grade,
            fromValue: b.fromValue,
            toValue: b.toValue,
          }))
        }
      }
    } else {
      // Используем только границы из шаблона
      const templateBoundaries = await prisma.normTemplateBoundary.findMany({
        where: {
          templateId,
          gender,
          class: classValue,
        },
      })
      boundaries = templateBoundaries.map(b => ({
        grade: b.grade,
        fromValue: b.fromValue,
        toValue: b.toValue,
      }))
    }

    if (boundaries.length === 0) {
      console.warn('[calcGrade] No boundaries found for:', {
        templateId,
        gender,
        class: classValue,
        groupNormId,
        applicableGender,
        athleteGender: athleteGenderParam,
      })
      return null
    }

    console.log('[calcGrade] Found boundaries:', {
      count: boundaries.length,
      boundaries: boundaries.map(b => ({
        grade: b.grade,
        fromValue: b.fromValue,
        toValue: b.toValue,
      })),
      value,
      templateId,
      gender, // Пол, использованный для поиска границ
      class: classValue,
      groupNormId,
      applicableGender, // Для кого норматив по полу
      athleteGender: athleteGenderParam, // Фактический пол ученика
    })

    // Получаем шаблон для определения направления
    const template = await prisma.normTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      console.warn('[calcGrade] Template not found:', templateId)
      return null
    }

    // Сортируем границы по оценке (от лучшей к худшей: 5, 4, 3, 2)
    boundaries.sort((a, b) => b.grade - a.grade)

    console.log('[calcGrade] Template direction:', template.direction)
    console.log('[calcGrade] Sorted boundaries:', boundaries)

    if (template.direction === 'LOWER_IS_BETTER') {
      // Чем меньше, тем лучше (время, секунды)
      // Для времени используются включительные интервалы: [fromValue, toValue]
      // То есть fromValue <= значение <= toValue
      // Значение, равное верхней границе "До", относится к этому диапазону
      
      // Проверяем каждый диапазон в порядке от лучшей оценки к худшей (5, 4, 3, 2)
      for (const boundary of boundaries) {
        const fromValue = boundary.fromValue
        const toValue = boundary.toValue
        
        // Проверяем: fromValue <= value <= toValue (обе границы включительно)
        // Используем точное сравнение для чисел с плавающей точкой
        if (value >= fromValue && value <= toValue) {
          console.log('[calcGrade] Found matching boundary for LOWER_IS_BETTER:', {
            value,
            fromValue,
            toValue,
            grade: boundary.grade,
            condition: `${fromValue} <= ${value} <= ${toValue}`,
          })
          return boundary.grade
        }
      }
      
      // Если значение меньше минимального fromValue -> лучшая оценка (5)
      const bestBoundary = boundaries[0]
      if (bestBoundary.fromValue > 0 && value < bestBoundary.fromValue) {
        console.log('[calcGrade] Value better than best boundary:', {
          value,
          bestFromValue: bestBoundary.fromValue,
          grade: bestBoundary.grade,
        })
        return bestBoundary.grade
      }
      
      // Если значение больше максимального toValue -> минимальная оценка (2)
      const worstBoundary = boundaries[boundaries.length - 1]
      const worstToValue = worstBoundary.toValue
      if (value > worstToValue) {
        console.log('[calcGrade] Value worse than worst boundary:', {
          value,
          worstToValue,
          grade: 2,
        })
        return 2
      }
      
      // Если значение не попало ни в один диапазон, но находится в пределах всех границ
      // Это не должно произойти при правильных границах, но на всякий случай
      console.warn('[calcGrade] Value not found in any boundary for LOWER_IS_BETTER:', {
        value,
        boundaries,
      })
      return 2 // Минимальная оценка по умолчанию
    } else {
      // HIGHER_IS_BETTER - чем больше, тем лучше (метры, количество)
      // Для метров/количества: fromValue <= значение <= toValue (обе границы включительно)
      
      // Проверяем каждый диапазон
      for (const boundary of boundaries) {
        const fromValue = boundary.fromValue
        const toValue = boundary.toValue || Infinity
        
        // Проверяем: fromValue <= value <= toValue
        if (value >= fromValue && value <= toValue) {
          console.log('[calcGrade] Found matching boundary for HIGHER_IS_BETTER:', {
            value,
            fromValue,
            toValue,
            grade: boundary.grade,
          })
          return boundary.grade
        }
      }
      
      // Если значение больше максимального toValue -> лучшая оценка
      const bestBoundary = boundaries[0]
      const bestToValue = bestBoundary.toValue || Infinity
      if (value > bestToValue) {
        console.log('[calcGrade] Value better than best boundary:', {
          value,
          bestToValue,
          grade: bestBoundary.grade,
        })
        return bestBoundary.grade
      }
      
      // Если значение меньше минимального fromValue -> минимальная оценка (2)
      const worstBoundary = boundaries[boundaries.length - 1]
      if (value < worstBoundary.fromValue) {
        console.log('[calcGrade] Value worse than worst boundary:', {
          value,
          worstFromValue: worstBoundary.fromValue,
          grade: 2,
        })
        return 2
      }
      
      console.warn('[calcGrade] Value not found in any boundary for HIGHER_IS_BETTER:', {
        value,
        boundaries,
      })
      return 2 // Минимальная оценка по умолчанию
    }
  } catch (error: any) {
    console.error('[calcGrade] Error calculating grade:', error)
    return null
  }
}

/**
 * Конвертирует числовую оценку в строковое представление
 * @param grade - Оценка (5, 4, 3, 2) или null
 * @returns Строковое представление ("5", "4", "3", "2" или "-")
 */
export function gradeToString(grade: number | null): string {
  if (grade === null) return '-'
  return String(grade)
}

