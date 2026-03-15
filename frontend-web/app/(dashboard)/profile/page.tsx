'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/stores/authStore';
import { usePatientProfile, useUpdatePatientProfile } from '@/hooks/usePatientProfile';
import { useDoctorProfile, useUpdateDoctorProfile } from '@/hooks/useDoctorProfile';
import { patientProfileSchema, type PatientProfileFormData } from '@/lib/validations/profile.schema';
import api from '@/lib/api';
import { z } from 'zod';

// Doctor profile validation schema
const doctorProfileSchema = z.object({
 firstName: z.string().min(1, 'Prenom requis'),
 lastName: z.string().min(1, 'Nom requis'),
 specialty: z.string().optional(),
 practiceAddress: z.string().optional(),
 practicePhone: z.string().optional(),
});

type DoctorProfileFormData = z.infer<typeof doctorProfileSchema>;

export default function ProfilePage() {
 const user = useAuthStore((s) => s.user);
 const isDoctor = user?.role === 'MEDECIN' || user?.role === 'CARDIOLOGUE';

 // Both hooks always called (React rules), but disabled when not relevant
 const { data: patientProfile, isLoading: patientLoading } = usePatientProfile({ enabled: !isDoctor });
 const updatePatient = useUpdatePatientProfile();
 const { data: doctorProfile, isLoading: doctorLoading } = useDoctorProfile({ enabled: !!isDoctor });
 const updateDoctor = useUpdateDoctorProfile();

 const profile = isDoctor ? doctorProfile : patientProfile;
 const isLoading = isDoctor ? doctorLoading : patientLoading;

 const [editing, setEditing] = useState(false);
 const [photoPreview, setPhotoPreview] = useState<string | null>(null);
 const [uploadingPhoto, setUploadingPhoto] = useState(false);
 const [uploadingSignature, setUploadingSignature] = useState(false);
 const [uploadingStamp, setUploadingStamp] = useState(false);
 const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
 const [stampPreview, setStampPreview] = useState<string | null>(null);
 const cameraInputRef = useRef<HTMLInputElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const signatureInputRef = useRef<HTMLInputElement>(null);
 const stampInputRef = useRef<HTMLInputElement>(null);

 // Build the photo URL from profile data
 const getPhotoUrl = () => {
  if (photoPreview) return photoPreview;
  if (!profile?.profilePhotoUrl) return null;
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const endpoint = isDoctor ? 'doctors' : 'patients';
  const filename = profile.profilePhotoUrl.split('/').pop();
  return `${baseURL}/${endpoint}/profile/photo/${filename}`;
 };

 const handlePhotoUpload = async (file: File) => {
  setUploadingPhoto(true);
  try {
   const formData = new FormData();
   formData.append('photo', file);
   const endpoint = isDoctor ? '/doctors/profile/photo' : '/patients/profile/photo';
   const { data } = await api.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
   });
   // Show local preview immediately
   const objectUrl = URL.createObjectURL(file);
   setPhotoPreview(objectUrl);
  } catch (err) {
   console.error('Erreur lors du telechargement de la photo:', err);
  } finally {
   setUploadingPhoto(false);
  }
 };

 const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) handlePhotoUpload(file);
  // Reset input so the same file can be re-selected
  e.target.value = '';
 };

 // Signature & Stamp URLs
 const getSignatureUrl = () => {
  if (signaturePreview) return signaturePreview;
  if (!profile?.signatureImageUrl) return null;
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const filename = profile.signatureImageUrl.split('/').pop();
  return `${baseURL}/doctors/signature/${filename}`;
 };
 const getStampUrl = () => {
  if (stampPreview) return stampPreview;
  if (!profile?.stampImageUrl) return null;
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const filename = profile.stampImageUrl.split('/').pop();
  return `${baseURL}/doctors/stamp/${filename}`;
 };

 const handleSignatureUpload = async (file: File) => {
  setUploadingSignature(true);
  try {
   const formData = new FormData();
   formData.append('signature', file);
   await api.post('/doctors/signature', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
   });
   setSignaturePreview(URL.createObjectURL(file));
  } catch (err) {
   console.error('Erreur upload signature:', err);
  } finally {
   setUploadingSignature(false);
  }
 };

 const handleStampUpload = async (file: File) => {
  setUploadingStamp(true);
  try {
   const formData = new FormData();
   formData.append('stamp', file);
   await api.post('/doctors/stamp', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
   });
   setStampPreview(URL.createObjectURL(file));
  } catch (err) {
   console.error('Erreur upload cachet:', err);
  } finally {
   setUploadingStamp(false);
  }
 };

 const onSignatureSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) handleSignatureUpload(file);
  e.target.value = '';
 };

 const onStampSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) handleStampUpload(file);
  e.target.value = '';
 };

 // Patient form
 const patientForm = useForm<PatientProfileFormData>({
  resolver: zodResolver(patientProfileSchema),
 });

 // Doctor form
 const doctorForm = useForm<DoctorProfileFormData>({
  resolver: zodResolver(doctorProfileSchema),
 });

 // Reset forms when profile loads
 useEffect(() => {
  if (profile && !isDoctor) {
   patientForm.reset({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    birthDate: profile.birthDate ? new Date(profile.birthDate).toISOString().split('T')[0] : '',
    gender: profile.gender || '',
    weightKg: profile.weightKg?.toString() || '',
    heightCm: profile.heightCm?.toString() || '',
    medicalStatus: profile.medicalStatus || '',
    emergencyContactName: profile.emergencyContactName || '',
    emergencyContactPhone: profile.emergencyContactPhone || '',
   });
  }
  if (profile && isDoctor) {
   doctorForm.reset({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    specialty: profile.specialty || '',
    practiceAddress: profile.practiceAddress || '',
    practicePhone: profile.practicePhone || '',
   });
  }
 }, [profile, editing]);

 const onSubmitPatient = async (formData: PatientProfileFormData) => {
  const payload: any = {};
  if (formData.firstName) payload.firstName = formData.firstName;
  if (formData.lastName) payload.lastName = formData.lastName;
  if (formData.birthDate) payload.birthDate = formData.birthDate;
  if (formData.gender && (formData.gender as string) !== '') payload.gender = formData.gender;
  if (formData.weightKg) payload.weightKg = typeof formData.weightKg === 'number' ? formData.weightKg : parseFloat(formData.weightKg as any);
  if (formData.heightCm) payload.heightCm = typeof formData.heightCm === 'number' ? formData.heightCm : parseInt(formData.heightCm as any, 10);
  if (formData.medicalStatus && (formData.medicalStatus as string) !== '') payload.medicalStatus = formData.medicalStatus;
  if (formData.emergencyContactName) payload.emergencyContactName = formData.emergencyContactName;
  if (formData.emergencyContactPhone) payload.emergencyContactPhone = formData.emergencyContactPhone;

  await updatePatient.mutateAsync(payload);
  setEditing(false);
 };

 const onSubmitDoctor = async (formData: DoctorProfileFormData) => {
  const payload: any = {};
  if (formData.firstName) payload.firstName = formData.firstName;
  if (formData.lastName) payload.lastName = formData.lastName;
  if (formData.specialty) payload.specialty = formData.specialty;
  if (formData.practiceAddress) payload.practiceAddress = formData.practiceAddress;
  if (formData.practicePhone) payload.practicePhone = formData.practicePhone;

  await updateDoctor.mutateAsync(payload);
  setEditing(false);
 };

 const calculateBMI = () => {
  if (isDoctor) return null;
  const w = parseFloat(profile?.weightKg);
  const h = parseFloat(profile?.heightCm);
  if (!w || !h || h === 0) return null;
  const heightM = h / 100;
  return (w / (heightM * heightM)).toFixed(1);
 };

 const isSaving = isDoctor ? updateDoctor.isPending : updatePatient.isPending;

 if (isLoading || !profile) {
  return (
   <div>
    <h1 className="text-xl sm:text-2xl font-bold mb-6">Mon profil</h1>
    <div className="glass-card p-12 rounded-xl text-center">
     <p className="text-slate-500">Chargement...</p>
    </div>
   </div>
  );
 }

 const bmi = calculateBMI();

 return (
  <div>
   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
    <div>
     <h1 className="text-xl sm:text-2xl font-bold">Mon profil</h1>
     {isDoctor && (
      <p className="text-sm text-cyan-400 mt-0.5">{user?.role === 'CARDIOLOGUE' ? 'Cardiologue' : 'Medecin'}</p>
     )}
    </div>
    {!editing ? (
     <button onClick={() => setEditing(true)}
      className="glow-btn px-4 py-2 rounded-lg transition text-sm w-full sm:w-auto text-center">
      Modifier
     </button>
    ) : (
     <div className="flex gap-2">
      <button onClick={() => setEditing(false)}
       className="flex-1 sm:flex-none px-4 py-2 rounded-lg border text-slate-400 hover:bg-cardio-800/50 transition text-sm">
       Annuler
      </button>
      <button
       onClick={isDoctor ? doctorForm.handleSubmit(onSubmitDoctor) : patientForm.handleSubmit(onSubmitPatient)}
       disabled={isSaving}
       className="flex-1 sm:flex-none glow-btn px-4 py-2 rounded-lg disabled:opacity-50 transition text-sm">
       {isSaving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
     </div>
    )}
   </div>

   {/* ===== DOCTOR PROFILE ===== */}
   {isDoctor && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
     <div className="glass-card p-6 rounded-xl">
      <h2 className="font-semibold mb-4">Informations personnelles</h2>
      <div className="space-y-3">
       {/* Photo de profil */}
       <div className="flex flex-col items-center gap-3 pb-3 border-b border-cyan-500/10">
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-600/20 to-teal-600/20 flex items-center justify-center">
         {getPhotoUrl() ? (
          <img src={getPhotoUrl()!} alt="Photo de profil" className="w-full h-full object-cover" />
         ) : (
          <svg className="w-12 h-12 text-cyan-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
           <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
         )}
         {uploadingPhoto && (
          <div className="absolute inset-0 bg-cardio-900/60 flex items-center justify-center">
           <div className="animate-spin h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
          </div>
         )}
        </div>
        {editing && (
         <div className="flex gap-2">
          <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFileSelected} />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
          <button type="button" onClick={() => cameraInputRef.current?.click()}
           className="px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 transition">
           Prendre une photo
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}
           className="px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 transition">
           Choisir une image
          </button>
         </div>
        )}
       </div>
       <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
        <p className="text-sm text-slate-300 bg-cardio-800/50 px-3 py-2 rounded-lg">{user?.email || '-'}</p>
       </div>
       {editing ? (
        <>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Prenom</label>
          <input type="text" {...doctorForm.register('firstName')}
           className={`w-full glass-input rounded-lg px-3 py-2 text-sm ${
            doctorForm.formState.errors.firstName ? 'border-red-500/20 bg-red-500/10' : 'border-cyan-500/15'
           }`} />
          {doctorForm.formState.errors.firstName && <p className="mt-1 text-xs text-red-500">{doctorForm.formState.errors.firstName.message}</p>}
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Nom</label>
          <input type="text" {...doctorForm.register('lastName')}
           className={`w-full glass-input rounded-lg px-3 py-2 text-sm ${
            doctorForm.formState.errors.lastName ? 'border-red-500/20 bg-red-500/10' : 'border-cyan-500/15'
           }`} />
          {doctorForm.formState.errors.lastName && <p className="mt-1 text-xs text-red-500">{doctorForm.formState.errors.lastName.message}</p>}
         </div>
        </>
       ) : (
        <>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Prenom</label>
          <p className="text-sm text-slate-300">{profile.firstName || '-'}</p>
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Nom</label>
          <p className="text-sm text-slate-300">{profile.lastName || '-'}</p>
         </div>
        </>
       )}
      </div>
     </div>

     <div className="space-y-6">
      <div className="glass-card p-6 rounded-xl">
       <h2 className="font-semibold mb-4">Informations professionnelles</h2>
       <div className="space-y-3">
        {editing ? (
         <>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Specialite</label>
           <input type="text" {...doctorForm.register('specialty')}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Adresse du cabinet</label>
           <input type="text" {...doctorForm.register('practiceAddress')}
            placeholder="Adresse du cabinet medical"
            className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Telephone du cabinet</label>
           <input type="text" {...doctorForm.register('practicePhone')}
            placeholder="Numero de telephone"
            className="w-full glass-input rounded-lg px-3 py-2 text-sm" />
          </div>
         </>
        ) : (
         <>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Specialite</label>
           <p className="text-sm text-slate-300">{profile.specialty || '-'}</p>
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">N RPPS</label>
           <p className="text-sm text-slate-300">{profile.rppsNumber || '-'}</p>
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Adresse du cabinet</label>
           <p className="text-sm text-slate-300">{profile.practiceAddress || '-'}</p>
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Telephone du cabinet</label>
           <p className="text-sm text-slate-300">{profile.practicePhone || '-'}</p>
          </div>
         </>
        )}
       </div>
      </div>

      <div className="glass-card p-6 rounded-xl">
       <h2 className="font-semibold mb-4">Statut de verification</h2>
       <div className="space-y-3">
        <div>
         <label className="block text-xs font-medium text-slate-400 mb-1">Statut</label>
         <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
          profile.verificationStatus === 'VERIFIED' ? 'bg-green-500/15 text-green-400' :
          profile.verificationStatus === 'PENDING' ? 'bg-amber-500/15 text-amber-400' :
          'bg-cardio-800 text-slate-400'
         }`}>
          {profile.verificationStatus === 'VERIFIED' ? 'Verifie' :
           profile.verificationStatus === 'PENDING' ? 'En attente' :
           profile.verificationStatus || '-'}
         </span>
        </div>
        {profile.verifiedAt && (
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Verifie le</label>
          <p className="text-sm text-slate-300">{new Date(profile.verifiedAt).toLocaleDateString('fr-FR')}</p>
         </div>
        )}
        <div>
         <label className="block text-xs font-medium text-slate-400 mb-1">Accepte nouveaux patients</label>
         <p className="text-sm text-slate-300">{profile.acceptingNewPatients ? 'Oui' : 'Non'}</p>
        </div>
       </div>
      </div>
     </div>

     {/* ===== SIGNATURE & CACHET ===== */}
     <div className="md:col-span-2 glass-card p-6 rounded-xl">
      <h2 className="font-semibold mb-1">Signature & Cachet</h2>
      <p className="text-xs text-slate-500 mb-4">Ces images apparaitront sur vos ordonnances PDF</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
       {/* Signature */}
       <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Signature manuscrite</label>
        <div className="relative w-full h-28 rounded-lg border-2 border-dashed border-cyan-500/20 bg-cardio-800/30 flex items-center justify-center overflow-hidden">
         {getSignatureUrl() ? (
          <img src={getSignatureUrl()!} alt="Signature" className="max-w-full max-h-full object-contain p-2" />
         ) : (
          <div className="text-center">
           <svg className="w-8 h-8 text-cyan-500/30 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
           </svg>
           <span className="text-xs text-slate-500">Aucune signature</span>
          </div>
         )}
         {uploadingSignature && (
          <div className="absolute inset-0 bg-cardio-900/60 flex items-center justify-center">
           <div className="animate-spin h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
          </div>
         )}
        </div>
        <input ref={signatureInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onSignatureSelected} />
        <button
         type="button"
         onClick={() => signatureInputRef.current?.click()}
         className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 transition"
        >
         {getSignatureUrl() ? 'Changer la signature' : 'Uploader une signature'}
        </button>
        <p className="text-[10px] text-slate-600 mt-1">PNG transparent recommande</p>
       </div>

       {/* Cachet */}
       <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Cachet (tampon)</label>
        <div className="relative w-full h-28 rounded-lg border-2 border-dashed border-purple-500/20 bg-cardio-800/30 flex items-center justify-center overflow-hidden">
         {getStampUrl() ? (
          <img src={getStampUrl()!} alt="Cachet" className="max-w-full max-h-full object-contain p-2" />
         ) : (
          <div className="text-center">
           <svg className="w-8 h-8 text-purple-500/30 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
           </svg>
           <span className="text-xs text-slate-500">Aucun cachet</span>
          </div>
         )}
         {uploadingStamp && (
          <div className="absolute inset-0 bg-cardio-900/60 flex items-center justify-center">
           <div className="animate-spin h-6 w-6 border-2 border-purple-400 border-t-transparent rounded-full"></div>
          </div>
         )}
        </div>
        <input ref={stampInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onStampSelected} />
        <button
         type="button"
         onClick={() => stampInputRef.current?.click()}
         className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg border border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10 transition"
        >
         {getStampUrl() ? 'Changer le cachet' : 'Uploader un cachet'}
        </button>
        <p className="text-[10px] text-slate-600 mt-1">PNG transparent recommande</p>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* ===== PATIENT PROFILE ===== */}
   {!isDoctor && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
     <div className="glass-card p-6 rounded-xl">
      <h2 className="font-semibold mb-4">Informations personnelles</h2>
      <div className="space-y-3">
       {/* Photo de profil */}
       <div className="flex flex-col items-center gap-3 pb-3 border-b border-cyan-500/10">
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-600/20 to-teal-600/20 flex items-center justify-center">
         {getPhotoUrl() ? (
          <img src={getPhotoUrl()!} alt="Photo de profil" className="w-full h-full object-cover" />
         ) : (
          <svg className="w-12 h-12 text-cyan-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
           <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
         )}
         {uploadingPhoto && (
          <div className="absolute inset-0 bg-cardio-900/60 flex items-center justify-center">
           <div className="animate-spin h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
          </div>
         )}
        </div>
        {editing && (
         <div className="flex gap-2">
          <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFileSelected} />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
          <button type="button" onClick={() => cameraInputRef.current?.click()}
           className="px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 transition">
           Prendre une photo
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}
           className="px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 transition">
           Choisir une image
          </button>
         </div>
        )}
       </div>
       <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
        <p className="text-sm text-slate-300 bg-cardio-800/50 px-3 py-2 rounded-lg">{user?.email || '-'}</p>
       </div>
       {editing ? (
        <>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Prenom</label>
          <input type="text" {...patientForm.register('firstName')}
           className={`w-full glass-input rounded-lg px-3 py-2 text-sm ${
            patientForm.formState.errors.firstName ? 'border-red-500/20 bg-red-500/10' : 'border-cyan-500/15'
           }`} />
          {patientForm.formState.errors.firstName && <p className="mt-1 text-xs text-red-500">{patientForm.formState.errors.firstName.message}</p>}
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Nom</label>
          <input type="text" {...patientForm.register('lastName')}
           className={`w-full glass-input rounded-lg px-3 py-2 text-sm ${
            patientForm.formState.errors.lastName ? 'border-red-500/20 bg-red-500/10' : 'border-cyan-500/15'
           }`} />
          {patientForm.formState.errors.lastName && <p className="mt-1 text-xs text-red-500">{patientForm.formState.errors.lastName.message}</p>}
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Date de naissance</label>
          <input type="date" {...patientForm.register('birthDate')}
           className="w-full glass-input rounded-lg px-3 py-2 text-sm border-cyan-500/15" />
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Genre</label>
          <select {...patientForm.register('gender')}
           className="w-full glass-input rounded-lg px-3 py-2 text-sm border-cyan-500/15">
           <option value="">Non renseigne</option>
           <option value="MALE">Homme</option>
           <option value="FEMALE">Femme</option>
           <option value="OTHER">Autre</option>
          </select>
         </div>
        </>
       ) : (
        <>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Prenom</label>
          <p className="text-sm text-slate-300">{profile.firstName || '-'}</p>
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Nom</label>
          <p className="text-sm text-slate-300">{profile.lastName || '-'}</p>
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Date de naissance</label>
          <p className="text-sm text-slate-300">{profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('fr-FR') : '-'}</p>
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Genre</label>
          <p className="text-sm text-slate-300">
           {profile.gender === 'MALE' ? 'Homme' : profile.gender === 'FEMALE' ? 'Femme' : profile.gender === 'OTHER' ? 'Autre' : '-'}
          </p>
         </div>
        </>
       )}
      </div>
     </div>

     <div className="space-y-6">
      <div className="glass-card p-6 rounded-xl">
       <h2 className="font-semibold mb-4">Donnees medicales</h2>
       <div className="space-y-3">
        {editing ? (
         <>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Poids (kg)</label>
           <input type="number" {...patientForm.register('weightKg')}
            className={`w-full glass-input rounded-lg px-3 py-2 text-sm ${
             patientForm.formState.errors.weightKg ? 'border-red-500/20 bg-red-500/10' : 'border-cyan-500/15'
            }`} />
           {patientForm.formState.errors.weightKg && <p className="mt-1 text-xs text-red-500">{patientForm.formState.errors.weightKg.message}</p>}
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Taille (cm)</label>
           <input type="number" {...patientForm.register('heightCm')}
            className={`w-full glass-input rounded-lg px-3 py-2 text-sm ${
             patientForm.formState.errors.heightCm ? 'border-red-500/20 bg-red-500/10' : 'border-cyan-500/15'
            }`} />
           {patientForm.formState.errors.heightCm && <p className="mt-1 text-xs text-red-500">{patientForm.formState.errors.heightCm.message}</p>}
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Statut medical</label>
           <select {...patientForm.register('medicalStatus')}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm border-cyan-500/15">
            <option value="">Non renseigne</option>
            <option value="STANDARD">Standard</option>
            <option value="HYPERTENDU">Hypertendu</option>
            <option value="POST_AVC">Post-AVC</option>
            <option value="DIABETIQUE">Diabetique</option>
            <option value="AUTRE">Autre</option>
           </select>
          </div>
         </>
        ) : (
         <>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Poids</label>
           <p className="text-sm text-slate-300">{profile.weightKg ? `${profile.weightKg} kg` : '-'}</p>
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Taille</label>
           <p className="text-sm text-slate-300">{profile.heightCm ? `${profile.heightCm} cm` : '-'}</p>
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">IMC</label>
           <p className="text-sm text-slate-300">{bmi ? bmi : '-'}</p>
          </div>
          <div>
           <label className="block text-xs font-medium text-slate-400 mb-1">Statut medical</label>
           <p className="text-sm text-slate-300">
            {profile.medicalStatus === 'STANDARD' ? 'Standard' :
             profile.medicalStatus === 'HYPERTENDU' ? 'Hypertendu' :
             profile.medicalStatus === 'POST_AVC' ? 'Post-AVC' :
             profile.medicalStatus === 'DIABETIQUE' ? 'Diabetique' :
             profile.medicalStatus === 'AUTRE' ? 'Autre' : '-'}
           </p>
          </div>
         </>
        )}
       </div>
      </div>

      <div className="glass-card p-6 rounded-xl">
       <h2 className="font-semibold mb-4">Contact d&apos;urgence</h2>
       {editing ? (
        <div className="space-y-3">
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Nom du contact</label>
          <input type="text" {...patientForm.register('emergencyContactName')}
           placeholder="Nom du contact d'urgence"
           className={`w-full glass-input rounded-lg px-3 py-2 text-sm ${
            patientForm.formState.errors.emergencyContactName ? 'border-red-500/20 bg-red-500/10' : 'border-cyan-500/15'
           }`} />
          {patientForm.formState.errors.emergencyContactName && <p className="mt-1 text-xs text-red-500">{patientForm.formState.errors.emergencyContactName.message}</p>}
         </div>
         <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Telephone du contact</label>
          <input type="text" {...patientForm.register('emergencyContactPhone')}
           placeholder="Numero de telephone"
           className={`w-full glass-input rounded-lg px-3 py-2 text-sm ${
            patientForm.formState.errors.emergencyContactPhone ? 'border-red-500/20 bg-red-500/10' : 'border-cyan-500/15'
           }`} />
          {patientForm.formState.errors.emergencyContactPhone && <p className="mt-1 text-xs text-red-500">{patientForm.formState.errors.emergencyContactPhone.message}</p>}
         </div>
        </div>
       ) : (
        <div className="space-y-1">
         <p className="text-sm text-slate-300">{profile.emergencyContactName || 'Non renseigne'}</p>
         {profile.emergencyContactPhone && (
          <p className="text-sm text-slate-400">{profile.emergencyContactPhone}</p>
         )}
        </div>
       )}
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
