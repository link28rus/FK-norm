'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface AthleteProgressChartProps {
  normName: string
  unit: string | null
  startValue: number | null
  endValue: number | null
  startDate: string | null
  endDate: string | null
  direction?: string // "LOWER_IS_BETTER" | "HIGHER_IS_BETTER"
}

export function AthleteProgressChart({
  normName,
  unit,
  startValue,
  endValue,
  startDate,
  endDate,
  direction,
}: AthleteProgressChartProps) {
  // Подготовка данных для графика
  const data = []
  
  if (startValue !== null) {
    data.push({
      name: startDate ? new Date(startDate).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }) : 'Начало года',
      value: startValue,
      period: 'Начало года',
    })
  }

  if (endValue !== null) {
    data.push({
      name: endDate ? new Date(endDate).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }) : 'Конец года',
      value: endValue,
      period: 'Конец года',
    })
  }

  // Если нет данных, показываем пустой график
  if (data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: '300px' }}>
        <p className="text-secondary">Нет данных для отображения</p>
      </div>
    )
  }

  // Определяем цвет столбца: зелёный для улучшения, красный для ухудшения
  const getBarColor = (index: number) => {
    if (data.length < 2) return '#6366f1' // indigo-500 для одного значения
    
    if (index === 0) return '#6366f1' // indigo-500 для начала года
    if (index === 1 && startValue !== null && endValue !== null) {
      // Для конца года: определяем, улучшился ли результат
      let improved: boolean
      if (direction === 'LOWER_IS_BETTER') {
        // Для норматива типа "меньше лучше" (например, время бега)
        improved = endValue < startValue
      } else {
        // Для норматива типа "больше лучше" (например, дальность прыжка)
        improved = endValue > startValue
      }
      return improved ? '#10b981' : '#ef4444' // green-500 или red-500
    }
    return '#6366f1'
  }

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
          />
          <YAxis
            label={{ 
              value: unit ? `Значение (${unit})` : 'Значение', 
              angle: -90, 
              position: 'insideLeft' 
            }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
            }}
            formatter={(value: number) => {
              return [`${value.toFixed(2)} ${unit || ''}`.trim(), 'Значение']
            }}
            labelFormatter={(label) => {
              const item = data.find(d => d.name === label)
              return item?.period || label
            }}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

