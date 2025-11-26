import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import GroupsPage from '@/components/GroupsPage'

export default async function TrainerGroupsPage() {
  // Проверка роли происходит в layout.tsx
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  let profile = null
  if (user) {
    profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })
  }

  return (
    <GroupsPage userFullName={profile?.fullName} userRole={user?.role} />
  )
}

