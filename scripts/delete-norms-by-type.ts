import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Поиск нормативов для удаления...\n')

  // Ищем все нормативы с типами, содержащими "Tets" или "Бег"
  const allNorms = await prisma.norm.findMany({
    where: {
      OR: [
        { type: { contains: 'Tets' } },
        { type: { contains: 'Бег' } },
        { type: { contains: 'Tets' } },
        { type: { contains: 'Бег' } },
      ],
    },
    select: {
      id: true,
      type: true,
      date: true,
      normType: true,
      athlete: {
        select: {
          fullName: true,
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  console.log(`Найдено нормативов: ${allNorms.length}\n`)

  if (allNorms.length === 0) {
    console.log('Нормативы не найдены. Возможно, они уже удалены или находятся в другой базе данных.')
    return
  }

  // Группируем по типу и дате
  const grouped = allNorms.reduce((acc, norm) => {
    const dateStr = norm.date.toISOString().split('T')[0]
    const key = `${norm.type}|${dateStr}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(norm)
    return acc
  }, {} as Record<string, typeof allNorms>)

  console.log('Найденные нормативы:')
  Object.entries(grouped).forEach(([key, groupNorms]) => {
    const [type, date] = key.split('|')
    console.log(`\n${type} - ${date}: ${groupNorms.length} нормативов`)
    groupNorms.forEach(n => {
      console.log(`  - ID: ${n.id}, Группа: "${n.athlete.group.name}" (${n.athlete.group.id}), Ученик: ${n.athlete.fullName}`)
    })
  })

  // Удаляем нормативы с типами "Tets" и "Бег" и датами 2025-11-23 и 2025-11-22
  const targetTypes = ['Tets', 'Бег']
  const targetDates = ['2025-11-23', '2025-11-22']

  const toDelete = allNorms.filter(norm => {
    const normType = norm.type.trim()
    const normDate = norm.date.toISOString().split('T')[0]
    return targetTypes.some(type => normType === type) && targetDates.includes(normDate)
  })

  console.log(`\nНормативы для удаления: ${toDelete.length}`)
  toDelete.forEach(n => {
    console.log(`  - ID: ${n.id}, Тип: "${n.type}", Дата: ${n.date.toISOString().split('T')[0]}`)
  })

  if (toDelete.length > 0) {
    const result = await prisma.norm.deleteMany({
      where: {
        id: {
          in: toDelete.map(n => n.id),
        },
      },
    })

    console.log(`\n✓ Удалено нормативов: ${result.count}`)
  } else {
    console.log('\nНормативы для удаления не найдены')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

