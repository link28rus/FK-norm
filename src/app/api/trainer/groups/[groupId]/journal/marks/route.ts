import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// POST - создать или обновить оценку (автоматически создаёт Lesson, если его нет)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    console.log('[Marks POST] ========== START REQUEST ==========')
    console.log('[Marks POST] Request URL:', request.url)
    console.log('[Marks POST] Request method:', request.method)
    
    console.log('[Marks POST] Step 1: Processing params...')
    console.log('[Marks POST] Params type:', typeof params)
    
    if (!params) {
      console.error('[Marks POST] ERROR: params is null or undefined')
      return NextResponse.json(
        { error: 'Параметры не найдены' },
        { status: 400 }
      )
    }
    
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14)
    const resolvedParams = await Promise.resolve(params)
    console.log('[Marks POST] Resolved params:', JSON.stringify(resolvedParams))
    
    if (!resolvedParams || !resolvedParams.groupId) {
      console.error('[Marks POST] ERROR: resolvedParams or groupId is missing')
      return NextResponse.json(
        { error: 'Неверный параметр группы' },
        { status: 400 }
      )
    }
    
    const groupId = resolvedParams.groupId
    console.log('[Marks POST] ✓ GroupId extracted:', groupId)
    
    console.log('[Marks POST] Step 2: Getting current user...')
    const user = await getCurrentUser(request)
    console.log('[Marks POST] ✓ User retrieved:', { 
      id: user?.id, 
      role: user?.role,
      email: user?.email 
    })

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      console.error('[Marks POST] ERROR: Access denied - invalid user or role')
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    console.log('[Marks POST] Step 3: Getting trainer profile...')
    // Если ADMIN и нет TrainerProfile - создаём автоматически
    let profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })
    console.log('[Marks POST] Profile found:', profile ? { id: profile.id, fullName: profile.fullName } : 'null')

    if (user.role === 'ADMIN' && !profile) {
      console.log('[Marks POST] Creating admin profile...')
      try {
        profile = await prisma.trainerProfile.create({
          data: {
            userId: user.id,
            fullName: user.email.split('@')[0],
            phone: null,
          },
        })
        console.log('[Marks POST] ✓ Admin profile created:', { id: profile.id })
      } catch (profileError: any) {
        console.error('[Marks POST] ERROR creating admin profile:', profileError?.message)
        throw profileError
      }
    }

    if (!profile) {
      console.error('[Marks POST] ERROR: Profile not found for user:', user.id)
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      )
    }
    console.log('[Marks POST] ✓ Profile ready:', { id: profile.id })

    console.log('[Marks POST] Step 4: Getting group...')
    // Проверяем, что группа принадлежит этому тренеру (или ADMIN имеет доступ ко всем группам)
    const groupWhere = user.role === 'ADMIN'
      ? { id: groupId }
      : {
          id: groupId,
          trainerId: profile.id,
        }
    console.log('[Marks POST] Group query where:', JSON.stringify(groupWhere))
    
    const group = await prisma.group.findFirst({
      where: groupWhere,
    })
    console.log('[Marks POST] Group found:', group ? { id: group.id, name: group.name } : 'null')

    if (!group) {
      console.error('[Marks POST] ERROR: Group not found with params:', groupWhere)
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }
    console.log('[Marks POST] ✓ Group found:', { id: group.id })

    console.log('[Marks POST] Step 5: Parsing request body...')
    let body
    try {
      body = await request.json()
      console.log('[Marks POST] ✓ Body parsed:', { 
        hasDate: !!body.date,
        hasAthleteId: !!body.athleteId,
        hasCode: body.code !== undefined,
        hasCode2: body.code2 !== undefined,
        code: body.code,
        code2: body.code2
      })
    } catch (bodyError: any) {
      console.error('[Marks POST] ERROR: Failed to parse request body')
      console.error('[Marks POST] Body error:', bodyError?.message)
      return NextResponse.json(
        { error: 'Неверный формат данных запроса' },
        { status: 400 }
      )
    }
    
    const { date, athleteId, code, code2 } = body // Принимаем date, code и code2

    console.log('[Marks POST] Step 6: Validating request data...')
    if (!date || !athleteId) {
      console.error('[Marks POST] ERROR: Missing required fields:', { date: !!date, athleteId: !!athleteId })
      return NextResponse.json(
        { error: 'Дата и ID учащегося обязательны' },
        { status: 400 }
      )
    }
    console.log('[Marks POST] ✓ Required fields present:', { date, athleteId })

    console.log('[Marks POST] Step 7: Validating athlete...')
    // Проверяем, что учащийся принадлежит этой группе
    const athlete = await prisma.athlete.findFirst({
      where: {
        id: athleteId,
        groupId: groupId,
      },
    })
    console.log('[Marks POST] Athlete found:', athlete ? { id: athlete.id, fullName: athlete.fullName } : 'null')

    if (!athlete) {
      console.error('[Marks POST] ERROR: Athlete not found:', { athleteId, groupId })
      return NextResponse.json(
        { error: 'Учащийся не найден' },
        { status: 404 }
      )
    }
    console.log('[Marks POST] ✓ Athlete validated:', { id: athlete.id })

    console.log('[Marks POST] Step 8: Validating and normalizing codes...')
    // Валидация кода оценки
    const validCodes = ['Н/Ф', 'Н', 'Б', '2', '3', '4', '5', 'О', null, '']
    const normalizedCode = code === '' || code === null ? null : code
    console.log('[Marks POST] Code validation:', { 
      original: code, 
      normalized: normalizedCode, 
      isValid: normalizedCode === null || validCodes.includes(normalizedCode) 
    })
    
    if (normalizedCode !== null && !validCodes.includes(normalizedCode)) {
      console.error('[Marks POST] ERROR: Invalid code value:', normalizedCode)
      return NextResponse.json(
        { error: 'Недопустимое значение оценки' },
        { status: 400 }
      )
    }
    
    console.log('[Marks POST] Step 9: Normalizing date...')
    // Нормализуем дату (убираем время, оставляем только дату)
    // Важно: работаем с датой в локальной временной зоне, чтобы избежать смещения дня
    let lessonDate: Date
    let lessonDateEnd: Date
    try {
      // Парсим дату из строки формата YYYY-MM-DD
      // Создаем дату явно в локальной временной зоне, а не через new Date(date),
      // т.к. new Date('2025-11-04') интерпретирует строку как UTC, что может вызвать смещение
      const dateParts = date.split('-')
      if (dateParts.length !== 3) {
        throw new Error('Invalid date format')
      }
      const parsedYear = parseInt(dateParts[0], 10)
      const parsedMonth = parseInt(dateParts[1], 10) - 1 // month is 0-indexed
      const parsedDay = parseInt(dateParts[2], 10)
      
      // Создаем дату в локальной временной зоне (без смещения UTC)
      lessonDate = new Date(parsedYear, parsedMonth, parsedDay, 0, 0, 0, 0)
      console.log('[Marks POST] Date parsed:', { 
        original: date,
        year: parsedYear,
        month: parsedMonth + 1,
        day: parsedDay,
        parsedISO: lessonDate.toISOString(),
        parsedLocal: lessonDate.toString(),
        isValid: !isNaN(lessonDate.getTime()),
        getFullYear: lessonDate.getFullYear(),
        getMonth: lessonDate.getMonth() + 1,
        getDate: lessonDate.getDate()
      })
      
      // Проверяем, что дата корректно создана
      if (isNaN(lessonDate.getTime()) || 
          lessonDate.getFullYear() !== parsedYear || 
          lessonDate.getMonth() !== parsedMonth ||
          lessonDate.getDate() !== parsedDay) {
        console.error('[Marks POST] ERROR: Invalid date:', {
          date,
          parsedYear,
          parsedMonth: parsedMonth + 1,
          parsedDay,
          actualYear: lessonDate.getFullYear(),
          actualMonth: lessonDate.getMonth() + 1,
          actualDay: lessonDate.getDate()
        })
        return NextResponse.json(
          { error: 'Неверный формат даты' },
          { status: 400 }
        )
      }
      
      // Создаем диапазон для поиска урока (весь день) в локальной временной зоне
      lessonDateEnd = new Date(parsedYear, parsedMonth, parsedDay, 23, 59, 59, 999)
      console.log('[Marks POST] ✓ Date normalized:', {
        start: lessonDate.toISOString(),
        end: lessonDateEnd.toISOString()
      })
    } catch (dateError: any) {
      console.error('[Marks POST] ERROR: Failed to parse date:', dateError?.message)
      return NextResponse.json(
        { error: 'Неверный формат даты' },
        { status: 400 }
      )
    }

    console.log('[Marks POST] Step 10: Processing code2...')
    // Валидация второй оценки (если не передана, получаем существующее значение из БД)
    let normalizedCode2: string | null = null
    if (code2 !== undefined) {
      normalizedCode2 = code2 === '' || code2 === null ? null : code2
      console.log('[Marks POST] Code2 validation:', {
        original: code2,
        normalized: normalizedCode2,
        isValid: normalizedCode2 === null || validCodes.includes(normalizedCode2)
      })
      
      if (normalizedCode2 !== null && !validCodes.includes(normalizedCode2)) {
        console.error('[Marks POST] ERROR: Invalid code2 value:', normalizedCode2)
        return NextResponse.json(
          { error: 'Недопустимое значение второй оценки' },
          { status: 400 }
        )
      }
    } else {
      console.log('[Marks POST] Code2 not provided, fetching existing value from DB...')
      // Если code2 не передан, получаем существующее значение из БД
      try {
        const existingLesson = await prisma.lesson.findFirst({
          where: {
            groupId: groupId,
            date: {
              gte: lessonDate,
              lte: lessonDateEnd,
            },
          },
        })
        console.log('[Marks POST] Existing lesson found:', existingLesson ? { id: existingLesson.id } : 'null')
        
        if (existingLesson) {
          const existingMark = await prisma.lessonMark.findUnique({
            where: {
              lessonId_athleteId: {
                lessonId: existingLesson.id,
                athleteId,
              },
            },
          })
          console.log('[Marks POST] Existing mark found:', existingMark ? { id: existingMark.id } : 'null')
          
          // Безопасный доступ к code2 через any
          if (existingMark) {
            const markAny = existingMark as any
            normalizedCode2 = markAny.code2 ?? null
            console.log('[Marks POST] ✓ Code2 from existing mark:', normalizedCode2)
          }
        }
      } catch (code2Error: any) {
        console.error('[Marks POST] ERROR: Failed to fetch existing code2:', code2Error?.message)
        // Продолжаем с null, не прерываем выполнение
        normalizedCode2 = null
      }
    }
    console.log('[Marks POST] ✓ Code2 normalized:', normalizedCode2)

    console.log('[Marks POST] Step 11: Finding or creating lesson...')
    // Ищем существующий урок на эту дату для этой группы
    let lesson
    try {
      lesson = await prisma.lesson.findFirst({
        where: {
          groupId: groupId,
          date: {
            gte: lessonDate,
            lte: lessonDateEnd,
          },
        },
      })
      console.log('[Marks POST] Lesson found:', lesson ? { id: lesson.id, date: lesson.date.toISOString() } : 'null')

      // Если урока нет, создаём его автоматически
      if (!lesson) {
        console.log('[Marks POST] Creating new lesson...')
        lesson = await prisma.lesson.create({
          data: {
            groupId: groupId,
            date: lessonDate,
            topic: null,
            notes: null,
          },
        })
        console.log('[Marks POST] ✓ Lesson created:', { id: lesson.id })
      } else {
        console.log('[Marks POST] ✓ Using existing lesson:', { id: lesson.id })
      }
    } catch (lessonError: any) {
      console.error('[Marks POST] ERROR: Failed to find/create lesson')
      console.error('[Marks POST] Lesson error type:', lessonError?.constructor?.name)
      console.error('[Marks POST] Lesson error message:', lessonError?.message)
      console.error('[Marks POST] Lesson error stack:', lessonError?.stack)
      throw lessonError
    }

    console.log('[Marks POST] Step 12: Upserting lesson mark...')
    // Создаём или обновляем LessonMark
    let lessonMark
    try {
      const upsertData = {
        where: {
          lessonId_athleteId: {
            lessonId: lesson.id,
            athleteId,
          },
        },
        update: {
          code: normalizedCode,
          code2: normalizedCode2,
        },
        create: {
          lessonId: lesson.id,
          athleteId,
          code: normalizedCode,
          code2: normalizedCode2,
        },
      }
      console.log('[Marks POST] Upsert data:', {
        lessonId: upsertData.where.lessonId_athleteId.lessonId,
        athleteId: upsertData.where.lessonId_athleteId.athleteId,
        code: upsertData.update.code,
        code2: upsertData.update.code2
      })
      
      lessonMark = await prisma.lessonMark.upsert(upsertData)
      console.log('[Marks POST] ✓ Lesson mark upserted:', { id: lessonMark.id })
    } catch (markError: any) {
      console.error('[Marks POST] ERROR: Failed to upsert lesson mark')
      console.error('[Marks POST] Mark error type:', markError?.constructor?.name)
      console.error('[Marks POST] Mark error message:', markError?.message)
      console.error('[Marks POST] Mark error code:', markError?.code)
      console.error('[Marks POST] Mark error meta:', markError?.meta)
      console.error('[Marks POST] Mark error stack:', markError?.stack)
      throw markError
    }

    console.log('[Marks POST] Step 13: Building response...')
    const response = { success: true, lessonMark, lesson }
    console.log('[Marks POST] ✓ Response ready')
    console.log('[Marks POST] ========== SUCCESS ==========')
    
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[Marks POST] ========== ERROR ==========')
    console.error('[Marks POST] Error type:', error?.constructor?.name)
    console.error('[Marks POST] Error message:', error?.message)
    console.error('[Marks POST] Error stack:', error?.stack)
    console.error('[Marks POST] Error code:', error?.code)
    console.error('[Marks POST] Error meta:', error?.meta)
    console.error('[Marks POST] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    console.error('[Marks POST] ===========================')
    
    return NextResponse.json(
      { 
        error: 'Внутренняя ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    )
  }
}
