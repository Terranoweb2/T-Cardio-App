-- AlterTable
ALTER TABLE "patients" ALTER COLUMN "first_name" DROP NOT NULL,
ALTER COLUMN "last_name" DROP NOT NULL,
ALTER COLUMN "birth_date" DROP NOT NULL;
