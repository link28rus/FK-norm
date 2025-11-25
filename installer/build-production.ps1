# Скрипт для сборки production build приложения
# Запуск: .\installer\build-production.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Сборка production build для NormTracker ===" -ForegroundColor Green

# Проверка Node.js
Write-Host "`nПроверка Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка: Node.js не найден. Установите Node.js и повторите попытку." -ForegroundColor Red
    exit 1
}
Write-Host "Node.js версия: $nodeVersion" -ForegroundColor Green

# Очистка предыдущих сборок
Write-Host "`nОчистка предыдущих сборок..." -ForegroundColor Yellow
if (Test-Path "dist\production") {
    Remove-Item -Path "dist\production" -Recurse -Force
}
New-Item -ItemType Directory -Path "dist\production" -Force | Out-Null

# Установка зависимостей (если нужно)
Write-Host "`nПроверка зависимостей..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "Установка зависимостей..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Ошибка при установке зависимостей" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Зависимости уже установлены" -ForegroundColor Green
}

# Генерация Prisma Client
Write-Host "`nГенерация Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при генерации Prisma Client" -ForegroundColor Red
    exit 1
}

# Сборка Next.js
Write-Host "`nСборка Next.js приложения..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при сборке Next.js" -ForegroundColor Red
    exit 1
}

# Копирование файлов
Write-Host "`nКопирование файлов..." -ForegroundColor Yellow

# Копируем .next
Copy-Item -Path ".next" -Destination "dist\production\.next" -Recurse -Force

# Копируем node_modules (только production зависимости)
Write-Host "Копирование node_modules..." -ForegroundColor Yellow
# Сначала копируем package.json, затем устанавливаем зависимости
Copy-Item -Path "package.json" -Destination "dist\production\package.json" -Force
Copy-Item -Path "package-lock.json" -Destination "dist\production\package-lock.json" -Force -ErrorAction SilentlyContinue

# Устанавливаем только production зависимости
Push-Location "dist\production"
npm ci --production=true
$npmSuccess = $LASTEXITCODE -eq 0
Pop-Location

if (-not $npmSuccess) {
    Write-Host "Предупреждение: не удалось установить production зависимости" -ForegroundColor Yellow
    Write-Host "Копирование node_modules из исходной папки..." -ForegroundColor Yellow
    Copy-Item -Path "node_modules" -Destination "dist\production\node_modules" -Recurse -Force
}

# Устанавливаем dotenv для чтения .env файла
Write-Host "Установка dotenv..." -ForegroundColor Yellow
Push-Location "dist\production"
npm install dotenv --save --production=false
Pop-Location

# Копируем необходимые файлы
$filesToCopy = @(
    "package.json",
    "package-lock.json",
    "next.config.js",
    "tsconfig.json",
    "tailwind.config.ts",
    "postcss.config.js"
)

foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination "dist\production\$file" -Force
        Write-Host "  Скопирован: $file" -ForegroundColor Gray
    }
}

# Копируем папки
$dirsToCopy = @(
    "prisma",
    "public"
)

foreach ($dir in $dirsToCopy) {
    if (Test-Path $dir) {
        Copy-Item -Path $dir -Destination "dist\production\$dir" -Recurse -Force
        Write-Host "  Скопирована папка: $dir" -ForegroundColor Gray
    }
}

# Создание server.js для запуска
Write-Host "`nСоздание server.js..." -ForegroundColor Yellow
$serverJs = @"
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

// Загружаем переменные окружения из .env
require('dotenv').config();

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

const app = next({ 
  dev: false,
  dir: __dirname,
  conf: {
    distDir: '.next'
  }
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, hostname, (err) => {
    if (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err);
  process.exit(1);
});
"@

Set-Content -Path "dist\production\server.js" -Value $serverJs -Encoding UTF8

# Создание package.json для production
Write-Host "`nОбновление package.json для production..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$packageJson.scripts.start = "node server.js"
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "dist\production\package.json" -Encoding UTF8

Write-Host "`n=== Сборка завершена успешно! ===" -ForegroundColor Green
Write-Host "Файлы находятся в: dist\production" -ForegroundColor Cyan
Write-Host "`nСледующий шаг: запустите сборку установщика:" -ForegroundColor Yellow
Write-Host "  .\installer\build-installer.ps1" -ForegroundColor Cyan

