import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { MeasurementsService } from './measurements.service';
import { PrismaService } from '../../core/prisma/prisma.service';

describe('MeasurementsService', () => {
  let service: MeasurementsService;
  let prisma: PrismaService;

  const mockPatient = {
    id: 'patient-id-1',
    userId: 'user-id-1',
    firstName: 'Jean',
    lastName: 'Dupont',
  };

  const mockMeasurement = {
    id: 'measurement-id-1',
    patientId: 'patient-id-1',
    systolic: 130,
    diastolic: 85,
    pulse: 72,
    source: 'MANUEL',
    context: 'REPOS',
    notes: null,
    riskLevel: 'MODERE',
    isEmergency: false,
    measuredAt: new Date('2025-01-15T10:00:00Z'),
    createdAt: new Date(),
  };

  const mockPrismaService = {
    patient: {
      findUnique: jest.fn(),
    },
    bpMeasurement: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeasurementsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MeasurementsService>(MeasurementsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== CREATE ====================

  describe('create', () => {
    const createDto = {
      systolic: 130,
      diastolic: 85,
      pulse: 72,
      source: 'MANUEL' as const,
      context: 'REPOS' as const,
      notes: 'Test measurement',
      measuredAt: '2025-01-15T10:00:00Z',
    };

    it('should create a measurement successfully', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.create.mockResolvedValue(mockMeasurement);

      const result = await service.create('user-id-1', createDto);

      expect(result).toEqual(mockMeasurement);
      expect(mockPrismaService.bpMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: 'patient-id-1',
          systolic: 130,
          diastolic: 85,
          pulse: 72,
        }),
      });
    });

    it('should throw BadRequestException if patient profile not found', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      await expect(service.create('user-id-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-id-1', createDto)).rejects.toThrow(
        'Patient profile required',
      );
    });

    it('should throw BadRequestException if systolic <= diastolic', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);

      const invalidDto = { ...createDto, systolic: 80, diastolic: 85 };
      await expect(service.create('user-id-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-id-1', invalidDto)).rejects.toThrow(
        'Systolic must be greater than diastolic',
      );
    });

    it('should calculate risk level FAIBLE for normal BP', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.create.mockResolvedValue(mockMeasurement);

      const normalDto = { ...createDto, systolic: 110, diastolic: 70 };
      await service.create('user-id-1', normalDto);

      expect(mockPrismaService.bpMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riskLevel: 'FAIBLE',
          isEmergency: false,
        }),
      });
    });

    it('should calculate risk level MODERE for elevated BP', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.create.mockResolvedValue(mockMeasurement);

      const elevatedDto = { ...createDto, systolic: 125, diastolic: 82 };
      await service.create('user-id-1', elevatedDto);

      expect(mockPrismaService.bpMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riskLevel: 'MODERE',
        }),
      });
    });

    it('should calculate risk level ELEVE for high BP', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.create.mockResolvedValue(mockMeasurement);

      const highDto = { ...createDto, systolic: 150, diastolic: 95 };
      await service.create('user-id-1', highDto);

      expect(mockPrismaService.bpMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riskLevel: 'ELEVE',
        }),
      });
    });

    it('should calculate risk level CRITIQUE and isEmergency for critical BP', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.create.mockResolvedValue(mockMeasurement);

      const criticalDto = { ...createDto, systolic: 185, diastolic: 125 };
      await service.create('user-id-1', criticalDto);

      expect(mockPrismaService.bpMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riskLevel: 'CRITIQUE',
          isEmergency: true,
        }),
      });
    });

    it('should flag isEmergency when systolic >= 180', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.create.mockResolvedValue(mockMeasurement);

      const emergencyDto = { ...createDto, systolic: 180, diastolic: 100 };
      await service.create('user-id-1', emergencyDto);

      expect(mockPrismaService.bpMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isEmergency: true,
        }),
      });
    });

    it('should flag isEmergency when diastolic >= 120', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.create.mockResolvedValue(mockMeasurement);

      const emergencyDto = { ...createDto, systolic: 170, diastolic: 120 };
      await service.create('user-id-1', emergencyDto);

      expect(mockPrismaService.bpMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isEmergency: true,
        }),
      });
    });

    it('should use default source MANUEL if not provided', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.create.mockResolvedValue(mockMeasurement);

      const dtoNoSource = { systolic: 130, diastolic: 85, measuredAt: '2025-01-15T10:00:00Z' };
      await service.create('user-id-1', dtoNoSource as any);

      expect(mockPrismaService.bpMeasurement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'MANUEL',
        }),
      });
    });
  });

  // ==================== FIND BY PATIENT (PAGINATION) ====================

  describe('findByPatientUserId', () => {
    it('should return paginated measurements', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([mockMeasurement]);
      mockPrismaService.bpMeasurement.count.mockResolvedValue(1);

      const result = await service.findByPatientUserId('user-id-1', {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should return empty result if patient not found', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      const result = await service.findByPatientUserId('non-existent', {});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should apply pagination parameters', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([]);
      mockPrismaService.bpMeasurement.count.mockResolvedValue(50);

      const result = await service.findByPatientUserId('user-id-1', {
        page: 2,
        limit: 10,
        days: 60,
      });

      expect(mockPrismaService.bpMeasurement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { measuredAt: 'desc' },
        }),
      );
      expect(result.meta.totalPages).toBe(5);
    });

    it('should use default values for days=30, page=1, limit=20', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([]);
      mockPrismaService.bpMeasurement.count.mockResolvedValue(0);

      await service.findByPatientId('patient-id-1', {});

      expect(mockPrismaService.bpMeasurement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  // ==================== STATS ====================

  describe('getStats', () => {
    it('should return null if no measurements found', async () => {
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([]);

      const result = await service.getStats('patient-id-1', 30);

      expect(result).toBeNull();
    });

    it('should calculate stats correctly', async () => {
      const measurements = [
        { systolic: 120, diastolic: 80, pulse: 70, isEmergency: false, measuredAt: new Date() },
        { systolic: 130, diastolic: 85, pulse: 75, isEmergency: false, measuredAt: new Date() },
        { systolic: 140, diastolic: 90, pulse: 80, isEmergency: false, measuredAt: new Date() },
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getStats('patient-id-1', 30);

      expect(result).not.toBeNull();
      expect(result!.count).toBe(3);
      expect(result!.systolic.avg).toBe(130);
      expect(result!.systolic.min).toBe(120);
      expect(result!.systolic.max).toBe(140);
      expect(result!.diastolic.avg).toBe(85);
      expect(result!.diastolic.min).toBe(80);
      expect(result!.diastolic.max).toBe(90);
      expect(result!.pulse).not.toBeNull();
      expect(result!.pulse!.avg).toBe(75);
      expect(result!.emergencyCount).toBe(0);
    });

    it('should count emergency measurements', async () => {
      const measurements = [
        { systolic: 185, diastolic: 125, pulse: 90, isEmergency: true, measuredAt: new Date() },
        { systolic: 130, diastolic: 85, pulse: 75, isEmergency: false, measuredAt: new Date() },
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getStats('patient-id-1', 30);

      expect(result!.emergencyCount).toBe(1);
    });

    it('should handle measurements without pulse', async () => {
      const measurements = [
        { systolic: 120, diastolic: 80, pulse: null, isEmergency: false, measuredAt: new Date() },
        { systolic: 130, diastolic: 85, pulse: null, isEmergency: false, measuredAt: new Date() },
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getStats('patient-id-1', 30);

      expect(result!.pulse).toBeNull();
    });
  });
});
