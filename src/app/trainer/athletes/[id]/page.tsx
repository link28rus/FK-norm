import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AthleteDetailPage from '@/components/AthleteDetailPage'

export default async function AthletePage({
  params,
}: {
  params: { id: string }
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

  return (
    <AthleteDetailPage athleteId={params.id} userFullName={profile?.fullName} userRole={user.role} />
  )
}
