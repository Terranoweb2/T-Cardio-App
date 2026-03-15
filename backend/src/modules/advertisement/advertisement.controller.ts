import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AdvertisementService } from './advertisement.service';

@ApiTags('Advertisements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('advertisements')
export class AdvertisementController {
  constructor(private readonly adService: AdvertisementService) {}

  // ─── Public: active ads for current user ───

  @Get('active')
  @ApiOperation({ summary: 'Publicites actives pour l\'utilisateur courant' })
  async getActive(@CurrentUser('role') role: string) {
    return this.adService.getActiveAds(role);
  }

  // ─── Admin CRUD ───

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Creer une publicite' })
  async create(
    @Body() body: any,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adService.create(body, adminId);
  }

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lister toutes les publicites (admin)' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.adService.findAll(page || 1, limit || 20, type);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Modifier une publicite' })
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adService.update(id, body, adminId);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Activer/desactiver une publicite' })
  async toggle(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adService.toggleActive(id, adminId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Supprimer une publicite' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.adService.remove(id, adminId);
  }
}
