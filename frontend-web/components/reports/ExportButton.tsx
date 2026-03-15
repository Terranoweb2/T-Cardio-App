'use client';
import { useState } from 'react';
import { FileDown, Loader2, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ExportButton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/complete-medical-file', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `dossier-medical-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDone(true);
      toast.success('Dossier medical telecharge');
      setTimeout(() => setDone(false), 3000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors du telechargement');
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'compact') {
    return (
      <button onClick={handleExport} disabled={loading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg glass-card hover:border-cyan-500/30 transition-all text-sm disabled:opacity-50">
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : done ? <CheckCircle className="w-4 h-4 text-green-400" /> : <FileDown className="w-4 h-4 text-cyan-400" />}
        <span className="text-slate-300">{loading ? 'Export...' : done ? 'Telecharge' : 'Exporter PDF'}</span>
      </button>
    );
  }

  return (
    <button onClick={handleExport} disabled={loading}
      className="glow-btn px-6 py-3 rounded-xl flex items-center gap-3 disabled:opacity-50">
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : done ? <CheckCircle className="w-5 h-5" /> : <FileDown className="w-5 h-5" />}
      <span>{loading ? 'Generation en cours...' : done ? 'Dossier telecharge !' : 'Exporter mon dossier medical'}</span>
    </button>
  );
}
