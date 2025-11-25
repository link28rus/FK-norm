import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Получаем все группы
  const groups = await prisma.group.findMany({
    select: {
      id: true,
      name: true,
      schoolYear: true,
    },
  })

  console.log(`Всего групп: ${groups.length}\n`)
  
  // Для каждой группы проверяем нормативы
  for (const group of groups) {
    const norms = await prisma.norm.findMany({
      where: {
        athlete: {
          groupId: group.id,
        },
        OR: [
          { type: 'Tets' },
          { type: 'Бег' },
          { type: { contains: 'Tets' } },
          { type: { contains: 'Бег' } },
        ],
      },
      select: {
        id: true,
        type: true,
        date: true,
        normType: true,
      },
    })

    if (norms.length > 0) {
      console.log(`Группа: "${group.name}" (ID: ${group.id})`)
      console.log(`  Найдено нормативов: ${norms.length}`)
      norms.forEach(n => {
        console.log(`    - ID: ${n.id}, Тип: "${n.type}", Дата: ${n.date.toISOString().split('T')[0]}, normType: ${n.normType}`)
      })
      console.log('')
    }
  }

  // Также ищем все нормативы с типами Tets или Бег
  const allNorms = await prisma.norm.findMany({
    where: {
      OR: [
        { type: 'Tets' },
        { type: 'Бег' },
      ],
    },
    select: {
      id: true,
      type: true,
      date: true,
      normType: true,
      athlete: {
        select: {
          id: true,
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

  if (allNorms.length > 0) {
    console.log(`\nВсего найдено нормативов Tets/Бег: ${allNorms.length}`)
    allNorms.forEach(n => {
      console.log(`  - ID: ${n.id}, Тип: "${n.type}", Дата: ${n.date.toISOString().split('T')[0]}, Группа: "${n.athlete.group.name}" (${n.athlete.group.id})`)
    })
  } else {
    console.log('\nНормативы Tets/Бег не найдены')
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

