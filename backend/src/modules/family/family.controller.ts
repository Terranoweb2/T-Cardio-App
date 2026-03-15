import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FamilyService } from './family.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Family')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('family')
export class FamilyController {
  constructor(
    private readonly familyService: FamilyService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private async getPatientId(userId: string): Promise<string> {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!patient) {
      throw new BadRequestException('Profil patient introuvable');
    }
    return patient.id;
  }

  // ---------------------------------------------------------------------------
  // POST /family — Creer un groupe familial
  // ---------------------------------------------------------------------------
  @Post()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Creer un groupe familial' })
  async createGroup(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateFamilyDto,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.familyService.createGroup(patientId, dto.name);
  }

  // ---------------------------------------------------------------------------
  // GET /family — Recuperer mon groupe familial
  // ---------------------------------------------------------------------------
  @Get()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Recuperer mon groupe familial' })
  async getMyGroup(@CurrentUser('sub') userId: string) {
    const patientId = await this.getPatientId(userId);
    return this.familyService.getMyGroup(patientId);
  }

  // ---------------------------------------------------------------------------
  // POST /family/invite — Inviter un membre au groupe familial
  // ---------------------------------------------------------------------------
  @Post('invite')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Inviter un membre au groupe familial' })
  async inviteMember(
    @CurrentUser('sub') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.familyService.inviteMember(patientId, dto.email);
  }

  // ---------------------------------------------------------------------------
  // POST /family/accept/:token — Accepter une invitation familiale
  // ---------------------------------------------------------------------------
  @Post('accept/:token')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Accepter une invitation familiale' })
  async acceptInvitation(
    @CurrentUser('sub') userId: string,
    @Param('token') token: string,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.familyService.acceptInvitation(patientId, token);
  }

  // ---------------------------------------------------------------------------
  // DELETE /family/members/:memberId — Retirer un membre du groupe familial
  // ---------------------------------------------------------------------------
  @Delete('members/:memberId')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Retirer un membre du groupe familial' })
  async removeMember(
    @CurrentUser('sub') userId: string,
    @Param('memberId') memberId: string,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.familyService.removeMember(patientId, memberId);
  }

  // ---------------------------------------------------------------------------
  // GET /family/members/:memberId/data — Consulter les donnees d'un membre
  // ---------------------------------------------------------------------------
  @Get('members/:memberId/data')
  @Roles('PATIENT')
  @ApiOperation({ summary: "Consulter les donnees de sante d'un membre du groupe" })
  async getMemberData(
    @CurrentUser('sub') userId: string,
    @Param('memberId') memberId: string,
  ) {
    const patientId = await this.getPatientId(userId);
    // memberId is the FamilyMember row id — resolve to patientId
    const familyMember = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
      select: { patientId: true },
    });
    if (!familyMember) {
      throw new BadRequestException('Membre introuvable');
    }
    return this.familyService.getMemberData(patientId, familyMember.patientId);
  }
}
