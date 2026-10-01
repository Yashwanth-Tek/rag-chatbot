import { Library, RefreshCw, Search, SearchX } from 'lucide-react'
import { useState } from 'react'

import { errorMessage } from '../api'
import { Alert } from '../components/Alert'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DocumentDetails } from '../components/DocumentDetails'
import { DocumentList } from '../components/DocumentList'
import { Dropzone } from '../components/Dropzone'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { UploadList } from '../components/UploadList'
import { isProcessing } from '../format'
import type { UploadLimits, useDocuments, useUploads } from '../hooks'
import type { DocumentInfo } from '../types'

interface Props {
  documents: ReturnType<typeof useDocuments>
  uploads: ReturnType<typeof useUploads>
  limits: UploadLimits | null
  currentModelId: string | null
}

const FILTERS = {
  all: { label: 'All', match: () => true },
  ready: { label: 'Ready', match: (d: DocumentInfo) => d.status === 'ready' },
  processing: { label: 'Processing', match: (d: DocumentInfo) => isProcessing(d.status) },
  failed: { label: 'Failed', match: (d: DocumentInfo) => d.status === 'failed' },
}
type Filter = keyof typeof FILTERS

export function KnowledgeBase({ documents, uploads, limits, currentModelId }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocumentInfo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const list = documents.documents
  const opened = list?.find((d) => d.id === openId) ?? null
  const visible = list?.filter(
    (d) => FILTERS[filter].match(d) && d.filename.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await documents.remove(pendingDelete.id)
      if (openId === pendingDelete.id) setOpenId(null)
      setDeleteError(null)
    } catch (e) {
      setDeleteError(errorMessage(e))
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge base"
        title="Your documents"
        description="Each upload is extracted, chunked, embedded and indexed so the assistant can cite it."
        actions={
          <button type="button" onClick={() => void documents.refresh()} className="btn btn-secondary">
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </button>
        }
      />

      <Dropzone
        onFiles={(files) => uploads.start(files, limits)}
        extensions={limits?.extensions ?? []}
        maxMb={limits?.maxMb ?? null}
      />
      <UploadList items={uploads.items} onDismiss={uploads.dismiss} />

      {documents.error && <Alert tone="error">{documents.error}</Alert>}
      {deleteError && <Alert tone="error">{deleteError}</Alert>}

      <section aria-labelledby="documents-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="documents-heading" className="flex items-center gap-2 text-xl font-semibold">
            Library
            {list && (
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-mono text-xs font-medium text-violet-700 dark:text-violet-300">
                {list.length}
              </span>
            )}
          </h2>

          {list && list.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div role="group" aria-label="Filter by status" className="glass flex rounded-xl p-1">
                {(Object.keys(FILTERS) as Filter[]).map((key) => {
                  const count = list.filter(FILTERS[key].match).length
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                      className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        filter === key
                          ? 'bg-linear-to-r from-indigo-500 to-fuchsia-500 text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {FILTERS[key].label}
                      <span className="ml-1.5 font-mono opacity-70">{count}</span>
                    </button>
                  )
                })}
              </div>
              <label className="glass flex flex-1 items-center gap-2 rounded-xl px-3 py-2 transition focus-within:ring-2 focus-within:ring-violet-500/50 sm:w-56 sm:flex-none">
                <Search className="size-4 text-slate-400" aria-hidden />
                <span className="sr-only">Search documents</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </label>
            </div>
          )}
        </div>

        {list === null ? (
          <div className="card space-y-4 p-5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-2/5" />
                  <div className="skeleton h-3 w-1/5" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="card">
            <EmptyState icon={Library} title="No documents yet">
              Upload PDF, Word, text, Markdown, CSV or JSON files. Answers will only ever come from them.
            </EmptyState>
          </div>
        ) : visible && visible.length > 0 ? (
          <DocumentList documents={visible} onOpen={(d) => setOpenId(d.id)} onDelete={setPendingDelete} />
        ) : (
          <div className="card">
            <EmptyState icon={SearchX} title="No matching documents">
              Try another name or status filter.
            </EmptyState>
          </div>
        )}
      </section>

      <DocumentDetails
        document={opened}
        currentModelId={currentModelId}
        onClose={() => setOpenId(null)}
        onDelete={setPendingDelete}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this document?"
        message={`“${pendingDelete?.filename ?? ''}” and all of its indexed chunks will be removed from the knowledge base. This can't be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
