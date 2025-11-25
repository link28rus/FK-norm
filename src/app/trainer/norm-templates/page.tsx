import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import NormTemplatesTrainer from '@/components/NormTemplatesTrainer'
import Header from '@/components/Header'

export default async function TrainerNormTemplatesPage() {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'TRAINER' && user.role !== 'ADMIN') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userFullName={user.trainerProfile?.fullName || user.email} userRole={user.role} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-4">
            <a
              href="/trainer"
              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
            >
              ← Назад в кабинет тренера
            </a>
          </div>
          <NormTemplatesTrainer />
        </div>
      </main>
    </div>
  )
}



