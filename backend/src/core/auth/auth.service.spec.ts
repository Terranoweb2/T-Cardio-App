import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-random-token-hex'),
  })),
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mock-token-hash'),
    })),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    role: 'PATIENT',
    status: 'ACTIVE',
    emailVerified: false,
    twoFactorEnabled: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    phone: null,
    twoFactorSecret: null,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    patient: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(() => 'mock-access-token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '15m',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== REGISTER ====================

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'Password123!',
      role: 'PATIENT' as const,
    };

    it('should register a new patient successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        email: 'new@example.com',
      });
      mockPrismaService.patient.create.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn', 900);
      expect(result.user).toHaveProperty('email', 'new@example.com');
      expect(result.user).toHaveProperty('role', 'PATIENT');
    });

    it('should hash the password with salt rounds of 12', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
    });

    it('should convert email to lowercase', async () => {
      const dtoUpperEmail = { ...registerDto, email: 'NEW@EXAMPLE.COM' };
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.register(dtoUpperEmail);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@example.com' }),
        }),
      );
    });

    it('should throw BadRequestException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'ERR_EMAIL_EXISTS',
      );
    });

    it('should create a patient profile for PATIENT role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.patient.create.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.register(registerDto);

      expect(mockPrismaService.patient.create).toHaveBeenCalledWith({
        data: { userId: mockUser.id },
      });
    });

    it('should set status to PENDING for non-PATIENT roles', async () => {
      const doctorDto = { ...registerDto, role: 'MEDECIN' as const };
      const doctorUser = { ...mockUser, role: 'MEDECIN', status: 'PENDING' };
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(doctorUser);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.register(doctorDto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('should return tokens and user info', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          sessionId: 'mock-uuid-v4',
        }),
      );
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-random-token-hex');
    });
  });

  // ==================== LOGIN ====================

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should login successfully with valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect((result as any).user.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'ERR_INVALID_CREDENTIALS',
      );
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should increment failed login attempts on wrong password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow();

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { failedLoginAttempts: 1 },
      });
    });

    it('should lock account after 5 failed attempts', async () => {
      const userWith4Attempts = { ...mockUser, failedLoginAttempts: 4 };
      mockPrismaService.user.findUnique.mockResolvedValue(userWith4Attempts);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockPrismaService.user.update.mockResolvedValue(userWith4Attempts);

      await expect(service.login(loginDto)).rejects.toThrow();

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      });
    });

    it('should throw ForbiddenException if account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(lockedUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'ERR_ACCOUNT_LOCKED',
      );
    });

    it('should throw ForbiddenException if account is suspended', async () => {
      const suspendedUser = { ...mockUser, status: 'SUSPENDED' };
      mockPrismaService.user.findUnique.mockResolvedValue(suspendedUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'ERR_ACCOUNT_INACTIVE',
      );
    });

    it('should throw ForbiddenException if non-patient account is PENDING', async () => {
      const pendingDoctor = {
        ...mockUser,
        status: 'PENDING',
        role: 'MEDECIN',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(pendingDoctor);

      await expect(service.login(loginDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'ERR_ACCOUNT_PENDING_VALIDATION',
      );
    });

    it('should return requires2FA if 2FA is enabled and no code provided', async () => {
      const twoFaUser = { ...mockUser, twoFactorEnabled: true };
      mockPrismaService.user.findUnique.mockResolvedValue(twoFaUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toEqual({ requires2FA: true });
    });

    it('should reset failed attempts on successful login', async () => {
      const userWithAttempts = { ...mockUser, failedLoginAttempts: 3 };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithAttempts);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(userWithAttempts);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.login(loginDto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('should update lastLoginAt on successful login', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.login(loginDto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  // ==================== REFRESH TOKEN ====================

  describe('refreshToken', () => {
    const refreshTokenDto = { refreshToken: 'valid-refresh-token' };

    it('should return new tokens for a valid refresh token', async () => {
      const tokenRecord = {
        id: 'token-record-id',
        tokenHash: 'mock-token-hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: mockUser,
      };
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(tokenRecord);
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken(refreshTokenDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn', 900);
    });

    it('should revoke the old token (token rotation)', async () => {
      const tokenRecord = {
        id: 'token-record-id',
        tokenHash: 'mock-token-hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: mockUser,
      };
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(tokenRecord);
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.refreshToken(refreshTokenDto);

      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-record-id' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken(refreshTokenDto)).rejects.toThrow(
        'ERR_INVALID_REFRESH_TOKEN',
      );
    });
  });

  // ==================== LOGOUT ====================

  describe('logout', () => {
    it('should revoke a specific refresh token', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-id-1', 'some-token');

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: 'mock-token-hash', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should revoke all tokens if no specific token provided', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.logout('user-id-1');

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
