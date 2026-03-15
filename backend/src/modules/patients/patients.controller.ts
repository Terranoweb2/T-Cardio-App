import { Controller, Get, Post, Patch, Body, UseGuards, Param, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PatientsService } from './patients.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/guards/public.decorator';

@ApiTags('Patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly prisma: PrismaService,
  ) {}

  @Patch('onboarding/complete')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Marquer onboarding termine' })
  async completeOnboarding(@CurrentUser('sub') userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
      select: { id: true, onboardingCompleted: true },
    });
  }

  @Post('profile')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Creer profil patient' })
  async createProfile(@CurrentUser('sub') userId: string, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(userId, dto);
  }

  @Get('profile')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mon profil patient' })
  async getMyProfile(@CurrentUser('sub') userId: string) {
    const patient = await this.patientsService.findByUserId(userId);
    const bmi = await this.patientsService.getBMI(userId);
    return { ...patient, bmi };
  }

  @Patch('profile')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Modifier profil patient' })
  async updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(userId, dto);
  }

  @Get('my-doctors')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mes medecins associes' })
  async getMyDoctors(@CurrentUser('sub') userId: string) {
    return this.patientsService.getMyDoctors(userId);
  }

  @Post('redeem-token')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Utiliser un code d\'invitation medecin' })
  async redeemToken(
    @CurrentUser('sub') userId: string,
    @Body() body: { token: string },
  ) {
    return this.patientsService.redeemInvitationToken(userId, body.token);
  }

  @Post('profile/photo')
  @Roles('PATIENT')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Upload profile photo' })
  async uploadProfilePhoto(
    @CurrentUser('sub') userId: string,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    if (!photo) {
      throw new BadRequestException('Photo file is required');
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(photo.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    if (photo.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    return this.patientsService.uploadProfilePhoto(userId, photo);
  }

  @Get('profile/photo/:filename')
  @Public()
  @ApiOperation({ summary: 'Get profile photo' })
  async getProfilePhoto(@Param('filename') filename: string, @Res() res: Response) {
    const stream = await this.patientsService.getProfilePhotoStream(filename);

    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const contentType = mimeMap[ext || ''] || 'application/octet-stream';

    res.set({ 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' });
    (stream as any).pipe(res);
  }

  @Get(':id')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Voir un patient (medecin/admin)' })
  async getPatient(@Param('id') id: string) {
    const patient = await this.patientsService.findById(id);
    // Calculate age from birthDate
    let age: number | null = null;
    if (patient.birthDate) {
      age = Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
    // Calculate BMI
    let bmi: number | null = null;
    if (patient.heightCm && patient.weightKg) {
      const heightM = patient.heightCm / 100;
      bmi = Number((Number(patient.weightKg) / (heightM * heightM)).toFixed(1));
    }
    return { ...patient, age, bmi };
  }
}
