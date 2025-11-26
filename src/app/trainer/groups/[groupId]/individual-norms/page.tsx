import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import GroupIndividualNormsPage from '@/components/trainer/GroupIndividualNormsPage'

export default async function IndividualNormsPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  return (
    <GroupIndividualNormsPage
      groupId={groupId}
      userFullName={user?.trainerProfile?.fullName || user?.email}
      userRole={user?.role}
    />
  )
}



