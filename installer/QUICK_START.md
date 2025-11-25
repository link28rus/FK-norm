# Быстрый старт: Сборка MSI установщика

## Минимальные требования

1. **WiX Toolset 4.x** - https://wixtoolset.org/
2. **.NET SDK 6.0+** - https://dotnet.microsoft.com/
3. **Node.js 18+**
4. **PowerShell**

## Быстрая сборка

### Вариант 1: Через npm команды

```powershell
# Сборка production build и MSI установщика
npm run build:all
```

### Вариант 2: Пошагово

```powershell
# Шаг 1: Сборка production build
npm run build:production

# Шаг 2: Сборка MSI установщика
npm run build:msi
```

### Вариант 3: Прямой запуск скриптов

```powershell
# Сборка production build
.\installer\build-production.ps1

# Сборка MSI установщика
.\installer\build-msi.ps1
```

## Результат

После успешной сборки MSI установщик будет находиться в:
```
dist\installer\NormTracker-Setup-1.0.0.msi
```

## Установка

1. Запустите `dist\NormTracker-Setup-1.0.0.exe`
2. Следуйте инструкциям мастера установки
3. После установки приложение будет доступно как Windows-сервис

## Проверка установки

1. Откройте "Службы Windows" (services.msc)
2. Найдите "NormTrackerService"
3. Убедитесь, что сервис запущен
4. Откройте браузер: `http://localhost:3000` (или указанный порт)

## Удаление

1. Откройте "Программы и компоненты" (или "Приложения" в Windows 10/11)
2. Найдите "NormTracker"
3. Нажмите "Удалить"
4. MSI установщик автоматически:
   - Остановит сервис
   - Удалит сервис из Windows
   - Удалит все файлы приложения

Или через командную строку:
```cmd
"C:\Program Files\NormTracker\nssm\nssm.exe" stop NormTrackerService
"C:\Program Files\NormTracker\nssm\nssm.exe" remove NormTrackerService confirm
```

