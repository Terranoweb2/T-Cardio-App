import { Controller, Get, Patch, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { DoctorWalletService } from '../doctor-wallet/doctor-wallet.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly walletService: DoctorWalletService,
  ) {}

  // ─── Users ───

  @Get('users')
  @ApiOperation({ summary: 'Liste des utilisateurs (enrichie)' })
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(page || 1, limit || 20, role, search);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Activer/suspendre un utilisateur' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.updateUserStatus(id, status, adminId);
  }

  @Post('users/:id/grant-subscription')
  @ApiOperation({ summary: 'Accorder un abonnement gratuit a un patient' })
  async grantSubscription(
    @Param('id') userId: string,
    @Body() body: { plan: string; durationDays?: number },
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.grantSubscription(
      userId,
      body.plan,
      body.durationDays || 365,
      adminId,
    );
  }

  @Post('users/:id/bonus')
  @ApiOperation({ summary: 'Ajouter des credits bonus a un patient' })
  async addBonusCredits(
    @Param('id') userId: string,
    @Body() body: { amount: number; description: string },
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.addBonusCredits(
      userId,
      body.amount,
      body.description,
      adminId,
    );
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Supprimer un utilisateur et toutes ses donnees' })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.deleteUser(id, adminId);
  }

  // ─── Doctor verification ───

  @Get('doctors/pending')
  @ApiOperation({ summary: 'Medecins en attente de validation' })
  async getPendingDoctors() {
    return this.adminService.getPendingDoctors();
  }

  @Get('doctors/all')
  @ApiOperation({ summary: 'Tous les medecins verifies (pour contact)' })
  async getAllDoctors() {
    return this.adminService.getDoctorsForContact();
  }

  @Post('doctors/:id/verify')
  @ApiOperation({ summary: 'Valider/rejeter un medecin' })
  async verifyDoctor(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.verifyDoctor(id, approved, adminId);
  }

  // ─── Admin-Doctor messaging ───

  @Post('messages/doctors')
  @ApiOperation({ summary: 'Envoyer un message a un medecin' })
  async sendMessageToDoctor(
    @Body() body: { doctorUserId: string; subject: string; content: string; priority: string },
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.sendMessageToDoctor(
      body.doctorUserId,
      body.subject,
      body.content,
      body.priority as 'NORMAL' | 'URGENT',
      adminId,
    );
  }

  @Get('messages')
  @ApiOperation({ summary: 'Historique des messages envoyes' })
  async getMessages(
    @CurrentUser('sub') adminId: string,
    @Query('page') page?: number,
  ) {
    return this.adminService.getMessagesSent(adminId, page || 1);
  }

  // ─── Stats & Config ───

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques globales' })
  async getGlobalStats() {
    return this.adminService.getGlobalStats();
  }

  @Get('ai-thresholds')
  @ApiOperation({ summary: 'Seuils IA configures' })
  async getAiThresholds() {
    return this.adminService.getAiThresholds();
  }

  @Patch('ai-thresholds/:id')
  @ApiOperation({ summary: 'Modifier un seuil IA' })
  async updateAiThreshold(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adminService.updateAiThreshold(id, body, adminId);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Logs d\'audit' })
  async getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('resourceType') resourceType?: string,
  ) {
    return this.adminService.getAuditLogs(page || 1, limit || 50, resourceType);
  }

  // ─── Withdrawals ───

  @Get('withdrawals')
  @ApiOperation({ summary: 'Liste des demandes de retrait' })
  async getWithdrawals(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.walletService.getAllWithdrawals(page || 1, limit || 20, status);
  }

  @Patch('withdrawals/:id')
  @ApiOperation({ summary: 'Approuver ou rejeter un retrait' })
  async processWithdrawal(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject'; reason?: string },
    @CurrentUser('sub') adminId: string,
  ) {
    return this.walletService.processWithdrawal(id, adminId, body.action, body.reason);
  }

  // ─── Advanced Stats ───

  @Get('stats/revenue')
  @ApiOperation({ summary: 'Statistiques de revenus par jour' })
  async getRevenueStats(@Query('days') days?: number) {
    return this.adminService.getRevenueStats(days || 30);
  }

  @Get('stats/user-growth')
  @ApiOperation({ summary: 'Croissance des utilisateurs par jour' })
  async getUserGrowthStats(@Query('days') days?: number) {
    return this.adminService.getUserGrowthStats(days || 30);
  }

  @Get('stats/subscriptions')
  @ApiOperation({ summary: 'Repartition des abonnements' })
  async getSubscriptionStats() {
    return this.adminService.getSubscriptionStats();
  }

  @Get('stats/top-doctors')
  @ApiOperation({ summary: 'Top medecins par consultations' })
  async getTopDoctors(@Query('limit') limit?: number) {
    return this.adminService.getTopDoctors(limit || 5);
  }
}
