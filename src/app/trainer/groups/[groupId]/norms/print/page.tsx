import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import NormPrintView from '@/components/NormPrintView'

export default async function NormPrintPage({
  params,
  searchParams,
}: {
  params: { groupId: string }
  searchParams: { type?: string; date?: string }
}) {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user) {
    redirect('/login')
  }

  // Разрешаем доступ ADMIN и TRAINER
  if (user.role !== 'TRAINER' && user.role !== 'ADMIN') {
    redirect('/')
  }

  // Если ADMIN и нет TrainerProfile - создаём автоматически
  let profile = await prisma.trainerProfile.findUnique({
    where: { userId: user.id },
  })

  if (user.role === 'ADMIN' && !profile) {
    profile = await prisma.trainerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: user.email.split('@')[0],
        phone: null,
      },
      update: {},
    })
  }

  if (!profile) {
    redirect('/trainer')
  }

  // Проверяем, что группа принадлежит этому тренеру (или админу разрешаем доступ ко всем группам)
  const group = await prisma.group.findFirst({
    where: user.role === 'ADMIN' 
      ? { id: params.groupId }
      : {
          id: params.groupId,
          trainerId: profile.id,
        },
  })

  if (!group) {
    redirect('/trainer/groups')
  }

  const { type, date } = searchParams

  if (!type || !date) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Не указаны тип и дата норматива</p>
      </div>
    )
  }

  // Парсим дату из строки формата YYYY-MM-DD
  // Создаём дату в локальном времени для начала и конца дня
  const dateParts = date.split('-')
  const year = parseInt(dateParts[0])
  const month = parseInt(dateParts[1]) - 1 // месяцы в JS начинаются с 0
  const day = parseInt(dateParts[2])
  
  const startOfDay = new Date(year, month, day, 0, 0, 0, 0)
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999)

  // Получаем все нормативы для этой группы с указанным type+date
  // Используем диапазон дат для более надёжного поиска
  const norms = await prisma.norm.findMany({
    where: {
      athlete: {
        groupId: params.groupId,
      },
      type,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      athlete: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
    orderBy: {
      athlete: {
        fullName: 'asc',
      },
    },
  })

  // Получаем unit из первого норматива (они все должны иметь одинаковый unit)
  const unit = norms[0]?.unit || null

  // Формируем данные для печати
  // Преобразуем status в grade (оценку)
  const validGrades = ['-', '2', '3', '4', '5', 'Б', 'О']
  const printData = norms.map((norm) => {
    // Если status содержит валидную оценку - используем её, иначе "-"
    const grade = norm.status && validGrades.includes(norm.status) ? norm.status : '-'
    return {
      athleteName: norm.athlete.fullName,
      value: norm.value,
      grade,
    }
  })

  // Проверяем, есть ли данные для отчёта
  // Данные считаются существующими, если есть хотя бы одна запись с:
  // - grade не пустым и не равным "-" (оценка проставлена)
  // - или value не пустым (значение проставлено)
  const hasData = printData.some(
    (norm) => (norm.grade && norm.grade !== '-') || (norm.value !== null && norm.value !== undefined)
  )

  // Если данных нет, показываем сообщение
  if (!hasData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 text-lg">
            По этому нормативу ещё нет данных для отчёта.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Вид норматива: {type}, Дата зачёта: {new Date(date).toLocaleDateString('ru-RU')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <NormPrintView
        type={type}
        date={date}
        unit={unit}
        groupName={group.name}
        schoolYear={group.schoolYear}
        norms={printData}
      />
    </div>
  )
}

