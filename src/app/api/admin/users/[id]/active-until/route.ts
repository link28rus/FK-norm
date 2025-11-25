import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// PATCH - установить/снять срок действия аккаунта пользователя
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { activeUntil } = body

    // Логирование для отладки
    console.log('Update activeUntil request:', { userId: params.id, activeUntil })

    // Проверяем, что пользователь существует
    const userToUpdate = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    // Парсим дату, если она передана
    let activeUntilDate: Date | null = null
    if (activeUntil) {
      // Формат из input type="date" должен быть YYYY-MM-DD
      // Проверяем разные форматы
      let dateString = activeUntil
      
      // Если формат dd.mm.yyyy, конвертируем в yyyy-mm-dd
      if (dateString.includes('.')) {
        const [day, month, year] = dateString.split('.')
        dateString = `${year}-${month}-${day}`
      }
      
      activeUntilDate = new Date(dateString)
      
      // Проверяем валидность даты
      if (isNaN(activeUntilDate.getTime())) {
        console.error('Invalid date format:', activeUntil, 'parsed as:', dateString)
        return NextResponse.json(
          { error: `Неверный формат даты: ${activeUntil}` },
          { status: 400 }
        )
      }
      
      // Устанавливаем время на конец дня (включительно)
      activeUntilDate.setHours(23, 59, 59, 999)
      
      console.log('Parsed date:', activeUntilDate.toISOString())
    }

    // Сначала проверяем наличие поля и применяем миграцию, если нужно
    try {
      // Пытаемся проверить наличие поля через простой запрос
      await prisma.$queryRaw`SELECT "activeUntil" FROM "users" LIMIT 1`
    } catch (checkError: any) {
      // Если поле отсутствует, применяем миграцию
      const errorMsg = checkError?.message || String(checkError)
      if (
        errorMsg.includes('column "activeUntil" does not exist') ||
        errorMsg.includes('Unknown column') ||
        errorMsg.includes('activeUntil')
      ) {
        console.log('Поле activeUntil не найдено, применяю миграцию...')
        try {
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeUntil" TIMESTAMP(3);
          `)
          console.log('✅ Миграция применена успешно')
        } catch (migrationError: any) {
          console.error('❌ Ошибка при применении миграции:', migrationError)
          // Продолжаем выполнение - возможно, поле уже существует
        }
      }
    }

    // Обновляем срок действия
    try {
      const updateData: { activeUntil: Date | null } = {
        activeUntil: activeUntilDate,
      }
      
      console.log('Updating user with data:', updateData)
      
      const updatedUser = await prisma.user.update({
        where: { id: params.id },
        data: updateData,
      })

      console.log('User updated successfully:', updatedUser.id, 'activeUntil:', updatedUser.activeUntil)
      return NextResponse.json({ success: true, user: updatedUser })
    } catch (prismaError: any) {
      console.error('Prisma update error:', prismaError)
      console.error('Error code:', prismaError.code)
      console.error('Error message:', prismaError.message)
      console.error('Error meta:', prismaError.meta)
      
      // Проверяем различные типы ошибок Prisma, связанных с отсутствием поля
      const errorMsg = prismaError?.message || String(prismaError)
      const isFieldMissing = 
        prismaError.code === 'P2009' ||
        errorMsg.includes('Unknown field') ||
        errorMsg.includes('activeUntil') ||
        errorMsg.includes('column "activeUntil" does not exist') ||
        errorMsg.includes('Unknown column')
      
      if (isFieldMissing) {
        // Пытаемся автоматически применить миграцию
        try {
          console.log('Попытка автоматического применения миграции для поля activeUntil...')
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeUntil" TIMESTAMP(3);
          `)
          console.log('Миграция применена успешно, повторяем обновление...')
          
          // Повторяем обновление после применения миграции
          const updatedUser = await prisma.user.update({
            where: { id: params.id },
            data: { activeUntil: activeUntilDate },
          })
          
          return NextResponse.json({ success: true, user: updatedUser })
        } catch (migrationError: any) {
          console.error('Ошибка при автоматическом применении миграции:', migrationError)
          return NextResponse.json(
            { 
              error: 'Поле activeUntil не найдено в схеме БД. Выполните миграцию: npx prisma migrate deploy',
              details: process.env.NODE_ENV === 'development' ? migrationError.message : undefined
            },
            { status: 500 }
          )
        }
      }
      
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          { error: 'Пользователь не найден' },
          { status: 404 }
        )
      }
      
      throw prismaError // Пробрасываем дальше для общего обработчика
    }
  } catch (error: any) {
    console.error('Update user activeUntil error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    })
    
    return NextResponse.json(
      { 
        error: 'Внутренняя ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

