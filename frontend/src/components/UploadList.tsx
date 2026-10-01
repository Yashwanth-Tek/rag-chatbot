import { CircleCheck, CircleX, X } from 'lucide-react'

import { fileExtension, formatBytes } from '../format'
import type { UploadItem } from '../types'
import { FileIcon } from './FileIcon'

export function UploadList({ items, onDismiss }: { items: UploadItem[]; onDismiss: (id: string) => void }) {
  if (!items.length) return null
  return (
    <ul className="space-y-2" aria-label="Uploads">
      {items.map((item) => (
        <li key={item.id} className="card flex animate-fade-up items-center gap-3 px-4 py-3">
          <FileIcon type={fileExtension(item.name).slice(1).replace('markdown', 'md')} small />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {item.state === 'uploading' ? `${Math.round(item.progress * 100)}%` : formatBytes(item.size)}
              </span>
            </div>
            {item.state === 'uploading' && (
              <div
                role="progressbar"
                aria-label={`Uploading ${item.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(item.progress * 100)}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10"
              >
                <div
                  className="relative h-full overflow-hidden rounded-full bg-linear-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 transition-[width] duration-200"
                  style={{ width: `${Math.max(4, item.progress * 100)}%` }}
                >
                  <span className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/50 to-transparent bg-size-[200%_100%]" />
                </div>
              </div>
            )}
            {item.state === 'done' && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CircleCheck className="size-3.5" aria-hidden /> Uploaded. Processing has started.
              </p>
            )}
            {item.state === 'error' && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <CircleX className="size-3.5 shrink-0" aria-hidden /> {item.error}
              </p>
            )}
          </div>
          {item.state !== 'uploading' && (
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="btn btn-ghost size-8 p-0"
              aria-label={`Dismiss ${item.name}`}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
