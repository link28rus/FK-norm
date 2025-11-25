import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import JournalPage from '@/components/JournalPage'

export default async function GroupJournalPage({
  params,
}: {
  params: { groupId: string }
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

  return <JournalPage groupId={params.groupId} userFullName={user.trainerProfile?.fullName || user.email} userRole={user.role} />
}

