import type { DocumentInfo, DocumentStatus, Location } from './types'

export const PROCESSING_STAGES = [
  'extracting',
  'chunking',
  'embedding',
  'indexing',
] as const satisfies readonly DocumentStatus[]

export function isProcessing(
  status: DocumentStatus,
): status is Exclude<DocumentStatus, 'ready' | 'failed'> {
  return status === 'uploaded' || (PROCESSING_STAGES as readonly DocumentStatus[]).includes(status)
}

export interface DocumentCounts {
  total: number
  ready: number // searchable: ready and embedded by the current model
  chunks: number
  processing: number
  failed: number
  needsReindex: number
}

export function summarizeDocuments(documents: DocumentInfo[], modelId?: string): DocumentCounts {
  const current = (d: DocumentInfo) => modelId === undefined || d.embedding_model === modelId
  const searchable = documents.filter((d) => d.status === 'ready' && current(d))
  return {
    total: documents.length,
    ready: searchable.length,
    chunks: searchable.reduce((sum, d) => sum + d.chunk_count, 0),
    processing: documents.filter((d) => isProcessing(d.status)).length,
    failed: documents.filter((d) => d.status === 'failed').length,
    needsReindex: documents.filter((d) => d.status === 'ready' && !current(d)).length,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const steps: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
]

export function formatRelative(iso: string): string {
  let value = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return relativeFormat.format(Math.round(value), unit)
    value /= size
  }
  return ''
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Same rules as the backend: only location facts the parser recorded, never guessed. */
export function locationLabel(location: Location): string | null {
  if ('page' in location) return `Page ${location.page}`
  if ('section' in location) return `Section: ${location.section}`
  if ('row' in location) return `Row ${location.row}`
  if ('rows' in location) return `Rows ${location.rows}`
  if ('record' in location) return `Record ${location.record}`
  if ('records' in location) return `Records ${location.records}`
  return null
}

export function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}
