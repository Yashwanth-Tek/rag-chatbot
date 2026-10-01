import { Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { formatBytes, formatDateTime, isProcessing } from '../format'
import type { DocumentInfo } from '../types'
import { Alert } from './Alert'
import { FileIcon } from './FileIcon'
import { StageStepper } from './StageStepper'
import { StatusBadge } from './StatusBadge'

const METADATA_LABELS: Record<string, string> = {
  pages: 'Pages',
  rows: 'Data rows',
  columns: 'Columns',
  records: 'Records',
  characters: 'Characters',
}

/** A side drawer built on the native <dialog> element. */
export function DocumentDetails({
  document,
  currentModelId,
  onClose,
  onDelete,
}: {
  document: DocumentInfo | null
  currentModelId: string | null
  onClose: () => void
  onDelete: (document: DocumentInfo) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (document && !element?.open) element?.showModal()
    if (!document && element?.open) element.close()
  }, [document])

  const needsReindex =
    document?.status === 'ready' && currentModelId !== null && document.embedding_model !== currentModelId

  return (
    <dialog
      ref={dialog}
      aria-labelledby="document-details-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => event.target === dialog.current && onClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-md open:animate-fade-up sm:inset-y-3 sm:right-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-3xl dark:bg-[#0c0e1a] dark:text-slate-100"
    >
      {document && (
        <div className="relative flex h-full flex-col overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-20 size-60 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />

          <div className="relative flex items-start gap-3 p-6">
            <FileIcon type={document.document_type} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{document.document_type} document</p>
              <h2 id="document-details-title" className="mt-1 text-lg font-semibold break-words">
                {document.filename}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="btn btn-ghost size-9 p-0" aria-label="Close details">
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="relative flex-1 space-y-6 overflow-y-auto px-6 pb-6">
            <section className="space-y-4 rounded-2xl bg-slate-900/[0.03] p-4 dark:bg-white/[0.04]">
              <StatusBadge status={document.status} />
              {isProcessing(document.status) && <StageStepper status={document.status} labels />}
              {document.status === 'ready' && <StageStepper status="ready" labels />}
              {document.status === 'failed' && <Alert tone="error">{document.error_message}</Alert>}
              {needsReindex && (
                <Alert tone="warning">
                  Embedded with a different model, so it isn't searchable. Delete it and upload it again to
                  re-index.
                </Alert>
              )}
            </section>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Size" value={formatBytes(document.size_bytes)} />
              <Detail label="Chunks" value={document.status === 'ready' ? String(document.chunk_count) : '—'} />
              {Object.entries(document.metadata).map(([key, value]) => (
                <Detail
                  key={key}
                  label={METADATA_LABELS[key] ?? key}
                  value={typeof value === 'number' ? value.toLocaleString() : value}
                />
              ))}
              <Detail label="Added" value={formatDateTime(document.created_at)} />
              <Detail label="Updated" value={formatDateTime(document.updated_at)} />
              {document.embedding_model && (
                <div className="col-span-2">
                  <Detail label="Embedding model" value={document.embedding_model} mono />
                </div>
              )}
            </dl>
          </div>

          <div className="relative border-t border-slate-900/5 p-6 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => onDelete(document)}
              className="btn w-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-300"
            >
              <Trash2 className="size-4" aria-hidden /> Delete document
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-900/5 p-3 dark:border-white/[0.06]">
      <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`mt-0.5 font-medium break-words ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
