# Установщик NormTracker для Windows (MSI)

Этот каталог содержит файлы для создания MSI установщика Windows для приложения NormTracker.

## Требования

1. **WiX Toolset 4.x** - https://wixtoolset.org/
   - Скачайте и установите WiX Toolset v4.0 SDK
   - Убедитесь, что путь к WiX доступен

2. **.NET SDK 6.0+** - требуется для WiX 4.x
   - Скачайте с https://dotnet.microsoft.com/

3. **Node.js** - для сборки production build
   - Рекомендуется Node.js 18+

4. **PowerShell** - для запуска скриптов сборки

## Структура файлов

```
installer/
├── NormTracker.wxs        # Основной файл конфигурации WiX
├── NormTracker.wixproj   # Проект WiX для сборки MSI
├── heat-files.wxs        # Автоматически генерируемый список файлов
├── build-production.ps1   # Скрипт сборки production build
├── build-msi.ps1         # Скрипт сборки MSI установщика
├── nssm/                  # NSSM для создания Windows-сервиса
│   └── nssm.exe
└── README.md              # Этот файл
```

## Процесс сборки

### Шаг 1: Сборка production build

```powershell
.\installer\build-production.ps1
```

Или через npm:
```powershell
npm run build:production
```

Этот скрипт:
- Устанавливает зависимости
- Генерирует Prisma Client
- Собирает Next.js приложение
- Копирует все необходимые файлы в `dist\production`
- Создает `server.js` для запуска приложения

### Шаг 2: Сборка MSI установщика

```powershell
.\installer\build-msi.ps1
```

Или через npm:
```powershell
npm run build:msi
```

Этот скрипт:
- Проверяет наличие WiX Toolset и .NET SDK
- Генерирует список файлов через Heat
- Скачивает NSSM (если отсутствует)
- Автоматически находит путь к Node.js
- Компилирует MSI через `dotnet build`
- Создает `dist\installer\NormTracker-Setup-1.0.0.msi`

### Полная сборка (оба шага)

```powershell
npm run build:all
```

## Установка

1. Запустите `dist\installer\NormTracker-Setup-1.0.0.msi`
2. Следуйте инструкциям мастера установки Windows
3. Установщик автоматически:
   - Скопирует файлы в `C:\Program Files\NormTracker`
   - Создаст Windows-сервис "NormTrackerService" через NSSM
   - Настроит сервис (автозапуск, логи)
   - Запустит сервис
4. После установки:
   - Отредактируйте `.env` файл в папке установки (порт, DATABASE_URL, JWT_SECRET)
   - Перезапустите сервис для применения изменений

## Удаление

1. Откройте "Программы и компоненты" в Windows
2. Найдите "NormTracker"
3. Нажмите "Удалить"
4. Установщик автоматически:
   - Остановит сервис
   - Удалит сервис из Windows
   - Удалит все файлы приложения

## Настройка сервиса

После установки сервис можно управлять через:

- **Службы Windows** (services.msc)
- **Командная строка**:
  ```cmd
  sc start NormTrackerService
  sc stop NormTrackerService
  sc query NormTrackerService
  ```

Или через NSSM:
```cmd
C:\Program Files\NormTracker\nssm\nssm.exe start NormTrackerService
C:\Program Files\NormTracker\nssm\nssm.exe stop NormTrackerService
```

## Логи

Логи сервиса находятся в:
- `C:\Program Files\NormTracker\logs\service.log`
- `C:\Program Files\NormTracker\logs\service-error.log`

## Конфигурация

Файл конфигурации `.env` находится в:
- `C:\Program Files\NormTracker\.env`

Для изменения настроек:
1. Остановите сервис
2. Отредактируйте `.env`
3. Запустите сервис

## Устранение неполадок

### Сервис не запускается

1. Проверьте логи в `logs\service-error.log`
2. Убедитесь, что порт не занят другим приложением
3. Проверьте, что PostgreSQL доступен по указанному DATABASE_URL
4. Проверьте права доступа к папке приложения

### Приложение не открывается в браузере

1. Проверьте, что сервис запущен
2. Проверьте порт в `.env`
3. Откройте браузер вручную: `http://localhost:<PORT>`

### Ошибки базы данных

1. Убедитесь, что PostgreSQL запущен
2. Проверьте DATABASE_URL в `.env`
3. Выполните миграции вручную:
   ```cmd
   cd "C:\Program Files\NormTracker"
   npx prisma migrate deploy
   ```

## Разработка установщика

Для изменения установщика отредактируйте `NormTracker.wxs` и пересоберите:

```powershell
.\installer\build-msi.ps1
```

Основные параметры в `NormTracker.wxs`:
- `Package Name` - имя приложения
- `Package Version` - версия
- `UpgradeCode` - уникальный код для обновлений
- `INSTALLFOLDER` - директория установки по умолчанию
- `ServiceName` - имя Windows-сервиса (в CustomAction)

### Изменение версии

Измените `Version` в `NormTracker.wxs` и пересоберите MSI.

### Добавление файлов

Файлы автоматически включаются через Heat. Если нужно добавить файлы вручную, отредактируйте `NormTracker.wxs` в секции `ApplicationFiles`.

