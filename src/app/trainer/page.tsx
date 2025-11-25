import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TrainerCabinet from '@/components/TrainerCabinet'

export default async function TrainerPage() {
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

  return <TrainerCabinet userRole={user.role} />
}

