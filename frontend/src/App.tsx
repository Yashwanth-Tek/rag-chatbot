import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'

import { NavBar } from './components/NavBar'
import { summarizeDocuments } from './format'
import { useChat, useDocuments, useStatus, useUploads } from './hooks'
import { Chat } from './pages/Chat'
import { Dashboard } from './pages/Dashboard'
import { KnowledgeBase } from './pages/KnowledgeBase'

export default function App() {
  // State lives here so uploads, polling and the conversation survive page switches.
  const documents = useDocuments()
  const status = useStatus()
  const uploads = useUploads(documents.refresh)
  const chat = useChat()
  const location = useLocation()

  const config = status.status?.configuration
  const limits = config ? { maxMb: config.uploads.max_mb, extensions: config.uploads.extensions } : null
  const counts = documents.documents && summarizeDocuments(documents.documents, config?.embedding.model_id)

  const page = (content: ReactNode) => (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:py-10">{content}</div>
  )

  return (
    <div className="relative min-h-dvh">
      <Backdrop />
      <NavBar status={status.status} counts={counts} chatBusy={chat.pending} />
      <main className="lg:pl-[18.5rem]">
        {/* Keyed by path so every page change plays the entrance animation. */}
        <div key={location.pathname} className="animate-page-in">
          <Routes>
            <Route path="/" element={page(<Dashboard documents={documents} status={status} counts={counts} />)} />
            <Route
              path="/knowledge-base"
              element={page(
                <KnowledgeBase
                  documents={documents}
                  uploads={uploads}
                  limits={limits}
                  currentModelId={config?.embedding.model_id ?? null}
                />,
              )}
            />
            <Route
              path="/chat"
              element={<Chat chat={chat} documents={documents.documents ?? []} ready={(counts?.ready ?? 0) > 0} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

/** Drifting aurora light, a faint grid and film grain behind every page. Purely decorative. */
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <div className="backdrop-grid absolute inset-0" />
      <div className="backdrop-noise absolute inset-0" />
    </div>
  )
}
