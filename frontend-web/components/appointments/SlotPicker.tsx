'use client';

import { useAvailableSlots } from '@/hooks/useAppointments';
import { Clock, Loader2 } from 'lucide-react';

interface SlotPickerProps {
  doctorId: string;
  selectedDate: string;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
}

export default function SlotPicker({
  doctorId,
  selectedDate,
  selectedSlot,
  onSelectSlot,
}: SlotPickerProps) {
  const { data: slots = [], isLoading, isError } = useAvailableSlots(doctorId, selectedDate);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mr-2" />
        <span className="text-sm text-slate-400">Chargement des creneaux...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-400">Erreur lors du chargement des creneaux</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 bg-cardio-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-sm text-slate-400 font-medium">Aucun creneau disponible</p>
        <p className="text-xs text-slate-500 mt-1">Essayez une autre date</p>
      </div>
    );
  }

  // Group slots by period (morning / afternoon / evening)
  const morning: string[] = [];
  const afternoon: string[] = [];
  const evening: string[] = [];

  slots.forEach((slot) => {
    const hour = parseInt(slot.split(':')[0], 10);
    if (hour < 12) morning.push(slot);
    else if (hour < 18) afternoon.push(slot);
    else evening.push(slot);
  });

  const sections = [
    { label: 'Matin', slots: morning, icon: '🌅' },
    { label: 'Apres-midi', slots: afternoon, icon: '☀️' },
    { label: 'Soir', slots: evening, icon: '🌙' },
  ].filter((s) => s.slots.length > 0);

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">
            {section.label}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {section.slots.map((slot) => {
              const isSelected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => onSelectSlot(slot)}
                  className={`
                    relative px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border
                    ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'glass-card text-slate-300 border-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-300'
                    }
                  `}
                >
                  <Clock className={`w-3.5 h-3.5 inline-block mr-1 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                  {slot}
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-cardio-900" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
