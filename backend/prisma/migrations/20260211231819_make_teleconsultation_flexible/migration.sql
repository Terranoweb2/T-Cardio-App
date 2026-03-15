-- DropForeignKey
ALTER TABLE "teleconsultations" DROP CONSTRAINT "teleconsultations_doctor_id_fkey";

-- AlterTable
ALTER TABLE "teleconsultations" ALTER COLUMN "doctor_id" DROP NOT NULL,
ALTER COLUMN "scheduled_at" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "teleconsultations" ADD CONSTRAINT "teleconsultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
