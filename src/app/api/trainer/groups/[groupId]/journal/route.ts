import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - получить данные журнала за месяц (по дням)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> | { groupId: string } }
) {
  try {
    console.log('[Journal GET] ========== START REQUEST ==========')
    console.log('[Journal GET] Request URL:', request.url)
    console.log('[Journal GET] Request method:', request.method)
    
    // Обрабатываем params как Promise или обычный объект (для совместимости с Next.js 14)
    console.log('[Journal GET] Step 1: Processing params...')
    console.log('[Journal GET] Params type:', typeof params)
    console.log('[Journal GET] Params value:', params)
    
    if (!params) {
      console.error('[Journal GET] ERROR: params is null or undefined')
      return NextResponse.json(
        { error: 'Параметры не найдены' },
        { status: 400 }
      )
    }
    
    console.log('[Journal GET] Resolving params promise...')
    const resolvedParams = await Promise.resolve(params)
    console.log('[Journal GET] Resolved params:', JSON.stringify(resolvedParams))
    
    if (!resolvedParams || !resolvedParams.groupId) {
      console.error('[Journal GET] ERROR: resolvedParams or groupId is missing')
      console.error('[Journal GET] resolvedParams:', resolvedParams)
      return NextResponse.json(
        { error: 'Неверный параметр группы' },
        { status: 400 }
      )
    }
    const groupId = resolvedParams.groupId
    console.log('[Journal GET] ✓ GroupId extracted:', groupId)
    
    console.log('[Journal GET] Step 2: Getting current user...')
    const user = await getCurrentUser(request)
    console.log('[Journal GET] ✓ User retrieved:', { 
      id: user?.id, 
      role: user?.role,
      email: user?.email 
    })

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      console.error('[Journal GET] ERROR: Access denied - invalid user or role')
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    console.log('[Journal GET] Step 3: Getting trainer profile...')
    // Если ADMIN и нет TrainerProfile - создаём автоматически
    let profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })
    console.log('[Journal GET] Profile found:', profile ? { id: profile.id, fullName: profile.fullName } : 'null')

    if (user.role === 'ADMIN' && !profile) {
      console.log('[Journal GET] Creating admin profile...')
      try {
        profile = await prisma.trainerProfile.create({
          data: {
            userId: user.id,
            fullName: user.email.split('@')[0],
            phone: null,
          },
        })
        console.log('[Journal GET] ✓ Admin profile created:', { id: profile.id })
      } catch (profileError: any) {
        console.error('[Journal GET] ERROR creating admin profile:', profileError?.message)
        throw profileError
      }
    }

    if (!profile) {
      console.error('[Journal GET] ERROR: Profile not found for user:', user.id)
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      )
    }
    console.log('[Journal GET] ✓ Profile ready:', { id: profile.id, trainerId: profile.id })

    console.log('[Journal GET] Step 4: Getting group...')
    // Проверяем, что группа принадлежит этому тренеру (или ADMIN имеет доступ ко всем группам)
    const groupWhere = user.role === 'ADMIN'
      ? { id: groupId }
      : {
          id: groupId,
          trainerId: profile.id,
        }
    console.log('[Journal GET] Group query where clause:', JSON.stringify(groupWhere))
    
    try {
      const group = await prisma.group.findFirst({
        where: groupWhere,
      })
      console.log('[Journal GET] Group query result:', group ? { id: group.id, name: group.name, trainerId: group.trainerId } : 'null')

      if (!group) {
        console.error('[Journal GET] ERROR: Group not found with params:', groupWhere)
        return NextResponse.json(
          { error: 'Группа не найдена' },
          { status: 404 }
        )
      }
      console.log('[Journal GET] ✓ Group found:', { id: group.id, name: group.name })

      const { searchParams } = new URL(request.url)
      console.log('[Journal GET] Step 5: Parsing query parameters...')
      console.log('[Journal GET] Search params:', Object.fromEntries(searchParams.entries()))
      
      const year = parseInt(searchParams.get('year') || '')
      const month = parseInt(searchParams.get('month') || '') // 1-12
      console.log('[Journal GET] Parsed year:', year, '(valid:', !isNaN(year), ')')
      console.log('[Journal GET] Parsed month:', month, '(valid:', !isNaN(month), ')')

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        console.error('[Journal GET] ERROR: Invalid year or month:', { year, month })
        return NextResponse.json(
          { error: 'Неверный год или месяц' },
          { status: 400 }
        )
      }

      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59) // Последний день месяца
      console.log('[Journal GET] ✓ Date range calculated:', {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        startTimestamp: startDate.getTime(),
        endTimestamp: endDate.getTime()
      })

      // Получаем учащихся группы
      console.log('[Journal GET] Step 6: Fetching athletes...')
      console.log('[Journal GET] Athletes query where:', { groupId })
      
      // Объявляем переменные снаружи try-блоков для доступа в дальнейшем коде
      let athletes: Array<{
        id: string
        groupId: string
        fullName: string
        birthDate: Date | null
        gender: string | null
        notes: string | null
        schoolYear: string
        isActive: boolean
        exitDate: Date | null
        createdAt: Date
      }> = []
      
      let lessons: Array<{
        id: string
        date: Date
        topic: string | null
        groupId: string
        lessonMarks: Array<{
          id: string
          lessonId: string
          athleteId: string
          code: string | null
          code2: string | null
        }>
      }> = []
      
      try {
        // Загружаем всех учеников (активных и выбывших) для корректного отображения в месяце выбытия
        athletes = await prisma.athlete.findMany({
          where: { 
            groupId: groupId,
          },
          select: {
            id: true,
            groupId: true,
            fullName: true,
            birthDate: true,
            gender: true,
            notes: true,
            schoolYear: true,
            isActive: true,
            exitDate: true,
            createdAt: true,
          },
          orderBy: { fullName: 'asc' },
        })
        console.log('[Journal GET] ✓ Athletes found:', athletes.length)
        console.log('[Journal GET] Athletes IDs:', athletes.map(a => a.id).join(', '))

        // Получаем все уроки за месяц
        console.log('[Journal GET] Step 7: Fetching lessons...')
        const lessonsWhere = {
          groupId: groupId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        }
        console.log('[Journal GET] Lessons query where:', JSON.stringify({
          groupId,
          date: {
            gte: startDate.toISOString(),
            lte: endDate.toISOString(),
          }
        }))
        
        try {
          const fetchedLessons = await prisma.lesson.findMany({
            where: lessonsWhere,
            include: {
              lessonMarks: true,
            },
          })
          console.log('[Journal GET] ✓ Raw lessons fetched from DB:', fetchedLessons.length)
          console.log('[Journal GET] First lesson sample:', fetchedLessons.length > 0 ? {
            id: fetchedLessons[0].id,
            date: fetchedLessons[0].date?.toISOString(),
            marksCount: fetchedLessons[0].lessonMarks?.length
          } : 'none')
          
          lessons = fetchedLessons as typeof lessons
          console.log('[Journal GET] ✓ Lessons processed:', lessons.length)
          if (lessons.length > 0) {
            console.log('[Journal GET] First lesson details:', {
              id: lessons[0].id,
              date: lessons[0].date?.toISOString(),
              topic: lessons[0].topic,
              marksCount: lessons[0].lessonMarks?.length || 0,
            })
            if (lessons[0].lessonMarks && lessons[0].lessonMarks.length > 0) {
              const firstMark = lessons[0].lessonMarks[0] as any
              console.log('[Journal GET] First mark raw type:', typeof firstMark)
              console.log('[Journal GET] First mark is null?', firstMark === null)
              console.log('[Journal GET] First mark is object?', typeof firstMark === 'object' && firstMark !== null)
              
              // Проверяем, что firstMark является объектом перед использованием оператора 'in'
              const isObject = firstMark !== null && typeof firstMark === 'object'
              console.log('[Journal GET] First mark structure:', {
                id: firstMark?.id,
                athleteId: firstMark?.athleteId,
                lessonId: firstMark?.lessonId,
                hasCode: isObject ? ('code' in firstMark) : false,
                hasCode2: isObject ? ('code2' in firstMark) : false,
                code: firstMark?.code,
                code2: firstMark?.code2,
                allKeys: isObject ? Object.keys(firstMark) : [],
                rawMark: firstMark,
              })
            }
          }
        } catch (dbError: any) {
          console.error('[Journal GET] ERROR: Database error when fetching lessons')
          console.error('[Journal GET] Error type:', dbError?.constructor?.name)
          console.error('[Journal GET] Error message:', dbError?.message)
          console.error('[Journal GET] Error code:', dbError?.code)
          console.error('[Journal GET] Error meta:', dbError?.meta)
          console.error('[Journal GET] Error stack:', dbError?.stack)
          throw dbError
        }
      } catch (athleteError: any) {
        console.error('[Journal GET] ERROR: Failed to fetch athletes')
        console.error('[Journal GET] Error type:', athleteError?.constructor?.name)
        console.error('[Journal GET] Error message:', athleteError?.message)
        console.error('[Journal GET] Error stack:', athleteError?.stack)
        throw athleteError
      }
      // Создаём карту: день месяца -> урок
      console.log('[Journal GET] Step 8: Creating lessons map...')
      const lessonsByDay: Record<number, typeof lessons[0] | null> = {}
      console.log('[Journal GET] Processing', lessons.length, 'lessons to map to days...')
      lessons.forEach((lesson, index) => {
        try {
          if (!lesson.date) {
            console.error(`[Journal GET] Lesson ${index} has no date:`, lesson.id)
            return
          }
          
          // Получаем дату урока
          let lessonDate: Date
          if (lesson.date instanceof Date) {
            lessonDate = lesson.date
          } else {
            lessonDate = new Date(lesson.date)
          }
          
          // Получаем компоненты даты урока в локальной временной зоне
          const lessonYear = lessonDate.getFullYear()
          const lessonMonth = lessonDate.getMonth() + 1 // getMonth() возвращает 0-11
          const day = lessonDate.getDate()
          
          // Проверяем, что урок относится к запрашиваемому месяцу
          if (lessonYear !== year || lessonMonth !== month) {
            console.warn(`[Journal GET] Lesson ${index} date is outside requested month:`, {
              lessonDateISO: lessonDate.toISOString(),
              lessonDateLocal: lessonDate.toString(),
              requestedYear: year,
              requestedMonth: month,
              lessonYear,
              lessonMonth,
              day
            })
            return // Пропускаем уроки из другого месяца
          }
          
          if (isNaN(day) || day < 1 || day > 31) {
            console.error(`[Journal GET] Invalid day for lesson ${index}:`, {
              day,
              lessonDateISO: lessonDate.toISOString(),
              lessonDateLocal: lessonDate.toString(),
              lessonId: lesson.id
            })
            return
          }
          
          console.log(`[Journal GET] Mapping lesson ${index} to day ${day}:`, {
            lessonId: lesson.id,
            dateISO: lessonDate.toISOString(),
            dateLocal: lessonDate.toString(),
            year: lessonYear,
            month: lessonMonth,
            day
          })
          
          lessonsByDay[day] = lesson
        } catch (e: any) {
          console.error(`[Journal GET] Error processing lesson ${index} date:`, e?.message, 'Lesson ID:', lesson.id)
        }
      })
      console.log('[Journal GET] ✓ Lessons mapped to days:', Object.keys(lessonsByDay).length, 'days')
      console.log('[Journal GET] Mapped days:', Object.keys(lessonsByDay).map(d => parseInt(d)).sort((a, b) => a - b).join(', '))

      // Получаем количество дней в месяце
      const daysInMonth = endDate.getDate()
      console.log('[Journal GET] Step 9: Building days data...')
      console.log('[Journal GET] Days in month:', daysInMonth)
      const daysData: Array<{
        day: number
        lesson: { id: string; date: string; topic?: string | null } | null
        marks: Record<string, { code: string | null; code2: string | null }> // athleteId -> { code, code2 }
      }> = []

      for (let day = 1; day <= daysInMonth; day++) {
        if (day % 10 === 0 || day === 1 || day === daysInMonth) {
          console.log(`[Journal GET] Processing day ${day}/${daysInMonth}...`)
        }
        
        const lesson = lessonsByDay[day] || null
        const marks: Record<string, { code: string | null; code2: string | null }> = {}

        if (lesson) {
        if (!lesson.lessonMarks || !Array.isArray(lesson.lessonMarks)) {
          console.error(`[Journal GET] Lesson ${lesson.id} has invalid lessonMarks:`, typeof lesson.lessonMarks)
          // Если lessonMarks не массив, создаем пустые оценки для всех учащихся
          athletes.forEach((athlete) => {
            marks[athlete.id] = {
              code: null,
              code2: null,
            }
          })
        } else {
          athletes.forEach((athlete) => {
            try {
              const mark = lesson.lessonMarks.find((m) => m && m.athleteId === athlete.id)
              if (mark) {
                // Безопасный доступ к code2
                let code2Value: string | null = null
                try {
                  // Пробуем получить code2 через прямой доступ
                  const markData = mark as any
                  if (markData && typeof markData === 'object') {
                    if ('code2' in markData) {
                      code2Value = markData.code2 ?? null
                    }
                  }
                } catch (e: any) {
                  // Если ошибка при доступе к code2, оставляем null
                  console.error(`[Journal GET] Error accessing code2 for mark ${mark.id}:`, e?.message)
                  code2Value = null
                }
                
                marks[athlete.id] = {
                  code: mark.code ?? null,
                  code2: code2Value,
                }
              } else {
                marks[athlete.id] = {
                  code: null,
                  code2: null,
                }
              }
            } catch (e: any) {
              // Если ошибка при обработке одного учащегося, добавляем пустые данные
              console.error(`[Journal GET] Error processing athlete ${athlete.id} for day ${day}:`, e?.message)
              marks[athlete.id] = {
                code: null,
                code2: null,
              }
            }
          })
        }
      } else {
        // Если урока нет, все оценки null
        athletes.forEach((athlete) => {
          marks[athlete.id] = {
            code: null,
            code2: null,
          }
        })
      }

        try {
          daysData.push({
            day,
            lesson: lesson ? {
              id: lesson.id,
              date: lesson.date instanceof Date ? lesson.date.toISOString() : new Date(lesson.date).toISOString(),
              topic: lesson.topic ?? null,
            } : null,
            marks,
          })
        } catch (e: any) {
          // Если ошибка при добавлении дня, логируем и добавляем пустые данные
          console.error(`[Journal GET] Error processing day ${day}:`, e?.message)
          daysData.push({
            day,
            lesson: null,
            marks: Object.fromEntries(athletes.map(a => [a.id, { code: null, code2: null }])),
          })
        }
      }
      console.log('[Journal GET] ✓ Days data built:', daysData.length, 'days')
      console.log('[Journal GET] Days with lessons:', daysData.filter(d => d.lesson !== null).length)
    
      console.log('[Journal GET] Step 10: Building final response...')
      const response = {
        athletes,
        days: daysData,
        year,
        month,
      };
      
      console.log('[Journal GET] ✓ Response structure:', {
        athletesCount: response.athletes.length,
        daysCount: response.days.length,
        year: response.year,
        month: response.month,
      });
      
      console.log('[Journal GET] ========== SUCCESS ==========')
      return NextResponse.json(response);
    } catch (groupError: any) {
      console.error('[Journal GET] ERROR: Failed to get group')
      console.error('[Journal GET] Error type:', groupError?.constructor?.name)
      console.error('[Journal GET] Error message:', groupError?.message)
      console.error('[Journal GET] Error stack:', groupError?.stack)
      throw groupError
    }
  } catch (error: any) {
    console.error('[Journal GET] ========== ERROR ==========')
    console.error('[Journal GET] Error type:', error?.constructor?.name)
    console.error('[Journal GET] Error message:', error?.message)
    console.error('[Journal GET] Error stack:', error?.stack)
    console.error('[Journal GET] Error code:', error?.code)
    console.error('[Journal GET] Error meta:', error?.meta)
    console.error('[Journal GET] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    console.error('[Journal GET] ===========================')
    
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
