import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20251121010350_add_groups_lessons_marks/migration.sql'
  )

  console.log('Читаю файл миграции:', migrationPath)
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  // Выполняем SQL напрямую
  console.log('Применяю миграцию...')
  
  try {
    // Разбиваем на блоки по CREATE TABLE, ALTER TABLE и т.д.
    const blocks = sql.split(/(?=CREATE TABLE|ALTER TABLE|INSERT INTO|UPDATE|DROP TABLE|CREATE UNIQUE INDEX)/)
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim()
      if (!block || block.startsWith('--')) continue
      
      // Убираем комментарии
      const cleanBlock = block
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
      
      if (!cleanBlock) continue
      
      // Добавляем точку с запятой если её нет
      const statement = cleanBlock.endsWith(';') ? cleanBlock : cleanBlock + ';'
      
      try {
        await prisma.$executeRawUnsafe(statement)
        console.log(`✓ Применён блок ${i + 1}/${blocks.length}`)
      } catch (error: any) {
        const errorMsg = error?.message || String(error)
        if (
          errorMsg.includes('already exists') ||
          errorMsg.includes('duplicate') ||
          errorMsg.includes('UNIQUE constraint') ||
          errorMsg.includes('no such table') && errorMsg.includes('groups')
        ) {
          console.log(`⚠ Пропущен блок ${i + 1} (уже существует или не применимо)`)
        } else {
          console.error(`✗ Ошибка в блоке ${i + 1}:`, errorMsg)
          console.error('Первые 200 символов блока:', statement.substring(0, 200))
        }
      }
    }

    console.log('Миграция применена!')
  } catch (error) {
    console.error('Критическая ошибка:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
