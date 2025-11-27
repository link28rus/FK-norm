import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { getCurrentUserFromCookies } from "@/lib/auth"
import { cookies } from "next/headers"
import PrintOnLoad from "@/components/PrintOnLoad"
import { BackButton } from "@/components/BackButton"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AthletePrintPage({ params }: PageProps) {
  const { id: athleteId } = await params

  // Проверка авторизации
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
    notFound()
  }

  // Получаем профиль тренера
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
    notFound()
  }

  // Получаем данные ученика
  const athlete = await prisma.athlete.findFirst({
    where: user.role === 'ADMIN'
      ? { id: athleteId }
      : {
          id: athleteId,
          group: {
            trainerId: profile.id,
          },
        },
    include: {
      group: {
        select: {
          name: true,
          schoolYear: true,
        },
      },
    },
  })

  if (!athlete) {
    notFound()
  }

  // Получаем все нормативы ученика (индивидуальные, групповые, контрольные)
  const norms = await prisma.norm.findMany({
    where: {
      athleteId: athleteId,
      // НЕ фильтруем по normType, groupNormId, period - показываем все нормативы
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          unit: true,
        },
      },
      groupNorm: {
        select: {
          id: true,
          period: true,
        },
      },
    },
    orderBy: {
      date: 'asc',
    },
  })

  const formatDate = (value: Date | string | null | undefined) => {
    if (!value) return "—"
    const d = new Date(value)
    return d.toLocaleDateString("ru-RU")
  }

  const calculateAge = (birthDate: Date | string | null | undefined) => {
    if (!birthDate) return null
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const status = athlete.isActive ? "Активен" : "Выбыл"

  // Функция для определения типа норматива
  const getNormTypeLabel = (norm: any): string => {
    // Если есть groupNorm и period, определяем тип контрольного замера
    if (norm.groupNorm?.period === 'START_OF_YEAR') return 'Контр. (начало)'
    if (norm.groupNorm?.period === 'END_OF_YEAR') return 'Контр. (конец)'
    // Если есть groupNormId, но period REGULAR или null - это групповой норматив
    if (norm.groupNormId) return 'Общий'
    // Иначе - индивидуальный
    return 'Индивид.'
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-8 athlete-card-print">
      <BackButton />
      <PrintOnLoad />
      <div className="max-w-4xl mx-auto text-sm space-y-6">
        {/* Заголовок */}
        <header className="text-center border-b pb-4 mb-4">
          <h1 className="text-2xl font-bold mb-1">Карточка ученика</h1>
          <p className="text-gray-700">
            Группа: {athlete.group?.name ?? "—"}
            {athlete.group?.schoolYear && ` · Учебный год: ${athlete.group.schoolYear}`}
          </p>
        </header>

        {/* Данные ученика */}
        <section className="border rounded-lg p-4 avoid-page-break">
          <h2 className="text-lg font-semibold mb-3">Данные ученика</h2>

          <div className="grid grid-cols-2 gap-y-2 gap-x-8">
            <div>
              <span className="font-medium">ФИО:</span>{" "}
              <span>
                {athlete.fullName}
                {!athlete.isActive && " (выбыл)"}
              </span>
            </div>

            <div>
              <span className="font-medium">Статус:</span>{" "}
              <span>{status}</span>
            </div>

            {athlete.birthDate && (
              <>
                <div>
                  <span className="font-medium">Дата рождения:</span>{" "}
                  <span>{formatDate(athlete.birthDate)}</span>
                </div>
                {calculateAge(athlete.birthDate) && (
                  <div>
                    <span className="font-medium">Возраст:</span>{" "}
                    <span>{calculateAge(athlete.birthDate)} лет</span>
                  </div>
                )}
              </>
            )}

            {athlete.gender && (
              <div>
                <span className="font-medium">Пол:</span>{" "}
                <span>{athlete.gender === 'М' ? 'Мужской' : athlete.gender === 'Ж' ? 'Женский' : athlete.gender}</span>
              </div>
            )}

            {athlete.height !== null && athlete.height !== undefined && (
              <div>
                <span className="font-medium">Рост:</span>{" "}
                <span>{athlete.height} см</span>
              </div>
            )}

            {athlete.weight !== null && athlete.weight !== undefined && (
              <div>
                <span className="font-medium">Вес:</span>{" "}
                <span>{athlete.weight} кг</span>
              </div>
            )}

            {athlete.shoeSize !== null && athlete.shoeSize !== undefined && (
              <div>
                <span className="font-medium">Размер обуви:</span>{" "}
                <span>{athlete.shoeSize}</span>
              </div>
            )}

            {athlete.uinGto && (
              <div>
                <span className="font-medium">УИН ГТО:</span>{" "}
                <span>{athlete.uinGto}</span>
              </div>
            )}

            {athlete.exitDate && (
              <>
                <div>
                  <span className="font-medium">Дата выбытия:</span>{" "}
                  <span>{formatDate(athlete.exitDate)}</span>
                </div>
                {athlete.exitReason && (
                  <div className="col-span-2">
                    <span className="font-medium">Причина выбытия:</span>{" "}
                    <span>{athlete.exitReason}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Нормативы */}
        <section className="border rounded-lg p-4 avoid-page-break">
          <h2 className="text-lg font-semibold mb-3">Нормативы</h2>

          {norms.length === 0 ? (
            <p className="text-gray-600 text-sm">
              Нормативы для данного ученика ещё не добавлены.
            </p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="border px-2 py-1 text-left font-semibold">Дата</th>
                  <th className="border px-2 py-1 text-left font-semibold">Тип</th>
                  <th className="border px-2 py-1 text-left font-semibold">Норматив</th>
                  <th className="border px-2 py-1 text-right font-semibold">Результат</th>
                  <th className="border px-2 py-1 text-left font-semibold">Ед. изм.</th>
                  <th className="border px-2 py-1 text-center font-semibold">Оценка</th>
                </tr>
              </thead>
              <tbody>
                {norms.map((norm) => (
                  <tr key={norm.id} className="border-b">
                    <td className="border px-2 py-1 align-top">
                      {formatDate(norm.date)}
                    </td>
                    <td className="border px-2 py-1 align-top">
                      {getNormTypeLabel(norm)}
                    </td>
                    <td className="border px-2 py-1 align-top">
                      {norm.template?.name || norm.type || "—"}
                    </td>
                    <td className="border px-2 py-1 align-top text-right">
                      {norm.value !== null && norm.value !== undefined ? norm.value : "—"}
                    </td>
                    <td className="border px-2 py-1 align-top">
                      {norm.template?.unit || norm.unit || "—"}
                    </td>
                    <td className="border px-2 py-1 align-top text-center">
                      {norm.status || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Подписи */}
        <section className="flex justify-between pt-4 text-xs avoid-page-break">
          <div>
            <span className="font-medium">Тренер: </span>
            <span>____________________</span>
          </div>
          <div>
            <span className="font-medium">Дата печати: </span>
            <span>{new Date().toLocaleDateString("ru-RU")}</span>
          </div>
        </section>
      </div>
    </div>
  )
}

