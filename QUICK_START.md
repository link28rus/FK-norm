# Быстрый старт

## Вариант 1: Бесплатная облачная БД (рекомендуется)

1. Зарегистрируйтесь на https://neon.tech (или https://supabase.com)
2. Создайте новый проект
3. Скопируйте `DATABASE_URL` из настроек проекта
4. Вставьте в файл `.env`:
   ```
   DATABASE_URL="ваш_url_из_neon"
   JWT_SECRET="любая-случайная-строка-для-безопасности"
   NODE_ENV="development"
   ```

## Вариант 2: Локальный PostgreSQL

1. Установите PostgreSQL: https://www.postgresql.org/download/
2. Создайте базу данных:
   ```sql
   CREATE DATABASE fk_norm;
   ```
3. В файле `.env` укажите:
   ```
   DATABASE_URL="postgresql://postgres:ваш_пароль@localhost:5432/fk_norm?schema=public"
   JWT_SECRET="любая-случайная-строка-для-безопасности"
   NODE_ENV="development"
   ```

## Вариант 3: Docker

```bash
docker run --name postgres-fk-norm -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fk_norm -p 5432:5432 -d postgres
```

В `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fk_norm?schema=public"
JWT_SECRET="любая-случайная-строка-для-безопасности"
NODE_ENV="development"
```

## После настройки БД

1. Выполните миграции:
   ```bash
   npm run prisma:migrate
   ```

2. Создайте администратора:
   ```bash
   npm run create-admin admin@example.com admin123
   ```

3. Войдите в систему:
   - Email: `admin@example.com`
   - Пароль: `admin123`

4. Откройте http://localhost:3000




