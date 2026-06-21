import { Loader2 } from 'lucide-react'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin ${className}`} />
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-100">
      <Spinner className="h-10 w-10 text-brand-600" />
    </div>
  )
}
