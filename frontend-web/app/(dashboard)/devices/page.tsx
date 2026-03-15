'use client';

import { useState } from 'react';
import {
  Smartphone, Watch, Upload, Plus, Wifi, WifiOff, Cpu,
  X, FileJson, PenLine,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DeviceCard from '@/components/devices/DeviceCard';
import {
  useDevices,
  useCreateDevice,
  useDeleteDevice,
  useSyncDevice,
  type DeviceType,
  type SyncRecord,
} from '@/hooks/useDevices';

// ── Device type options ──

const deviceTypeOptions: { value: DeviceType; label: string; icon: typeof Smartphone }[] = [
  { value: 'APPLE_HEALTH', label: 'Apple Health', icon: Smartphone },
  { value: 'GOOGLE_FIT', label: 'Google Fit', icon: Smartphone },
  { value: 'WITHINGS', label: 'Withings', icon: Watch },
  { value: 'OMRON', label: 'Omron', icon: Watch },
  { value: 'MANUAL_IMPORT', label: 'Import manuel', icon: Upload },
  { value: 'OTHER_DEVICE', label: 'Autre appareil', icon: Cpu },
];

export default function DevicesPage() {
  const { data: devices, isLoading } = useDevices();
  const createDevice = useCreateDevice();
  const deleteDevice = useDeleteDevice();
  const syncDevice = useSyncDevice();

  // Add device modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<DeviceType>('APPLE_HEALTH');
  const [addName, setAddName] = useState('');
  const [addDeviceId, setAddDeviceId] = useState('');

  // Manual sync modal
  const [showManualSync, setShowManualSync] = useState(false);
  const [manualSyncDeviceId, setManualSyncDeviceId] = useState('');
  const [syncMode, setSyncMode] = useState<'json' | 'form'>('form');
  const [jsonInput, setJsonInput] = useState('');
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);

  // Manual form fields
  const [formSystolic, setFormSystolic] = useState('');
  const [formDiastolic, setFormDiastolic] = useState('');
  const [formPulse, setFormPulse] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formContext, setFormContext] = useState('');

  const handleAddDevice = () => {
    if (!addName.trim()) {
      toast.error('Veuillez entrer un nom pour l\'appareil');
      return;
    }

    createDevice.mutate(
      {
        type: addType,
        name: addName.trim(),
        deviceId: addDeviceId.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Appareil ajoute avec succes');
          setShowAddModal(false);
          setAddName('');
          setAddDeviceId('');
          setAddType('APPLE_HEALTH');
        },
        onError: () => {
          toast.error('Erreur lors de l\'ajout de l\'appareil');
        },
      }
    );
  };

  const handleSync = (deviceId: string) => {
    setSyncingDeviceId(deviceId);
    syncDevice.mutate(
      { deviceId, records: [] },
      {
        onSuccess: () => {
          toast.success('Synchronisation terminee');
          setSyncingDeviceId(null);
        },
        onError: () => {
          toast.error('Erreur lors de la synchronisation');
          setSyncingDeviceId(null);
        },
      }
    );
  };

  const handleDelete = (deviceId: string) => {
    deleteDevice.mutate(deviceId, {
      onSuccess: () => toast.success('Appareil deconnecte'),
      onError: () => toast.error('Erreur lors de la deconnexion'),
    });
  };

  const handleManualSync = (deviceId: string) => {
    setManualSyncDeviceId(deviceId);
    setShowManualSync(true);
  };

  const submitManualSync = () => {
    let records: SyncRecord[] = [];

    if (syncMode === 'json') {
      try {
        const parsed = JSON.parse(jsonInput);
        records = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        toast.error('Format JSON invalide');
        return;
      }
    } else {
      if (!formSystolic || !formDiastolic) {
        toast.error('Systolique et diastolique sont obligatoires');
        return;
      }
      records = [
        {
          systolic: Number(formSystolic),
          diastolic: Number(formDiastolic),
          pulse: formPulse ? Number(formPulse) : undefined,
          measuredAt: formDate || new Date().toISOString(),
          context: formContext || undefined,
        },
      ];
    }

    setSyncingDeviceId(manualSyncDeviceId);
    syncDevice.mutate(
      { deviceId: manualSyncDeviceId, records },
      {
        onSuccess: () => {
          toast.success(`${records.length} mesure(s) synchronisee(s)`);
          setShowManualSync(false);
          setSyncingDeviceId(null);
          setJsonInput('');
          setFormSystolic('');
          setFormDiastolic('');
          setFormPulse('');
          setFormDate('');
          setFormContext('');
        },
        onError: () => {
          toast.error('Erreur lors de la synchronisation');
          setSyncingDeviceId(null);
        },
      }
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan">Appareils connectes</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="glow-btn px-4 py-2 rounded-lg transition text-sm text-center flex items-center gap-2 justify-center"
        >
          <Plus className="w-4 h-4" />
          Ajouter un appareil
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cardio-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-cardio-800 rounded w-1/3" />
                  <div className="h-3 bg-cardio-800 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !devices || devices.length === 0 ? (
        /* Empty state */
        <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/20 flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">
            Connectez vos appareils de sante
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Synchronisez vos tensiometres, montres connectees et applications de sante pour un suivi automatique de vos mesures.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="glow-btn px-6 py-2.5 rounded-lg transition text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter votre premier appareil
          </button>
        </div>
      ) : (
        /* Device list */
        <div className="space-y-3">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onSync={handleSync}
              onDelete={handleDelete}
              onManualSync={handleManualSync}
              isSyncing={syncingDeviceId === device.id}
            />
          ))}
        </div>
      )}

      {/* ── Add Device Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-200">Ajouter un appareil</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-cardio-700/50 transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Type selector */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Type d&apos;appareil
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {deviceTypeOptions.map((opt) => {
                  const OptIcon = opt.icon;
                  const isSelected = addType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAddType(opt.value)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all duration-200 ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                          : 'bg-cardio-800/50 border-cyan-500/10 text-slate-400 hover:border-cyan-500/25 hover:text-slate-300'
                      }`}
                    >
                      <OptIcon className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nom de l&apos;appareil <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Ex: Mon tensiometre Omron"
                className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
              />
            </div>

            {/* Device ID (optional) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Identifiant de l&apos;appareil <span className="text-slate-500">(optionnel)</span>
              </label>
              <input
                type="text"
                value={addDeviceId}
                onChange={(e) => setAddDeviceId(e.target.value)}
                placeholder="Ex: SN-12345678"
                className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-cardio-700/50 transition text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleAddDevice}
                disabled={createDevice.isPending}
                className="flex-1 glow-btn px-4 py-2.5 rounded-lg transition text-sm font-medium disabled:opacity-50"
              >
                {createDevice.isPending ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Sync Modal ── */}
      {showManualSync && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-200">Synchronisation manuelle</h2>
              <button
                onClick={() => setShowManualSync(false)}
                className="p-1.5 rounded-lg hover:bg-cardio-700/50 transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setSyncMode('form')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  syncMode === 'form'
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-cardio-800 text-slate-400 border border-cyan-500/10'
                }`}
              >
                <PenLine className="w-4 h-4" />
                Saisie manuelle
              </button>
              <button
                onClick={() => setSyncMode('json')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  syncMode === 'json'
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-cardio-800 text-slate-400 border border-cyan-500/10'
                }`}
              >
                <FileJson className="w-4 h-4" />
                Coller JSON
              </button>
            </div>

            {syncMode === 'form' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Systolique <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={formSystolic}
                      onChange={(e) => setFormSystolic(e.target.value)}
                      placeholder="120"
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Diastolique <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={formDiastolic}
                      onChange={(e) => setFormDiastolic(e.target.value)}
                      placeholder="80"
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Pouls <span className="text-slate-500">(opt.)</span>
                    </label>
                    <input
                      type="number"
                      value={formPulse}
                      onChange={(e) => setFormPulse(e.target.value)}
                      placeholder="72"
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Date et heure
                    </label>
                    <input
                      type="datetime-local"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Contexte <span className="text-slate-500">(opt.)</span>
                  </label>
                  <input
                    type="text"
                    value={formContext}
                    onChange={(e) => setFormContext(e.target.value)}
                    placeholder="Ex: Matin, repos, apres effort..."
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Donnees JSON
                </label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  rows={8}
                  placeholder={`[
  {
    "systolic": 120,
    "diastolic": 80,
    "pulse": 72,
    "measuredAt": "2025-01-15T08:30:00Z",
    "context": "Matin"
  }
]`}
                  className="glass-input w-full px-4 py-3 rounded-lg text-sm font-mono resize-none"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Collez un tableau JSON de mesures ou une seule mesure.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowManualSync(false)}
                className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-cardio-700/50 transition text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={submitManualSync}
                disabled={syncDevice.isPending}
                className="flex-1 glow-btn px-4 py-2.5 rounded-lg transition text-sm font-medium disabled:opacity-50"
              >
                {syncDevice.isPending ? 'Envoi...' : 'Synchroniser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
