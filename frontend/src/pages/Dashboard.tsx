import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  Binary,
  Bot,
  CircleCheck,
  Clock,
  Cpu,
  Database,
  FileSearch,
  Layers,
  Library,
  MessageSquareText,
  RefreshCw,
  Scissors,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Workflow,
} from 'lucide-react'
import { Link } from 'react-router'

import { Alert } from '../components/Alert'
import { EmptyState } from '../components/EmptyState'
import { FileIcon } from '../components/FileIcon'
import { Orb } from '../components/Orb'
import { StatusBadge } from '../components/StatusBadge'
import { followPointer, useCountUp } from '../effects'
import { type DocumentCounts, formatDateTime, formatRelative, isProcessing, plural } from '../format'
import type { useDocuments, useStatus } from '../hooks'
import type { DocumentInfo, DocumentStatus, SystemStatus } from '../types'

interface Props {
  documents: ReturnType<typeof useDocuments>
  status: ReturnType<typeof useStatus>
  counts: DocumentCounts | null
}

export function Dashboard({ documents, status, counts }: Props) {
  const refresh = () => {
    void status.refresh()
    void documents.refresh()
  }

  return (
    <div className="space-y-6">
      <Hero counts={counts} refreshing={status.loading} onRefresh={refresh} />

      {(status.error || documents.error) && <Alert tone="error">{status.error ?? documents.error}</Alert>}
      {counts && counts.needsReindex > 0 && (
        <Alert tone="warning">
          {plural(counts.needsReindex, 'document')} {counts.needsReindex === 1 ? 'was' : 'were'} embedded
          with a different model and {counts.needsReindex === 1 ? "isn't" : "aren't"} searchable.
          Delete and upload {counts.needsReindex === 1 ? 'it' : 'them'} again to re-index.
        </Alert>
      )}

      <section aria-label="Knowledge base summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} icon={Library} label="Documents" value={counts?.total} hint={`${counts?.ready ?? 0} searchable`} tone="from-indigo-500 to-violet-500" />
        <StatCard index={1} icon={Layers} label="Passages" value={counts?.chunks} hint="indexed chunks" tone="from-violet-500 to-fuchsia-500" />
        <StatCard index={2} icon={Workflow} label="Processing" value={counts?.processing} hint="in the pipeline" tone="from-cyan-500 to-sky-500" />
        <StatCard index={3} icon={TriangleAlert} label="Failed" value={counts?.failed} hint="need attention" tone="from-rose-500 to-orange-400" />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Pipeline documents={documents.documents} />
        <Health status={status.status} loading={status.loading && !status.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <RecentUploads documents={documents.documents} />
        <Configuration status={status.status} />
      </div>
    </div>
  )
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function Hero({ counts, refreshing, onRefresh }: { counts: DocumentCounts | null; refreshing: boolean; onRefresh: () => void }) {
  return (
    <section className="card ring-gradient relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-fuchsia-500/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-cyan-400/15 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="eyebrow">{greeting()} · Dashboard</p>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold sm:text-5xl">
            Your knowledge,
            <br />
            <span className="gradient-text">grounded.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
            {counts && counts.total > 0
              ? `${plural(counts.ready, 'document')} and ${plural(counts.chunks, 'passage')} ready to answer from. `
              : 'Upload documents to build your knowledge base. '}
            Every answer is checked against its sources before you see it.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/chat" className="btn btn-primary">
              <MessageSquareText className="size-4" aria-hidden /> Ask a question
            </Link>
            <Link to="/knowledge-base" className="btn btn-secondary">
              <Upload className="size-4" aria-hidden /> Upload documents
            </Link>
            <button type="button" onClick={onRefresh} className="btn btn-ghost" disabled={refreshing} aria-label="Refresh">
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          </div>
        </div>
        <HeroVisual />
      </div>
    </section>
  )
}

const ORBIT_CHIPS = [
  { label: 'PDF', className: 'top-2 left-6 from-rose-500 to-orange-400', delay: '0s' },
  { label: 'DOCX', className: 'top-10 -right-4 from-blue-500 to-indigo-500', delay: '1.2s' },
  { label: 'CSV', className: 'bottom-6 -left-6 from-emerald-500 to-teal-400', delay: '2.4s' },
  { label: 'JSON', className: '-bottom-2 right-8 from-amber-500 to-yellow-400', delay: '0.6s' },
  { label: 'MD', className: 'top-1/2 -left-10 from-violet-500 to-fuchsia-500', delay: '1.8s' },
]

function HeroVisual() {
  return (
    <div className="relative mx-auto hidden size-56 shrink-0 items-center justify-center md:flex lg:mr-6" aria-hidden>
      <span className="absolute inset-0 animate-[spin_40s_linear_infinite] rounded-full border border-dashed border-violet-400/40" />
      <span className="absolute inset-7 animate-[spin_28s_linear_infinite_reverse] rounded-full border border-cyan-400/25" />
      <span className="absolute inset-12 rounded-full bg-violet-500/20 blur-2xl" />
      <Orb size="lg" />
      {ORBIT_CHIPS.map((chip) => (
        <span
          key={chip.label}
          className={`absolute animate-float rounded-lg bg-linear-to-br px-2 py-1 font-mono text-[10px] font-semibold text-white shadow-lg ${chip.className}`}
          style={{ animationDelay: chip.delay }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  index,
}: {
  icon: LucideIcon
  label: string
  value: number | undefined
  hint: string
  tone: string
  index: number
}) {
  const shown = useCountUp(value)
  return (
    <div
      onPointerMove={followPointer}
      className="card ring-gradient spotlight group animate-fade-up overflow-hidden p-4 transition duration-300 hover:-translate-y-1 sm:p-5"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`flex size-10 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-lg transition duration-300 group-hover:scale-110 group-hover:rotate-3 ${tone}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="eyebrow text-slate-400 dark:text-slate-500">{label}</span>
      </div>
      {value === undefined ? (
        <div className="skeleton mt-5 h-9 w-20" />
      ) : (
        <p className="mt-4 font-display text-4xl font-semibold tabular-nums">{shown.toLocaleString()}</p>
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  )
}

const PIPELINE: { label: string; status: DocumentStatus; icon: LucideIcon }[] = [
  { label: 'Queued', status: 'uploaded', icon: Clock },
  { label: 'Extract', status: 'extracting', icon: FileSearch },
  { label: 'Chunk', status: 'chunking', icon: Scissors },
  { label: 'Embed', status: 'embedding', icon: Binary },
  { label: 'Index', status: 'indexing', icon: Database },
  { label: 'Ready', status: 'ready', icon: CircleCheck },
]

function Pipeline({ documents }: { documents: DocumentInfo[] | null }) {
  const count = (status: DocumentStatus) => documents?.filter((d) => d.status === status).length ?? 0
  const processing = documents?.filter((d) => isProcessing(d.status)).length ?? 0
  const failed = count('failed')

  return (
    <section aria-labelledby="pipeline-heading" className="card p-5 sm:p-6 lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Ingestion pipeline</p>
          <h2 id="pipeline-heading" className="mt-1 text-lg font-semibold">How documents become knowledge</h2>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            processing
              ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
              : 'bg-slate-900/5 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
          }`}
        >
          <span className={`size-1.5 rounded-full ${processing ? 'animate-pulse-dot bg-violet-500' : 'bg-slate-400'}`} aria-hidden />
          {processing ? `Processing ${processing}` : 'Idle'}
        </span>
      </div>

      <ol className="relative mt-8 grid grid-cols-3 gap-y-7 sm:grid-cols-6">
        <span className="absolute top-5 right-[8%] left-[8%] hidden h-0.5 rounded-full bg-slate-900/10 sm:block dark:bg-white/10" aria-hidden />
        {processing > 0 && (
          <span className="flow-line absolute top-5 right-[8%] left-[8%] hidden h-0.5 animate-flow rounded-full sm:block" aria-hidden />
        )}
        {PIPELINE.map(({ label, status, icon: Icon }) => {
          const n = count(status)
          const done = status === 'ready'
          return (
            <li key={status} className="relative flex flex-col items-center gap-2 text-center">
              <span
                className={`relative flex size-10 items-center justify-center rounded-full ring-4 ring-canvas transition duration-500 dark:ring-night ${
                  n === 0
                    ? 'border border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-500'
                    : done
                      ? 'bg-linear-to-br from-emerald-500 to-teal-400 text-white shadow-[0_8px_20px_-6px_rgb(16_185_129/0.7)]'
                      : 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_8px_20px_-6px_rgb(168_85_247/0.8)]'
                }`}
              >
                {n > 0 && !done && <span className="absolute inset-0 animate-ping-slow rounded-full bg-violet-500/40" aria-hidden />}
                <Icon className="relative size-4.5" aria-hidden />
              </span>
              <span className="text-xs font-medium">{label}</span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{n}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/5 pt-4 text-xs text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
        <span>Retrieval, answering and verification run per question in Chat.</span>
        {failed > 0 && (
          <Link to="/knowledge-base" className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 font-medium text-rose-600 dark:text-rose-300">
            <TriangleAlert className="size-3.5" aria-hidden /> {failed} failed · review <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  )
}

const SERVICES: {
  key: keyof SystemStatus['services']
  label: string
  icon: LucideIcon
  describe: (config: SystemStatus['configuration']) => string
}[] = [
  { key: 'database', label: 'Vector database', icon: Database, describe: () => 'PostgreSQL + pgvector' },
  { key: 'embedding', label: 'Embeddings', icon: Cpu, describe: (c) => `${c.embedding.provider} · ${c.embedding.model}` },
  { key: 'llm', label: 'Answer model', icon: Bot, describe: (c) => `${c.llm.provider} · ${c.llm.model}` },
]

const RING = 2 * Math.PI * 42

function Health({ status, loading }: { status: SystemStatus | null; loading: boolean }) {
  const online = status ? SERVICES.filter((s) => status.services[s.key].ok).length : 0
  return (
    <section aria-labelledby="health-heading" className="card p-5 sm:p-6 lg:col-span-2">
      <p className="eyebrow">System health</p>
      <h2 id="health-heading" className="mt-1 text-lg font-semibold">Services</h2>

      {loading || !status ? (
        <div className="mt-6 space-y-3" aria-hidden>
          <div className="skeleton mx-auto size-28 rounded-full" />
          {SERVICES.map((s) => (
            <div key={s.key} className="skeleton h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-5 size-28">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <defs>
                <linearGradient id="health-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={online === SERVICES.length ? '#10b981' : '#f59e0b'} />
                  <stop offset="100%" stopColor={online === SERVICES.length ? '#22d3ee' : '#f43f5e'} />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-slate-900/[0.07] dark:stroke-white/10" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                stroke="url(#health-gradient)"
                strokeDasharray={`${(online / SERVICES.length) * RING} ${RING}`}
                className="transition-[stroke-dasharray] duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-semibold">
                {online}/{SERVICES.length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">online</span>
            </div>
          </div>

          <ul className="mt-5 space-y-2">
            {SERVICES.map(({ key, label, icon: Icon, describe }) => {
              const health = status.services[key]
              return (
                <li key={key} className="rounded-xl bg-slate-900/[0.03] p-3 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <Icon className="size-4.5 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="font-mono text-[11px] break-words text-slate-500 dark:text-slate-400">
                        {describe(status.configuration)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        health.ok
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${health.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden />
                      {health.ok ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  {health.detail && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{health.detail}</p>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function RecentUploads({ documents }: { documents: DocumentInfo[] | null }) {
  return (
    <section aria-labelledby="recent-heading" className="card p-5 sm:p-6 lg:col-span-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Activity</p>
          <h2 id="recent-heading" className="mt-1 text-lg font-semibold">Recent uploads</h2>
        </div>
        <Link to="/knowledge-base" className="btn btn-ghost -mr-2 px-3 py-1.5 text-xs">
          View all <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {documents === null ? (
        <div className="mt-5 space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Nothing here yet"
          action={
            <Link to="/knowledge-base" className="btn btn-primary">
              <Upload className="size-4" aria-hidden /> Upload documents
            </Link>
          }
        >
          Upload documents and the assistant will answer questions using only their content.
        </EmptyState>
      ) : (
        <ul className="mt-4 space-y-1">
          {documents.slice(0, 5).map((document, index) => (
            <li
              key={document.id}
              className="flex animate-fade-up items-center gap-3 rounded-xl p-2 transition hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.03]"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <FileIcon type={document.document_type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{document.filename}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400" title={formatDateTime(document.created_at)}>
                  {formatRelative(document.created_at)}
                  {document.status === 'ready' && ` · ${plural(document.chunk_count, 'chunk')}`}
                </p>
              </div>
              <StatusBadge status={document.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Configuration({ status }: { status: SystemStatus | null }) {
  const config = status?.configuration
  const rows = config
    ? [
        ['Embedding model', config.embedding.model],
        ['Vector size', `${config.embedding.dimension} dimensions`],
        ['Answer model', config.llm.model],
        ['Effort', config.llm.effort],
        ['Passages / question', `up to ${config.retrieval.top_k}`],
        ['Min. similarity', config.retrieval.min_similarity.toFixed(2)],
        ['Chunk size', `${config.chunking.size_chars} chars · ${config.chunking.overlap_chars} overlap`],
        ['Upload limit', `${config.uploads.max_mb} MB`],
      ]
    : []

  return (
    <section aria-labelledby="config-heading" className="card p-5 sm:p-6 lg:col-span-2">
      <p className="eyebrow">Configuration</p>
      <h2 id="config-heading" className="mt-1 flex items-center gap-2 text-lg font-semibold">
        Grounding setup <ShieldCheck className="size-4.5 text-emerald-500" aria-hidden />
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">From the server's .env. Secrets are never shown.</p>
      {config ? (
        <dl className="mt-4 divide-y divide-slate-900/5 text-sm dark:divide-white/[0.06]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="rounded-md bg-slate-900/[0.04] px-2 py-0.5 text-right font-mono text-xs break-all dark:bg-white/[0.05]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-4 space-y-3" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-6" />
          ))}
        </div>
      )}
    </section>
  )
}
