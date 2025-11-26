'use client'

import { useParams, useSearchParams } from 'next/navigation'
import AthleteProgressReport from '@/components/trainer/AthleteProgressReport'

export default function AthleteProgressPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const athleteId = params.id as string
  const yearParam = searchParams.get('year')

  return (
    <AthleteProgressReport
      athleteId={athleteId}
      defaultYear={yearParam || undefined}
    />
  )
}



