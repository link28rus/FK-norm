import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// DELETE - удалить все нормативы группы с указанным type+date
export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  console.log('DELETE /api/trainer/groups/[groupId]/norms/delete - handler called', {
    groupId: params.groupId,
    url: request.url,
  })
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Если ADMIN и нет TrainerProfile - создаём автоматически
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

    // Для ADMIN разрешаем доступ ко всем группам, для TRAINER - только к своим
    const group = await prisma.group.findFirst({
      where: user.role === 'ADMIN'
        ? { id: params.groupId }
        : {
            id: params.groupId,
            trainerId: profile.id,
          },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const date = searchParams.get('date')

    console.log('Delete norm: received params', {
      groupId: params.groupId,
      type,
      date,
      url: request.url,
    })

    if (!type || !date) {
      return NextResponse.json(
        { error: 'Тип и дата обязательны' },
        { status: 400 }
      )
    }

    // Парсим дату из строки формата YYYY-MM-DD
    // Создаём дату в локальном времени для начала и конца дня
    let startOfDay: Date
    let endOfDay: Date

    try {
      const dateParts = date.split('-')
      if (dateParts.length !== 3) {
        throw new Error('Неверный формат даты')
      }
      const year = parseInt(dateParts[0])
      const month = parseInt(dateParts[1]) - 1 // месяцы в JS начинаются с 0
      const day = parseInt(dateParts[2])
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error('Неверный формат даты')
      }
      
      startOfDay = new Date(year, month, day, 0, 0, 0, 0)
      endOfDay = new Date(year, month, day, 23, 59, 59, 999)
    } catch (error) {
      return NextResponse.json(
        { error: 'Неверный формат даты. Ожидается YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Сначала проверяем, есть ли нормативы для удаления
    // Ищем ВСЕ нормативы группы с таким типом (и GROUP, и INDIVIDUAL, и старые без normType)
    // Это нужно для универсального удаления старых и новых нормативов
    // Нормализуем тип: убираем лишние пробелы и приводим к единому виду
    const normalizedType = type.trim()
    
    // Сначала получаем ВСЕ нормативы группы (без фильтра по типу), чтобы увидеть, что есть в БД
    const allGroupNorms = await prisma.norm.findMany({
      where: {
        athlete: {
          groupId: params.groupId,
        },
      },
      select: {
        id: true,
        date: true,
        normType: true,
        type: true,
      },
    })
    
    console.log('Delete norm: ALL norms in group', {
      totalCount: allGroupNorms.length,
      allTypes: [...new Set(allGroupNorms.map(n => n.type))],
      norms: allGroupNorms.map(n => ({
        id: n.id,
        type: n.type,
        typeLength: n.type.length,
        date: n.date.toISOString(),
        dateStr: `${n.date.getFullYear()}-${String(n.date.getMonth() + 1).padStart(2, '0')}-${String(n.date.getDate()).padStart(2, '0')}`,
        normType: n.normType,
      })),
    })
    
    // Теперь фильтруем по типу
    const allNormsWithType = allGroupNorms.filter(n => {
      const normType = n.type.trim()
      const matches = normType === normalizedType
      if (!matches) {
        console.log('Type mismatch:', {
          requested: normalizedType,
          requestedLength: normalizedType.length,
          found: normType,
          foundLength: normType.length,
          charCodes: {
            requested: normalizedType.split('').map(c => c.charCodeAt(0)),
            found: normType.split('').map(c => c.charCodeAt(0)),
          },
        })
      }
      return matches
    })

    // Фильтруем по дате вручную, чтобы избежать проблем с часовыми поясами
    // Используем тот же подход, что и в GET запросе: toISOString().split('T')[0]
    // Это гарантирует одинаковое форматирование дат
    const searchDateStr = new Date(startOfDay).toISOString().split('T')[0]

    console.log('Delete norm: searching norms', {
      groupId: params.groupId,
      type,
      normalizedType,
      date,
      startOfDay: startOfDay.toISOString(),
      searchDateStr,
      allNormsCount: allNormsWithType.length,
      allNorms: allNormsWithType.map(n => ({
        id: n.id,
        type: n.type,
        date: n.date.toISOString(),
        dateStr: `${new Date(n.date).getFullYear()}-${String(new Date(n.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(n.date).getDate()).padStart(2, '0')}`,
        normType: n.normType,
      })),
    })
    
    const existingNorms = allNormsWithType.filter((norm) => {
      // Используем тот же формат, что и в GET запросе
      const normDateStr = new Date(norm.date).toISOString().split('T')[0]
      return normDateStr === searchDateStr
    })

    console.log('Delete norm: filtered by date', {
      existingNormsCount: existingNorms.length,
      existingNormsIds: existingNorms.map(n => n.id),
      existingNormsDetails: existingNorms.map(n => ({
        id: n.id,
        date: n.date.toISOString(),
        normType: n.normType,
      })),
    })

    if (existingNorms.length === 0) {
      console.log('Delete norm: no norms found after filtering', {
        groupId: params.groupId,
        type,
        date,
        startOfDay: startOfDay.toISOString(),
        allNormsCount: allNormsWithType.length,
        allNormsDates: allNormsWithType.map(n => ({
          id: n.id,
          date: n.date.toISOString(),
          dateOnly: `${n.date.getFullYear()}-${String(n.date.getMonth() + 1).padStart(2, '0')}-${String(n.date.getDate()).padStart(2, '0')}`,
          normType: n.normType,
        })),
        searchDateOnly: `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, '0')}-${String(startOfDay.getDate()).padStart(2, '0')}`,
      })
      
      // Если не найдено по дате, но есть нормативы с таким типом - удаляем их все
      // Это для случаев, когда дата в БД отличается от запрошенной
      if (allNormsWithType.length > 0) {
        console.log('Delete norm: found norms with type but different date, deleting all of them')
        const normIds = allNormsWithType.map(n => n.id)
        const result = await prisma.norm.deleteMany({
          where: {
            id: {
              in: normIds,
            },
          },
        })
        
        console.log('Delete norm: deletion result (by type only)', {
          requestedCount: normIds.length,
          deletedCount: result.count,
        })
        
        return NextResponse.json({ 
          success: true, 
          deletedCount: result.count,
          message: 'Удалено по типу (дата не совпала)'
        })
      }
      
      return NextResponse.json(
        { error: 'Нормативы не найдены для удаления' },
        { status: 404 }
      )
    }

    // Удаляем найденные нормативы по их ID
    // Это более надёжно, чем поиск по диапазону дат
    const normIds = existingNorms.map(n => n.id)
    console.log('Delete norm: attempting to delete', {
      normIds,
      count: normIds.length,
    })

    const result = await prisma.norm.deleteMany({
      where: {
        id: {
          in: normIds,
        },
      },
    })

    console.log('Delete norm: deletion result', {
      requestedCount: normIds.length,
      deletedCount: result.count,
      normIds,
    })

    // Проверяем, что хотя бы одна запись была удалена
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Нормативы не найдены для удаления' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.count 
    })
  } catch (error) {
    console.error('Delete group norms error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
