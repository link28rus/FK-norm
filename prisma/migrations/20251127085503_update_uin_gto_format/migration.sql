-- AlterTable: изменение размера поля uinGto с 50 на 20 символов для формата 00-00-0000000
ALTER TABLE "athletes" ALTER COLUMN "uinGto" TYPE VARCHAR(20);

