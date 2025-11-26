import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import GroupDetailPage from '@/components/GroupDetailPage'

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  // Проверка роли происходит в layout.tsx
  const { groupId } = await params
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  let profile = null
  if (user) {
    profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })
  }

  return (
    <GroupDetailPage groupId={groupId} userFullName={profile?.fullName} userRole={user?.role} />
  )
}
