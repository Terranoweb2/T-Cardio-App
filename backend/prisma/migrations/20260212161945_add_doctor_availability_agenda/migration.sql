-- AlterTable
ALTER TABLE "teleconsultation_messages" ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_size_bytes" INTEGER,
ADD COLUMN     "file_type" TEXT,
ADD COLUMN     "file_url" TEXT;

-- CreateTable
CREATE TABLE "doctor_availabilities" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "slot_duration_min" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_unavailabilities" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_unavailabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_tokens" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_by" TEXT,
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doctor_availabilities_doctor_id_idx" ON "doctor_availabilities"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_availabilities_doctor_id_day_of_week_start_time_key" ON "doctor_availabilities"("doctor_id", "day_of_week", "start_time");

-- CreateIndex
CREATE INDEX "doctor_unavailabilities_doctor_id_date_idx" ON "doctor_unavailabilities"("doctor_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokens_token_key" ON "invitation_tokens"("token");

-- CreateIndex
CREATE INDEX "invitation_tokens_doctor_id_idx" ON "invitation_tokens"("doctor_id");

-- CreateIndex
CREATE INDEX "invitation_tokens_token_idx" ON "invitation_tokens"("token");

-- AddForeignKey
ALTER TABLE "doctor_availabilities" ADD CONSTRAINT "doctor_availabilities_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_unavailabilities" ADD CONSTRAINT "doctor_unavailabilities_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
