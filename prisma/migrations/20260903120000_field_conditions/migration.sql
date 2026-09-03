-- Adds conditional show/hide + alternate-label support to FormField. Purely
-- additive - four new nullable columns, nothing existing touched.

-- CreateEnum
CREATE TYPE "FieldConditionMode" AS ENUM ('SHOW_IF', 'HIDE_IF');

-- AlterTable
ALTER TABLE "FormField" ADD COLUMN "conditionFieldId" TEXT;
ALTER TABLE "FormField" ADD COLUMN "conditionValue" TEXT;
ALTER TABLE "FormField" ADD COLUMN "conditionMode" "FieldConditionMode";
ALTER TABLE "FormField" ADD COLUMN "altLabel" TEXT;
