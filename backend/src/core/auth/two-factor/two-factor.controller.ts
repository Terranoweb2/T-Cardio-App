import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { TwoFactorService } from './two-factor.service';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';

@ApiTags('Auth - 2FA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generer un secret TOTP et QR code pour configurer la 2FA' })
  @ApiResponse({ status: 200, description: 'Secret et QR code generes' })
  @ApiResponse({ status: 401, description: 'Non authentifie' })
  async generate(@CurrentUser('sub') userId: string) {
    return this.twoFactorService.generateSecret(userId);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activer la 2FA apres verification du code' })
  @ApiResponse({ status: 200, description: '2FA activee avec succes' })
  @ApiResponse({ status: 400, description: 'Code invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifie' })
  async enable(
    @CurrentUser('sub') userId: string,
    @Body() dto: Enable2faDto,
  ) {
    return this.twoFactorService.enableTwoFactor(userId, dto.token);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifier un code 2FA lors de la connexion' })
  @ApiResponse({ status: 200, description: 'Code valide' })
  @ApiResponse({ status: 400, description: 'Code invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifie' })
  async verify(
    @CurrentUser('sub') userId: string,
    @Body() dto: Verify2faDto,
  ) {
    const isValid = await this.twoFactorService.verifyToken(userId, dto.token);
    if (!isValid) {
      return { valid: false, message: 'Code 2FA invalide' };
    }
    return { valid: true, message: 'Code 2FA valide' };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactiver la 2FA' })
  @ApiResponse({ status: 200, description: '2FA desactivee avec succes' })
  @ApiResponse({ status: 400, description: 'Code invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifie' })
  async disable(
    @CurrentUser('sub') userId: string,
    @Body() dto: Verify2faDto,
  ) {
    return this.twoFactorService.disableTwoFactor(userId, dto.token);
  }
}
