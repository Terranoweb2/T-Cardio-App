'use client';

import { useState } from 'react';
import {
  Smartphone, Watch, Upload, Wifi, RefreshCw, Trash2,
  ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle,
  Cpu,
} from 'lucide-react';
import { type Device, type DeviceType, type SyncLog, useDeviceHistory } from '@/hooks/useDevices';

// ── Device type config ──

const deviceTypeConfig: Record<DeviceType, { icon: typeof Smartphone; label: string; color: string }> = {
  APPLE_HEALTH: { icon: Smartphone, label: 'Apple Health', color: 'text-slate-200' },
  GOOGLE_FIT: { icon: Smartphone, label: 'Google Fit', color: 'text-green-400' },
  WITHINGS: { icon: Watch, label: 'Withings', color: 'text-cyan-400' },
  OMRON: { icon: Watch, label: 'Omron', color: 'text-blue-400' },
  MANUAL_IMPORT: { icon: Upload, label: 'Import manuel', color: 'text-amber-400' },
  OTHER_DEVICE: { icon: Cpu, label: 'Autre appareil', color: 'text-purple-400' },
};

interface DeviceCardProps {
  device: Device;
  onSync: (deviceId: string) => void;
  onDelete: (deviceId: string) => void;
  isSyncing: boolean;
  onManualSync?: (deviceId: string) => void;
}

export default function DeviceCard({ device, onSync, onDelete, isSyncing, onManualSync }: DeviceCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const config = deviceTypeConfig[device.type] || deviceTypeConfig.OTHER_DEVICE;
  const Icon = config.icon;

  const { data: history, isLoading: historyLoading } = useDeviceHistory(
    showHistory ? device.id : ''
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="glass-card rounded-xl p-4 hover:border-cyan-500/20 transition-all duration-200">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          {/* Left: Device info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg bg-cardio-800 border border-cyan-500/15 flex items-center justify-center shrink-0">
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-200 truncate">{device.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  device.isActive
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : 'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                }`}>
                  {device.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className={`px-2 py-0.5 rounded bg-cardio-800 border border-cyan-500/10 ${config.color}`}>
                  {config.label}
                </span>
                {device.lastSyncAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Derniere sync : {formatDate(device.lastSyncAt)}
                  </span>
                )}
                {!device.lastSyncAt && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <AlertCircle className="w-3 h-3" />
                    Jamais synchronise
                  </span>
                )}
              </div>

              {device.deviceId && (
                <p className="text-xs text-slate-500 mt-1 truncate">ID: {device.deviceId}</p>
              )}
            </div>
          </div>

          {/* Right: Status indicator */}
          <div className="shrink-0">
            {device.isActive ? (
              <Wifi className="w-4 h-4 text-green-400 animate-pulse" />
            ) : (
              <Wifi className="w-4 h-4 text-slate-600" />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-cyan-500/10">
          <button
            onClick={() => {
              if (device.type === 'MANUAL_IMPORT' && onManualSync) {
                onManualSync(device.id);
              } else {
                onSync(device.id);
              }
            }}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cardio-800 text-slate-300 hover:bg-cardio-700/80 transition border border-cyan-500/10"
          >
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Historique
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Deconnecter
          </button>
        </div>

        {/* Sync history expand */}
        {showHistory && (
          <div className="mt-3 pt-3 border-t border-cyan-500/10">
            <h4 className="text-xs font-medium text-slate-400 mb-2">Historique de synchronisation</h4>
            {historyLoading ? (
              <div className="text-xs text-slate-500 py-2">Chargement...</div>
            ) : !history || history.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">Aucune synchronisation enregistree</div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {history.map((log: SyncLog) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-cardio-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span className="text-slate-300">{log.recordsCount} mesure(s)</span>
                    </div>
                    <span className="text-slate-500">{formatDate(log.syncedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Deconnecter l&apos;appareil</h3>
            <p className="text-sm text-slate-400 mb-6">
              Voulez-vous vraiment deconnecter <span className="text-slate-200 font-medium">{device.name}</span> ?
              Les donnees synchronisees seront conservees.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-cardio-700/50 transition text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onDelete(device.id);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium"
              >
                Deconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
