import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    cors: {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
        // Allow requests with no origin (mobile apps, Capacitor, curl, etc.)
        if (!origin) return callback(null, true);
        // Allow Capacitor and Ionic WebView origins
        if (
          allowedOrigins.includes(origin) ||
          origin.startsWith('capacitor://') ||
          origin.startsWith('ionic://') ||
          origin === 'http://localhost' ||
          origin === 'https://localhost'
        ) {
          return callback(null, true);
        }
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    },
  });

  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.use(compression());

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger (dev only)
  if (configService.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('T-Cardio Pro API')
      .setDescription('API de suivi cardiovasculaire avec IA DeepSeek')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Auth', 'Authentification & inscription')
      .addTag('Patients', 'Gestion des profils patients')
      .addTag('Doctors', 'Gestion des medecins')
      .addTag('Measurements', 'Mesures tensionnelles')
      .addTag('Analytics', 'Visualisation & analytique')
      .addTag('AI', 'Analyses IA DeepSeek')
      .addTag('Emergency', 'Mode urgence')
      .addTag('Teleconsultation', 'Teleconsultation')
      .addTag('Reports', 'Rapports PDF')
      .addTag('Admin', 'Administration')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);

  logger.log(`========================================`);
  logger.log(`T-Cardio Pro API demarree`);
  logger.log(`Environnement: ${configService.get('NODE_ENV', 'development')}`);
  logger.log(`Port: ${port}`);
  logger.log(`Documentation: http://localhost:${port}/api/docs`);
  logger.log(`========================================`);
}

bootstrap();
