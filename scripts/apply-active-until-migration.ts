import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20250101000000_add_active_until_field/migration.sql'
  )

  console.log('Читаю файл миграции:', migrationPath)
  
  if (!fs.existsSync(migrationPath)) {
    console.error('Файл миграции не найден:', migrationPath)
    process.exit(1)
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('Применяю миграцию для добавления поля activeUntil...')
  
  try {
    // Выполняем SQL напрямую
    await prisma.$executeRawUnsafe(sql)
    console.log('✅ Миграция применена успешно!')
    console.log('Поле activeUntil добавлено в таблицу users')
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    
    // Если поле уже существует, это не ошибка
    if (
      errorMsg.includes('already exists') ||
      errorMsg.includes('duplicate') ||
      errorMsg.includes('column "activeUntil" already exists')
    ) {
      console.log('⚠ Поле activeUntil уже существует в таблице users')
      console.log('Миграция не требуется')
    } else {
      console.error('❌ Ошибка при применении миграции:', errorMsg)
      throw error
    }
  }
}

main()
  .catch((e) => {
    console.error('Критическая ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })




