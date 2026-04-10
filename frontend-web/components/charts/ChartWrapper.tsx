'use client';

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  height?: string;
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  children: React.ReactNode;
}

export default function ChartWrapper({
  title,
  subtitle,
  height = 'h-56 sm:h-64 lg:h-72',
  loading = false,
  error = false,
  empty = false,
  children,
}: ChartWrapperProps) {
  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {loading ? (
        <div className={`${height} flex items-center justify-center`}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Chargement...</p>
          </div>
        </div>
      ) : error ? (
        <div className={`${height} flex items-center justify-center`}>
          <p className="text-sm text-red-400">Erreur de chargement des donnees</p>
        </div>
      ) : empty ? (
        <div className={`${height} flex items-center justify-center`}>
          <p className="text-sm text-slate-500">Pas assez de donnees pour afficher le graphique</p>
        </div>
      ) : (
        <div className={height}>{children}</div>
      )}
    </div>
  );
}
