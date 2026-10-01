// Shapes of the backend API responses (see backend/app/api).

export type DocumentStatus =
  | 'uploaded'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'ready'
  | 'failed'

/** Location facts recorded by the parser, e.g. {page: 3}. Empty when the format has none. */
export type Location = Record<string, string | number>

export interface DocumentInfo {
  id: string
  filename: string
  document_type: string
  size_bytes: number
  status: DocumentStatus
  error_message: string | null
  chunk_count: number
  embedding_model: string | null
  metadata: Record<string, string | number>
  created_at: string
  updated_at: string
}

export interface ServiceHealth {
  ok: boolean
  detail: string | null
}

export interface SystemStatus {
  services: { database: ServiceHealth; embedding: ServiceHealth; llm: ServiceHealth }
  configuration: {
    embedding: { provider: string; model: string; model_id: string; dimension: number }
    llm: { provider: string; model: string; effort: string }
    retrieval: { top_k: number; min_similarity: number }
    chunking: { size_chars: number; overlap_chars: number }
    uploads: { max_mb: number; extensions: string[] }
  }
}

export type Stage = 'retrieving' | 'generating' | 'verifying'

export interface Segment {
  kind: 'supported' | 'not_in_kb'
  text: string
  sources: number[]
  paragraph_start: boolean
}

export interface Source {
  id: number
  document_id: string
  document_name: string
  location: Location
  excerpt: string
}

export interface ChatResult {
  status: 'answered' | 'partial' | 'not_found' | 'kb_empty'
  message: string | null
  segments: Segment[]
  sources: Source[]
}

export interface UserMessage {
  id: string
  role: 'user'
  text: string
}

export interface AssistantReply {
  id: string
  role: 'assistant'
  question: string
  state: 'pending' | 'done' | 'error'
  stage: Stage
  attempt: number
  result?: ChatResult
  error?: string
}

export type ChatMessage = UserMessage | AssistantReply

export interface UploadItem {
  id: string
  name: string
  size: number
  progress: number // 0..1 of the bytes sent
  state: 'uploading' | 'done' | 'error'
  error?: string
}
