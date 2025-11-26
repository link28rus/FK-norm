import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InfoCard } from '@/components/ui'
import GroupTabs from '@/components/trainer/GroupTabs'

interface GroupLayoutProps {
  children: React.ReactNode
  params: Promise<{ groupId: string }>
}

export default async function GroupLayout({ children, params }: GroupLayoutProps) {
  const { groupId } = await params
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user || (user.role !== 'TRAINER' && user.role !== 'ADMIN')) {
    return null
  }

  let profile = null
  if (user) {
    profile = await prisma.trainerProfile.findUnique({
      where: { userId: user.id },
    })
  }

  // Если ADMIN и нет TrainerProfile - создаём автоматически
  if (user.role === 'ADMIN' && !profile) {
    profile = await prisma.trainerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: user.email.split('@')[0],
        phone: null,
      },
      update: {},
    })
  }

  if (!profile) {
    return null
  }

  // Получаем группу для проверки доступа и отображения информации
  const group = await prisma.group.findFirst({
    where: user.role === 'ADMIN'
      ? { id: groupId }
      : {
          id: groupId,
          trainerId: profile.id,
        },
    select: {
      id: true,
      name: true,
      description: true,
      schoolYear: true,
      class: true,
    },
  })

  if (!group) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и информация о группе */}
      <div>
        <h1 className="h1 mb-4">{group.name}</h1>
        <InfoCard className="mb-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-secondary mb-0.5">Учебный год</dt>
              <dd className="text-sm text-heading">{group.schoolYear}</dd>
            </div>
            {group.class && (
              <div>
                <dt className="text-sm font-medium text-secondary mb-0.5">Класс</dt>
                <dd className="text-sm text-heading">{group.class}</dd>
              </div>
            )}
            {group.description && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-secondary mb-0.5">Описание</dt>
                <dd className="text-sm text-heading">{group.description}</dd>
              </div>
            )}
          </dl>
        </InfoCard>
      </div>

      {/* Вкладки */}
      <GroupTabs groupId={groupId} />

      {/* Контент страницы */}
      {children}
    </div>
  )
}

