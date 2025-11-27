-- AlterTable: добавление полей выбытия ученика
ALTER TABLE "athletes" ADD COLUMN "exitReason" VARCHAR(255);
ALTER TABLE "athletes" ADD COLUMN "exitDate" TIMESTAMP(3);

