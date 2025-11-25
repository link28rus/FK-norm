/**
 * Извлекает класс группы из её названия
 * Ищет первую цифру в названии и использует её как школьный класс
 * 
 * Примеры:
 * - "2 П" → 2
 * - "4 А" → 4
 * - "6Б" → 6
 * - "3-спец" → 3
 * 
 * @param groupName - Название группы
 * @returns Класс (число) или null, если цифра не найдена
 */
export function extractClassFromGroupName(groupName: string | null | undefined): number | null {
  if (!groupName) {
    return null
  }

  // Ищем первую цифру в названии
  const match = groupName.match(/\d/)
  
  if (match && match[0]) {
    const classNumber = parseInt(match[0], 10)
    
    // Валидация: класс должен быть от 1 до 11
    if (classNumber >= 1 && classNumber <= 11) {
      return classNumber
    }
  }

  return null
}

/**
 * Проверяет, можно ли определить класс из названия группы
 * @param groupName - Название группы
 * @returns true, если класс можно определить, false - если нет
 */
export function canExtractClassFromGroupName(groupName: string | null | undefined): boolean {
  return extractClassFromGroupName(groupName) !== null
}



