import { ChevronRight, Trash2 } from 'lucide-react'

import { formatBytes, formatDateTime, formatRelative, isProcessing, plural } from '../format'
import type { DocumentInfo } from '../types'
import { FileIcon } from './FileIcon'
import { StageStepper } from './StageStepper'
import { StatusBadge } from './StatusBadge'

interface Props {
  documents: DocumentInfo[]
  onOpen: (document: DocumentInfo) => void
  onDelete: (document: DocumentInfo) => void
}

/** A table on wider screens, stacked cards on phones. */
export function DocumentList({ documents, onOpen, onDelete }: Props) {
  return (
    <>
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="eyebrow border-b border-slate-900/5 text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
            <tr>
              <th scope="col" className="w-full px-5 py-3.5 font-medium">Document</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-3.5 text-right font-medium">Chunks</th>
              <th scope="col" className="px-4 py-3.5 text-right font-medium">Size</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Added</th>
              <th scope="col" className="px-4 py-3.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/5 dark:divide-white/[0.05]">
            {documents.map((document, index) => (
              <tr
                key={document.id}
                className="group animate-fade-up transition-colors hover:bg-linear-to-r hover:from-violet-500/[0.07] hover:to-transparent"
                style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
              >
                <td className="max-w-0 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => onOpen(document)}
                    className="focus-ring flex w-full items-center gap-3 rounded-lg text-left"
                  >
                    <FileIcon type={document.document_type} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium transition group-hover:text-violet-600 dark:group-hover:text-violet-300">
                        {document.filename}
                      </span>
                      {document.status === 'failed' ? (
                        <span className="block truncate text-xs text-rose-600 dark:text-rose-400">{document.error_message}</span>
                      ) : (
                        <span className="block font-mono text-[11px] text-slate-400 uppercase">{document.document_type}</span>
                      )}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col items-start gap-2">
                    <StatusBadge status={document.status} />
                    {isProcessing(document.status) && <StageStepper status={document.status} />}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                  {document.status === 'ready' ? document.chunk_count : '—'}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                  {formatBytes(document.size_bytes)}
                </td>
                <td className="px-4 py-3.5 text-xs whitespace-nowrap text-slate-500 dark:text-slate-400" title={formatDateTime(document.created_at)}>
                  {formatRelative(document.created_at)}
                </td>
                <td className="px-3 py-3.5 text-right">
                  <DeleteButton document={document} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {documents.map((document) => (
          <li key={document.id} className="card animate-fade-up p-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onOpen(document)}
                className="focus-ring flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left"
              >
                <FileIcon type={document.document_type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{document.filename}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(document.size_bytes)} · {formatRelative(document.created_at)}
                    {document.status === 'ready' && ` · ${plural(document.chunk_count, 'chunk')}`}
                  </span>
                </span>
                <ChevronRight className="mt-2 size-4 shrink-0 text-slate-400" aria-hidden />
              </button>
              <DeleteButton document={document} onDelete={onDelete} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={document.status} />
              {isProcessing(document.status) && <StageStepper status={document.status} />}
            </div>
            {document.status === 'failed' && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{document.error_message}</p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function DeleteButton({ document, onDelete }: { document: DocumentInfo; onDelete: Props['onDelete'] }) {
  return (
    <button
      type="button"
      onClick={() => onDelete(document)}
      className="btn btn-ghost size-9 shrink-0 p-0 opacity-70 transition hover:bg-rose-500/10 hover:text-rose-600 hover:opacity-100 dark:hover:text-rose-400"
      aria-label={`Delete ${document.filename}`}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  )
}
