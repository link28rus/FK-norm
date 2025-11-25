# Скрипт для сборки MSI установщика через WiX Toolset
# Требуется: WiX Toolset 4.x (https://wixtoolset.org/)
# Запуск: .\installer\build-msi.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Сборка MSI установщика NormTracker ===" -ForegroundColor Green

# Проверка WiX Toolset
Write-Host "`nПроверка WiX Toolset..." -ForegroundColor Yellow
$wixPath = "${env:ProgramFiles}\WiX Toolset v4.0 SDK\bin"
if (-not (Test-Path $wixPath)) {
    $wixPath = "${env:ProgramFiles(x86)}\WiX Toolset v4.0 SDK\bin"
}
if (-not (Test-Path $wixPath)) {
    Write-Host "Ошибка: WiX Toolset не найден." -ForegroundColor Red
    Write-Host "Установите WiX Toolset 4.x с https://wixtoolset.org/" -ForegroundColor Yellow
    Write-Host "Ожидаемый путь: $wixPath" -ForegroundColor Yellow
    exit 1
}
Write-Host "WiX Toolset найден: $wixPath" -ForegroundColor Green

# Проверка .NET SDK (для WiX 4.x)
Write-Host "`nПроверка .NET SDK..." -ForegroundColor Yellow
$dotnetVersion = dotnet --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка: .NET SDK не найден." -ForegroundColor Red
    Write-Host "Установите .NET SDK 6.0+ с https://dotnet.microsoft.com/" -ForegroundColor Yellow
    exit 1
}
Write-Host ".NET SDK версия: $dotnetVersion" -ForegroundColor Green

# Проверка production build
Write-Host "`nПроверка production build..." -ForegroundColor Yellow
$productionPath = Join-Path $PSScriptRoot "..\dist\production"
if (-not (Test-Path $productionPath)) {
    Write-Host "Ошибка: production build не найден." -ForegroundColor Red
    Write-Host "Сначала выполните сборку: .\installer\build-production.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host "Production build найден: $productionPath" -ForegroundColor Green

# Проверка NSSM
Write-Host "`nПроверка NSSM..." -ForegroundColor Yellow
$nssmPath = Join-Path $PSScriptRoot "nssm"
if (-not (Test-Path "$nssmPath\nssm.exe")) {
    Write-Host "Предупреждение: NSSM не найден. Скачивание..." -ForegroundColor Yellow
    
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$nssmPath.zip"
    
    New-Item -ItemType Directory -Path $nssmPath -Force | Out-Null
    
    try {
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
        Expand-Archive -Path $nssmZip -DestinationPath $nssmPath -Force
        
        # NSSM находится в подпапке win64 или win32
        if (Test-Path "$nssmPath\nssm-2.24\win64\nssm.exe") {
            Copy-Item "$nssmPath\nssm-2.24\win64\nssm.exe" "$nssmPath\nssm.exe" -Force
        } elseif (Test-Path "$nssmPath\nssm-2.24\win32\nssm.exe") {
            Copy-Item "$nssmPath\nssm-2.24\win32\nssm.exe" "$nssmPath\nssm.exe" -Force
        }
        
        Remove-Item $nssmZip -Force -ErrorAction SilentlyContinue
        Write-Host "NSSM успешно скачан" -ForegroundColor Green
    } catch {
        Write-Host "Ошибка при скачивании NSSM: $_" -ForegroundColor Red
        Write-Host "Скачайте NSSM вручную с https://nssm.cc/download и поместите nssm.exe в installer\nssm\" -ForegroundColor Yellow
        exit 1
    }
}

# Создание шаблона .env файла
Write-Host "`nСоздание шаблона .env файла..." -ForegroundColor Yellow
$envTemplate = @"
PORT=3000
DATABASE_URL=postgresql://postgres:admin@localhost:5432/fk_norm?schema=public
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
NODE_ENV=production
"@
$envTemplatePath = Join-Path $productionPath ".env.template"
Set-Content -Path $envTemplatePath -Value $envTemplate -Encoding UTF8

# Генерация списка файлов через Heat
Write-Host "`nГенерация списка файлов через Heat..." -ForegroundColor Yellow
$heatExe = Join-Path $wixPath "heat.exe"
if (-not (Test-Path $heatExe)) {
    Write-Host "Ошибка: heat.exe не найден в $wixPath" -ForegroundColor Red
    Write-Host "Убедитесь, что WiX Toolset установлен правильно" -ForegroundColor Yellow
    exit 1
}

$heatOutput = Join-Path $PSScriptRoot "heat-files.wxs"

# Удаляем старый файл, если существует
if (Test-Path $heatOutput) {
    Remove-Item $heatOutput -Force
}

& $heatExe dir "$productionPath" `
    -cg ApplicationFiles `
    -gg `
    -scom `
    -sreg `
    -sfrag `
    -dr INSTALLFOLDER `
    -var var.ProductionPath `
    -out $heatOutput

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при генерации списка файлов через Heat" -ForegroundColor Red
    exit 1
}

Write-Host "Список файлов сгенерирован: $heatOutput" -ForegroundColor Green

# Создание папки для установщика
Write-Host "`nСоздание папки для установщика..." -ForegroundColor Yellow
$distInstallerPath = Join-Path $PSScriptRoot "..\dist\installer"
New-Item -ItemType Directory -Path $distInstallerPath -Force | Out-Null

# Поиск пути к Node.js
Write-Host "`nПоиск пути к Node.js..." -ForegroundColor Yellow
$nodePath = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $nodePath) {
    $nodePath = "${env:ProgramFiles}\nodejs\node.exe"
    if (-not (Test-Path $nodePath)) {
        $nodePath = "${env:ProgramFiles(x86)}\nodejs\node.exe"
    }
}
if (-not (Test-Path $nodePath)) {
    Write-Host "Предупреждение: Node.js не найден. Используется путь по умолчанию." -ForegroundColor Yellow
    $nodePath = "C:\Program Files\nodejs\node.exe"
}
Write-Host "Путь к Node.js: $nodePath" -ForegroundColor Green

# Сборка MSI через dotnet build
Write-Host "`nСборка MSI установщика..." -ForegroundColor Yellow
Push-Location $PSScriptRoot

try {
    # Собираем MSI
    # В WiX 4.x переменные передаются через -p:DefineConstants
    dotnet build NormTracker.wixproj `
        -p:ProductionPath="$productionPath" `
        -p:NSSMPath="$nssmPath" `
        -p:NodePath="$nodePath" `
        -p:DefineConstants="NodePath=$nodePath" `
        -c Release
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nОшибка при сборке MSI" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    # Копируем MSI в папку dist/installer
    $msiFile = Get-ChildItem -Path "bin\Release" -Filter "*.msi" -Recurse | Select-Object -First 1
    if ($msiFile) {
        Copy-Item -Path $msiFile.FullName -Destination "$distInstallerPath\NormTracker-Setup-1.0.0.msi" -Force
        Write-Host "`n=== MSI установщик успешно создан! ===" -ForegroundColor Green
        Write-Host "Файл установщика: $distInstallerPath\NormTracker-Setup-1.0.0.msi" -ForegroundColor Cyan
    } else {
        Write-Host "`nОшибка: MSI файл не найден после сборки" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} finally {
    Pop-Location
}

