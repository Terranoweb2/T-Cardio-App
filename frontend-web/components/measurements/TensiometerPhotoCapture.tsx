'use client';

import { useState, useRef, useCallback } from 'react';
import { useOcrMeasurement, type OcrResult } from '@/hooks/useOcrMeasurement';

interface TensiometerPhotoCaptureProps {
  onValuesExtracted: (values: {
    systolic: number;
    diastolic: number;
    pulse?: number;
    photoPath?: string;
    interpretation?: string;
  }) => void;
}

/**
 * Compresse une image via Canvas pour reduire la taille avant upload.
 * Resize a max 1200px et compresse en JPEG 75%.
 * Une photo de 4MB devient ~100-200KB.
 */
function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src); // Prevent memory leak
      let { width, height } = img;

      // Resize si plus grand que maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
          });
          console.log(`[OCR] Photo: ${(file.size / 1024).toFixed(0)}KB -> ${(compressed.size / 1024).toFixed(0)}KB`);
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); resolve(file); }; // Fallback: envoyer l'original
    img.src = URL.createObjectURL(file);
  });
}

export default function TensiometerPhotoCapture({ onValuesExtracted }: TensiometerPhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrMutation = useOcrMeasurement();

  const handleFile = useCallback(async (file: File) => {
    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format non supporté. Utilisez JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo trop volumineuse (maximum 10 Mo).');
      return;
    }

    // Preview
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Compress image before upload (4MB -> ~150KB)
    const compressed = await compressImage(file);

    // Send to OCR
    try {
      const ocrResult = await ocrMutation.mutateAsync(compressed);
      setResult(ocrResult);

      if (ocrResult.isValidDevice && ocrResult.systolic && ocrResult.diastolic) {
        onValuesExtracted({
          systolic: ocrResult.systolic,
          diastolic: ocrResult.diastolic,
          pulse: ocrResult.pulse,
          photoPath: ocrResult.photoPath,
          interpretation: ocrResult.interpretation,
        });
      } else if (!ocrResult.isValidDevice) {
        setError("Cette image ne semble pas être un tensiomètre. Veuillez réessayer avec une photo claire de l'écran de votre appareil.");
      }
    } catch (err: any) {
      console.error('[OCR] Error:', err?.response?.status, err?.response?.data, err?.message);
      const msg = err?.response?.data?.message
        || (err?.code === 'ECONNABORTED' ? 'Délai dépassé. Réessayez avec une photo plus petite.' : null)
        || err?.message
        || "Erreur lors de l'analyse de la photo. Veuillez réessayer.";
      setError(msg);
    }
  }, [ocrMutation, onValuesExtracted]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [handleFile]);

  const resetCapture = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const confidenceColor = (confidence?: string | number) => {
    if (!confidence) return 'text-slate-400';
    // Backend returns string: 'high', 'medium', 'low'
    if (typeof confidence === 'string') {
      if (confidence === 'high') return 'text-green-400';
      if (confidence === 'medium') return 'text-yellow-400';
      return 'text-orange-400';
    }
    if (confidence >= 0.9) return 'text-green-400';
    if (confidence >= 0.7) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const confidenceLabel = (confidence?: string | number) => {
    if (!confidence) return '';
    if (typeof confidence === 'string') {
      if (confidence === 'high') return 'Confiance élevée';
      if (confidence === 'medium') return 'Confiance moyenne';
      return 'Confiance faible — vérifiez les valeurs';
    }
    if (confidence >= 0.9) return 'Confiance élevée';
    if (confidence >= 0.7) return 'Confiance moyenne';
    return 'Confiance faible — vérifiez les valeurs';
  };

  const interpretationStyle = (interpretation?: string) => {
    if (!interpretation) return '';
    if (interpretation.includes('ATTENTION') || interpretation.includes('critique')) {
      return 'bg-red-500/10 border-red-500/20 text-red-400';
    }
    if (interpretation.includes('élevée') || interpretation.includes('consultez')) {
      return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
    }
    if (interpretation.includes('légèrement')) {
      return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
    }
    return 'bg-green-500/10 border-green-500/20 text-green-400';
  };

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6 mb-4">
      <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
        Scanner un tensiomètre
      </h2>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* No preview: show buttons */}
      {!preview && !ocrMutation.isPending && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-400 rounded-lg border border-cyan-500/20 transition text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Prendre une photo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cardio-800/50 hover:bg-cardio-700/50 text-slate-300 rounded-lg border border-cyan-500/10 transition text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
            Choisir une image
          </button>
        </div>
      )}

      {/* Loading state */}
      {ocrMutation.isPending && (
        <div className="flex flex-col items-center py-6 gap-3">
          {preview && (
            <img src={preview} alt="Aperçu" className="w-32 h-32 object-cover rounded-lg opacity-60" />
          )}
          <div className="flex items-center gap-2 text-cyan-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium">Analyse de la photo en cours...</span>
          </div>
        </div>
      )}

      {/* Preview + result */}
      {preview && !ocrMutation.isPending && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <img src={preview} alt="Tensiomètre" className="w-24 h-24 object-cover rounded-lg border" />
            <div className="flex-1 min-w-0">
              {result?.isValidDevice && result.systolic && result.diastolic && (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-slate-100">{result.systolic}/{result.diastolic}</span>
                    <span className="text-sm text-slate-400">mmHg</span>
                    {result.pulse && (
                      <span className="text-sm text-slate-400 ml-2">{result.pulse} bpm</span>
                    )}
                  </div>
                  {result.confidence !== undefined && (
                    <p className={`text-xs ${confidenceColor(result.confidence)}`}>
                      {confidenceLabel(result.confidence)}
                    </p>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={resetCapture}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 underline"
              >
                Reprendre une photo
              </button>
            </div>
          </div>

          {/* Interpretation banner */}
          {result?.interpretation && result.isValidDevice && (
            <div className={`p-3 rounded-lg border text-sm ${interpretationStyle(result.interpretation)}`}>
              {result.interpretation}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p>{error}</p>
            <button type="button" onClick={resetCapture} className="mt-1 text-xs text-red-400 underline">
              Réessayer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
