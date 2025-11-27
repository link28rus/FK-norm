-- AlterTable: добавление полей антропометрии
ALTER TABLE "athletes" ADD COLUMN "height" INTEGER;
ALTER TABLE "athletes" ADD COLUMN "weight" INTEGER;
ALTER TABLE "athletes" ADD COLUMN "shoeSize" DOUBLE PRECISION;

