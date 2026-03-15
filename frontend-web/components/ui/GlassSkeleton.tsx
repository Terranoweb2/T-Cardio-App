export function GlassSkeleton({ className = '', lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="glass-skeleton h-4 rounded" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function GlassCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`glass-card rounded-xl p-6 ${className}`}>
      <div className="glass-skeleton h-5 w-1/3 rounded mb-4" />
      <div className="space-y-3">
        <div className="glass-skeleton h-4 w-full rounded" />
        <div className="glass-skeleton h-4 w-3/4 rounded" />
        <div className="glass-skeleton h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}
