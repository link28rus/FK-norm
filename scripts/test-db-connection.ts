import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('Проверка подключения к базе данных...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || 'не установлен')
    
    // Простая проверка подключения
    await prisma.$connect()
    console.log('✅ Подключение к базе данных успешно!')
    
    // Проверяем, есть ли таблицы
    const userCount = await prisma.user.count()
    console.log(`✅ База данных доступна. Пользователей в базе: ${userCount}`)
    
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Ошибка подключения к базе данных:')
    console.error('Код ошибки:', error?.code)
    console.error('Сообщение:', error?.message)
    
    if (error?.code === 'P1001') {
      console.error('\n💡 Решение:')
      console.error('1. Убедитесь, что PostgreSQL запущен')
      console.error('2. Проверьте DATABASE_URL в файле .env')
      console.error('3. Проверьте, что база данных существует')
      console.error('4. Выполните: npm run prisma:migrate')
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()



