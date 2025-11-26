import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import GroupNormsPage from '@/components/trainer/GroupNormsPage'

export default async function NormsPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  return (
    <GroupNormsPage
      groupId={groupId}
      userFullName={user?.trainerProfile?.fullName || user?.email}
      userRole={user?.role}
    />
  )
}



