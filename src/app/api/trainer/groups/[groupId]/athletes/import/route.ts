import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import * as XLSX from 'xlsx'

// POST - импорт учеников из Excel файла
export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
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

    // Проверяем, что группа принадлежит этому тренеру
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

    // Получаем файл из FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не загружен' },
        { status: 400 }
      )
    }

    // Проверяем расширение файла
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Файл должен быть в формате Excel (.xlsx или .xls)' },
        { status: 400 }
      )
    }

    // Читаем файл
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Парсим Excel
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch (error) {
      return NextResponse.json(
        { error: 'Не удалось прочитать файл Excel. Проверьте, что файл не повреждён.' },
        { status: 400 }
      )
    }

    // Получаем первый лист
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json(
        { error: 'Файл не содержит листов' },
        { status: 400 }
      )
    }

    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]

    if (data.length < 2) {
      return NextResponse.json(
        { error: 'Файл должен содержать хотя бы одну строку данных (кроме заголовка)' },
        { status: 400 }
      )
    }

    // Парсим данные
    const athletesToCreate: Array<{
      groupId: string
      fullName: string
      birthDate: Date | null
      gender: string | null
      notes: string | null
      schoolYear: string
    }> = []

    const errors: Array<{ row: number; error: string }> = []

    // Проходим по строкам, начиная со второй (первая - заголовки)
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1 // Для отображения пользователю (начинается с 1)

      // Пропускаем пустые строки
      if (!row || row.every((cell) => cell === null || cell === undefined || cell === '')) {
        continue
      }

      // Получаем значения из колонок
      // Колонка A (индекс 0) - ФИО
      // Колонка B (индекс 1) - Дата рождения
      const fullNameRaw = row[0]
      const birthDateRaw = row[1]

      // Валидация ФИО
      if (!fullNameRaw || typeof fullNameRaw !== 'string' || fullNameRaw.trim() === '') {
        errors.push({
          row: rowNumber,
          error: 'ФИО не указано или некорректно',
        })
        continue
      }

      const fullName = fullNameRaw.toString().trim()

      // Парсинг даты рождения
      let birthDate: Date | null = null
      if (birthDateRaw) {
        try {
          // Пробуем разные форматы даты
          let dateValue: Date | null = null

          // Если это число (Excel дата как число дней с 1900-01-01)
          if (typeof birthDateRaw === 'number') {
            // Excel дата: количество дней с 1900-01-01
            const excelEpoch = new Date(1899, 11, 30) // 1899-12-30
            dateValue = new Date(excelEpoch.getTime() + birthDateRaw * 24 * 60 * 60 * 1000)
          } else if (typeof birthDateRaw === 'string') {
            // Пробуем разные форматы строки
            const dateStr = birthDateRaw.trim()

            // Формат dd.mm.yyyy
            const ddmmyyyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
            if (ddmmyyyy) {
              const [, day, month, year] = ddmmyyyy
              dateValue = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            } else {
              // Пробуем стандартный формат ISO
              dateValue = new Date(dateStr)
            }
          } else if (birthDateRaw instanceof Date) {
            dateValue = birthDateRaw
          }

          if (dateValue && !isNaN(dateValue.getTime())) {
            // Проверяем, что дата разумная (не в будущем и не слишком старая)
            const now = new Date()
            const minDate = new Date(1900, 0, 1)
            if (dateValue > now) {
              errors.push({
                row: rowNumber,
                error: 'Дата рождения не может быть в будущем',
              })
              continue
            }
            if (dateValue < minDate) {
              errors.push({
                row: rowNumber,
                error: 'Дата рождения слишком старая',
              })
              continue
            }
            birthDate = dateValue
          } else {
            errors.push({
              row: rowNumber,
              error: 'Некорректный формат даты рождения',
            })
            continue
          }
        } catch (error) {
          errors.push({
            row: rowNumber,
            error: 'Ошибка при парсинге даты рождения',
          })
          continue
        }
      }

      // Пол (опционально, колонка C)
      const genderRaw = row[2]
      let gender: string | null = null
      if (genderRaw) {
        const genderStr = genderRaw.toString().trim().toUpperCase()
        if (genderStr === 'М' || genderStr === 'МУЖ' || genderStr === 'МУЖСКОЙ') {
          gender = 'М'
        } else if (genderStr === 'Ж' || genderStr === 'ЖЕН' || genderStr === 'ЖЕНСКИЙ') {
          gender = 'Ж'
        }
      }

      // Примечания (опционально, колонка D)
      const notesRaw = row[3]
      const notes = notesRaw ? notesRaw.toString().trim() : null

      athletesToCreate.push({
        groupId: params.groupId,
        fullName,
        birthDate,
        gender,
        notes,
        schoolYear: group.schoolYear,
      })
    }

    if (athletesToCreate.length === 0) {
      return NextResponse.json(
        { error: 'Не найдено валидных строк для импорта' },
        { status: 400 }
      )
    }

    // Создаём учеников в транзакции
    try {
      const createdAthletes = await prisma.$transaction(
        athletesToCreate.map((athlete) =>
          prisma.athlete.create({
            data: athlete,
          })
        )
      )

      return NextResponse.json({
        success: true,
        imported: createdAthletes.length,
        errors: errors.length > 0 ? errors : undefined,
        message:
          errors.length > 0
            ? `Импортировано ${createdAthletes.length} учеников. ${errors.length} строк(и) пропущено из-за ошибок.`
            : `Успешно импортировано ${createdAthletes.length} учеников`,
      })
    } catch (error) {
      console.error('Create athletes error:', error)
      return NextResponse.json(
        { error: 'Ошибка при создании учеников в базе данных' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Import athletes error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

