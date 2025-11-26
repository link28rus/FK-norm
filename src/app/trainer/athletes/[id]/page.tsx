import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AthleteDetailPage from '@/components/AthleteDetailPage'

export default async function AthletePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Проверка роли происходит в layout.tsx
  const { id } = await params
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  let profile = null
  if (user) {
    profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AthleteDetailPage athleteId={id} userFullName={profile?.fullName} userRole={user?.role} />
    </div>
  )
}
