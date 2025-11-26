'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import GroupProgressReport from '@/components/trainer/GroupProgressReport'

export default function GroupProgressPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const groupId = params.groupId as string
  const yearParam = searchParams.get('year')

  return (
    <GroupProgressReport
      groupId={groupId}
      defaultYear={yearParam || undefined}
    />
  )
}



