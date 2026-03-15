import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Headers,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Creer un compte utilisateur' })
  @ApiResponse({ status: 201, description: 'Compte cree avec succes' })
  @ApiResponse({ status: 400, description: 'Email deja utilise' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion' })
  @ApiResponse({ status: 200, description: 'Connexion reussie' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demander un code de reinitialisation du mot de passe' })
  @ApiResponse({ status: 200, description: 'Code envoye si l\'email existe' })
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reinitialiser le mot de passe avec un code' })
  @ApiResponse({ status: 200, description: 'Mot de passe reinitialise' })
  @ApiResponse({ status: 400, description: 'Code invalide ou expire' })
  async resetPassword(
    @Body() body: { email: string; code: string; newPassword: string },
  ) {
    return this.authService.resetPassword(body.email, body.code, body.newPassword);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verifier l\'email avec un code' })
  async verifyEmail(
    @CurrentUser('sub') userId: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyEmail(userId, code);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renvoyer le code de verification' })
  async resendVerification(@CurrentUser('sub') userId: string) {
    return this.authService.resendVerificationCode(userId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraichir le token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deconnexion' })
  async logout(
    @CurrentUser('sub') userId: string,
    @Body('refreshToken') refreshToken?: string,
  ) {
    await this.authService.logout(userId, refreshToken);
    return { message: 'Deconnexion reussie' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil utilisateur connecte' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }
}
