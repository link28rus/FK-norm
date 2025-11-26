'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ProgressChartProps {
  summary: {
    improvedCount: number
    worsenedCount: number
    sameCount: number
    noDataCount?: number
  }
  normName: string
}

export function ProgressChart({ summary, normName }: ProgressChartProps) {
  const data = [
    {
      name: 'Улучшили',
      Количество: summary.improvedCount,
      fill: '#10b981', // green-500
    },
    {
      name: 'Ухудшили',
      Количество: summary.worsenedCount,
      fill: '#ef4444', // red-500
    },
    {
      name: 'Без изменений',
      Количество: summary.sameCount,
      fill: '#6b7280', // gray-500
    },
    ...(summary.noDataCount !== undefined && summary.noDataCount > 0
      ? [
          {
            name: 'Нет данных',
            Количество: summary.noDataCount,
            fill: '#d1d5db', // gray-300
          },
        ]
      : []),
  ]

  return (
    <div className="w-full" style={{ height: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            label={{ value: 'Количество учеников', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
            }}
          />
          <Legend />
          <Bar
            dataKey="Количество"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}



