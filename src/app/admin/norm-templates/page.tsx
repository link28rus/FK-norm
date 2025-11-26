import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import NormTemplatesAdmin from '@/components/NormTemplatesAdmin'

export default async function NormTemplatesAdminPage() {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'ADMIN') {
    redirect('/')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <a
          href="/admin"
          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
        >
          ← Назад к админ-панели
        </a>
      </div>
      <NormTemplatesAdmin />
    </div>
  )
}



