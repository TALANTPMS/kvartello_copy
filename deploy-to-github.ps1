# Скрипт для загрузки проекта на GitHub

# Переход в директорию проекта
Set-Location "$PSScriptRoot"

# Проверка статуса
Write-Host "Проверка статуса Git..." -ForegroundColor Cyan
git status

# Добавление всех изменений
Write-Host "`nДобавление всех файлов..." -ForegroundColor Cyan
git add .

# Проверка что будет закоммичено
Write-Host "`nФайлы готовые к коммиту:" -ForegroundColor Cyan
git status

# Коммит изменений
Write-Host "`nСоздание коммита..." -ForegroundColor Cyan
$commitMessage = Read-Host "Введите сообщение коммита (или нажмите Enter для использования 'Update project files')"
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "Update project files"
}
git commit -m $commitMessage

# Отправка на GitHub
Write-Host "`nОтправка на GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host "`n✓ Проект успешно загружен на GitHub!" -ForegroundColor Green
Write-Host "Репозиторий: https://github.com/Slerz/fill_template.git" -ForegroundColor Yellow
