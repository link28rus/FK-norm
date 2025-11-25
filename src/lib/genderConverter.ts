/**
 * Преобразует пол из русского формата (М/Ж) в английский (MALE/FEMALE)
 */
export function convertGenderToEnglish(gender: string | null | undefined): 'MALE' | 'FEMALE' | null {
  if (!gender) return null
  
  const normalized = gender.trim().toUpperCase()
  
  if (normalized === 'М' || normalized === 'M' || normalized === 'MALE' || normalized === 'МУЖ') {
    return 'MALE'
  }
  
  if (normalized === 'Ж' || normalized === 'F' || normalized === 'FEMALE' || normalized === 'ЖЕН') {
    return 'FEMALE'
  }
  
  return null
}

/**
 * Преобразует пол из английского формата (MALE/FEMALE) в русский (М/Ж)
 */
export function convertGenderToRussian(gender: string | null | undefined): 'М' | 'Ж' | null {
  if (!gender) return null
  
  const normalized = gender.trim().toUpperCase()
  
  if (normalized === 'MALE' || normalized === 'М' || normalized === 'M' || normalized === 'МУЖ') {
    return 'М'
  }
  
  if (normalized === 'FEMALE' || normalized === 'Ж' || normalized === 'F' || normalized === 'ЖЕН') {
    return 'Ж'
  }
  
  return null
}



