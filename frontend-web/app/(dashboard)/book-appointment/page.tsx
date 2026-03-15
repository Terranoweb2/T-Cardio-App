'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  useVerifiedDoctors,
  useBookAppointment,
  usePatientAppointments,
  useDoctorAppointments,
  type VerifiedDoctor,
  type Appointment,
} from '@/hooks/useAppointments';
import SlotPicker from '@/components/appointments/SlotPicker';
import AppointmentCard from '@/components/appointments/AppointmentCard';
import { GlassCardSkeleton } from '@/components/ui/GlassSkeleton';
import {
  Search,
  Stethoscope,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock,
  CalendarDays,
  FileText,
  Loader2,
  ArrowLeft,
  ListFilter,
} from 'lucide-react';

type BookingStep = 1 | 2 | 3 | 4;

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'APPT_PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmes' },
  { value: 'REJECTED', label: 'Rejetes' },
  { value: 'CANCELLED', label: 'Annules' },
];

export default function BookAppointmentPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isDoctor = user?.role === 'MEDECIN' || user?.role === 'CARDIOLOGUE';

  // ---- Booking flow state ----
  const [step, setStep] = useState<BookingStep>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<VerifiedDoctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // ---- Appointments list state ----
  const [statusFilter, setStatusFilter] = useState('');

  // ---- Data fetching ----
  const { data: doctors = [], isLoading: loadingDoctors } = useVerifiedDoctors();
  const bookMutation = useBookAppointment();

  const {
    data: patientAppointments = [],
    isLoading: loadingPatientAppts,
  } = usePatientAppointments(statusFilter || undefined);

  const {
    data: doctorAppointments = [],
    isLoading: loadingDoctorAppts,
  } = useDoctorAppointments(isDoctor ? (statusFilter || undefined) : undefined);

  const appointments: Appointment[] = isDoctor ? doctorAppointments : patientAppointments;
  const loadingAppts = isDoctor ? loadingDoctorAppts : loadingPatientAppts;

  // ---- Filtered doctors ----
  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctors;
    const q = searchQuery.toLowerCase();
    return doctors.filter(
      (d) =>
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
        (d.specialty || '').toLowerCase().includes(q),
    );
  }, [doctors, searchQuery]);

  // ---- Next 14 days for date picker ----
  const dateOptions = useMemo(() => {
    const dates: Array<{ value: string; label: string; dayLabel: string; dayNum: string; monthLabel: string }> = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push({
        value: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        dayLabel: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNum: d.getDate().toString(),
        monthLabel: d.toLocaleDateString('fr-FR', { month: 'short' }),
      });
    }
    return dates;
  }, []);

  // ---- Handlers ----
  const handleSelectDoctor = useCallback((doctor: VerifiedDoctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSelectedSlot(null);
    setStep(2);
  }, []);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const handleSelectSlot = useCallback((slot: string) => {
    setSelectedSlot(slot);
    setStep(3);
  }, []);

  const handleConfirmBooking = () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot) return;
    const scheduledAt = `${selectedDate}T${selectedSlot}:00`;
    bookMutation.mutate(
      {
        doctorId: selectedDoctor.id,
        scheduledAt,
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          setStep(4);
        },
      },
    );
  };

  const handleRestart = () => {
    setStep(1);
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setReason('');
  };

  const goBack = () => {
    if (step === 2) { setStep(1); setSelectedDate(''); setSelectedSlot(null); }
    else if (step === 3) { setStep(2); setSelectedSlot(null); }
  };

  // ---- Step indicator ----
  const steps = [
    { num: 1, label: 'Medecin' },
    { num: 2, label: 'Date & Heure' },
    { num: 3, label: 'Confirmation' },
    { num: 4, label: 'Termine' },
  ];

  return (
    <div className="page-transition">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
            {isDoctor ? 'Rendez-vous' : 'Prendre rendez-vous'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isDoctor
              ? 'Gerez vos rendez-vous patients'
              : 'Reservez une consultation avec un medecin'}
          </p>
        </div>
      </div>

      {/* ====== BOOKING FLOW (patients only) ====== */}
      {!isDoctor && (
        <div className="mb-8">
          {/* Progress steps */}
          <div className="glass-card rounded-xl p-4 sm:p-5 mb-6">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => (
                <div key={s.num} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border-2
                        ${
                          step > s.num
                            ? 'bg-cyan-500 border-cyan-500 text-white'
                            : step === s.num
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                              : 'bg-cardio-800 border-cardio-700 text-slate-500'
                        }
                      `}
                    >
                      {step > s.num ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : s.num}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs mt-1 font-medium transition-colors ${
                        step >= s.num ? 'text-cyan-400' : 'text-slate-500'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 sm:mx-3 rounded-full transition-colors ${
                        step > s.num ? 'bg-cyan-500' : 'bg-cardio-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="animate-fade-in">
            {/* ======== STEP 1: Choose doctor ======== */}
            {step === 1 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Stethoscope className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-slate-200">Choisir un medecin</h2>
                </div>

                {/* Search input */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom ou specialite..."
                    className="w-full glass-input rounded-lg pl-10 pr-4 py-2.5 text-sm"
                  />
                </div>

                {/* Doctor cards */}
                {loadingDoctors ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                      <GlassCardSkeleton key={i} />
                    ))}
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="glass-card rounded-xl p-8 text-center">
                    <Stethoscope className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">
                      {searchQuery ? 'Aucun medecin trouve' : 'Aucun medecin disponible'}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredDoctors.map((doctor) => (
                      <button
                        key={doctor.id}
                        onClick={() => handleSelectDoctor(doctor)}
                        className="glass-card rounded-xl p-4 sm:p-5 border border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-200 text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-cyan-600/40 to-teal-600/40 rounded-full flex items-center justify-center text-white text-base font-bold border border-cyan-500/20 shrink-0 group-hover:scale-105 transition-transform">
                            {doctor.firstName?.[0]}
                            {doctor.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                              Dr. {doctor.firstName} {doctor.lastName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {doctor.specialty || 'Medecine generale'}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 ml-auto group-hover:text-cyan-400 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ======== STEP 2: Choose date & slot ======== */}
            {step === 2 && selectedDoctor && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={goBack}
                    className="p-1.5 rounded-lg hover:bg-cardio-700/50 transition"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-400" />
                  </button>
                  <CalendarDays className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-slate-200">
                    Choisir une date et un creneau
                  </h2>
                </div>

                {/* Selected doctor recap */}
                <div className="glass-card rounded-xl p-4 mb-5 border border-cyan-500/20 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-600/30 to-teal-600/30 rounded-full flex items-center justify-center text-white text-sm font-bold border border-cyan-500/20 shrink-0">
                    {selectedDoctor.firstName?.[0]}
                    {selectedDoctor.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200">
                      Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedDoctor.specialty || 'Medecine generale'}
                    </p>
                  </div>
                </div>

                {/* Date picker: horizontal scroll of day cards */}
                <div className="mb-5">
                  <label className="block text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">
                    Selectionnez une date
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 dark-scrollbar -mx-1 px-1">
                    {dateOptions.map((d) => {
                      const isSelected = selectedDate === d.value;
                      return (
                        <button
                          key={d.value}
                          onClick={() => handleSelectDate(d.value)}
                          className={`
                            flex flex-col items-center px-3 py-2.5 rounded-xl min-w-[4.5rem] shrink-0 border transition-all duration-200
                            ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                : 'glass-card border-cyan-500/10 text-slate-400 hover:border-cyan-500/20 hover:text-slate-300'
                            }
                          `}
                        >
                          <span className="text-[10px] font-medium uppercase">
                            {d.dayLabel}
                          </span>
                          <span className={`text-xl font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                            {d.dayNum}
                          </span>
                          <span className="text-[10px]">{d.monthLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slot picker */}
                {selectedDate && (
                  <div className="glass-card rounded-xl p-4 sm:p-5">
                    <label className="block text-xs text-slate-400 font-medium mb-3 uppercase tracking-wider">
                      Creneaux disponibles
                    </label>
                    <SlotPicker
                      doctorId={selectedDoctor.id}
                      selectedDate={selectedDate}
                      selectedSlot={selectedSlot}
                      onSelectSlot={handleSelectSlot}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ======== STEP 3: Confirm ======== */}
            {step === 3 && selectedDoctor && selectedDate && selectedSlot && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={goBack}
                    className="p-1.5 rounded-lg hover:bg-cardio-700/50 transition"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-400" />
                  </button>
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-slate-200">
                    Confirmer le rendez-vous
                  </h2>
                </div>

                <div className="glass-card rounded-xl p-5 sm:p-6 border border-cyan-500/20 max-w-lg">
                  {/* Summary */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-600/30 to-teal-600/30 rounded-full flex items-center justify-center shrink-0 border border-cyan-500/20">
                        <Stethoscope className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Medecin</p>
                        <p className="text-sm font-semibold text-slate-200">
                          Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedDoctor.specialty || 'Medecine generale'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cardio-800 rounded-full flex items-center justify-center shrink-0 border border-cyan-500/10">
                        <Calendar className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Date</p>
                        <p className="text-sm font-semibold text-slate-200 capitalize">
                          {new Date(selectedDate).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cardio-800 rounded-full flex items-center justify-center shrink-0 border border-cyan-500/10">
                        <Clock className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Heure</p>
                        <p className="text-sm font-semibold text-slate-200">{selectedSlot}</p>
                      </div>
                    </div>
                  </div>

                  {/* Reason textarea */}
                  <div className="mb-5">
                    <label className="block text-xs text-slate-400 font-medium mb-1.5">
                      Motif de la consultation (optionnel)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Decrivez brievement la raison de votre visite..."
                      className="w-full glass-input rounded-lg px-3 py-2.5 text-sm resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handleConfirmBooking}
                    disabled={bookMutation.isPending}
                    className="w-full glow-btn py-3 rounded-lg text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {bookMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmer le rendez-vous
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ======== STEP 4: Success ======== */}
            {step === 4 && (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                {/* Animated checkmark */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center animate-[scale-in_0.4s_ease-out] border-2 border-green-500/30">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-green-400/30 animate-ping" />
                </div>

                <h2 className="text-xl font-bold text-slate-100 mb-2 text-center">
                  Demande envoyee !
                </h2>
                <p className="text-sm text-slate-400 text-center max-w-sm mb-6">
                  Votre demande de rendez-vous a ete envoyee au medecin. Vous recevrez une
                  notification lorsque le medecin confirmera ou repondra a votre demande.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleRestart}
                    className="glow-btn px-5 py-2.5 rounded-lg text-sm font-medium transition"
                  >
                    Prendre un autre rendez-vous
                  </button>
                  <button
                    onClick={() => {
                      handleRestart();
                      // Scroll to appointments list
                      const el = document.getElementById('appointments-list');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="glass-card border border-cyan-500/20 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-500/30 transition"
                  >
                    Voir mes rendez-vous
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== APPOINTMENTS LIST ====== */}
      <div id="appointments-list">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ListFilter className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-200">
              {isDoctor ? 'Rendez-vous patients' : 'Mes rendez-vous'}
            </h2>
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 dark-scrollbar">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 border transition
                  ${
                    statusFilter === f.value
                      ? 'glow-btn border-cyan-400'
                      : 'glass-card border-cyan-500/10 text-slate-400 hover:text-slate-300 hover:border-cyan-500/20'
                  }
                `}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Appointments grid */}
        {loadingAppts ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <GlassCardSkeleton key={i} />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="glass-card rounded-xl p-8 sm:p-12 text-center">
            <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">Aucun rendez-vous</p>
            <p className="text-xs text-slate-500 mt-1">
              {statusFilter
                ? 'Aucun rendez-vous avec ce statut'
                : isDoctor
                  ? 'Vous n\'avez pas encore de rendez-vous patients'
                  : 'Commencez par prendre un rendez-vous ci-dessus'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {appointments.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                viewerRole={(user?.role as any) || 'PATIENT'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
