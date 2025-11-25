import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Проверяем подключение
    await prisma.$connect()
    console.log('Подключение к БД успешно\n')

    // Проверяем группы
    const groupsCount = await prisma.group.count()
    console.log(`Всего групп в БД: ${groupsCount}`)

    if (groupsCount > 0) {
      const groups = await prisma.group.findMany({
        take: 5,
        select: {
          id: true,
          name: true,
        },
      })
      console.log('Первые группы:')
      groups.forEach(g => {
        console.log(`  - ${g.id}: "${g.name}"`)
      })
    }

    // Проверяем нормативы
    const normsCount = await prisma.norm.count()
    console.log(`\nВсего нормативов в БД: ${normsCount}`)

    if (normsCount > 0) {
      const norms = await prisma.norm.findMany({
        take: 10,
        select: {
          id: true,
          type: true,
          date: true,
        },
      })
      console.log('Первые нормативы:')
      norms.forEach(n => {
        console.log(`  - ${n.id}: "${n.type}", ${n.date.toISOString().split('T')[0]}`)
      })
    }

    // Проверяем конкретную группу
    const specificGroup = await prisma.group.findUnique({
      where: { id: 'cmibhtfkr004h6frkcughkep0' },
      include: {
        athletes: {
          take: 1,
        },
      },
    })

    if (specificGroup) {
      console.log(`\nГруппа найдена: "${specificGroup.name}"`)
      const normsInGroup = await prisma.norm.count({
        where: {
          athlete: {
            groupId: 'cmibhtfkr004h6frkcughkep0',
          },
        },
      })
      console.log(`Нормативов в группе: ${normsInGroup}`)
    } else {
      console.log('\nГруппа cmibhtfkr004h6frkcughkep0 не найдена')
    }
  } catch (error) {
    console.error('Ошибка:', error)
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

