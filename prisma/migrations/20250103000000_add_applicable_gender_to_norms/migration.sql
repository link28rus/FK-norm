-- CreateEnum
CREATE TYPE "NormApplicableGender" AS ENUM ('ALL', 'MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "norm_templates" ADD COLUMN "applicableGender" "NormApplicableGender" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "group_norms" ADD COLUMN "applicableGender" "NormApplicableGender" NOT NULL DEFAULT 'ALL';



