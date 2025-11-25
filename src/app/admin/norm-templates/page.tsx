import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import NormTemplatesAdmin from '@/components/NormTemplatesAdmin'
import Header from '@/components/Header'

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
    <div className="min-h-screen bg-gray-50">
      <Header userFullName={user.trainerProfile?.fullName || user.email} userRole={user.role} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
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
      </main>
    </div>
  )
}



