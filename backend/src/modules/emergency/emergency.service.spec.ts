import { Test, TestingModule } from '@nestjs/testing';

import { EmergencyService } from './emergency.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

describe('EmergencyService', () => {
  let service: EmergencyService;
  let prisma: PrismaService;
  let auditService: AuditService;

  const mockEmergencyEvent = {
    id: 'event-id-1',
    patientId: 'patient-id-1',
    measurementId: 'measurement-id-1',
    triggerType: 'SEUIL_SYSTOLIQUE',
    triggerValue: { systolic: 185, diastolic: 100 },
    status: 'ACTIVE',
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolutionNotes: null,
    doctorNotifiedAt: null,
    patientNotifiedAt: new Date(),
    createdAt: new Date(),
    resolvedAt: null,
  };

  const mockDoctorLink = {
    id: 'link-id-1',
    patientId: 'patient-id-1',
    doctorId: 'doctor-id-1',
    status: 'ACTIVE',
    doctor: {
      id: 'doctor-id-1',
      userId: 'doctor-user-id-1',
      firstName: 'Dr',
      lastName: 'Smith',
    },
  };

  const mockPrismaService = {
    emergencyEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    alert: {
      create: jest.fn(),
    },
    patientDoctorLink: {
      findMany: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<EmergencyService>(EmergencyService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== HANDLE EMERGENCY MEASUREMENT ====================

  describe('handleEmergencyMeasurement', () => {
    it('should create an emergency event for critical systolic BP', async () => {
      mockPrismaService.emergencyEvent.create.mockResolvedValue(mockEmergencyEvent);
      mockPrismaService.alert.create.mockResolvedValue({});
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([]);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.handleEmergencyMeasurement(
        'measurement-id-1',
        'patient-id-1',
        185,
        100,
      );

      expect(result).toEqual(mockEmergencyEvent);
      expect(mockPrismaService.emergencyEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: 'patient-id-1',
          measurementId: 'measurement-id-1',
          triggerType: 'SEUIL_SYSTOLIQUE',
          status: 'ACTIVE',
        }),
      });
    });

    it('should use SEUIL_DIASTOLIQUE trigger type when systolic < 180', async () => {
      mockPrismaService.emergencyEvent.create.mockResolvedValue({
        ...mockEmergencyEvent,
        triggerType: 'SEUIL_DIASTOLIQUE',
      });
      mockPrismaService.alert.create.mockResolvedValue({});
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([]);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.handleEmergencyMeasurement(
        'measurement-id-1',
        'patient-id-1',
        170,
        125,
      );

      expect(mockPrismaService.emergencyEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          triggerType: 'SEUIL_DIASTOLIQUE',
        }),
      });
    });

    it('should create a patient alert with critical severity', async () => {
      mockPrismaService.emergencyEvent.create.mockResolvedValue(mockEmergencyEvent);
      mockPrismaService.alert.create.mockResolvedValue({});
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([]);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.handleEmergencyMeasurement(
        'measurement-id-1',
        'patient-id-1',
        185,
        100,
      );

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: 'patient-id-1',
          type: 'EMERGENCY',
          severity: 'CRITIQUE',
        }),
      });
    });

    it('should notify all assigned doctors', async () => {
      mockPrismaService.emergencyEvent.create.mockResolvedValue(mockEmergencyEvent);
      mockPrismaService.alert.create.mockResolvedValue({});
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([
        mockDoctorLink,
        { ...mockDoctorLink, id: 'link-id-2', doctorId: 'doctor-id-2' },
      ]);
      mockPrismaService.emergencyEvent.update.mockResolvedValue({});
      mockAuditService.log.mockResolvedValue(undefined);

      await service.handleEmergencyMeasurement(
        'measurement-id-1',
        'patient-id-1',
        185,
        100,
      );

      // 1 patient alert + 2 doctor alerts = 3 alert.create calls
      expect(mockPrismaService.alert.create).toHaveBeenCalledTimes(3);
    });

    it('should update emergency event with doctor notification timestamp', async () => {
      mockPrismaService.emergencyEvent.create.mockResolvedValue(mockEmergencyEvent);
      mockPrismaService.alert.create.mockResolvedValue({});
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([mockDoctorLink]);
      mockPrismaService.emergencyEvent.update.mockResolvedValue({});
      mockAuditService.log.mockResolvedValue(undefined);

      await service.handleEmergencyMeasurement(
        'measurement-id-1',
        'patient-id-1',
        185,
        100,
      );

      expect(mockPrismaService.emergencyEvent.update).toHaveBeenCalledWith({
        where: { id: mockEmergencyEvent.id },
        data: { doctorNotifiedAt: expect.any(Date) },
      });
    });

    it('should create an audit log entry', async () => {
      mockPrismaService.emergencyEvent.create.mockResolvedValue(mockEmergencyEvent);
      mockPrismaService.alert.create.mockResolvedValue({});
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([]);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.handleEmergencyMeasurement(
        'measurement-id-1',
        'patient-id-1',
        185,
        100,
      );

      expect(mockAuditService.log).toHaveBeenCalledWith({
        action: 'CREATE',
        resourceType: 'emergency_event',
        resourceId: mockEmergencyEvent.id,
        details: expect.objectContaining({
          patientId: 'patient-id-1',
          systolic: 185,
          diastolic: 100,
          triggerType: 'SEUIL_SYSTOLIQUE',
          doctorsNotified: 0,
        }),
      });
    });

    it('should include the number of notified doctors in the audit log', async () => {
      mockPrismaService.emergencyEvent.create.mockResolvedValue(mockEmergencyEvent);
      mockPrismaService.alert.create.mockResolvedValue({});
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([
        mockDoctorLink,
        { ...mockDoctorLink, id: 'link-id-2', doctorId: 'doctor-id-2' },
      ]);
      mockPrismaService.emergencyEvent.update.mockResolvedValue({});
      mockAuditService.log.mockResolvedValue(undefined);

      await service.handleEmergencyMeasurement(
        'measurement-id-1',
        'patient-id-1',
        185,
        100,
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            doctorsNotified: 2,
          }),
        }),
      );
    });
  });

  // ==================== GET ACTIVE EMERGENCIES ====================

  describe('getActiveEmergencies', () => {
    it('should return all active emergencies when no doctorUserId', async () => {
      mockPrismaService.emergencyEvent.findMany.mockResolvedValue([mockEmergencyEvent]);

      const result = await service.getActiveEmergencies();

      expect(result).toHaveLength(1);
      expect(mockPrismaService.emergencyEvent.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: { patient: true, measurement: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by doctor patients when doctorUserId provided', async () => {
      const mockDoctor = { id: 'doctor-id-1', userId: 'doctor-user-id-1' };
      mockPrismaService.doctor.findUnique.mockResolvedValue(mockDoctor);
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([
        { patientId: 'patient-id-1' },
        { patientId: 'patient-id-2' },
      ]);
      mockPrismaService.emergencyEvent.findMany.mockResolvedValue([mockEmergencyEvent]);

      const result = await service.getActiveEmergencies('doctor-user-id-1');

      expect(mockPrismaService.emergencyEvent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          patientId: { in: ['patient-id-1', 'patient-id-2'] },
        },
        include: { patient: true, measurement: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ==================== ACKNOWLEDGE / RESOLVE ====================

  describe('acknowledgeEmergency', () => {
    it('should update emergency status to ACKNOWLEDGED', async () => {
      mockPrismaService.emergencyEvent.update.mockResolvedValue({
        ...mockEmergencyEvent,
        status: 'ACKNOWLEDGED',
      });

      const result = await service.acknowledgeEmergency('event-id-1', 'user-id-1');

      expect(mockPrismaService.emergencyEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-id-1' },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedBy: 'user-id-1',
          acknowledgedAt: expect.any(Date),
        },
      });
    });
  });

  describe('resolveEmergency', () => {
    it('should update emergency status to RESOLVED with notes', async () => {
      mockPrismaService.emergencyEvent.update.mockResolvedValue({
        ...mockEmergencyEvent,
        status: 'RESOLVED',
      });

      const result = await service.resolveEmergency('event-id-1', 'Patient stable');

      expect(mockPrismaService.emergencyEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-id-1' },
        data: {
          status: 'RESOLVED',
          resolutionNotes: 'Patient stable',
          resolvedAt: expect.any(Date),
        },
      });
    });
  });
});
