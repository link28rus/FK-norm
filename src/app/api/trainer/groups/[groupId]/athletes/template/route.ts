import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { readFile } from 'fs/promises'
import { join } from 'path'

// GET - скачать шаблон Excel файла
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Доступ запрещён' },
        { status: 403 }
      )
    }

    // Путь к шаблону в корне проекта
    const templatePath = join(process.cwd(), '4A.xlsx')

    try {
      const fileBuffer = await readFile(templatePath)

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="4A.xlsx"',
        },
      })
    } catch (error) {
      console.error('Template file read error:', error)
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Get template error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

