import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Ищем группу "4 А" или "4А"
  const groups = await prisma.group.findMany({
    where: {
      OR: [
        { name: { contains: '4' } },
        { name: { contains: 'А' } },
      ],
    },
    select: {
      id: true,
      name: true,
      schoolYear: true,
    },
  })

  console.log('Найдено групп:', groups.length)
  groups.forEach(g => {
    console.log(`- ID: ${g.id}, Название: "${g.name}", Учебный год: ${g.schoolYear}`)
  })

  // Для каждой группы проверяем нормативы
  for (const group of groups) {
    const normsCount = await prisma.norm.count({
      where: {
        athlete: {
          groupId: group.id,
        },
      },
    })

    if (normsCount > 0) {
      console.log(`\nГруппа "${group.name}" (${group.id}): ${normsCount} нормативов`)
      
      const norms = await prisma.norm.findMany({
        where: {
          athlete: {
            groupId: group.id,
          },
        },
        select: {
          id: true,
          type: true,
          date: true,
        },
        take: 10,
      })

      norms.forEach(n => {
        console.log(`  - Тип: "${n.type}", Дата: ${n.date.toISOString().split('T')[0]}`)
      })
    }
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

