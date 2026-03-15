'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface DoctorLink {
 id: string;
 doctorId: string;
 doctor: {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
 };
}

interface AvailabilitySlot {
 id: string;
 dayOfWeek: number;
 startTime: string;
 endTime: string;
 slotDurationMin: number;
}

interface FreeSlot {
 startTime: string;
 endTime: string;
}

export default function MyDoctorPage() {
 const queryClient = useQueryClient();
 const [selectedDoctor, setSelectedDoctor] = useState<DoctorLink | null>(null);
 const [selectedDate, setSelectedDate] = useState('');
 const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
 const [bookingReason, setBookingReason] = useState('');
 const [bookingSuccess, setBookingSuccess] = useState(false);

 // Fetch patient's doctors
 const { data: doctorLinks = [], isLoading: loadingDoctors } = useQuery<DoctorLink[]>({
  queryKey: ['patient-doctors'],
  queryFn: async () => {
   const { data } = await api.get('/patients/my-doctors');
   return data;
  },
 });

 // When only one doctor, auto-select
 const activeDoctor = selectedDoctor || (doctorLinks.length === 1 ? doctorLinks[0] : null);

 // Fetch doctor's weekly schedule
 const { data: agendaData } = useQuery({
  queryKey: ['doctor-agenda', activeDoctor?.doctor?.id],
  queryFn: async () => {
   const { data } = await api.get(`/doctors/${activeDoctor!.doctor.id}/agenda`);
   return data;
  },
  enabled: !!activeDoctor?.doctor?.id,
 });

 // Fetch available slots for selected date
 const { data: freeSlots = [], isLoading: loadingSlots } = useQuery<FreeSlot[]>({
  queryKey: ['doctor-slots', activeDoctor?.doctor?.id, selectedDate],
  queryFn: async () => {
   const { data } = await api.get(`/doctors/${activeDoctor!.doctor.id}/slots?date=${selectedDate}`);
   return data;
  },
  enabled: !!activeDoctor?.doctor?.id && !!selectedDate,
 });

 // Book teleconsultation mutation
 const bookMutation = useMutation({
  mutationFn: async (data: { scheduledAt: string; reason: string }) => {
   const { data: result } = await api.post('/teleconsultations/request', {
    motif: data.reason,
    scheduledAt: data.scheduledAt,
   });
   return result;
  },
  onSuccess: () => {
   setBookingSuccess(true);
   setSelectedSlot(null);
   setBookingReason('');
   queryClient.invalidateQueries({ queryKey: ['doctor-slots'] });
   setTimeout(() => setBookingSuccess(false), 5000);
  },
 });

 const handleBook = () => {
  if (!selectedSlot || !selectedDate) return;
  // Combine date and time
  const scheduledAt = `${selectedDate}T${selectedSlot.startTime}:00`;
  bookMutation.mutate({
   scheduledAt,
   reason: bookingReason || 'Teleconsultation',
  });
 };

 // Generate the next 14 days for date selection
 const dateOptions = useMemo(() => {
  const dates: Array<{ value: string; label: string; dayOfWeek: number }> = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
   const d = new Date(today);
   d.setDate(d.getDate() + i);
   dates.push({
    value: d.toISOString().split('T')[0],
    label: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
    dayOfWeek: d.getDay(),
   });
  }
  return dates;
 }, []);

 // Filter dates to only show days where doctor has availability
 const availableDays = new Set(
  (agendaData?.availabilities || []).map((a: AvailabilitySlot) => a.dayOfWeek),
 );
 const filteredDates = dateOptions.filter((d) => availableDays.has(d.dayOfWeek));

 // Group doctor's weekly schedule by day
 const weeklySchedule = DAYS.map((dayName, i) => ({
  dayName,
  dayIndex: i,
  slots: (agendaData?.availabilities || []).filter((a: AvailabilitySlot) => a.dayOfWeek === i),
 }));

 return (
  <div>
   <h1 className="text-xl sm:text-2xl font-bold mb-1">Mon medecin</h1>
   <p className="text-sm text-slate-400 mb-6">
    Consultez les disponibilites de votre medecin et planifiez une teleconsultation
   </p>

   {loadingDoctors ? (
    <div className="glass-card rounded-xl p-8 text-center text-slate-500 text-sm">Chargement...</div>
   ) : doctorLinks.length === 0 ? (
    <div className="glass-card rounded-xl p-8 text-center">
     <div className="w-16 h-16 bg-cardio-800 rounded-full flex items-center justify-center mx-auto mb-4">
      <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
     </div>
     <h3 className="text-slate-400 font-medium mb-2">Aucun medecin associe</h3>
     <p className="text-slate-500 text-sm">
      Utilisez le code d&apos;invitation de votre medecin sur le tableau de bord pour vous associer.
     </p>
    </div>
   ) : (
    <div className="space-y-6">
     {/* Doctor selector (if multiple) */}
     {doctorLinks.length > 1 && (
      <div className="glass-card rounded-xl p-4">
       <label className="block text-xs text-slate-400 mb-2">Selectionner un medecin</label>
       <div className="flex flex-wrap gap-2">
        {doctorLinks.map((link) => (
         <button
          key={link.id}
          onClick={() => setSelectedDoctor(link)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
           activeDoctor?.id === link.id
            ? 'glow-btn'
            : 'bg-cardio-800 text-slate-300 hover:bg-cardio-700/50'
          }`}
         >
          Dr. {link.doctor.firstName} {link.doctor.lastName}
         </button>
        ))}
       </div>
      </div>
     )}

     {activeDoctor && (
      <>
       {/* Doctor info card */}
       <div className="glass-card border border-cyan-500/20 rounded-xl p-5">
        <div className="flex items-center gap-4">
         <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
          {activeDoctor.doctor.firstName?.[0]}{activeDoctor.doctor.lastName?.[0]}
         </div>
         <div>
          <h2 className="text-lg font-semibold text-slate-200">
           Dr. {activeDoctor.doctor.firstName} {activeDoctor.doctor.lastName}
          </h2>
          <p className="text-sm text-slate-400">{activeDoctor.doctor.specialty || 'Cardiologie'}</p>
         </div>
        </div>
       </div>

       {/* Weekly schedule overview */}
       <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cyan-500/10">
         <h2 className="text-sm font-semibold text-slate-200">Horaires de consultation</h2>
         <p className="text-xs text-slate-500 mt-0.5">Planning hebdomadaire du medecin</p>
        </div>
        <div className="divide-y divide-cyan-500/10">
         {weeklySchedule.map(({ dayName, dayIndex, slots }) => (
          <div key={dayIndex} className="flex items-start p-3 px-4">
           <div className="w-28 shrink-0">
            <p className={`text-sm ${slots.length > 0 ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>
             {dayName}
            </p>
           </div>
           <div className="flex-1">
            {slots.length === 0 ? (
             <p className="text-xs text-slate-500 italic">Ferme</p>
            ) : (
             <div className="flex flex-wrap gap-2">
              {slots.map((slot: AvailabilitySlot) => (
               <span
                key={slot.id}
                className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 rounded-md px-2 py-1 text-xs"
               >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {slot.startTime} - {slot.endTime}
               </span>
              ))}
             </div>
            )}
           </div>
          </div>
         ))}
        </div>
       </div>

       {/* Booking section */}
       <div className="glass-card rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Planifier une teleconsultation</h2>

        {bookingSuccess && (
         <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg p-3 mb-4 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
           <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Teleconsultation planifiee avec succes ! Vous pouvez la retrouver dans vos teleconsultations.
         </div>
        )}

        {/* Date selection */}
        <div className="mb-4">
         <label className="block text-xs text-slate-400 mb-2">Choisir une date</label>
         {filteredDates.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
           Aucune disponibilite configuree par le medecin
          </p>
         ) : (
          <div className="flex flex-wrap gap-2">
           {filteredDates.map((d) => (
            <button
             key={d.value}
             onClick={() => {
              setSelectedDate(d.value);
              setSelectedSlot(null);
             }}
             className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
              selectedDate === d.value
               ? 'glow-btn border-cyan-400'
               : 'glass-card text-slate-400 border-cyan-500/10 hover:border-cyan-500/20 hover:text-cyan-400'
             }`}
            >
             <span className="capitalize">{d.label}</span>
            </button>
           ))}
          </div>
         )}
        </div>

        {/* Time slots */}
        {selectedDate && (
         <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2">Creneaux disponibles</label>
          {loadingSlots ? (
           <p className="text-sm text-slate-500">Chargement des creneaux...</p>
          ) : freeSlots.length === 0 ? (
           <p className="text-sm text-slate-500 italic">
            Aucun creneau disponible pour cette date
           </p>
          ) : (
           <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {freeSlots.map((slot) => (
             <button
              key={slot.startTime}
              onClick={() => setSelectedSlot(slot)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
               selectedSlot?.startTime === slot.startTime
                ? 'bg-green-600 text-white border-green-600'
                : 'glass-card text-slate-300 border-cyan-500/10 hover:border-green-500/20 hover:text-green-300'
              }`}
             >
              {slot.startTime}
             </button>
            ))}
           </div>
          )}
         </div>
        )}

        {/* Reason + confirm */}
        {selectedSlot && (
         <div className="space-y-3 mt-4 pt-4 border-t border-cyan-500/10">
          <div>
           <label className="block text-xs text-slate-400 mb-1">Motif (optionnel)</label>
           <input
            type="text"
            value={bookingReason}
            onChange={(e) => setBookingReason(e.target.value)}
            placeholder="Suivi tension, Douleurs thoraciques..."
            className="w-full glass-input rounded-lg px-3 py-2 text-sm"
           />
          </div>
          <div className="bg-cyan-500/10 rounded-lg p-3 text-sm">
           <p className="text-cyan-300">
            <span className="font-medium">Rendez-vous :</span>{' '}
            {new Date(selectedDate).toLocaleDateString('fr-FR', {
             weekday: 'long',
             day: 'numeric',
             month: 'long',
            })}{' '}
            a {selectedSlot.startTime} - {selectedSlot.endTime}
           </p>
          </div>
          <button
           onClick={handleBook}
           disabled={bookMutation.isPending}
           className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition"
          >
           {bookMutation.isPending ? 'Planification...' : 'Confirmer le rendez-vous'}
          </button>
          {bookMutation.isError && (
           <p className="text-red-500 text-xs">Erreur lors de la planification</p>
          )}
         </div>
        )}
       </div>
      </>
     )}
    </div>
   )}
  </div>
 );
}
