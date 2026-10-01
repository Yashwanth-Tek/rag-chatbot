import { CloudUpload } from 'lucide-react'
import { useState } from 'react'

import { followPointer } from '../effects'

const TYPE_COLORS: Record<string, string> = {
  PDF: 'bg-rose-500',
  DOCX: 'bg-blue-500',
  TXT: 'bg-slate-400',
  MD: 'bg-violet-500',
  CSV: 'bg-emerald-500',
  JSON: 'bg-amber-500',
}

/** Drag-and-drop area that is also a keyboard-accessible file picker. */
export function Dropzone({
  onFiles,
  extensions,
  maxMb,
}: {
  onFiles: (files: File[]) => void
  extensions: string[]
  maxMb: number | null
}) {
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const types = extensions.filter((e) => e !== '.markdown').map((e) => e.slice(1).toUpperCase())

  return (
    <label
      onPointerMove={followPointer}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        onFiles([...event.dataTransfer.files])
      }}
      className={`card ring-gradient spotlight group flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-12 text-center transition duration-300 sm:py-14 ${
        dragging || focused ? 'ring-spin scale-[1.01] shadow-[0_24px_60px_-24px_rgb(139_92_246/0.7)]' : 'hover:-translate-y-0.5'
      }`}
    >
      <input
        type="file"
        multiple
        accept={extensions.join(',')}
        className="sr-only"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])])
          event.target.value = '' // allow choosing the same file again
        }}
      />
      <span className="relative">
        <span
          className={`absolute inset-0 rounded-2xl bg-fuchsia-500/40 blur-xl transition-opacity duration-300 ${dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`}
          aria-hidden
        />
        <span
          className={`relative flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-xl transition duration-300 ${
            dragging ? '-translate-y-2 scale-110 rotate-3' : 'group-hover:-translate-y-1'
          }`}
        >
          <CloudUpload className="size-8" aria-hidden />
        </span>
      </span>

      <span className="mt-5 font-display text-lg font-semibold sm:text-xl">
        {dragging ? 'Release to upload' : 'Drop files to grow your knowledge base'}
      </span>
      <span className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        or <span className="font-medium text-violet-600 underline-offset-4 group-hover:underline dark:text-violet-300">browse your computer</span>
      </span>

      {types.length > 0 && (
        <span className="mt-6 flex flex-wrap justify-center gap-2">
          {types.map((type, index) => (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/[0.05] px-2.5 py-1 font-mono text-[11px] font-medium text-slate-600 transition duration-300 group-hover:-translate-y-0.5 dark:bg-white/[0.06] dark:text-slate-300"
              style={{ transitionDelay: `${index * 30}ms` }}
            >
              <span className={`size-1.5 rounded-full ${TYPE_COLORS[type] ?? 'bg-slate-400'}`} aria-hidden />
              {type}
            </span>
          ))}
        </span>
      )}
      {maxMb && <span className="mt-3 text-xs text-slate-400">Up to {maxMb} MB per file</span>}
    </label>
  )
}
