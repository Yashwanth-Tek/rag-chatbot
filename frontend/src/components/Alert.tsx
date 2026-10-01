import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

const TONES = {
  error: {
    icon: CircleAlert,
    className: 'border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-200',
    iconClass: 'text-rose-500',
  },
  warning: {
    icon: TriangleAlert,
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200',
    iconClass: 'text-amber-500',
  },
  info: {
    icon: Info,
    className: 'border-violet-500/25 bg-violet-500/10 text-violet-900 dark:text-violet-200',
    iconClass: 'text-violet-500',
  },
}

export function Alert({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  const { icon: Icon, className, iconClass } = TONES[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex animate-fade-up items-start gap-3 rounded-2xl border px-4 py-3 text-sm backdrop-blur-xl ${className}`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} aria-hidden />
      <div>{children}</div>
    </div>
  )
}
