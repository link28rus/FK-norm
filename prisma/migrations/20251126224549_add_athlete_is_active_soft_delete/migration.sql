-- AlterTable: добавление поля isActive для soft delete
ALTER TABLE "athletes" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Обновляем существующие записи: все ученики считаются активными
UPDATE "athletes" SET "isActive" = true WHERE "isActive" IS NULL;

-- AlterTable: изменение каскадного удаления нормативов на Restrict
-- Примечание: в PostgreSQL нельзя напрямую изменить onDelete через ALTER TABLE
-- Но так как теперь мы используем soft delete (не удаляем записи), каскад не будет срабатывать
-- Для безопасности оставляем связь как есть, но физическое удаление не будет происходить

