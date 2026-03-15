import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PatientsService } from './patients.service';
import { PrismaService } from '../../core/prisma/prisma.service';

describe('PatientsService', () => {
  let service: PatientsService;
  let prisma: PrismaService;

  const mockPatient = {
    id: 'patient-id-1',
    userId: 'user-id-1',
    firstName: 'Jean',
    lastName: 'Dupont',
    birthDate: new Date('1985-06-15'),
    gender: 'MALE',
    heightCm: 175,
    weightKg: 80,
    medicalStatus: 'STANDARD',
    medicalHistory: {},
    allergies: [],
    medications: [],
    emergencyContactName: 'Marie Dupont',
    emergencyContactPhone: '+33612345678',
    notificationPreferences: { email: true, sms: true, push: true },
    language: 'fr',
    timezone: 'Europe/Paris',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    patient: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    patientDoctorLink: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== GET PROFILE (findByUserId) ====================

  describe('findByUserId (getProfile)', () => {
    it('should return patient profile when found', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await service.findByUserId('user-id-1');

      expect(result).toEqual(mockPatient);
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-id-1' },
      });
    });

    it('should throw NotFoundException if patient not found', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByUserId('non-existent')).rejects.toThrow(
        'Patient profile not found',
      );
    });
  });

  // ==================== FIND BY ID ====================

  describe('findById', () => {
    it('should return patient when found by id', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await service.findById('patient-id-1');

      expect(result).toEqual(mockPatient);
      expect(mockPrismaService.patient.findUnique).toHaveBeenCalledWith({
        where: { id: 'patient-id-1' },
      });
    });

    it('should throw NotFoundException if patient not found by id', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent')).rejects.toThrow(
        'Patient not found',
      );
    });
  });

  // ==================== UPDATE PROFILE ====================

  describe('update (updateProfile)', () => {
    const updateDto = {
      firstName: 'Jean-Pierre',
      lastName: 'Dupont',
      weightKg: 78,
    };

    it('should update patient profile successfully', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      const updatedPatient = { ...mockPatient, ...updateDto };
      mockPrismaService.patient.update.mockResolvedValue(updatedPatient);

      const result = await service.update('user-id-1', updateDto);

      expect(result.firstName).toBe('Jean-Pierre');
      expect(mockPrismaService.patient.update).toHaveBeenCalledWith({
        where: { id: mockPatient.id },
        data: expect.objectContaining({
          firstName: 'Jean-Pierre',
          lastName: 'Dupont',
          weightKg: 78,
        }),
      });
    });

    it('should convert birthDate string to Date object when provided', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.patient.update.mockResolvedValue(mockPatient);

      const dtoWithBirthDate = { ...updateDto, birthDate: '1985-06-20' };
      await service.update('user-id-1', dtoWithBirthDate);

      expect(mockPrismaService.patient.update).toHaveBeenCalledWith({
        where: { id: mockPatient.id },
        data: expect.objectContaining({
          birthDate: new Date('1985-06-20'),
        }),
      });
    });

    it('should not set birthDate if not provided in dto', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);
      mockPrismaService.patient.update.mockResolvedValue(mockPatient);

      await service.update('user-id-1', { firstName: 'Pierre' });

      expect(mockPrismaService.patient.update).toHaveBeenCalledWith({
        where: { id: mockPatient.id },
        data: expect.objectContaining({
          birthDate: undefined,
        }),
      });
    });

    it('should throw NotFoundException if patient not found during update', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== CREATE ====================

  describe('create', () => {
    const createDto = {
      firstName: 'Marie',
      lastName: 'Martin',
      birthDate: '1990-03-25',
      gender: 'FEMALE' as const,
      heightCm: 165,
      weightKg: 60,
      medicalStatus: 'STANDARD' as const,
      emergencyContactName: 'Pierre Martin',
      emergencyContactPhone: '+33698765432',
    };

    it('should create a new patient profile', async () => {
      const createdPatient = {
        ...mockPatient,
        userId: 'user-id-2',
        firstName: 'Marie',
        lastName: 'Martin',
      };
      mockPrismaService.patient.create.mockResolvedValue(createdPatient);

      const result = await service.create('user-id-2', createDto);

      expect(result).toEqual(createdPatient);
      expect(mockPrismaService.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-id-2',
          firstName: 'Marie',
          lastName: 'Martin',
          birthDate: new Date('1990-03-25'),
          gender: 'FEMALE',
          heightCm: 165,
          weightKg: 60,
        }),
      });
    });
  });

  // ==================== GET BMI ====================

  describe('getBMI', () => {
    it('should calculate BMI correctly', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await service.getBMI('user-id-1');

      // BMI = 80 / (1.75 * 1.75) = 26.1
      expect(result).toBe(26.1);
    });

    it('should return null if height is missing', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue({
        ...mockPatient,
        heightCm: null,
      });

      const result = await service.getBMI('user-id-1');

      expect(result).toBeNull();
    });

    it('should return null if weight is missing', async () => {
      mockPrismaService.patient.findUnique.mockResolvedValue({
        ...mockPatient,
        weightKg: null,
      });

      const result = await service.getBMI('user-id-1');

      expect(result).toBeNull();
    });
  });

  // ==================== FIND BY DOCTOR ====================

  describe('findByDoctorId', () => {
    it('should return patients linked to a doctor', async () => {
      const links = [
        {
          patientId: 'patient-id-1',
          doctorId: 'doctor-id-1',
          status: 'ACTIVE',
          patient: {
            ...mockPatient,
            measurements: [{ id: 'm-1', systolic: 130, diastolic: 85, measuredAt: new Date() }],
          },
        },
      ];
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue(links);

      const result = await service.findByDoctorId('doctor-id-1');

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('Jean');
      expect(mockPrismaService.patientDoctorLink.findMany).toHaveBeenCalledWith({
        where: { doctorId: 'doctor-id-1', status: 'ACTIVE' },
        include: {
          patient: {
            include: {
              measurements: {
                orderBy: { measuredAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });
    });

    it('should return empty array if no patients linked', async () => {
      mockPrismaService.patientDoctorLink.findMany.mockResolvedValue([]);

      const result = await service.findByDoctorId('doctor-id-1');

      expect(result).toEqual([]);
    });
  });
});
