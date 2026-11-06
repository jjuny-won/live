export function Spinner({ className = '', label }: { className?: string; label?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-zinc-400 ${className}`}>
      <span className="size-6 animate-spin rounded-full border-2 border-zinc-600 border-t-brand-500" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
