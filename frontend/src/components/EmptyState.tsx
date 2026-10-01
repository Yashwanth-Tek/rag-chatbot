import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex animate-fade-up flex-col items-center px-6 py-12 text-center">
      <div className="relative mb-5">
        <span className="absolute inset-0 rounded-2xl bg-violet-500/30 blur-xl" aria-hidden />
        <span className="relative flex size-16 animate-float items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-xl">
          <Icon className="size-7" aria-hidden />
        </span>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
