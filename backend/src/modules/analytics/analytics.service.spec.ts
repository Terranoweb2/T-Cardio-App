import { Test, TestingModule } from '@nestjs/testing';

import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../core/prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaService;

  // Helper: create a measurement with a specific date, systolic, diastolic
  const makeMeasurement = (
    systolic: number,
    diastolic: number,
    date: string,
    pulse: number | null = 72,
    riskLevel: string = 'MODERE',
  ) => ({
    id: `m-${Date.now()}-${Math.random()}`,
    patientId: 'patient-id-1',
    systolic,
    diastolic,
    pulse,
    riskLevel,
    isEmergency: false,
    measuredAt: new Date(date),
    createdAt: new Date(),
  });

  const mockPrismaService = {
    bpMeasurement: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== GET CHART DATA ====================

  describe('getChartData', () => {
    it('should return formatted chart data from measurements', async () => {
      const measurements = [
        makeMeasurement(120, 80, '2025-01-10T08:00:00Z', 70, 'FAIBLE'),
        makeMeasurement(130, 85, '2025-01-11T08:00:00Z', 75, 'MODERE'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getChartData('patient-id-1', 30);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: measurements[0].measuredAt.toISOString(),
        systolic: 120,
        diastolic: 80,
        pulse: 70,
        riskLevel: 'FAIBLE',
      });
      expect(result[1]).toEqual({
        date: measurements[1].measuredAt.toISOString(),
        systolic: 130,
        diastolic: 85,
        pulse: 75,
        riskLevel: 'MODERE',
      });
    });

    it('should return empty array if no measurements', async () => {
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([]);

      const result = await service.getChartData('patient-id-1', 30);

      expect(result).toEqual([]);
    });

    it('should query measurements for the specified number of days', async () => {
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([]);

      await service.getChartData('patient-id-1', 60);

      expect(mockPrismaService.bpMeasurement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'patient-id-1',
          }),
          orderBy: { measuredAt: 'asc' },
        }),
      );
    });
  });

  // ==================== GET VARIABILITY ====================

  describe('getVariability', () => {
    it('should return null if fewer than 2 measurements', async () => {
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([
        makeMeasurement(120, 80, '2025-01-10'),
      ]);

      const result = await service.getVariability('patient-id-1', 30);

      expect(result).toBeNull();
    });

    it('should calculate variability statistics correctly', async () => {
      const measurements = [
        makeMeasurement(120, 80, '2025-01-10'),
        makeMeasurement(130, 85, '2025-01-11'),
        makeMeasurement(140, 90, '2025-01-12'),
        makeMeasurement(125, 82, '2025-01-13'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getVariability('patient-id-1', 30);

      expect(result).not.toBeNull();
      expect(result!.measurementCount).toBe(4);
      expect(result!.systolic).toHaveProperty('mean');
      expect(result!.systolic).toHaveProperty('stdDev');
      expect(result!.systolic).toHaveProperty('cv');
      expect(result!.diastolic).toHaveProperty('mean');
      expect(result!.diastolic).toHaveProperty('stdDev');
      expect(result!.diastolic).toHaveProperty('cv');
    });

    it('should compute correct mean values', async () => {
      const measurements = [
        makeMeasurement(120, 80, '2025-01-10'),
        makeMeasurement(140, 90, '2025-01-11'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getVariability('patient-id-1', 30);

      expect(result!.systolic.mean).toBe(130); // (120+140)/2
      expect(result!.diastolic.mean).toBe(85); // (80+90)/2
    });

    it('should compute standard deviation', async () => {
      // With values [120, 140]: mean = 130, variance = ((120-130)^2 + (140-130)^2) / 2 = 100, stdDev = 10
      const measurements = [
        makeMeasurement(120, 80, '2025-01-10'),
        makeMeasurement(140, 80, '2025-01-11'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getVariability('patient-id-1', 30);

      expect(result!.systolic.stdDev).toBe(10);
    });
  });

  // ==================== GET TRENDS ====================

  describe('getTrends', () => {
    it('should return null if fewer than 3 measurements', async () => {
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([
        makeMeasurement(120, 80, '2025-01-10'),
        makeMeasurement(130, 85, '2025-01-11'),
      ]);

      const result = await service.getTrends('patient-id-1', 30);

      expect(result).toBeNull();
    });

    it('should detect rising trend', async () => {
      const measurements = [
        makeMeasurement(120, 78, '2025-01-10'),
        makeMeasurement(125, 80, '2025-01-11'),
        makeMeasurement(130, 82, '2025-01-12'),
        makeMeasurement(135, 84, '2025-01-13'),
        makeMeasurement(140, 86, '2025-01-14'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getTrends('patient-id-1', 30);

      expect(result).not.toBeNull();
      expect(result!.systolic.direction).toBe('rising');
      expect(result!.systolic.slope).toBeGreaterThan(0.5);
      expect(result!.diastolic.direction).toBe('rising');
    });

    it('should detect falling trend', async () => {
      const measurements = [
        makeMeasurement(140, 90, '2025-01-10'),
        makeMeasurement(135, 88, '2025-01-11'),
        makeMeasurement(130, 86, '2025-01-12'),
        makeMeasurement(125, 84, '2025-01-13'),
        makeMeasurement(120, 82, '2025-01-14'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getTrends('patient-id-1', 30);

      expect(result).not.toBeNull();
      expect(result!.systolic.direction).toBe('falling');
      expect(result!.systolic.slope).toBeLessThan(-0.5);
    });

    it('should detect stable trend', async () => {
      const measurements = [
        makeMeasurement(130, 85, '2025-01-10'),
        makeMeasurement(130, 85, '2025-01-11'),
        makeMeasurement(130, 85, '2025-01-12'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getTrends('patient-id-1', 30);

      expect(result).not.toBeNull();
      expect(result!.systolic.direction).toBe('stable');
      expect(result!.diastolic.direction).toBe('stable');
    });

    it('should include period info in the result', async () => {
      const measurements = [
        makeMeasurement(120, 80, '2025-01-10'),
        makeMeasurement(125, 82, '2025-01-11'),
        makeMeasurement(130, 84, '2025-01-12'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getTrends('patient-id-1', 30);

      expect(result!.period).toEqual({
        days: 30,
        measurementCount: 3,
      });
    });
  });

  // ==================== GET MOVING AVERAGE ====================

  describe('getMovingAverage', () => {
    it('should return empty array if no measurements', async () => {
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue([]);

      const result = await service.getMovingAverage('patient-id-1', 7);

      expect(result).toEqual([]);
    });

    it('should calculate moving average over a window', async () => {
      const measurements = [];
      for (let i = 0; i < 10; i++) {
        measurements.push(
          makeMeasurement(120 + i, 80 + i, `2025-01-${String(i + 1).padStart(2, '0')}`),
        );
      }
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getMovingAverage('patient-id-1', 3);

      // With window=3, first result starts at index 2
      expect(result.length).toBe(8); // 10 - 3 + 1
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('avgSystolic');
      expect(result[0]).toHaveProperty('avgDiastolic');
    });
  });

  // ==================== MORNING/EVENING COMPARISON ====================

  describe('getMorningEveningComparison', () => {
    it('should separate morning and evening measurements', async () => {
      const measurements = [
        makeMeasurement(120, 80, '2025-01-10T07:00:00Z'), // morning
        makeMeasurement(125, 82, '2025-01-10T08:30:00Z'), // morning
        makeMeasurement(135, 88, '2025-01-10T19:00:00Z'), // evening
        makeMeasurement(140, 90, '2025-01-10T20:00:00Z'), // evening
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getMorningEveningComparison('patient-id-1', 30);

      expect(result.morning).not.toBeNull();
      expect(result.morning!.count).toBe(2);
      expect(result.evening).not.toBeNull();
      expect(result.evening!.count).toBe(2);
    });

    it('should return null for morning if no morning measurements', async () => {
      const measurements = [
        makeMeasurement(135, 88, '2025-01-10T19:00:00Z'),
      ];
      mockPrismaService.bpMeasurement.findMany.mockResolvedValue(measurements);

      const result = await service.getMorningEveningComparison('patient-id-1', 30);

      expect(result.morning).toBeNull();
      expect(result.evening).not.toBeNull();
    });
  });
});
