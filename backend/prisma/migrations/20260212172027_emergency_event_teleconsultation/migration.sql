-- DropForeignKey
ALTER TABLE "emergency_events" DROP CONSTRAINT "emergency_events_measurement_id_fkey";

-- AlterTable
ALTER TABLE "emergency_events" ADD COLUMN     "teleconsultation_id" TEXT,
ALTER COLUMN "measurement_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "emergency_events_teleconsultation_id_idx" ON "emergency_events"("teleconsultation_id");

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "bp_measurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_teleconsultation_id_fkey" FOREIGN KEY ("teleconsultation_id") REFERENCES "teleconsultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
