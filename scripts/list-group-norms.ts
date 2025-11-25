import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const groupId = 'cmibhtfkr004h6frkcughkep0'
  
  // Получаем все нормативы группы
  const norms = await prisma.norm.findMany({
    where: {
      athlete: {
        groupId: groupId,
      },
    },
    select: {
      id: true,
      type: true,
      date: true,
      normType: true,
      athlete: {
        select: {
          fullName: true,
        },
      },
    },
    orderBy: [
      { type: 'asc' },
      { date: 'desc' },
    ],
  })

  console.log(`Всего нормативов в группе: ${norms.length}`)
  console.log('\nНормативы:')
  
  norms.forEach((norm, index) => {
    console.log(`${index + 1}. ID: ${norm.id}`)
    console.log(`   Тип: "${norm.type}" (длина: ${norm.type.length})`)
    console.log(`   Дата: ${norm.date.toISOString()}`)
    console.log(`   Дата (локальная): ${norm.date.toLocaleDateString('ru-RU')}`)
    console.log(`   normType: ${norm.normType}`)
    console.log(`   Ученик: ${norm.athlete.fullName}`)
    console.log('')
  })

  // Группируем по типу и дате
  const grouped = norms.reduce((acc, norm) => {
    const dateStr = norm.date.toISOString().split('T')[0]
    const key = `${norm.type}|${dateStr}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(norm)
    return acc
  }, {} as Record<string, typeof norms>)

  console.log('\nГруппировка по типу и дате:')
  Object.entries(grouped).forEach(([key, groupNorms]) => {
    const [type, date] = key.split('|')
    console.log(`\n${type} - ${date}: ${groupNorms.length} нормативов`)
    groupNorms.forEach(n => {
      console.log(`  - ID: ${n.id}, Ученик: ${n.athlete.fullName}`)
    })
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

