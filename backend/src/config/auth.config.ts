import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '365d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '365d',
}));
