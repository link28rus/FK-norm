import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || 'admin@example.com'
  const password = process.argv[3] || 'admin123'

  console.log(`Создание администратора: ${email}`)

  // Проверяем, существует ли уже пользователь
  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    console.log('Пользователь с таким email уже существует!')
    process.exit(1)
  }

  // Хешируем пароль
  const passwordHash = await bcrypt.hash(password, 10)

  // Создаём администратора
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN' as any, // SQLite использует строку вместо enum
    },
  })

  console.log('✅ Администратор успешно создан!')
  console.log(`Email: ${admin.email}`)
  console.log(`Пароль: ${password}`)
  console.log('\n⚠️  Сохраните эти данные в безопасном месте!')
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

