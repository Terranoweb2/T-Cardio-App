'use client';

import { useState } from 'react';
import { X, Pill, Loader2, Plus, Minus } from 'lucide-react';
import { useCreateMedication } from '@/hooks/useMedications';

interface AddMedicationModalProps {
  onClose: () => void;
}

const frequencyOptions = [
  { value: 'ONCE_DAILY', label: 'Une fois/jour', defaultTimes: ['08:00'] },
  { value: 'TWICE_DAILY', label: 'Deux fois/jour', defaultTimes: ['08:00', '20:00'] },
  { value: 'THREE_DAILY', label: 'Trois fois/jour', defaultTimes: ['08:00', '14:00', '20:00'] },
  { value: 'EVERY_OTHER_DAY', label: 'Tous les 2 jours', defaultTimes: ['08:00'] },
  { value: 'WEEKLY', label: 'Hebdomadaire', defaultTimes: ['08:00'] },
  { value: 'AS_NEEDED', label: 'Au besoin', defaultTimes: [] },
];

export default function AddMedicationModal({ onClose }: AddMedicationModalProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('ONCE_DAILY');
  const [reminderTimes, setReminderTimes] = useState<string[]>(['08:00']);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const createMutation = useCreateMedication();

  const isAsNeeded = frequency === 'AS_NEEDED';

  const handleFrequencyChange = (value: string) => {
    setFrequency(value);
    const option = frequencyOptions.find((o) => o.value === value);
    if (option) {
      setReminderTimes(option.defaultTimes.length > 0 ? [...option.defaultTimes] : []);
    }
  };

  const handleAddTime = () => {
    setReminderTimes([...reminderTimes, '12:00']);
  };

  const handleRemoveTime = (index: number) => {
    if (reminderTimes.length > 1) {
      setReminderTimes(reminderTimes.filter((_, i) => i !== index));
    }
  };

  const handleTimeChange = (index: number, value: string) => {
    const updated = [...reminderTimes];
    updated[index] = value;
    setReminderTimes(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate(
      {
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        frequency,
        reminderTimes: isAsNeeded ? undefined : reminderTimes,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-white" />
            <h2 className="text-white text-lg font-semibold">Ajouter un medicament</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto dark-scrollbar">
          {/* Name */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Nom du medicament <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
              placeholder="Ex: Amlodipine, Metoprolol..."
              required
              autoFocus
            />
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Posologie</label>
            <input
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
              placeholder="Ex: 5mg, 1 comprime, 10 gouttes..."
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Frequence</label>
            <select
              value={frequency}
              onChange={(e) => handleFrequencyChange(e.target.value)}
              className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
            >
              {frequencyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reminder times */}
          {!isAsNeeded && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Heures de rappel</label>
              <div className="space-y-2">
                {reminderTimes.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => handleTimeChange(index, e.target.value)}
                      className="flex-1 glass-input rounded-lg px-3 py-2.5 text-sm"
                    />
                    {reminderTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTime(index)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddTime}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une heure
                </button>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Date de debut</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Date de fin <span className="text-slate-600">(optionnel)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Notes <span className="text-slate-600">(optionnel)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full glass-input rounded-lg px-3 py-2.5 text-sm resize-none"
              placeholder="Prendre avec un repas, eviter le pamplemousse..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-cardio-700/50 transition text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="flex-1 glow-btn px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pill className="w-4 h-4" />
              )}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
