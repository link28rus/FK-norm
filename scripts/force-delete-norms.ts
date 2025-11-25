import { prisma } from '../src/lib/prisma'

async function main() {
  const groupId = 'cmibhtfkr004h6frkcughkep0'
  
  console.log('Поиск всех нормативов в группе...\n')

  // Получаем ВСЕ нормативы группы без фильтров
  const allNorms = await prisma.norm.findMany({
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
  })

  console.log(`Всего нормативов в группе: ${allNorms.length}\n`)

  if (allNorms.length === 0) {
    console.log('Нормативы не найдены. Возможно, они уже удалены.')
    return
  }

  // Показываем все нормативы
  allNorms.forEach((norm, index) => {
    const dateStr = norm.date.toISOString().split('T')[0]
    console.log(`${index + 1}. ID: ${norm.id}`)
    console.log(`   Тип: "${norm.type}"`)
    console.log(`   Дата: ${dateStr}`)
    console.log(`   normType: ${norm.normType}`)
    console.log(`   Ученик: ${norm.athlete.fullName}`)
    console.log('')
  })

  // Ищем нормативы с типами "Tets" или "Бег" и датами 2025-11-23 или 2025-11-22
  const toDelete = allNorms.filter(norm => {
    const normType = norm.type.trim()
    const normDate = norm.date.toISOString().split('T')[0]
    
    const matchesType = normType === 'Tets' || normType === 'Бег'
    const matchesDate = normDate === '2025-11-23' || normDate === '2025-11-22'
    
    return matchesType && matchesDate
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

    console.log(`\n✓ Успешно удалено нормативов: ${result.count}`)
  } else {
    console.log('\nНормативы для удаления не найдены среди найденных нормативов.')
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

