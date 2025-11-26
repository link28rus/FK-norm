import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20250102000000_add_norm_period/migration.sql'
  )

  console.log('Читаю файл миграции:', migrationPath)
  
  if (!fs.existsSync(migrationPath)) {
    console.error('Файл миграции не найден:', migrationPath)
    process.exit(1)
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('Применяю миграцию для добавления поля period и enum NormPeriod...')
  
  try {
    // Выполняем SQL напрямую
    await prisma.$executeRawUnsafe(sql)
    console.log('✅ Миграция применена успешно!')
    console.log('Enum NormPeriod создан и поле period добавлено в таблицу group_norms')
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    
    // Если enum или поле уже существуют, это не критическая ошибка
    if (
      errorMsg.includes('already exists') ||
      errorMsg.includes('duplicate') ||
      errorMsg.includes('column "period" already exists') ||
      errorMsg.includes('type "NormPeriod" already exists')
    ) {
      console.log('⚠ Enum NormPeriod или поле period уже существуют')
      console.log('Миграция не требуется или уже применена')
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



