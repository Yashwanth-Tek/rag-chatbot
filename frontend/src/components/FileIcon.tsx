import { FileCode, FileJson, FileSpreadsheet, FileText, FileType } from 'lucide-react'

const STYLES: Record<string, { icon: typeof FileText; gradient: string }> = {
  pdf: { icon: FileText, gradient: 'from-rose-500 to-orange-400 shadow-rose-500/30' },
  docx: { icon: FileType, gradient: 'from-blue-500 to-indigo-500 shadow-blue-500/30' },
  csv: { icon: FileSpreadsheet, gradient: 'from-emerald-500 to-teal-400 shadow-emerald-500/30' },
  json: { icon: FileJson, gradient: 'from-amber-500 to-yellow-400 shadow-amber-500/30' },
  md: { icon: FileCode, gradient: 'from-violet-500 to-fuchsia-500 shadow-violet-500/30' },
}
const FALLBACK = { icon: FileText, gradient: 'from-slate-500 to-slate-400 shadow-slate-500/30' }

export function FileIcon({ type, small = false }: { type: string; small?: boolean }) {
  const { icon: Icon, gradient } = STYLES[type] ?? FALLBACK
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-linear-to-br text-white shadow-md ${gradient} ${
        small ? 'size-8 rounded-lg' : 'size-10 rounded-xl'
      }`}
    >
      <Icon className={small ? 'size-4' : 'size-5'} aria-hidden />
    </span>
  )
}
