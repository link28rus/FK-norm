import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'

export default async function Home() {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user) {
    redirect('/login')
  }

  if (user.role === 'ADMIN') {
    redirect('/admin')
  }

  if (user.role === 'TRAINER') {
    redirect('/trainer')
  }

  return null
}

