import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import aiConfig from './config/ai.config';
import storageConfig from './config/storage.config';
import redisConfig from './config/redis.config';
import paymentConfig from './config/payment.config';

// Core modules
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './core/auth/auth.module';
import { AuditModule } from './core/audit/audit.module';
import { RedisModule } from './core/redis/redis.module';
import { EmailModule } from './core/email/email.module';
import { PushModule } from './core/push/push.module';
import { TasksModule } from './core/tasks/tasks.module';
import { HealthModule } from './core/health/health.module';

// Business modules
import { PatientsModule } from './modules/patients/patients.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { MeasurementsModule } from './modules/measurements/measurements.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiEngineModule } from './modules/ai-engine/ai-engine.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { TeleconsultationModule } from './modules/teleconsultation/teleconsultation.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StorageModule } from './modules/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CreditModule } from './modules/credit/credit.module';
import { DoctorWalletModule } from './modules/doctor-wallet/doctor-wallet.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AdvertisementModule } from './modules/advertisement/advertisement.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { EmergencyCallModule } from './modules/emergency-call/emergency-call.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ExamResultsModule } from './modules/exam-results/exam-results.module';
import { DevicesModule } from './modules/devices/devices.module';
import { RiskScoreModule } from './modules/risk-score/risk-score.module';
import { FamilyModule } from './modules/family/family.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { MedicationsModule } from './modules/medications/medications.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, aiConfig, storageConfig, redisConfig, paymentConfig],
      envFilePath: ['.env.local', '.env', '../.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 10 },
      { name: 'measurements', ttl: 60000, limit: 60 },
    ]),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Core
    PrismaModule,
    AuthModule,
    AuditModule,
    RedisModule,
    EmailModule,
    PushModule,
    TasksModule,
    HealthModule,

    // Business
    PatientsModule,
    DoctorsModule,
    MeasurementsModule,
    AnalyticsModule,
    AiEngineModule,
    EmergencyModule,
    TeleconsultationModule,
    ReportsModule,
    StorageModule,
    AdminModule,
    NotificationsModule,
    CreditModule,
    DoctorWalletModule,
    SubscriptionModule,
    PaymentModule,
    AdvertisementModule,
    ChatbotModule,
    MessagingModule,
    PrescriptionsModule,
    EmergencyCallModule,
    AppointmentsModule,
    ExamResultsModule,
    DevicesModule,
    RiskScoreModule,
    FamilyModule,
    GamificationModule,
    MedicationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
