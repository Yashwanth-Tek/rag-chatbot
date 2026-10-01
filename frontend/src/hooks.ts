import { useCallback, useEffect, useRef, useState } from 'react'

import { api, askQuestion, errorMessage, uploadFile } from './api'
import { fileExtension, isProcessing } from './format'
import type { AssistantReply, ChatMessage, DocumentInfo, SystemStatus, UploadItem } from './types'

let lastId = 0
const nextId = () => String(++lastId)

const POLL_MS = 1500

/** The document list; polls while any document is still processing. */
export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    () =>
      api.documents().then(
        (list) => {
          setDocuments(list)
          setError(null)
        },
        (e: unknown) => setError(errorMessage(e)),
      ),
    [],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const processing = documents?.some((d) => isProcessing(d.status)) ?? false
  useEffect(() => {
    if (!processing) return
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [processing, refresh])

  const remove = useCallback(async (id: string) => {
    await api.deleteDocument(id)
    setDocuments((current) => current?.filter((d) => d.id !== id) ?? null)
  }, [])

  return { documents, error, refresh, remove }
}

/** Live service checks and non-secret configuration. */
export function useStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    () =>
      api
        .status()
        .then(
          (result) => {
            setStatus(result)
            setError(null)
          },
          (e: unknown) => setError(errorMessage(e)),
        )
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(() => {
    setLoading(true)
    return load()
  }, [load])

  return { status, error, loading, refresh }
}

export interface UploadLimits {
  maxMb: number
  extensions: string[]
}

/** The upload queue. Files are checked here first; the server validates them again. */
export function useUploads(onUploaded: () => void) {
  const [items, setItems] = useState<UploadItem[]>([])

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const start = useCallback(
    (files: File[], limits: UploadLimits | null) => {
      for (const file of files) {
        const id = nextId()
        const problem = limits && checkFile(file, limits) // null limits: the server checks
        const item: UploadItem = {
          id,
          name: file.name,
          size: file.size,
          progress: 0,
          state: problem ? 'error' : 'uploading',
          error: problem ?? undefined,
        }
        setItems((current) => [item, ...current])
        if (problem) continue
        uploadFile(file, (progress) => update(id, { progress }))
          .then(() => {
            update(id, { state: 'done', progress: 1 })
            onUploaded()
            setTimeout(() => dismiss(id), 4000)
          })
          .catch((e: unknown) => update(id, { state: 'error', error: errorMessage(e) }))
      }
    },
    [onUploaded, update, dismiss],
  )

  return { items, start, dismiss }
}

function checkFile(file: File, { maxMb, extensions }: UploadLimits): string | null {
  if (!extensions.includes(fileExtension(file.name))) {
    return `Unsupported file type. Use ${extensions.filter((e) => e !== '.markdown').join(', ')}.`
  }
  if (file.size === 0) return 'The file is empty.'
  if (file.size > maxMb * 1024 * 1024) return `The file is larger than the ${maxMb} MB limit.`
  return null
}

/** Chat history for this browser session only; nothing is stored on the server. */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const busy = useRef(false)

  const run = useCallback(async (replyId: string, question: string) => {
    const patch = (changes: Partial<AssistantReply>) =>
      setMessages((current) =>
        current.map((m) => (m.id === replyId && m.role === 'assistant' ? { ...m, ...changes } : m)),
      )
    busy.current = true
    try {
      const result = await askQuestion(question, (stage, attempt) => patch({ stage, attempt }))
      patch({ state: 'done', result })
    } catch (e) {
      patch({ state: 'error', error: errorMessage(e) })
    } finally {
      busy.current = false
    }
  }, [])

  const ask = useCallback(
    (question: string) => {
      if (busy.current) return
      const replyId = nextId()
      setMessages((current) => [
        ...current,
        { id: nextId(), role: 'user', text: question },
        { id: replyId, role: 'assistant', question, state: 'pending', stage: 'retrieving', attempt: 1 },
      ])
      void run(replyId, question)
    },
    [run],
  )

  const retry = useCallback(
    (reply: AssistantReply) => {
      if (busy.current) return
      setMessages((current) =>
        current.map((m) =>
          m.id === reply.id
            ? { ...reply, state: 'pending', stage: 'retrieving', attempt: 1, error: undefined }
            : m,
        ),
      )
      void run(reply.id, reply.question)
    },
    [run],
  )

  const clear = useCallback(() => {
    if (!busy.current) setMessages([])
  }, [])

  const pending = messages.some((m) => m.role === 'assistant' && m.state === 'pending')
  return { messages, pending, ask, retry, clear }
}
