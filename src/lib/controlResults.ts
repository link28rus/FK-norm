import { prisma } from "@/lib/prisma";

/**
 * Период контрольного норматива
 * 
 * Соответствие enum NormPeriod в Prisma схеме (prisma/schema.prisma, строки 15-19):
 * - CONTROL_START → START_OF_YEAR → "Контрольный замер начала года"
 * - CONTROL_END → END_OF_YEAR → "Контрольный замер конца года"
 * 
 * Поле period хранится в модели GroupNorm (prisma/schema.prisma, строка 170).
 * Все результаты учеников (модель Norm), связанные с GroupNorm через groupNormId,
 * наследуют период группового норматива.
 */
export type ControlPeriod = "CONTROL_START" | "CONTROL_END";

/**
 * Запись результата контрольного норматива
 */
export interface ControlResultEntry {
  studentId: string;      // ID ученика (athleteId из модели Norm)
  templateId: string;     // ID шаблона норматива (templateId из модели Norm)
  period: ControlPeriod;  // Период: CONTROL_START (START_OF_YEAR) или CONTROL_END (END_OF_YEAR)
  value: number | null;   // Значение результата (value из модели Norm)
  date: Date;             // Дата замера (date из модели Norm)
  groupId: string;        // ID группы (для удобства агрегации)
}

/**
 * Агрегированный результат контрольных нормативов для одного ученика и одного шаблона
 */
export interface GroupControlAggregatedResult {
  studentId: string;
  templateId: string;
  current: ControlResultEntry | null;  // Текущий результат (конец года, если нет — начало)
  start: ControlResultEntry | null;    // Результат начала года
  end: ControlResultEntry | null;      // Результат конца года
}

/**
 * Получить агрегированные результаты контрольных нормативов для группы
 * 
 * Функция загружает все нормативы группы с периодом START_OF_YEAR и END_OF_YEAR,
 * группирует их по (studentId, templateId) и определяет текущий результат:
 * - Если есть результат конца года (END_OF_YEAR) → current = end
 * - Иначе, если есть результат начала года (START_OF_YEAR) → current = start
 * - Иначе пара (studentId, templateId) не включается в результат
 * 
 * @param groupId - ID группы
 * @param schoolYear - Учебный год группы (например, "2024/2025"). Если не указан, используется год из Group
 * @returns Массив агрегированных результатов для каждой пары (studentId, templateId)
 */
export async function getGroupControlResults(
  groupId: string,
  schoolYear?: string
): Promise<GroupControlAggregatedResult[]> {
  
  // Получаем группу для проверки существования и получения schoolYear, если не указан
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      schoolYear: true,
    },
  });

  if (!group) {
    throw new Error(`Группа с ID ${groupId} не найдена`);
  }

  // Загружаем все групповые нормативы для этой группы с периодами START_OF_YEAR и END_OF_YEAR
  // Используем raw SQL, так как Prisma может не знать о поле period
  const groupNorms = await prisma.$queryRaw<Array<{
    id: string;
    templateId: string;
    period: 'START_OF_YEAR' | 'END_OF_YEAR';
    groupId: string;
  }>>`
    SELECT 
      gn.id,
      gn."templateId",
      gn."period",
      gn."groupId"
    FROM "group_norms" gn
    WHERE gn."groupId" = ${groupId}::text
      AND gn."period" IN ('START_OF_YEAR', 'END_OF_YEAR')
  `;

  if (groupNorms.length === 0) {
    return [];
  }

  const groupNormIds = groupNorms.map(gn => gn.id);

  // Загружаем все результаты нормативов (Norm), связанные с найденными групповыми нормативами
  const norms = await prisma.norm.findMany({
    where: {
      groupNormId: { in: groupNormIds },
      value: { not: null }, // Только нормативы с заполненным значением
    },
    select: {
      id: true,
      athleteId: true,
      templateId: true,
      value: true,
      date: true,
      groupNormId: true,
    },
    orderBy: [
      { date: 'desc' }, // Более поздние результаты сначала
      { value: 'asc' },  // Если одинаковые даты, лучшие результаты (меньше значение для LOWER_IS_BETTER)
    ],
  });

  // Создаём Map для быстрого доступа к периоду по groupNormId
  const periodByGroupNormId = new Map<string, 'START_OF_YEAR' | 'END_OF_YEAR'>();
  const templateIdByGroupNormId = new Map<string, string>();
  
  for (const gn of groupNorms) {
    periodByGroupNormId.set(gn.id, gn.period);
    templateIdByGroupNormId.set(gn.id, gn.templateId);
  }

  // Преобразуем Norm в ControlResultEntry
  const controlResults: ControlResultEntry[] = norms
    .filter(norm => {
      const period = periodByGroupNormId.get(norm.groupNormId || '');
      const templateId = templateIdByGroupNormId.get(norm.groupNormId || '');
      return period && templateId && norm.value !== null;
    })
    .map(norm => {
      const period = periodByGroupNormId.get(norm.groupNormId || '')!;
      const templateId = templateIdByGroupNormId.get(norm.groupNormId || '')!;
      
      return {
        studentId: norm.athleteId,
        templateId: templateId, // Используем templateId из GroupNorm для консистентности
        period: period === 'START_OF_YEAR' ? 'CONTROL_START' : 'CONTROL_END',
        value: norm.value as number,
        date: norm.date,
        groupId: groupId,
      };
    });

  // Группируем результаты по (studentId, templateId)
  const groupedByStudentAndTemplate = new Map<string, {
    studentId: string;
    templateId: string;
    start: ControlResultEntry[];
    end: ControlResultEntry[];
  }>();

  for (const result of controlResults) {
    const key = `${result.studentId}:${result.templateId}`;
    
    if (!groupedByStudentAndTemplate.has(key)) {
      groupedByStudentAndTemplate.set(key, {
        studentId: result.studentId,
        templateId: result.templateId,
        start: [],
        end: [],
      });
    }

    const group = groupedByStudentAndTemplate.get(key)!;
    
    if (result.period === 'CONTROL_START') {
      group.start.push(result);
    } else {
      group.end.push(result);
    }
  }

  // Агрегируем результаты: выбираем лучший результат для каждого периода
  // Если несколько результатов, берём последний по дате (уже отсортированы по date desc)
  const aggregatedResults: GroupControlAggregatedResult[] = [];

  for (const [key, group] of groupedByStudentAndTemplate.entries()) {
    // Выбираем лучший результат начала года (последний по дате, если несколько)
    const start: ControlResultEntry | null = group.start.length > 0 
      ? group.start[0] // Первый элемент уже отсортирован по date desc
      : null;

    // Выбираем лучший результат конца года (последний по дате, если несколько)
    const end: ControlResultEntry | null = group.end.length > 0
      ? group.end[0] // Первый элемент уже отсортирован по date desc
      : null;

    // Определяем current: приоритет конца года, если нет — начало года
    const current: ControlResultEntry | null = end || start;

    // Включаем в результат только если есть хотя бы один результат
    if (current) {
      aggregatedResults.push({
        studentId: group.studentId,
        templateId: group.templateId,
        current,
        start,
        end,
      });
    }
  }

  return aggregatedResults;
}

