-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'MEDECIN', 'CARDIOLOGUE', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicalStatus" AS ENUM ('STANDARD', 'HYPERTENDU', 'POST_AVC', 'DIABETIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('MANUEL', 'BLUETOOTH');

-- CreateEnum
CREATE TYPE "MeasurementContext" AS ENUM ('REPOS', 'APRES_EFFORT', 'MATIN', 'SOIR', 'STRESS', 'INCONNU');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('FAIBLE', 'MODERE', 'ELEVE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "DoctorVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PatientDoctorStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "TeleconsultationStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('GENERAL', 'TELECONSULTATION', 'URGENCE', 'SUIVI');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'PERSONNALISE', 'URGENCE');

-- CreateEnum
CREATE TYPE "EmergencyTriggerType" AS ENUM ('SEUIL_SYSTOLIQUE', 'SEUIL_DIASTOLIQUE', 'PATTERN_CRITIQUE', 'MANUEL');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT', 'AI_ANALYSIS');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('EMERGENCY', 'AI_RISK', 'THRESHOLD', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ThresholdCategory" AS ENUM ('RISK', 'EMERGENCY', 'TREND');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "last_login_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender",
    "height_cm" INTEGER,
    "weight_kg" DECIMAL(5,2),
    "medical_status" "MedicalStatus" NOT NULL DEFAULT 'STANDARD',
    "medical_history" JSONB NOT NULL DEFAULT '{}',
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "medications" JSONB NOT NULL DEFAULT '[]',
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "notification_preferences" JSONB NOT NULL DEFAULT '{"email": true, "sms": true, "push": true}',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "rpps_number" TEXT,
    "specialty" TEXT NOT NULL DEFAULT 'CARDIOLOGIE',
    "verification_status" "DoctorVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "verification_documents" JSONB NOT NULL DEFAULT '[]',
    "practice_address" TEXT,
    "practice_phone" TEXT,
    "accepting_new_patients" BOOLEAN NOT NULL DEFAULT true,
    "max_patients" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_doctor_links" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "status" "PatientDoctorStatus" NOT NULL DEFAULT 'PENDING',
    "initiated_by" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "ended_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_doctor_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bp_measurements" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "systolic" INTEGER NOT NULL,
    "diastolic" INTEGER NOT NULL,
    "pulse" INTEGER,
    "source" "MeasurementSource" NOT NULL DEFAULT 'MANUEL',
    "context" "MeasurementContext" NOT NULL DEFAULT 'INCONNU',
    "notes" TEXT,
    "risk_level" "RiskLevel",
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bp_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "patient_id_hash" TEXT NOT NULL,
    "measurement_ids" TEXT[],
    "input_data" JSONB NOT NULL,
    "input_measurements_count" INTEGER NOT NULL,
    "input_period_days" INTEGER NOT NULL,
    "prompt_version_id" TEXT,
    "risk_level" "RiskLevel",
    "confidence_score" DECIMAL(3,2),
    "projections" JSONB,
    "alerts" JSONB,
    "patient_summary" TEXT,
    "doctor_summary" TEXT,
    "model_name" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "processing_time_ms" INTEGER NOT NULL,
    "error_message" TEXT,
    "filtered" BOOLEAN NOT NULL DEFAULT false,
    "filtered_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "version_name" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "model_name" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "model_parameters" JSONB NOT NULL DEFAULT '{"temperature": 0.1, "max_tokens": 2000}',
    "created_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "change_log" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_thresholds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ThresholdCategory" NOT NULL,
    "systolic_min" INTEGER,
    "systolic_max" INTEGER,
    "diastolic_min" INTEGER,
    "diastolic_max" INTEGER,
    "action_type" TEXT,
    "action_params" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT,
    "type" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_events" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "measurement_id" TEXT NOT NULL,
    "trigger_type" "EmergencyTriggerType" NOT NULL,
    "trigger_value" JSONB NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "doctor_notified_at" TIMESTAMP(3),
    "patient_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "emergency_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teleconsultations" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "status" "TeleconsultationStatus" NOT NULL DEFAULT 'PLANNED',
    "rtc_room_id" TEXT,
    "reason" TEXT,
    "summary" TEXT,
    "follow_up_needed" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_date" DATE,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teleconsultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teleconsultation_messages" (
    "id" TEXT NOT NULL,
    "teleconsultation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_role" "UserRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teleconsultation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_notes" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "teleconsultation_id" TEXT,
    "note_type" "NoteType" NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "report_type" "ReportType" NOT NULL DEFAULT 'MENSUEL',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "file_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "file_hash" TEXT,
    "signed_by" TEXT,
    "signed_at" TIMESTAMP(3),
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "last_downloaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_role" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_codes_user_id_idx" ON "verification_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE INDEX "patients_medical_status_idx" ON "patients"("medical_status");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_user_id_key" ON "doctors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_rpps_number_key" ON "doctors"("rpps_number");

-- CreateIndex
CREATE INDEX "doctors_verification_status_idx" ON "doctors"("verification_status");

-- CreateIndex
CREATE INDEX "patient_doctor_links_patient_id_idx" ON "patient_doctor_links"("patient_id");

-- CreateIndex
CREATE INDEX "patient_doctor_links_doctor_id_idx" ON "patient_doctor_links"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_doctor_links_patient_id_doctor_id_key" ON "patient_doctor_links"("patient_id", "doctor_id");

-- CreateIndex
CREATE INDEX "bp_measurements_patient_id_measured_at_idx" ON "bp_measurements"("patient_id", "measured_at" DESC);

-- CreateIndex
CREATE INDEX "bp_measurements_risk_level_idx" ON "bp_measurements"("risk_level");

-- CreateIndex
CREATE INDEX "ai_analyses_patient_id_idx" ON "ai_analyses"("patient_id");

-- CreateIndex
CREATE INDEX "ai_analyses_created_at_idx" ON "ai_analyses"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_version_name_key" ON "prompt_versions"("version_name");

-- CreateIndex
CREATE INDEX "alerts_patient_id_idx" ON "alerts"("patient_id");

-- CreateIndex
CREATE INDEX "alerts_doctor_id_idx" ON "alerts"("doctor_id");

-- CreateIndex
CREATE INDEX "alerts_is_read_idx" ON "alerts"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_events_measurement_id_key" ON "emergency_events"("measurement_id");

-- CreateIndex
CREATE INDEX "emergency_events_patient_id_idx" ON "emergency_events"("patient_id");

-- CreateIndex
CREATE INDEX "emergency_events_status_idx" ON "emergency_events"("status");

-- CreateIndex
CREATE INDEX "teleconsultations_patient_id_idx" ON "teleconsultations"("patient_id");

-- CreateIndex
CREATE INDEX "teleconsultations_doctor_id_idx" ON "teleconsultations"("doctor_id");

-- CreateIndex
CREATE INDEX "teleconsultations_scheduled_at_idx" ON "teleconsultations"("scheduled_at");

-- CreateIndex
CREATE INDEX "teleconsultation_messages_teleconsultation_id_idx" ON "teleconsultation_messages"("teleconsultation_id");

-- CreateIndex
CREATE INDEX "medical_notes_patient_id_idx" ON "medical_notes"("patient_id");

-- CreateIndex
CREATE INDEX "medical_notes_doctor_id_idx" ON "medical_notes"("doctor_id");

-- CreateIndex
CREATE INDEX "reports_patient_id_idx" ON "reports"("patient_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_doctor_links" ADD CONSTRAINT "patient_doctor_links_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_doctor_links" ADD CONSTRAINT "patient_doctor_links_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_measurements" ADD CONSTRAINT "bp_measurements_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "bp_measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teleconsultations" ADD CONSTRAINT "teleconsultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teleconsultations" ADD CONSTRAINT "teleconsultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teleconsultation_messages" ADD CONSTRAINT "teleconsultation_messages_teleconsultation_id_fkey" FOREIGN KEY ("teleconsultation_id") REFERENCES "teleconsultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_notes" ADD CONSTRAINT "medical_notes_teleconsultation_id_fkey" FOREIGN KEY ("teleconsultation_id") REFERENCES "teleconsultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
