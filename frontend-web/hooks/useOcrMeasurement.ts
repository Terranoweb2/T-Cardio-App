import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';

export interface OcrResult {
  isValidDevice: boolean;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  confidence?: string | number;  // Backend returns 'high'|'medium'|'low'
  rawText?: string;
  interpretation?: string;
  photoPath?: string;
}

export function useOcrMeasurement() {
  return useMutation({
    mutationFn: async (photo: File): Promise<OcrResult> => {
      const formData = new FormData();
      formData.append('photo', photo);

      const { data } = await api.post('/measurements/ocr', formData, {
        headers: { 'Content-Type': undefined }, // Let Axios set multipart boundary automatically
        timeout: 60000, // 60s timeout for vision API (mobile networks can be slow)
      });
      return data;
    },
  });
}
