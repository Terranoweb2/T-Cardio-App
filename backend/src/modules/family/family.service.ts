import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailService } from '../../core/email/email.service';

@Injectable()
export class FamilyService {
  private readonly logger = new Logger(FamilyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // Transform raw Prisma group into the shape the frontend expects
  private transformGroup(group: any) {
    if (!group) return null;
    return {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      members: (group.members || []).map((m: any) => ({
        id: m.id,
        userId: m.patient?.userId || m.patientId,
        role: m.role,
        joinedAt: m.addedAt,
        user: {
          id: m.patient?.userId || m.patientId,
          firstName: m.patient?.firstName || null,
          lastName: m.patient?.lastName || null,
          email: m.patient?.user?.email || '',
        },
      })),
      invitations: (group.invitations || []).map((inv: any) => ({
        id: inv.id,
        email: inv.invitedEmail,
        status: (inv.status || '').replace('FAMILY_', ''),
        token: inv.token,
        createdAt: inv.createdAt,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // createGroup
  // ---------------------------------------------------------------------------
  async createGroup(patientId: string, name: string) {
    // Check patient doesn't already own a group
    const existingGroup = await this.prisma.familyGroup.findFirst({
      where: { ownerId: patientId },
    });

    if (existingGroup) {
      throw new ConflictException('Vous possedez deja un groupe familial');
    }

    // Create FamilyGroup + owner as FamilyMember in a transaction
    const group = await this.prisma.$transaction(async (tx) => {
      const familyGroup = await tx.familyGroup.create({
        data: {
          name,
          ownerId: patientId,
        },
      });

      await tx.familyMember.create({
        data: {
          familyGroupId: familyGroup.id,
          patientId,
          role: 'OWNER',
        },
      });

      return tx.familyGroup.findUnique({
        where: { id: familyGroup.id },
        include: {
          members: {
            include: {
              patient: {
                select: {
                  id: true,
                  userId: true,
                  firstName: true,
                  lastName: true,
                  user: { select: { email: true } },
                },
              },
            },
          },
          invitations: true,
        },
      });
    });

    this.logger.log(`Family group created: ${group!.id} by patient ${patientId}`);
    return this.transformGroup(group);
  }

  // ---------------------------------------------------------------------------
  // getMyGroup
  // ---------------------------------------------------------------------------
  async getMyGroup(patientId: string) {
    // Find group where patient is a member (owner or regular member)
    const membership = await this.prisma.familyMember.findFirst({
      where: { patientId },
      select: { familyGroupId: true },
    });

    if (!membership) {
      return null;
    }

    const group = await this.prisma.familyGroup.findUnique({
      where: { id: membership.familyGroupId },
      include: {
        members: {
          include: {
            patient: {
              select: {
                id: true,
                userId: true,
                firstName: true,
                lastName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
        invitations: {
          where: { status: 'FAMILY_PENDING' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return this.transformGroup(group);
  }

  // ---------------------------------------------------------------------------
  // inviteMember
  // ---------------------------------------------------------------------------
  async inviteMember(ownerPatientId: string, email: string) {
    // 1. Verify caller is the owner of a group
    const group = await this.prisma.familyGroup.findFirst({
      where: { ownerId: ownerPatientId },
      include: { members: true },
    });

    if (!group) {
      throw new ForbiddenException(
        "Vous devez etre proprietaire d'un groupe familial pour inviter des membres",
      );
    }

    // 2. Check if email is already a member
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { patient: true },
    });

    if (invitedUser?.patient) {
      const existingMember = await this.prisma.familyMember.findUnique({
        where: {
          familyGroupId_patientId: {
            familyGroupId: group.id,
            patientId: invitedUser.patient.id,
          },
        },
      });

      if (existingMember) {
        throw new ConflictException('Cette personne est deja membre du groupe familial');
      }
    }

    // Check for an existing pending invitation for the same email
    const existingInvitation = await this.prisma.familyInvitation.findFirst({
      where: {
        familyGroupId: group.id,
        invitedEmail: email.toLowerCase(),
        status: 'FAMILY_PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new ConflictException('Une invitation est deja en attente pour cette adresse email');
    }

    // 3. Generate random token
    const token = randomUUID();

    // 4. Create FamilyInvitation with expiresAt = 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.familyInvitation.create({
      data: {
        familyGroupId: group.id,
        invitedEmail: email.toLowerCase(),
        token,
        expiresAt,
      },
    });

    // 5. Send invitation email
    const ownerPatient = await this.prisma.patient.findUnique({
      where: { id: ownerPatientId },
    });
    const ownerName = ownerPatient
      ? `${ownerPatient.firstName || ''} ${ownerPatient.lastName || ''}`.trim()
      : 'Un membre';

    await this.emailService.sendEmail(
      email,
      'Invitation famille T-Cardio',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Invitation au groupe familial T-Cardio</h2>
          <p>Bonjour,</p>
          <p><strong>${ownerName}</strong> vous invite a rejoindre son groupe familial <strong>"${group.name}"</strong> sur T-Cardio.</p>
          <p>Le suivi familial vous permet de partager vos donnees de sante avec vos proches pour un meilleur accompagnement.</p>
          <p style="margin: 30px 0;">
            <a href="https://t-cardio.org/family/accept?token=${token}"
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Accepter l'invitation
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">Cette invitation expire dans 7 jours.</p>
          <p style="color: #6b7280; font-size: 13px;">Si vous n'avez pas de compte T-Cardio, veuillez d'abord en creer un puis accepter l'invitation.</p>
        </div>
      `,
    );

    this.logger.log(
      `Family invitation sent: group=${group.id}, email=${email}, token=${token}`,
    );

    return invitation;
  }

  // ---------------------------------------------------------------------------
  // acceptInvitation
  // ---------------------------------------------------------------------------
  async acceptInvitation(patientId: string, token: string) {
    // 1. Find invitation by token
    const invitation = await this.prisma.familyInvitation.findUnique({
      where: { token },
      include: { familyGroup: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation introuvable');
    }

    // Check not expired
    if (new Date() > invitation.expiresAt) {
      // Update status to expired
      await this.prisma.familyInvitation.update({
        where: { id: invitation.id },
        data: { status: 'FAMILY_EXPIRED' },
      });
      throw new BadRequestException('Cette invitation a expire');
    }

    // Check status is FAMILY_PENDING
    if (invitation.status !== 'FAMILY_PENDING') {
      throw new BadRequestException('Cette invitation a deja ete traitee');
    }

    // 2. Verify the patient's email matches the invited email
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: { select: { email: true } } },
    });

    if (!patient) {
      throw new NotFoundException('Profil patient introuvable');
    }

    if (patient.user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
      throw new ForbiddenException(
        "Cette invitation n'est pas destinee a votre adresse email",
      );
    }

    // Check if patient is already a member of this group
    const existingMember = await this.prisma.familyMember.findUnique({
      where: {
        familyGroupId_patientId: {
          familyGroupId: invitation.familyGroupId,
          patientId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('Vous etes deja membre de ce groupe familial');
    }

    // 3 & 4. Create FamilyMember + update invitation status in a transaction
    const group = await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.create({
        data: {
          familyGroupId: invitation.familyGroupId,
          patientId,
          role: 'MEMBER',
        },
      });

      await tx.familyInvitation.update({
        where: { id: invitation.id },
        data: { status: 'FAMILY_ACCEPTED' },
      });

      return tx.familyGroup.findUnique({
        where: { id: invitation.familyGroupId },
        include: {
          members: {
            include: {
              patient: {
                select: {
                  id: true,
                  userId: true,
                  firstName: true,
                  lastName: true,
                  user: { select: { email: true } },
                },
              },
            },
          },
          invitations: true,
        },
      });
    });

    this.logger.log(
      `Family invitation accepted: group=${invitation.familyGroupId}, patient=${patientId}`,
    );

    return this.transformGroup(group);
  }

  // ---------------------------------------------------------------------------
  // removeMember
  // ---------------------------------------------------------------------------
  async removeMember(ownerPatientId: string, memberId: string) {
    // 1. Verify caller is owner
    const group = await this.prisma.familyGroup.findFirst({
      where: { ownerId: ownerPatientId },
    });

    if (!group) {
      throw new ForbiddenException(
        'Vous devez etre proprietaire du groupe pour retirer un membre',
      );
    }

    // 2. Verify member exists and is not the owner
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException('Membre introuvable');
    }

    if (member.familyGroupId !== group.id) {
      throw new BadRequestException("Ce membre n'appartient pas a votre groupe familial");
    }

    if (member.role === 'OWNER') {
      throw new BadRequestException('Impossible de retirer le proprietaire du groupe');
    }

    // 3. Delete FamilyMember
    await this.prisma.familyMember.delete({
      where: { id: memberId },
    });

    this.logger.log(
      `Family member removed: memberId=${memberId}, group=${group.id}`,
    );

    return { success: true, message: 'Membre retire du groupe familial' };
  }

  // ---------------------------------------------------------------------------
  // getMemberData
  // ---------------------------------------------------------------------------
  async getMemberData(ownerPatientId: string, memberPatientId: string) {
    // 1. Verify caller is owner
    const group = await this.prisma.familyGroup.findFirst({
      where: { ownerId: ownerPatientId },
      include: { members: true },
    });

    if (!group) {
      throw new ForbiddenException(
        'Vous devez etre proprietaire du groupe pour consulter les donnees',
      );
    }

    // Verify target is a member of the same group
    const targetMember = group.members.find(
      (m) => m.patientId === memberPatientId,
    );

    if (!targetMember) {
      throw new BadRequestException(
        "Ce patient n'est pas membre de votre groupe familial",
      );
    }

    // 2. Fetch aggregated data
    const [measurements, medications] =
      await Promise.all([
        this.prisma.bpMeasurement.findMany({
          where: { patientId: memberPatientId },
          orderBy: { measuredAt: 'desc' },
          take: 20,
        }),
        this.prisma.medication.findMany({
          where: { patientId: memberPatientId, isActive: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    // Transform to the shape the frontend expects
    const latest = measurements.length > 0 ? measurements[0] : null;
    const count = measurements.length;
    const averageSystolic = count > 0
      ? measurements.reduce((sum, m) => sum + (m.systolic || 0), 0) / count
      : undefined;
    const averageDiastolic = count > 0
      ? measurements.reduce((sum, m) => sum + (m.diastolic || 0), 0) / count
      : undefined;

    return {
      measurements: {
        latest: latest
          ? {
              systolic: latest.systolic,
              diastolic: latest.diastolic,
              pulse: latest.pulse,
              measuredAt: latest.measuredAt,
              riskLevel: latest.riskLevel,
            }
          : undefined,
        count,
        averageSystolic,
        averageDiastolic,
      },
      medications: {
        active: medications.map((med) => ({
          id: med.id,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
        })),
        count: medications.length,
      },
    };
  }
}
