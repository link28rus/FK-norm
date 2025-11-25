# Скрипт для сборки установщика Windows
# Требуется: Inno Setup 6+ (https://innosetup.com/)
# Запуск: .\installer\build-installer.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Сборка установщика NormTracker ===" -ForegroundColor Green

# Проверка Inno Setup
Write-Host "`nПроверка Inno Setup..." -ForegroundColor Yellow
$innoSetupPath = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $innoSetupPath)) {
    $innoSetupPath = "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
}
if (-not (Test-Path $innoSetupPath)) {
    Write-Host "Ошибка: Inno Setup не найден." -ForegroundColor Red
    Write-Host "Установите Inno Setup 6+ с https://innosetup.com/" -ForegroundColor Yellow
    Write-Host "Ожидаемый путь: $innoSetupPath" -ForegroundColor Yellow
    exit 1
}
Write-Host "Inno Setup найден: $innoSetupPath" -ForegroundColor Green

# Проверка production build
Write-Host "`nПроверка production build..." -ForegroundColor Yellow
if (-not (Test-Path "dist\production")) {
    Write-Host "Ошибка: production build не найден." -ForegroundColor Red
    Write-Host "Сначала выполните сборку: .\installer\build-production.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host "Production build найден" -ForegroundColor Green

# Проверка NSSM
Write-Host "`nПроверка NSSM..." -ForegroundColor Yellow
if (-not (Test-Path "installer\nssm\nssm.exe")) {
    Write-Host "Предупреждение: NSSM не найден. Скачивание..." -ForegroundColor Yellow
    
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "installer\nssm.zip"
    $nssmDir = "installer\nssm"
    
    New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null
    
    try {
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
        Expand-Archive -Path $nssmZip -DestinationPath $nssmDir -Force
        
        # NSSM находится в подпапке win64 или win32
        if (Test-Path "$nssmDir\nssm-2.24\win64\nssm.exe") {
            Copy-Item "$nssmDir\nssm-2.24\win64\nssm.exe" "$nssmDir\nssm.exe" -Force
        } elseif (Test-Path "$nssmDir\nssm-2.24\win32\nssm.exe") {
            Copy-Item "$nssmDir\nssm-2.24\win32\nssm.exe" "$nssmDir\nssm.exe" -Force
        }
        
        Remove-Item $nssmZip -Force -ErrorAction SilentlyContinue
        Write-Host "NSSM успешно скачан" -ForegroundColor Green
    } catch {
        Write-Host "Ошибка при скачивании NSSM: $_" -ForegroundColor Red
        Write-Host "Скачайте NSSM вручную с https://nssm.cc/download и поместите nssm.exe в installer\nssm\" -ForegroundColor Yellow
        exit 1
    }
}

# Создание папки для установщика
Write-Host "`nСоздание папки для установщика..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "dist" -Force | Out-Null

# Компиляция установщика
Write-Host "`nКомпиляция установщика..." -ForegroundColor Yellow
$setupScript = Join-Path $PSScriptRoot "setup.iss"
& $innoSetupPath $setupScript

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Установщик успешно создан! ===" -ForegroundColor Green
    Write-Host "Файл установщика: dist\NormTracker-Setup-1.0.0.exe" -ForegroundColor Cyan
} else {
    Write-Host "`nОшибка при компиляции установщика" -ForegroundColor Red
    exit 1
}




