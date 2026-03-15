import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  fedapay: {
    secretKey: process.env.FEDAPAY_SECRET_KEY,
    publicKey: process.env.FEDAPAY_PUBLIC_KEY,
    environment: (process.env.FEDAPAY_ENV as 'sandbox' | 'live') || 'sandbox',
    callbackUrl: process.env.FEDAPAY_CALLBACK_URL || 'https://t-cardio.org/api/v1/payments/webhook',
  },
  plans: {
    BASIC: { priceXof: 2000, durationDays: 365, name: 'Basique' },
    PRO: { priceXof: 5000, durationDays: 365, name: 'Professionnel' },
  },
  creditPackages: [
    { id: 'essentiel', name: 'Essentiel', priceXof: 5000, credits: 5000, bonus: 0 },
    { id: 'standard', name: 'Standard', priceXof: 10000, credits: 10500, bonus: 500 },
    { id: 'premium', name: 'Premium', priceXof: 25000, credits: 27500, bonus: 2500 },
    { id: 'mega', name: 'Mega', priceXof: 50000, credits: 57000, bonus: 7000 },
  ],
  costs: {
    teleconsultation: 5000,
    emergencyPaid: 1000,
  },
}));
