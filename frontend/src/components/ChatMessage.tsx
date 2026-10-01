import {
  Check,
  CircleAlert,
  Copy,
  Library,
  RotateCcw,
  Search,
  SearchX,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { locationLabel } from '../format'
import type { AssistantReply, ChatResult, Segment, Stage } from '../types'
import { Orb } from './Orb'
import { SourceCard } from './SourceCard'

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex animate-fade-up justify-end">
      <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-3 text-[15px] whitespace-pre-wrap text-white shadow-[0_12px_30px_-12px_rgb(139_92_246/0.8)]">
        {text}
      </p>
    </div>
  )
}

export function AssistantMessage({ reply, onRetry }: { reply: AssistantReply; onRetry: () => void }) {
  return (
    <div className="flex animate-fade-up gap-3 sm:gap-4">
      <div className="pt-1">
        <Orb size="sm" busy={reply.state === 'pending'} />
      </div>
      <div className="min-w-0 flex-1">
        {reply.state === 'pending' && <StageProgress stage={reply.stage} attempt={reply.attempt} />}
        {reply.state === 'error' && (
          <div className="card flex items-start gap-3 border-rose-500/30 p-4">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{reply.error}</p>
              <button type="button" onClick={onRetry} className="btn btn-secondary mt-3">
                <RotateCcw className="size-4" aria-hidden /> Try again
              </button>
            </div>
          </div>
        )}
        {reply.state === 'done' && reply.result && <Result result={reply.result} replyId={reply.id} />}
      </div>
    </div>
  )
}

const STAGES: { key: Stage; label: string; detail: string; icon: typeof Search }[] = [
  { key: 'retrieving', label: 'Retrieve', detail: 'Searching your knowledge base', icon: Search },
  { key: 'generating', label: 'Answer', detail: 'Writing an answer from the sources', icon: Sparkles },
  { key: 'verifying', label: 'Verify', detail: 'Checking every claim against its source', icon: ShieldCheck },
]

function StageProgress({ stage, attempt }: { stage: Stage; attempt: number }) {
  const current = STAGES.findIndex((s) => s.key === stage)
  return (
    <div className="card ring-gradient ring-spin p-4 sm:p-5" aria-label="Working on your answer">
      <div className="relative">
        <div className="absolute top-4 right-[16%] left-[16%] h-0.5 rounded-full bg-slate-900/10 dark:bg-white/10" aria-hidden />
        <div
          className="absolute top-4 left-[16%] h-0.5 rounded-full bg-linear-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 transition-[width] duration-700 ease-out"
          style={{ width: `${(current / (STAGES.length - 1)) * 68}%` }}
          aria-hidden
        />
        <ol className="relative grid grid-cols-3">
          {STAGES.map(({ key, label, icon: Icon }, index) => {
            const done = index < current
            const active = index === current
            return (
              <li key={key} className="flex flex-col items-center gap-2">
                <span
                  className={`relative flex size-8 items-center justify-center rounded-full transition duration-500 ${
                    done
                      ? 'bg-linear-to-br from-emerald-500 to-teal-400 text-white'
                      : active
                        ? 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_6px_18px_-4px_rgb(168_85_247/0.9)]'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {active && <span className="absolute inset-0 animate-ping-slow rounded-full bg-violet-500/50" aria-hidden />}
                  {done ? <ShieldCheck className="relative size-4" aria-hidden /> : <Icon className="relative size-4" aria-hidden />}
                </span>
                <span className={`text-xs font-medium ${active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  {label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">{STAGES[current]?.detail}…</p>
      {attempt > 1 && (
        <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          The first draft contained a statement its sources didn't support, so it was discarded. Writing a stricter
          answer.
        </p>
      )}
      <div className="mt-4 space-y-2" aria-hidden>
        <div className="skeleton h-3 w-11/12" />
        <div className="skeleton h-3 w-4/5" />
        <div className="skeleton h-3 w-3/5" />
      </div>
    </div>
  )
}

function Result({ result, replyId }: { result: ChatResult; replyId: string }) {
  const [activeSource, setActiveSource] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  if (result.status === 'kb_empty') {
    return (
      <div className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg">
          <Library className="size-5" aria-hidden />
        </span>
        <p className="flex-1 text-sm">{result.message}</p>
        <Link to="/knowledge-base" className="btn btn-primary">
          Upload documents
        </Link>
      </div>
    )
  }
  if (result.status === 'not_found') {
    return (
      <div className="card flex items-start gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
          <SearchX className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-[15px] font-medium">{result.message}</p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Answers only use your uploaded documents. Try rephrasing, or upload a document that covers this topic.
          </p>
        </div>
      </div>
    )
  }

  const supported = result.segments.filter((s) => s.kind === 'supported')
  const missing = result.segments.filter((s) => s.kind === 'not_in_kb')
  const showSource = (id: number) => {
    setActiveSource(id)
    document.getElementById(`source-${replyId}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  const copy = async () => {
    const text = [
      supported.map((s) => s.text).join(' '),
      missing.length ? `\nNot in the knowledge base:\n${missing.map((s) => stripBullet(s.text)).join('\n')}` : '',
      `\nSources:\n${result.sources
        .map((s) => `[${s.id}] ${s.document_name}${locationLabel(s.location) ? ` (${locationLabel(s.location)})` : ''}`)
        .join('\n')}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be refused; copying is a convenience only.
    }
  }

  return (
    <div className="card ring-gradient space-y-5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        {result.status === 'answered' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20 ring-inset dark:text-emerald-300">
            <ShieldCheck className="size-3.5" aria-hidden /> Verified against your documents
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-500/20 ring-inset dark:text-amber-200">
            <TriangleAlert className="size-3.5" aria-hidden /> Partly answered by your documents
          </span>
        )}
        <button type="button" onClick={() => void copy()} className="btn btn-ghost size-8 p-0" aria-label={copied ? 'Copied' : 'Copy answer'}>
          {copied ? <Check className="size-4 text-emerald-500" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </button>
      </div>

      <AnswerText segments={supported} onSource={showSource} />

      {missing.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
          <p className="eyebrow text-amber-700 dark:text-amber-300">Not in your knowledge base</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-100">
            {missing.map((segment, index) => (
              <li key={index}>{stripBullet(segment.text)}</li>
            ))}
          </ul>
        </div>
      )}

      {result.sources.length > 0 && (
        <section aria-label="Sources">
          <p className="eyebrow mb-3 text-slate-500 dark:text-slate-400">Sources · {result.sources.length}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {result.sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                anchorId={`source-${replyId}-${source.id}`}
                active={activeSource === source.id}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const BULLET = /^[-•*]\s+/
const stripBullet = (text: string) => text.replace(BULLET, '')

type Block = { kind: 'p'; parts: Segment[] } | { kind: 'ul'; items: Segment[][] }

/** Rebuild paragraphs and bullet lists from the verified sentences, in their original order. */
function toBlocks(segments: Segment[]): Block[] {
  const blocks: Block[] = []
  for (const segment of segments) {
    const last = blocks.at(-1)
    if (BULLET.test(segment.text)) {
      const item = [{ ...segment, text: stripBullet(segment.text) }]
      if (last?.kind === 'ul') last.items.push(item)
      else blocks.push({ kind: 'ul', items: [item] })
    } else if (!segment.paragraph_start && last?.kind === 'ul') {
      last.items.at(-1)?.push(segment)
    } else if (!segment.paragraph_start && last?.kind === 'p') {
      last.parts.push(segment)
    } else {
      blocks.push({ kind: 'p', parts: [segment] })
    }
  }
  return blocks
}

function AnswerText({ segments, onSource }: { segments: Segment[]; onSource: (id: number) => void }) {
  const renderParts = (parts: Segment[]) =>
    parts.map((part, index) => (
      <span key={index}>
        {index > 0 && ' '}
        {part.text}
        {part.sources.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onSource(id)}
            className="focus-ring ml-1 inline-flex h-4.5 min-w-4.5 -translate-y-1.5 items-center justify-center rounded-full bg-violet-500/15 px-1 align-baseline font-mono text-[10px] font-semibold text-violet-700 transition hover:scale-110 hover:bg-violet-500 hover:text-white dark:text-violet-200"
            aria-label={`Show source ${id}`}
          >
            {id}
          </button>
        ))}
      </span>
    ))

  return (
    <div className="space-y-3 text-[15px] leading-7 text-slate-800 dark:text-slate-100">
      {toBlocks(segments).map((block, index) =>
        block.kind === 'p' ? (
          <p key={index} className="animate-fade-up" style={{ animationDelay: `${index * 70}ms` }}>
            {renderParts(block.parts)}
          </p>
        ) : (
          <ul
            key={index}
            className="animate-fade-up list-disc space-y-1.5 pl-5 marker:text-violet-400"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderParts(item)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}
