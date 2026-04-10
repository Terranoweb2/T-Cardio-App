'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { CalendarCheck, User, Clock, MessageSquare, Loader2, Pencil, X, Trash2 } from 'lucide-react';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => {
 const h = Math.floor(i / 2);
 const m = i % 2 === 0 ? '00' : '30';
 return `${String(h).padStart(2, '0')}:${m}`;
});

interface Availability {
 id: string;
 dayOfWeek: number;
 startTime: string;
 endTime: string;
 slotDurationMin: number;
 isActive: boolean;
}

interface Unavailability {
 id: string;
 date: string;
 startTime?: string;
 endTime?: string;
 reason?: string;
}

interface Teleconsultation {
 id: string;
 status: string;
 scheduledAt: string;
 durationMinutes: number;
 reason?: string;
 patient?: { firstName?: string; lastName?: string; user?: { email?: string } };
}

export default function DoctorAgendaPage() {
 const queryClient = useQueryClient();
 const [activeTab, setActiveTab] = useState<'schedule' | 'absences' | 'appointments'>('appointments');

 // Form states for adding availability
 const [newSlot, setNewSlot] = useState({
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '17:00',
  slotDurationMin: 30,
 });

 // Reschedule / Cancel modal states
 const [rescheduleModal, setRescheduleModal] = useState<{ id: string; currentDate: string; patientName: string } | null>(null);
 const [rescheduleDate, setRescheduleDate] = useState('');
 const [rescheduleTime, setRescheduleTime] = useState('');
 const [cancelModal, setCancelModal] = useState<{ id: string; patientName: string } | null>(null);
 const [cancelReason, setCancelReason] = useState('');

 // Form states for adding unavailability
 const [newAbsence, setNewAbsence] = useState({
  date: '',
  startTime: '',
  endTime: '',
  reason: '',
  fullDay: true,
 });

 // Fetch availabilities
 const { data: availabilities = [], isLoading: loadingAvail } = useQuery<Availability[]>({
  queryKey: ['doctor-availabilities'],
  queryFn: async () => {
   const { data } = await api.get('/doctors/availability');
   return data;
  },
 });

 // Fetch unavailabilities
 const { data: unavailabilities = [], isLoading: loadingUnavail } = useQuery<Unavailability[]>({
  queryKey: ['doctor-unavailabilities'],
  queryFn: async () => {
   const { data } = await api.get('/doctors/unavailability');
   return data;
  },
 });

 // Fetch upcoming teleconsultations (appointments)
 const { data: teleconsultations = [], isLoading: loadingTelec } = useQuery<Teleconsultation[]>({
  queryKey: ['doctor-teleconsultations'],
  queryFn: async () => {
   const { data } = await api.get('/teleconsultations/doctor');
   return data;
  },
 });

 // Filter and sort upcoming PLANNED consultations
 const upcomingAppointments = teleconsultations
  .filter((t) => t.status === 'PLANNED' && t.scheduledAt)
  .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

 const pastAppointments = teleconsultations
  .filter((t) => t.status === 'ENDED')
  .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
  .slice(0, 10);

 // Add availability mutation
 const addAvailMutation = useMutation({
  mutationFn: async (data: typeof newSlot) => {
   const { data: result } = await api.post('/doctors/availability', data);
   return result;
  },
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ['doctor-availabilities'] });
  },
 });

 // Delete availability mutation
 const deleteAvailMutation = useMutation({
  mutationFn: async (id: string) => {
   await api.delete(`/doctors/availability/${id}`);
  },
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ['doctor-availabilities'] });
  },
 });

 // Add unavailability mutation
 const addAbsenceMutation = useMutation({
  mutationFn: async (data: { date: string; startTime?: string; endTime?: string; reason?: string }) => {
   const { data: result } = await api.post('/doctors/unavailability', data);
   return result;
  },
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ['doctor-unavailabilities'] });
   setNewAbsence({ date: '', startTime: '', endTime: '', reason: '', fullDay: true });
  },
 });

 // Delete unavailability mutation
 const deleteAbsenceMutation = useMutation({
  mutationFn: async (id: string) => {
   await api.delete(`/doctors/unavailability/${id}`);
  },
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ['doctor-unavailabilities'] });
  },
 });

 // Reschedule mutation
 const rescheduleMutation = useMutation({
  mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
   const { data } = await api.patch(`/teleconsultations/${id}/reschedule`, { scheduledAt });
   return data;
  },
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ['doctor-teleconsultations'] });
   setRescheduleModal(null);
  },
 });

 // Cancel appointment mutation
 const cancelAppointmentMutation = useMutation({
  mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
   const { data } = await api.patch(`/teleconsultations/${id}/cancel-appointment`, { reason });
   return data;
  },
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ['doctor-teleconsultations'] });
   setCancelModal(null);
   setCancelReason('');
  },
 });

 const handleReschedule = () => {
  if (!rescheduleModal || !rescheduleDate || !rescheduleTime) return;
  const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
  rescheduleMutation.mutate({ id: rescheduleModal.id, scheduledAt });
 };

 const handleCancelAppointment = () => {
  if (!cancelModal) return;
  cancelAppointmentMutation.mutate({ id: cancelModal.id, reason: cancelReason || undefined });
 };

 const openRescheduleModal = (apt: Teleconsultation) => {
  const dt = new Date(apt.scheduledAt);
  const dateStr = dt.toISOString().split('T')[0];
  const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const patientName = apt.patient
   ? `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim() || 'Patient'
   : 'Patient';
  setRescheduleDate(dateStr);
  setRescheduleTime(timeStr);
  setRescheduleModal({ id: apt.id, currentDate: apt.scheduledAt, patientName });
 };

 const handleAddSlot = () => {
  if (newSlot.startTime >= newSlot.endTime) {
   alert('L\'heure de debut doit etre avant l\'heure de fin');
   return;
  }
  addAvailMutation.mutate(newSlot);
 };

 const handleAddAbsence = () => {
  if (!newAbsence.date) {
   alert('Veuillez selectionner une date');
   return;
  }
  const data: any = { date: newAbsence.date, reason: newAbsence.reason || undefined };
  if (!newAbsence.fullDay) {
   data.startTime = newAbsence.startTime;
   data.endTime = newAbsence.endTime;
  }
  addAbsenceMutation.mutate(data);
 };

 // Group availabilities by day
 const groupedByDay = DAYS.map((dayName, index) => ({
  dayName,
  dayIndex: index,
  slots: availabilities.filter((a) => a.dayOfWeek === index),
 }));

 return (
  <div>
   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
    <div>
     <h1 className="text-xl sm:text-2xl font-bold">Mon Agenda</h1>
     <p className="text-sm text-slate-400 mt-1">
      Definissez vos creneaux de disponibilite pour les teleconsultations
     </p>
    </div>
   </div>

   {/* Tabs */}
   <div className="flex gap-1 bg-cardio-800 rounded-xl p-1 mb-6 max-w-xl">
    <button
     onClick={() => setActiveTab('appointments')}
     className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
      activeTab === 'appointments'
       ? 'glass-card text-cyan-400 '
       : 'text-slate-400 hover:text-slate-300'
     }`}
    >
     Rendez-vous
     {upcomingAppointments.length > 0 && (
      <span className="ml-1.5 bg-cyan-500/20 text-cyan-400 text-xs px-1.5 py-0.5 rounded-full">
       {upcomingAppointments.length}
      </span>
     )}
    </button>
    <button
     onClick={() => setActiveTab('schedule')}
     className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
      activeTab === 'schedule'
       ? 'glass-card text-cyan-400 '
       : 'text-slate-400 hover:text-slate-300'
     }`}
    >
     Horaires
    </button>
    <button
     onClick={() => setActiveTab('absences')}
     className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
      activeTab === 'absences'
       ? 'glass-card text-cyan-400 '
       : 'text-slate-400 hover:text-slate-300'
     }`}
    >
     Absences
     {unavailabilities.length > 0 && (
      <span className="ml-1.5 bg-cardio-800 text-slate-400 text-xs px-1.5 py-0.5 rounded-full">
       {unavailabilities.length}
      </span>
     )}
    </button>
   </div>

   {/* ==================== APPOINTMENTS TAB ==================== */}
   {activeTab === 'appointments' && (
    <div className="space-y-6">
     {/* Upcoming appointments */}
     <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-cyan-500/10">
       <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <CalendarCheck className="w-4 h-4 text-cyan-400" />
        Rendez-vous a venir
       </h2>
       <p className="text-xs text-slate-500 mt-0.5">
        Consultations planifiees par vos patients
       </p>
      </div>

      {loadingTelec ? (
       <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
       </div>
      ) : upcomingAppointments.length === 0 ? (
       <div className="p-8 text-center">
        <CalendarCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Aucun rendez-vous a venir</p>
        <p className="text-slate-600 text-xs mt-1">
         Les reservations de vos patients apparaitront ici
        </p>
       </div>
      ) : (
       <div className="divide-y divide-cyan-500/10">
        {upcomingAppointments.map((apt) => {
         const dt = new Date(apt.scheduledAt);
         const isToday = dt.toDateString() === new Date().toDateString();
         const isTomorrow = dt.toDateString() === new Date(Date.now() + 86400000).toDateString();
         const dayLabel = isToday ? "Aujourd'hui" : isTomorrow ? 'Demain' : dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
         const timeLabel = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
         const patientName = apt.patient
          ? `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim() || apt.patient.user?.email || 'Patient'
          : 'Patient';

         return (
          <div key={apt.id} className="p-4 hover:bg-cardio-800/50 transition">
           <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
             <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isToday ? 'bg-cyan-500/20' : 'bg-cardio-700'}`}>
              <User className={`w-5 h-5 ${isToday ? 'text-cyan-400' : 'text-slate-400'}`} />
             </div>
             <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-200 truncate">{patientName}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
               <span className="flex items-center gap-1 text-xs text-cyan-400">
                <CalendarCheck className="w-3 h-3" />
                {dayLabel}
               </span>
               <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                {timeLabel}
               </span>
               <span className="text-xs text-slate-500">
                {apt.durationMinutes || 15} min
               </span>
              </div>
              {apt.reason && (
               <p className="flex items-center gap-1 text-xs text-slate-500 mt-1.5 truncate">
                <MessageSquare className="w-3 h-3 shrink-0" />
                {apt.reason}
               </p>
              )}
             </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
             {isToday && (
              <span className="bg-cyan-500/20 text-cyan-400 text-xs font-medium px-2 py-0.5 rounded-full">
               Aujourd&apos;hui
              </span>
             )}
             <button
              onClick={() => openRescheduleModal(apt)}
              className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition"
              title="Reporter"
             >
              <Pencil className="w-3.5 h-3.5" />
             </button>
             <button
              onClick={() => {
               const pName = apt.patient
                ? `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim() || 'Patient'
                : 'Patient';
               setCancelModal({ id: apt.id, patientName: pName });
              }}
              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
              title="Annuler"
             >
              <Trash2 className="w-3.5 h-3.5" />
             </button>
            </div>
           </div>
          </div>
         );
        })}
       </div>
      )}
     </div>

     {/* Past consultations (last 10) */}
     {pastAppointments.length > 0 && (
      <div className="glass-card rounded-xl overflow-hidden">
       <div className="p-4 border-b border-cyan-500/10">
        <h2 className="text-sm font-semibold text-slate-200">Consultations recentes</h2>
       </div>
       <div className="divide-y divide-cyan-500/10">
        {pastAppointments.map((apt) => {
         const dt = new Date(apt.scheduledAt);
         const patientName = apt.patient
          ? `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim() || apt.patient.user?.email || 'Patient'
          : 'Patient';

         return (
          <div key={apt.id} className="flex items-center justify-between p-4 opacity-60">
           <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
             <CalendarCheck className="w-4 h-4 text-green-500" />
            </div>
            <div>
             <p className="text-sm text-slate-300">{patientName}</p>
             <p className="text-xs text-slate-500">
              {dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })} a {dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
             </p>
            </div>
           </div>
           <span className="text-xs text-green-500/70 bg-green-500/10 px-2 py-0.5 rounded-full">Terminee</span>
          </div>
         );
        })}
       </div>
      </div>
     )}
    </div>
   )}

   {/* ==================== SCHEDULE TAB ==================== */}
   {activeTab === 'schedule' && (
    <div className="space-y-6">
     {/* Add slot form */}
     <div className="glass-card rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-200 mb-4">Ajouter un creneau</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
       <div>
        <label className="block text-xs text-slate-400 mb-1">Jour</label>
        <select
         value={newSlot.dayOfWeek}
         onChange={(e) => setNewSlot((s) => ({ ...s, dayOfWeek: Number(e.target.value) }))}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
         {DAYS.map((day, i) => (
          <option key={i} value={i}>{day}</option>
         ))}
        </select>
       </div>
       <div>
        <label className="block text-xs text-slate-400 mb-1">Debut</label>
        <select
         value={newSlot.startTime}
         onChange={(e) => setNewSlot((s) => ({ ...s, startTime: e.target.value }))}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
         {HALF_HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
         ))}
        </select>
       </div>
       <div>
        <label className="block text-xs text-slate-400 mb-1">Fin</label>
        <select
         value={newSlot.endTime}
         onChange={(e) => setNewSlot((s) => ({ ...s, endTime: e.target.value }))}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
         {HALF_HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
         ))}
        </select>
       </div>
       <div>
        <label className="block text-xs text-slate-400 mb-1">Duree creneau</label>
        <select
         value={newSlot.slotDurationMin}
         onChange={(e) => setNewSlot((s) => ({ ...s, slotDurationMin: Number(e.target.value) }))}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
         <option value={15}>15 min</option>
         <option value={20}>20 min</option>
         <option value={30}>30 min</option>
         <option value={45}>45 min</option>
         <option value={60}>60 min</option>
        </select>
       </div>
       <div className="flex items-end">
        <button
         onClick={handleAddSlot}
         disabled={addAvailMutation.isPending}
         className="w-full glow-btn px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition"
        >
         {addAvailMutation.isPending ? 'Ajout...' : 'Ajouter'}
        </button>
       </div>
      </div>
      {addAvailMutation.isError && (
       <p className="text-red-500 text-xs mt-2">Erreur lors de l&apos;ajout du creneau</p>
      )}
     </div>

     {/* Weekly schedule view */}
     <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-cyan-500/10">
       <h2 className="text-sm font-semibold text-slate-200">Planning hebdomadaire</h2>
       <p className="text-xs text-slate-500 mt-0.5">
        Vos patients verront ces creneaux dans votre agenda
       </p>
      </div>

      {loadingAvail ? (
       <div className="p-8 text-center text-slate-500 text-sm">Chargement...</div>
      ) : (
       <div className="divide-y divide-cyan-500/10">
        {groupedByDay.map(({ dayName, dayIndex, slots }) => (
         <div key={dayIndex} className="flex items-start p-4 hover:bg-cardio-800/50/50 transition">
          <div className="w-28 shrink-0">
           <p className={`text-sm font-medium ${slots.length > 0 ? 'text-slate-200' : 'text-slate-500'}`}>
            {dayName}
           </p>
          </div>
          <div className="flex-1">
           {slots.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-1">Non disponible</p>
           ) : (
            <div className="flex flex-wrap gap-2">
             {slots.map((slot) => (
              <div
               key={slot.id}
               className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-400 rounded-lg px-3 py-1.5 text-xs font-medium"
              >
               <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               {slot.startTime} - {slot.endTime}
               <span className="text-cyan-400">({slot.slotDurationMin}min)</span>
               <button
                onClick={() => deleteAvailMutation.mutate(slot.id)}
                className="ml-1 text-cyan-400 hover:text-red-500 transition"
                title="Supprimer"
               >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
               </button>
              </div>
             ))}
            </div>
           )}
          </div>
         </div>
        ))}
       </div>
      )}
     </div>

     {/* Info card */}
     <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
      <div className="flex gap-3">
       <svg className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
       </svg>
       <div>
        <p className="text-sm text-cyan-300 font-medium">Comment fonctionne l&apos;agenda ?</p>
        <p className="text-xs text-cyan-400 mt-1">
         Vos patients associes peuvent voir vos creneaux de disponibilite et planifier des teleconsultations
         aux heures que vous avez definies. Les creneaux deja reserves ne seront plus visibles.
        </p>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* ==================== ABSENCES TAB ==================== */}
   {activeTab === 'absences' && (
    <div className="space-y-6">
     {/* Add absence form */}
     <div className="glass-card rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-200 mb-4">Ajouter une absence</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
       <div>
        <label className="block text-xs text-slate-400 mb-1">Date</label>
        <input
         type="date"
         value={newAbsence.date}
         onChange={(e) => setNewAbsence((s) => ({ ...s, date: e.target.value }))}
         min={new Date().toISOString().split('T')[0]}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        />
       </div>
       <div>
        <label className="block text-xs text-slate-400 mb-1">Type</label>
        <div className="flex items-center gap-4 py-2">
         <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer">
          <input
           type="radio"
           checked={newAbsence.fullDay}
           onChange={() => setNewAbsence((s) => ({ ...s, fullDay: true }))}
           className="text-cyan-400"
          />
          Journee
         </label>
         <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer">
          <input
           type="radio"
           checked={!newAbsence.fullDay}
           onChange={() => setNewAbsence((s) => ({ ...s, fullDay: false }))}
           className="text-cyan-400"
          />
          Partielle
         </label>
        </div>
       </div>
       {!newAbsence.fullDay && (
        <>
         <div>
          <label className="block text-xs text-slate-400 mb-1">De</label>
          <select
           value={newAbsence.startTime}
           onChange={(e) => setNewAbsence((s) => ({ ...s, startTime: e.target.value }))}
           className="w-full glass-input rounded-lg px-3 py-2 text-sm"
          >
           <option value="">--</option>
           {HALF_HOURS.map((h) => (
            <option key={h} value={h}>{h}</option>
           ))}
          </select>
         </div>
         <div>
          <label className="block text-xs text-slate-400 mb-1">A</label>
          <select
           value={newAbsence.endTime}
           onChange={(e) => setNewAbsence((s) => ({ ...s, endTime: e.target.value }))}
           className="w-full glass-input rounded-lg px-3 py-2 text-sm"
          >
           <option value="">--</option>
           {HALF_HOURS.map((h) => (
            <option key={h} value={h}>{h}</option>
           ))}
          </select>
         </div>
        </>
       )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
       <div>
        <label className="block text-xs text-slate-400 mb-1">Raison (optionnel)</label>
        <input
         type="text"
         value={newAbsence.reason}
         onChange={(e) => setNewAbsence((s) => ({ ...s, reason: e.target.value }))}
         placeholder="Conge, Vacances, Formation..."
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        />
       </div>
       <div className="flex items-end">
        <button
         onClick={handleAddAbsence}
         disabled={addAbsenceMutation.isPending}
         className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition"
        >
         {addAbsenceMutation.isPending ? 'Ajout...' : 'Marquer absent'}
        </button>
       </div>
      </div>
     </div>

     {/* Absences list */}
     <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-cyan-500/10">
       <h2 className="text-sm font-semibold text-slate-200">Absences planifiees</h2>
      </div>

      {loadingUnavail ? (
       <div className="p-8 text-center text-slate-500 text-sm">Chargement...</div>
      ) : unavailabilities.length === 0 ? (
       <div className="p-8 text-center">
        <p className="text-slate-500 text-sm">Aucune absence planifiee</p>
       </div>
      ) : (
       <div className="divide-y divide-cyan-500/10">
        {unavailabilities.map((absence) => (
         <div key={absence.id} className="flex items-center justify-between p-4 hover:bg-cardio-800/50/50 transition">
          <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
           </div>
           <div>
            <p className="text-sm font-medium text-slate-200">
             {new Date(absence.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
             })}
            </p>
            <p className="text-xs text-slate-400">
             {absence.startTime && absence.endTime
              ? `${absence.startTime} - ${absence.endTime}`
              : 'Journee entiere'}
             {absence.reason && ` - ${absence.reason}`}
            </p>
           </div>
          </div>
          <button
           onClick={() => deleteAbsenceMutation.mutate(absence.id)}
           className="text-slate-500 hover:text-red-500 p-2 transition"
           title="Supprimer"
          >
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
           </svg>
          </button>
         </div>
        ))}
       </div>
      )}
     </div>
    </div>
   )}
   {/* ==================== RESCHEDULE MODAL ==================== */}
   {rescheduleModal && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
     <div className="glass-card rounded-2xl w-full max-w-md p-6">
      <div className="flex items-center justify-between mb-4">
       <h3 className="text-lg font-semibold text-slate-200">Reporter le rendez-vous</h3>
       <button onClick={() => setRescheduleModal(null)} className="text-slate-400 hover:text-slate-200">
        <X className="w-5 h-5" />
       </button>
      </div>
      <p className="text-sm text-slate-400 mb-4">
       Patient : <span className="text-slate-200">{rescheduleModal.patientName}</span>
      </p>
      <div className="space-y-3">
       <div>
        <label className="block text-xs text-slate-400 mb-1">Nouvelle date</label>
        <input
         type="date"
         value={rescheduleDate}
         onChange={(e) => setRescheduleDate(e.target.value)}
         min={new Date().toISOString().split('T')[0]}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        />
       </div>
       <div>
        <label className="block text-xs text-slate-400 mb-1">Nouvelle heure</label>
        <select
         value={rescheduleTime}
         onChange={(e) => setRescheduleTime(e.target.value)}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
         {HALF_HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
         ))}
        </select>
       </div>
      </div>
      <div className="flex gap-3 mt-6">
       <button
        onClick={() => setRescheduleModal(null)}
        className="flex-1 py-2 rounded-lg text-sm font-medium text-slate-400 bg-cardio-700 hover:bg-cardio-600 transition"
       >
        Annuler
       </button>
       <button
        onClick={handleReschedule}
        disabled={rescheduleMutation.isPending || !rescheduleDate || !rescheduleTime}
        className="flex-1 glow-btn py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition"
       >
        {rescheduleMutation.isPending ? 'Modification...' : 'Confirmer'}
       </button>
      </div>
      {rescheduleMutation.isError && (
       <p className="text-red-500 text-xs mt-2 text-center">Erreur lors de la modification</p>
      )}
     </div>
    </div>
   )}

   {/* ==================== CANCEL MODAL ==================== */}
   {cancelModal && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
     <div className="glass-card rounded-2xl w-full max-w-md p-6">
      <div className="flex items-center justify-between mb-4">
       <h3 className="text-lg font-semibold text-red-400">Annuler le rendez-vous</h3>
       <button onClick={() => { setCancelModal(null); setCancelReason(''); }} className="text-slate-400 hover:text-slate-200">
        <X className="w-5 h-5" />
       </button>
      </div>
      <p className="text-sm text-slate-400 mb-4">
       Voulez-vous annuler le rendez-vous avec <span className="text-slate-200">{cancelModal.patientName}</span> ?
      </p>
      <div>
       <label className="block text-xs text-slate-400 mb-1">Raison (optionnel)</label>
       <input
        type="text"
        value={cancelReason}
        onChange={(e) => setCancelReason(e.target.value)}
        placeholder="Indisponibilite, urgence..."
        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
       />
      </div>
      <div className="flex gap-3 mt-6">
       <button
        onClick={() => { setCancelModal(null); setCancelReason(''); }}
        className="flex-1 py-2 rounded-lg text-sm font-medium text-slate-400 bg-cardio-700 hover:bg-cardio-600 transition"
       >
        Non, garder
       </button>
       <button
        onClick={handleCancelAppointment}
        disabled={cancelAppointmentMutation.isPending}
        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition"
       >
        {cancelAppointmentMutation.isPending ? 'Annulation...' : 'Oui, annuler'}
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
