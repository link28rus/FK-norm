'use client'

import { usePathname } from 'next/navigation'
import { Tabs } from '@/components/ui'

interface GroupTabsProps {
  groupId: string
}

export default function GroupTabs({ groupId }: GroupTabsProps) {
  const pathname = usePathname()

  const tabs = [
    { label: 'Ученики', href: `/trainer/groups/${groupId}` },
    { label: 'Журнал', href: `/trainer/groups/${groupId}/journal` },
    { label: 'Нормативы', href: `/trainer/groups/${groupId}/norms` },
    { label: 'Индивидуальные нормативы', href: `/trainer/groups/${groupId}/individual-norms` },
    { label: 'Прогресс', href: `/trainer/groups/${groupId}/progress` },
  ]

  return <Tabs tabs={tabs} currentPath={pathname || ''} className="mb-6" />
}

