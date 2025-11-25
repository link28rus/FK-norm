; Inno Setup Script для NormTracker
; Требуется: Inno Setup 6+ (https://innosetup.com/)

#define AppName "NormTracker"
#define AppVersion "1.0.0"
#define AppPublisher "FK-Norm"
#define AppURL "http://localhost"
#define AppExeName "NormTrackerService.exe"
#define ServiceName "NormTrackerService"
#define InstallDir "C:\Program Files\NormTracker"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={#InstallDir}
DefaultGroupName={#AppName}
AllowNoIcons=yes
LicenseFile=
OutputDir=dist
OutputBaseFilename=NormTracker-Setup-{#AppVersion}
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1

[Files]
; Файлы приложения
Source: "dist\production\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; NSSM для создания сервиса
Source: "installer\nssm\nssm.exe"; DestDir: "{app}\nssm"; Flags: ignoreversion
; Node.js runtime (если включен в установку)
; Source: "installer\nodejs\*"; DestDir: "{app}\nodejs"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "http://localhost:{code:GetPort}"; IconFilename: "{app}\icon.ico"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "http://localhost:{code:GetPort}"; Tasks: desktopicon; IconFilename: "{app}\icon.ico"
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#AppName}"; Filename: "http://localhost:{code:GetPort}"; Tasks: quicklaunchicon; IconFilename: "{app}\icon.ico"

[Run]
; Создание папки для логов
Filename: "{cmd}"; Parameters: "/c mkdir ""{app}\logs"" 2>nul"; StatusMsg: "Создание папки для логов..."; Flags: runhidden
; Установка сервиса через NSSM
Filename: "{app}\nssm\nssm.exe"; Parameters: "install {#ServiceName} ""{code:GetNodePath}"" ""{code:GetStartCommand}"""; StatusMsg: "Установка Windows-сервиса..."; Flags: runhidden
; Настройка сервиса
Filename: "{app}\nssm\nssm.exe"; Parameters: "set {#ServiceName} AppDirectory ""{app}"""; StatusMsg: "Настройка сервиса..."; Flags: runhidden
Filename: "{app}\nssm\nssm.exe"; Parameters: "set {#ServiceName} DisplayName ""{#AppName} Service"""; StatusMsg: "Настройка сервиса..."; Flags: runhidden
Filename: "{app}\nssm\nssm.exe"; Parameters: "set {#ServiceName} Description ""Сервис для отслеживания нормативов по физической культуре"""; StatusMsg: "Настройка сервиса..."; Flags: runhidden
Filename: "{app}\nssm\nssm.exe"; Parameters: "set {#ServiceName} Start SERVICE_AUTO_START"; StatusMsg: "Настройка сервиса..."; Flags: runhidden
Filename: "{app}\nssm\nssm.exe"; Parameters: "set {#ServiceName} AppStdout ""{app}\logs\service.log"""; StatusMsg: "Настройка сервиса..."; Flags: runhidden
Filename: "{app}\nssm\nssm.exe"; Parameters: "set {#ServiceName} AppStderr ""{app}\logs\service-error.log"""; StatusMsg: "Настройка сервиса..."; Flags: runhidden
Filename: "{app}\nssm\nssm.exe"; Parameters: "set {#ServiceName} AppEnvironmentExtra ""PORT={code:GetPort}"""; StatusMsg: "Настройка сервиса..."; Flags: runhidden
; Запуск сервиса
Filename: "{app}\nssm\nssm.exe"; Parameters: "start {#ServiceName}"; StatusMsg: "Запуск сервиса..."; Flags: runhidden
; Открытие браузера (опционально)
Filename: "http://localhost:{code:GetPort}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Остановка и удаление сервиса
Filename: "{app}\nssm\nssm.exe"; Parameters: "stop {#ServiceName}"; StatusMsg: "Остановка сервиса..."; Flags: runhidden
Filename: "{app}\nssm\nssm.exe"; Parameters: "remove {#ServiceName} confirm"; StatusMsg: "Удаление сервиса..."; Flags: runhidden

[Code]
var
  PortPage: TInputQueryWizardPage;
  DatabaseUrlPage: TInputQueryWizardPage;
  JwtSecretPage: TInputQueryWizardPage;
  NodePathPage: TInputQueryWizardPage;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

procedure InitializeWizard;
begin
  // Страница ввода порта
  PortPage := CreateInputQueryPage(wpWelcome,
    'Настройка порта', 'Укажите порт для веб-сервера',
    'Введите номер порта (по умолчанию 3000):');
  PortPage.Add('Порт:', False);
  PortPage.Values[0] := '3000';

  // Страница ввода DATABASE_URL
  DatabaseUrlPage := CreateInputQueryPage(PortPage.ID,
    'Настройка базы данных', 'Укажите строку подключения к PostgreSQL',
    'Введите DATABASE_URL (например: postgresql://user:password@localhost:5432/fk_norm):');
  DatabaseUrlPage.Add('DATABASE_URL:', False);
  DatabaseUrlPage.Values[0] := 'postgresql://postgres:admin@localhost:5432/fk_norm?schema=public';

  // Страница ввода JWT_SECRET
  JwtSecretPage := CreateInputQueryPage(DatabaseUrlPage.ID,
    'Настройка безопасности', 'Укажите секретный ключ для JWT',
    'Введите JWT_SECRET (минимум 32 символа):');
  JwtSecretPage.Add('JWT_SECRET:', False);
  JwtSecretPage.Values[0] := 'your-super-secret-jwt-key-change-this-in-production-min-32-chars';

  // Страница выбора Node.js
  NodePathPage := CreateInputQueryPage(JwtSecretPage.ID,
    'Путь к Node.js', 'Укажите путь к исполняемому файлу Node.js',
    'Введите полный путь к node.exe (например: C:\Program Files\nodejs\node.exe):');
  NodePathPage.Add('Путь к node.exe:', False);
  NodePathPage.Values[0] := GetNodePathDefault;
end;

function GetPort(Param: String): String;
begin
  Result := PortPage.Values[0];
end;

function GetDatabaseUrl(Param: String): String;
begin
  Result := DatabaseUrlPage.Values[0];
end;

function GetJwtSecret(Param: String): String;
begin
  Result := JwtSecretPage.Values[0];
end;

function GetNodePath(Param: String): String;
begin
  Result := NodePathPage.Values[0];
end;

function GetNodePathDefault(): String;
var
  NodePath: String;
begin
  // Проверяем стандартные пути
  NodePath := ExpandConstant('{pf}\nodejs\node.exe');
  if FileExists(NodePath) then
    Result := NodePath
  else
  begin
    NodePath := ExpandConstant('{pf32}\nodejs\node.exe');
    if FileExists(NodePath) then
      Result := NodePath
    else
      Result := 'C:\Program Files\nodejs\node.exe';
  end;
end;

function GetStartCommand(Param: String): String;
begin
  Result := ExpandConstant('"{app}\server.js"');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Port: Integer;
begin
  Result := True;
  
  if CurPageID = PortPage.ID then
  begin
    // Проверка порта
    if not TryStrToInt(PortPage.Values[0], Port) or (Port < 1) or (Port > 65535) then
    begin
      MsgBox('Пожалуйста, введите корректный номер порта (1-65535)', mbError, MB_OK);
      Result := False;
    end;
  end
  else if CurPageID = NodePathPage.ID then
  begin
    // Проверка существования node.exe
    if not FileExists(NodePathPage.Values[0]) then
    begin
      if MsgBox('Файл node.exe не найден по указанному пути. Продолжить установку?', mbConfirmation, MB_YESNO) = IDNO then
        Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvContent: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Создание .env файла
    EnvContent := 'PORT=' + PortPage.Values[0] + #13#10;
    EnvContent := EnvContent + 'DATABASE_URL=' + DatabaseUrlPage.Values[0] + #13#10;
    EnvContent := EnvContent + 'JWT_SECRET=' + JwtSecretPage.Values[0] + #13#10;
    EnvContent := EnvContent + 'NODE_ENV=production' + #13#10;
    
    SaveStringToFile(ExpandConstant('{app}\.env'), EnvContent, False);
  end;
end;

