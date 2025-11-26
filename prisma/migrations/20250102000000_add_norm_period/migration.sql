-- CreateEnum
CREATE TYPE "NormPeriod" AS ENUM ('START_OF_YEAR', 'END_OF_YEAR', 'REGULAR');

-- AlterTable
ALTER TABLE "group_norms" ADD COLUMN "period" "NormPeriod" NOT NULL DEFAULT 'REGULAR';



