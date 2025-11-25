import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { extractClassFromGroupName } from '@/lib/groupClassExtractor'

// GET - получить список групп тренера
export async function GET(request: NextRequest) {
  try {
    console.log('[Groups GET] ========== START REQUEST ==========')
    console.log('[Groups GET] Request URL:', request.url)
    console.log('[Groups GET] Request method:', request.method)
    
    console.log('[Groups GET] Step 1: Getting current user...')
    const user = await getCurrentUser(request)
    console.log('[Groups GET] ✓ User retrieved:', { 
      id: user?.id, 
      role: user?.role,
      email: user?.email 
    })

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      console.error('[Groups GET] ERROR: Access denied - invalid user or role')
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    console.log('[Groups GET] Step 2: Getting trainer profile...')
    // Если ADMIN и нет TrainerProfile - создаём автоматически
    let profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })
    console.log('[Groups GET] Profile found:', profile ? { id: profile.id, fullName: profile.fullName } : 'null')

    if (user.role === 'ADMIN' && !profile) {
      console.log('[Groups GET] Creating admin profile...')
      try {
        profile = await prisma.trainerProfile.create({
          data: {
            userId: user.id,
            fullName: user.email.split('@')[0],
            phone: null,
          },
        })
        console.log('[Groups GET] ✓ Admin profile created:', { id: profile.id })
      } catch (profileError: any) {
        console.error('[Groups GET] ERROR creating admin profile:', profileError?.message)
        console.error('[Groups GET] Profile error stack:', profileError?.stack)
        throw profileError
      }
    }

    if (!profile) {
      console.error('[Groups GET] ERROR: Profile not found for user:', user.id)
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      )
    }
    console.log('[Groups GET] ✓ Profile ready:', { id: profile.id })

    console.log('[Groups GET] Step 3: Parsing query parameters...')
    // Получаем параметр фильтрации по учебному году
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear')
    console.log('[Groups GET] Search params:', Object.fromEntries(searchParams.entries()))
    console.log('[Groups GET] School year filter:', schoolYear || 'none')

    // Формируем условие where
    // Для ADMIN разрешаем доступ ко всем группам, для TRAINER - только к своим
    console.log('[Groups GET] Step 4: Building where condition...')
    const whereCondition: any = user.role === 'ADMIN' ? {} : { trainerId: profile.id }
    if (schoolYear) {
      whereCondition.schoolYear = schoolYear
    }
    console.log('[Groups GET] Where condition:', JSON.stringify(whereCondition))

    console.log('[Groups GET] Step 5: Fetching groups...')
    // Получаем группы с подсчётом через отдельные запросы для совместимости
    let groups
    try {
      groups = await prisma.group.findMany({
        where: whereCondition,
        include: {
          trainer: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: [{ schoolYear: 'desc' }, { name: 'asc' }],
      })
      console.log('[Groups GET] ✓ Groups found:', groups.length)
      console.log('[Groups GET] Groups IDs:', groups.map(g => g.id).join(', '))
      if (groups.length > 0) {
        console.log('[Groups GET] First group sample:', {
          id: groups[0].id,
          name: groups[0].name,
          trainerId: groups[0].trainerId,
          schoolYear: groups[0].schoolYear
        })
      }
    } catch (groupsError: any) {
      console.error('[Groups GET] ERROR: Failed to fetch groups')
      console.error('[Groups GET] Error type:', groupsError?.constructor?.name)
      console.error('[Groups GET] Error message:', groupsError?.message)
      console.error('[Groups GET] Error code:', groupsError?.code)
      console.error('[Groups GET] Error meta:', groupsError?.meta)
      console.error('[Groups GET] Error stack:', groupsError?.stack)
      throw groupsError
    }

    console.log('[Groups GET] Step 6: Counting athletes and lessons for each group...')
    // Подсчитываем количество учащихся и уроков для каждой группы
    let groupsWithCounts
    try {
      groupsWithCounts = await Promise.all(
        groups.map(async (group, index) => {
          try {
            console.log(`[Groups GET] Processing group ${index + 1}/${groups.length}: ${group.id}`)
            const [athletesCount, lessonsCount] = await Promise.all([
              prisma.athlete.count({
                where: { groupId: group.id },
              }),
              prisma.lesson.count({
                where: { groupId: group.id },
              }),
            ])
            console.log(`[Groups GET] ✓ Group ${group.id}: ${athletesCount} athletes, ${lessonsCount} lessons`)

            return {
              ...group,
              _count: {
                athletes: athletesCount,
                lessons: lessonsCount,
              },
            }
          } catch (countError: any) {
            console.error(`[Groups GET] ERROR counting for group ${group.id}:`, countError?.message)
            console.error(`[Groups GET] Count error stack:`, countError?.stack)
            // Возвращаем группу с нулевыми счетчиками в случае ошибки
            return {
              ...group,
              _count: {
                athletes: 0,
                lessons: 0,
              },
            }
          }
        })
      )
      console.log('[Groups GET] ✓ All groups processed:', groupsWithCounts.length)
    } catch (countsError: any) {
      console.error('[Groups GET] ERROR: Failed to count athletes/lessons')
      console.error('[Groups GET] Error type:', countsError?.constructor?.name)
      console.error('[Groups GET] Error message:', countsError?.message)
      console.error('[Groups GET] Error stack:', countsError?.stack)
      throw countsError
    }

    console.log('[Groups GET] Step 7: Building response...')
    const response = { groups: groupsWithCounts }
    console.log('[Groups GET] ✓ Response ready:', {
      groupsCount: response.groups.length,
      totalAthletes: response.groups.reduce((sum, g) => sum + (g._count?.athletes || 0), 0),
      totalLessons: response.groups.reduce((sum, g) => sum + (g._count?.lessons || 0), 0)
    })
    console.log('[Groups GET] ========== SUCCESS ==========')
    
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[Groups GET] ========== ERROR ==========')
    console.error('[Groups GET] Error type:', error?.constructor?.name)
    console.error('[Groups GET] Error message:', error?.message)
    console.error('[Groups GET] Error stack:', error?.stack)
    console.error('[Groups GET] Error code:', error?.code)
    console.error('[Groups GET] Error meta:', error?.meta)
    console.error('[Groups GET] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    console.error('[Groups GET] ===========================')
    
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

// POST - создать новую группу
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description, schoolYear } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Название группы обязательно' },
        { status: 400 }
      )
    }

    if (!schoolYear) {
      return NextResponse.json(
        { error: 'Учебный год обязателен' },
        { status: 400 }
      )
    }

    // Автоматически определяем класс из названия группы
    const extractedClass = extractClassFromGroupName(name)
    
    const group = await prisma.group.create({
      data: {
        trainerId: profile.id,
        name,
        description: description || null,
        schoolYear,
        class: extractedClass, // Автоматически определенный класс
      },
    })

    console.log('[Groups POST] Group created with auto-detected class:', {
      name,
      extractedClass,
      groupId: group.id,
    })

    return NextResponse.json({ success: true, group })
  } catch (error) {
    console.error('Create group error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

