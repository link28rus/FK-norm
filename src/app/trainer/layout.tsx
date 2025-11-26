import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TrainerLayout from '@/components/layouts/TrainerLayout'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
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
  if (user.role === 'ADMIN' && !user.trainerProfile) {
    await prisma.trainerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: user.email.split('@')[0], // Используем часть email как имя по умолчанию
        phone: null,
      },
      update: {},
    })
  }

  // Перезагружаем пользователя с профилем
  const userWithProfile = await getCurrentUserFromCookies(cookieStore)

  return (
    <TrainerLayout
      userRole={user.role}
      userFullName={userWithProfile?.trainerProfile?.fullName || user.email.split('@')[0]}
    >
      {children}
    </TrainerLayout>
  )
}




