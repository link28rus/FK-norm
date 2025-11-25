// Скрипт для удаления нормативов через API
// Используйте этот скрипт, если нормативы видны в интерфейсе, но не находятся в БД напрямую

const groupId = 'cmibhtfkr004h6frkcughkep0'
const baseUrl = 'http://localhost:3000'

async function deleteNorm(type: string, date: string) {
  const url = `${baseUrl}/api/trainer/groups/${groupId}/norms/delete?type=${encodeURIComponent(type)}&date=${encodeURIComponent(date)}`
  
  console.log(`Удаление норматива: ${type} - ${date}`)
  console.log(`URL: ${url}`)
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Для отправки cookies
    })

    const data = await response.json()
    
    if (response.ok) {
      console.log(`✓ Успешно удалено: ${data.deletedCount} нормативов`)
    } else {
      console.log(`✗ Ошибка: ${data.error} (${response.status})`)
    }
  } catch (error) {
    console.error('Ошибка запроса:', error)
  }
}

async function main() {
  console.log('Попытка удаления нормативов через API...\n')
  
  // Пробуем удалить нормативы
  await deleteNorm('Tets', '2025-11-23')
  await deleteNorm('Бег', '2025-11-22')
  
  console.log('\nГотово!')
}

main()

