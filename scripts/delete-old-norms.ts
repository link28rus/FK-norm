import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const groupId = 'cmibhtfkr004h6frkcughkep0'
  
  // Находим нормативы для удаления
  const normsToDelete = await prisma.norm.findMany({
    where: {
      athlete: {
        groupId: groupId,
      },
      OR: [
        {
          type: 'Tets',
          date: {
            gte: new Date('2025-11-23T00:00:00.000Z'),
            lte: new Date('2025-11-23T23:59:59.999Z'),
          },
        },
        {
          type: 'Бег',
          date: {
            gte: new Date('2025-11-22T00:00:00.000Z'),
            lte: new Date('2025-11-22T23:59:59.999Z'),
          },
        },
      ],
    },
    select: {
      id: true,
      type: true,
      date: true,
    },
  })

  console.log('Найдено нормативов для удаления:', normsToDelete.length)
  console.log('Нормативы:', normsToDelete)

  if (normsToDelete.length > 0) {
    const result = await prisma.norm.deleteMany({
      where: {
        id: {
          in: normsToDelete.map(n => n.id),
        },
      },
    })

    console.log(`Удалено нормативов: ${result.count}`)
  } else {
    console.log('Нормативы не найдены')
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

