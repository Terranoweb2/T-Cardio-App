import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des notifications' })
  async getNotifications(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.notificationsService.getForUser(userId, limit || 20);
    return { data };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  async getUnreadCount(@CurrentUser('sub') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }
}
