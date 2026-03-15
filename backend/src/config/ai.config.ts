import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  // OpenAI Vision (for tensiometer OCR)
  visionApiKey: process.env.OPENAI_VISION_API_KEY || '',
  visionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
}));
