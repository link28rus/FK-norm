import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import AdminLayout from '@/components/layouts/AdminLayout'

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

  if (user.role !== 'ADMIN') {
    redirect('/trainer')
  }

  return (
    <AdminLayout userFullName={user.email.split('@')[0]}>
      {children}
    </AdminLayout>
  )
}


