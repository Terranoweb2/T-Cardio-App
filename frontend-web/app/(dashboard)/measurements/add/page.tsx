'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateMeasurement } from '@/hooks/useMeasurements';
import { measurementSchema, type CreateMeasurementFormData } from '@/lib/validations/measurement.schema';
import TensiometerPhotoCapture from '@/components/measurements/TensiometerPhotoCapture';

export default function AddMeasurementPage() {
 const router = useRouter();
 const createMeasurement = useCreateMeasurement();
 const [result, setResult] = useState<any>(null);
 const [photoPath, setPhotoPath] = useState<string | undefined>();
 const [ocrInterpretation, setOcrInterpretation] = useState<string | undefined>();
 const [isFromPhoto, setIsFromPhoto] = useState(false);
 const [isSaved, setIsSaved] = useState(false);

 const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
  setError,
  setValue,
 } = useForm<CreateMeasurementFormData>({
  resolver: zodResolver(measurementSchema),
  defaultValues: {
   systolic: undefined,
   diastolic: undefined,
   pulse: undefined,
   context: 'INCONNU',
   notes: '',
  },
 });

 const handleOcrValues = useCallback((values: {
  systolic: number;
  diastolic: number;
  pulse?: number;
  photoPath?: string;
  interpretation?: string;
 }) => {
  setValue('systolic', values.systolic, { shouldValidate: true });
  setValue('diastolic', values.diastolic, { shouldValidate: true });
  if (values.pulse) {
   setValue('pulse', values.pulse, { shouldValidate: true });
  }
  setPhotoPath(values.photoPath);
  setOcrInterpretation(values.interpretation);
  setIsFromPhoto(true);
 }, [setValue]);

 const onSubmit = async (formData: CreateMeasurementFormData) => {
  try {
   const payload = {
    systolic: formData.systolic,
    diastolic: formData.diastolic,
    pulse: typeof formData.pulse === 'number' ? formData.pulse : undefined,
    context: formData.context,
    notes: formData.notes || undefined,
    measuredAt: new Date().toISOString(),
    ...(isFromPhoto && { source: 'PHOTO' as const, photoPath }),
   };

   const data = await createMeasurement.mutateAsync(payload);
   setResult(data);
   setIsSaved(true);

   if (data.isEmergency) {
    setError('root', {
     message: 'ATTENTION: Valeurs critiques detectees! Contactez votre medecin immediatement.',
    });
   }
  } catch (err: any) {
   setError('root', {
    message: err.response?.data?.message || 'Erreur lors de l\'enregistrement',
   });
  }
 };

 return (
  <div className="max-w-lg mx-auto">
   <h1 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6">Nouvelle mesure</h1>

   {errors.root && (
    <div className={`p-3 rounded-lg mb-4 text-sm ${
     result?.isEmergency ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-red-500/10 text-red-400'
    }`}>
     {errors.root.message}
    </div>
   )}

   {result && !result.isEmergency && (
    <div className="bg-green-500/10 text-green-400 p-3 rounded-lg mb-4 text-sm">
     Mesure enregistree ! Risque: {result.riskLevel}
     <button onClick={() => router.push('/measurements')} className="ml-2 underline">Voir historique</button>
    </div>
   )}

   {/* Photo capture section */}
   <TensiometerPhotoCapture onValuesExtracted={handleOcrValues} />

   {/* Separator */}
   <div className="flex items-center gap-3 mb-4">
    <div className="flex-1 h-px bg-cyan-500/10" />
    <span className="text-xs text-slate-500 whitespace-nowrap">ou saisir manuellement</span>
    <div className="flex-1 h-px bg-cyan-500/10" />
   </div>

   {/* OCR interpretation banner */}
   {ocrInterpretation && isFromPhoto && !result && (
    <div className={`p-3 rounded-lg mb-4 text-sm border ${
     ocrInterpretation.includes('ATTENTION') || ocrInterpretation.includes('critique')
      ? 'bg-red-500/10 border-red-500/20 text-red-400'
      : ocrInterpretation.includes('élevée') || ocrInterpretation.includes('consultez')
       ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
       : ocrInterpretation.includes('légèrement')
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        : 'bg-green-500/10 border-green-500/20 text-green-400'
    }`}>
     <span className="font-medium">Interprétation :</span> {ocrInterpretation}
    </div>
   )}

   <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-4 sm:p-6 rounded-xl space-y-4">
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
     <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">Systolique (mmHg)</label>
      <input
       type="number"
       {...register('systolic', { valueAsNumber: true })}
       className={`w-full px-2 py-2 sm:px-4 sm:py-3 border rounded-lg text-xl sm:text-2xl text-center font-bold ${
        errors.systolic ? 'border-red-500/20 bg-red-500/10' : ''
       }`}
       placeholder="120"
      />
      {errors.systolic && (
       <p className="mt-1 text-xs text-red-500">{errors.systolic.message}</p>
      )}
     </div>
     <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">Diastolique (mmHg)</label>
      <input
       type="number"
       {...register('diastolic', { valueAsNumber: true })}
       className={`w-full px-2 py-2 sm:px-4 sm:py-3 border rounded-lg text-xl sm:text-2xl text-center font-bold ${
        errors.diastolic ? 'border-red-500/20 bg-red-500/10' : ''
       }`}
       placeholder="80"
      />
      {errors.diastolic && (
       <p className="mt-1 text-xs text-red-500">{errors.diastolic.message}</p>
      )}
     </div>
    </div>

    <div>
     <label className="block text-sm font-medium text-slate-300 mb-1">Pouls (bpm, optionnel)</label>
     <input
      type="number"
      {...register('pulse', { valueAsNumber: true })}
      className={`w-full px-4 py-2 border rounded-lg ${
       errors.pulse ? 'border-red-500/20 bg-red-500/10' : ''
      }`}
      placeholder="72"
     />
     {errors.pulse && (
      <p className="mt-1 text-xs text-red-500">{errors.pulse.message}</p>
     )}
    </div>

    <div>
     <label className="block text-sm font-medium text-slate-300 mb-1">Contexte</label>
     <select
      {...register('context')}
      className="w-full px-4 py-2 border rounded-lg"
     >
      <option value="INCONNU">Non precise</option>
      <option value="REPOS">Au repos</option>
      <option value="MATIN">Matin</option>
      <option value="SOIR">Soir</option>
      <option value="APRES_EFFORT">Apres effort</option>
      <option value="STRESS">Stress</option>
     </select>
    </div>

    <div>
     <label className="block text-sm font-medium text-slate-300 mb-1">Notes (optionnel)</label>
     <textarea
      {...register('notes')}
      className="w-full px-4 py-2 border rounded-lg"
      rows={2}
      maxLength={500}
     />
     {errors.notes && (
      <p className="mt-1 text-xs text-red-500">{errors.notes.message}</p>
     )}
    </div>

    {/* Photo source indicator */}
    {isFromPhoto && (
     <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 px-3 py-2 rounded-lg">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
       <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
      Valeurs extraites par photo — vérifiez avant de soumettre
     </div>
    )}

    <button
     type="submit"
     disabled={isSubmitting || isSaved}
     className="w-full glow-btn py-3 rounded-lg disabled:opacity-50 transition font-medium text-lg"
    >
     {isSubmitting ? 'Enregistrement...' : isSaved ? 'Mesure deja enregistree' : 'Enregistrer la mesure'}
    </button>

    {isSaved && (
     <div className="text-center">
      <button
       type="button"
       onClick={() => {
        setIsSaved(false);
        setResult(null);
        setIsFromPhoto(false);
        setPhotoPath(undefined);
        setOcrInterpretation(undefined);
        setValue('systolic', undefined as any);
        setValue('diastolic', undefined as any);
        setValue('pulse', undefined as any);
        setValue('context', 'INCONNU');
        setValue('notes', '');
       }}
       className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 underline"
      >
       Prendre une nouvelle mesure
      </button>
     </div>
    )}
   </form>
  </div>
 );
}
