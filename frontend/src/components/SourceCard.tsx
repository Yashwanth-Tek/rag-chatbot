import { useState } from 'react'

import { locationLabel } from '../format'
import type { Source } from '../types'
import { FileIcon } from './FileIcon'

const LONG_EXCERPT = 180

export function SourceCard({ source, anchorId, active }: { source: Source; anchorId: string; active: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const location = locationLabel(source.location)
  const extension = source.document_name.split('.').pop()?.toLowerCase() ?? ''

  return (
    <li
      id={anchorId}
      className={`scroll-mt-24 rounded-2xl border p-3.5 transition duration-300 ${
        active
          ? 'border-violet-400/70 bg-violet-500/10 shadow-[0_0_0_4px_rgb(139_92_246/0.12)]'
          : 'border-slate-900/[0.06] bg-slate-900/[0.02] hover:border-violet-400/40 dark:border-white/[0.07] dark:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="relative">
          <FileIcon type={extension === 'markdown' ? 'md' : extension} small />
          <span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 font-mono text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#0c0e1a]">
            {source.id}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{source.document_name}</p>
          {location && (
            <span className="mt-1 inline-block rounded-md bg-slate-900/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
              {location}
            </span>
          )}
        </div>
      </div>
      {source.excerpt && (
        <>
          <blockquote
            className={`mt-3 border-l-2 border-violet-400/60 pl-3 text-[13px] leading-relaxed text-slate-600 italic dark:text-slate-300 ${expanded ? '' : 'line-clamp-3'}`}
          >
            “{source.excerpt}”
          </blockquote>
          {source.excerpt.length > LONG_EXCERPT && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="focus-ring mt-1.5 rounded text-xs font-medium text-violet-600 hover:underline dark:text-violet-300"
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : 'Show full quote'}
            </button>
          )}
        </>
      )}
    </li>
  )
}
