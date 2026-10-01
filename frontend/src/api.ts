import type { ChatResult, DocumentInfo, Stage, SystemStatus } from './types'

/** An error whose message is safe to show (the backend never sends internals). */
export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const UNREACHABLE = new ApiError(
  'NETWORK',
  "Can't reach the server. Check that the backend is running and try again.",
)

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json()
    if (body?.error?.message) return new ApiError(body.error.code, body.error.message)
  } catch {
    // Not JSON (e.g. a proxy error page): fall through to the generic message.
  }
  return response.status >= 500
    ? UNREACHABLE
    : new ApiError(`HTTP_${response.status}`, 'The request could not be completed.')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw UNREACHABLE
  }
  if (!response.ok) throw await toApiError(response)
  return (response.status === 204 ? undefined : await response.json()) as T
}

export const api = {
  status: () => request<SystemStatus>('/api/status'),
  documents: () => request<DocumentInfo[]>('/api/documents'),
  deleteDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: 'DELETE' }),
}

/** Upload with byte-level progress (fetch cannot report upload progress, XHR can). */
export function uploadFile(file: File, onProgress: (fraction: number) => void) {
  return new Promise<DocumentInfo>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/documents')
    xhr.responseType = 'json'
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as DocumentInfo)
      const error = xhr.response?.error
      reject(error?.message ? new ApiError(error.code, error.message) : UNREACHABLE)
    }
    xhr.onerror = () => reject(UNREACHABLE)
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

/** Ask a question; `onStage` reports progress; resolves with the verified result. */
export async function askQuestion(
  question: string,
  onStage: (stage: Stage, attempt: number) => void,
): Promise<ChatResult> {
  let response: Response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
  } catch {
    throw UNREACHABLE
  }
  if (!response.ok || !response.body) throw await toApiError(response)

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value.replaceAll('\r\n', '\n')
    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const { event, data } = parseEvent(buffer.slice(0, boundary))
      buffer = buffer.slice(boundary + 2)
      if (event === 'stage') onStage(data.stage, data.attempt)
      else if (event === 'result') return data as ChatResult
      else if (event === 'error') throw new ApiError(data.code, data.message)
    }
  }
  throw new ApiError('INCOMPLETE', 'The answer was interrupted. Please try again.')
}

function parseEvent(block: string) {
  let event = 'message'
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  return { event, data: data ? JSON.parse(data) : {} }
}
