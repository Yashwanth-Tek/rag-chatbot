import { CircleCheck, CircleX, Clock } from 'lucide-react'

import type { DocumentStatus } from '../types'

const LABELS: Record<DocumentStatus, string> = {
  uploaded: 'Queued',
  extracting: 'Extracting',
  chunking: 'Chunking',
  embedding: 'Embedding',
  indexing: 'Indexing',
  ready: 'Ready',
  failed: 'Failed',
}

const BASE = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap'

export function StatusBadge({ status }: { status: DocumentStatus }) {
  if (status === 'ready') {
    return (
      <span className={`${BASE} bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300`}>
        <CircleCheck className="size-3.5" aria-hidden /> Ready
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className={`${BASE} bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300`}>
        <CircleX className="size-3.5" aria-hidden /> Failed
      </span>
    )
  }
  if (status === 'uploaded') {
    return (
      <span className={`${BASE} bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300`}>
        <Clock className="size-3.5" aria-hidden /> Queued
      </span>
    )
  }
  return (
    <span className={`${BASE} bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300`}>
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inset-0 animate-ping-slow rounded-full bg-violet-500/60" />
        <span className="relative size-2 rounded-full bg-violet-500" />
      </span>
      {LABELS[status]}…
    </span>
  )
}
