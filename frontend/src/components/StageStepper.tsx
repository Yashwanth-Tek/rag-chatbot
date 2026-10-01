import { Check } from 'lucide-react'

import { PROCESSING_STAGES } from '../format'
import type { DocumentStatus } from '../types'

const STEPS = [...PROCESSING_STAGES, 'ready'] as const
const LABELS: Record<(typeof STEPS)[number], string> = {
  extracting: 'Extract',
  chunking: 'Chunk',
  embedding: 'Embed',
  indexing: 'Index',
  ready: 'Ready',
}

/** Extract → Chunk → Embed → Index → Ready, for a queued, processing or ready document. */
export function StageStepper({ status, labels = false }: { status: Exclude<DocumentStatus, 'failed'>; labels?: boolean }) {
  const currentIndex = status === 'uploaded' ? -1 : STEPS.indexOf(status)

  return (
    <ol className="flex items-start" aria-label="Processing progress">
      {STEPS.map((step, index) => {
        const done = index < currentIndex || status === 'ready'
        const active = index === currentIndex && status !== 'ready'
        return (
          <li key={step} className="flex items-start">
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={`relative flex size-6 items-center justify-center rounded-full text-[10px] font-semibold transition duration-500 ${
                  done
                    ? 'bg-linear-to-br from-emerald-500 to-teal-400 text-white shadow-[0_4px_12px_-4px_rgb(16_185_129/0.8)]'
                    : active
                      ? 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_4px_14px_-2px_rgb(168_85_247/0.9)]'
                      : 'bg-slate-900/[0.06] text-slate-500 dark:bg-white/[0.08] dark:text-slate-400'
                }`}
                title={LABELS[step]}
              >
                {active && <span className="absolute inset-0 animate-ping-slow rounded-full bg-violet-500/50" aria-hidden />}
                {done ? (
                  <Check className="size-3.5" aria-hidden />
                ) : active ? (
                  <span className="relative size-1.5 rounded-full bg-white" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              {labels && (
                <span className={`text-[10px] font-medium ${active ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {LABELS[step]}
                </span>
              )}
            </span>
            <span className="sr-only">
              {LABELS[step]}: {done ? 'done' : active ? 'in progress' : 'pending'}
            </span>
            {index < STEPS.length - 1 && (
              <span
                className={`mx-0.5 mt-[11px] h-0.5 w-4 rounded-full transition-colors duration-500 sm:w-6 ${
                  done ? 'bg-linear-to-r from-emerald-400 to-teal-300' : 'bg-slate-900/10 dark:bg-white/10'
                }`}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
