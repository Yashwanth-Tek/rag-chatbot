import { ArrowRight, ArrowUp, Eraser, Library, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { AssistantMessage, UserMessage } from '../components/ChatMessage'
import { Orb } from '../components/Orb'
import type { useChat } from '../hooks'
import type { DocumentInfo } from '../types'

const MAX_QUESTION = 2000

interface Props {
  chat: ReturnType<typeof useChat>
  documents: DocumentInfo[]
  ready: boolean
}

export function Chat({ chat, documents, ready }: Props) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (chat.messages.length) log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [chat.messages])

  const submit = () => {
    const question = draft.trim()
    if (!question || chat.pending) return
    chat.ask(question)
    setDraft('')
  }

  // Starter questions name real, searchable documents only.
  const suggestions = documents
    .filter((d) => d.status === 'ready')
    .slice(0, 3)
    .map((d) => `What are the key points in “${d.filename.replace(/\.[^.]+$/, '')}”?`)

  return (
    <div className="flex h-[calc(100dvh-8.75rem)] flex-col lg:h-dvh">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-10 lg:pt-8">
        <div>
          <p className="eyebrow">Grounded chat</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Ask your documents</h1>
        </div>
        {chat.messages.length > 0 && (
          <button type="button" onClick={chat.clear} className="btn btn-secondary" disabled={chat.pending}>
            <Eraser className="size-4" aria-hidden /> <span className="hidden sm:inline">New chat</span>
          </button>
        )}
      </div>

      <div ref={log} role="log" aria-live="polite" aria-label="Conversation" className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-7 py-6">
          {chat.messages.length === 0 ? (
            <Welcome
              ready={ready}
              suggestions={suggestions}
              onPick={(question) => {
                setDraft(question)
                input.current?.focus()
              }}
            />
          ) : (
            chat.messages.map((message) =>
              message.role === 'user' ? (
                <UserMessage key={message.id} text={message.text} />
              ) : (
                <AssistantMessage key={message.id} reply={message} onRetry={() => chat.retry(message)} />
              ),
            )
          )}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="px-4 pt-2 pb-3 sm:px-6 lg:px-10 lg:pb-8"
      >
        <div className="mx-auto max-w-3xl">
          <div
            className={`glass ring-gradient flex items-end gap-2 rounded-3xl p-2 transition duration-300 ${
              focused ? 'ring-spin shadow-[0_0_0_4px_rgb(139_92_246/0.12),0_24px_60px_-24px_rgb(139_92_246/0.7)]' : ''
            }`}
          >
            <label htmlFor="question" className="sr-only">
              Ask a question about your documents
            </label>
            <textarea
              ref={input}
              id="question"
              rows={1}
              value={draft}
              maxLength={MAX_QUESTION}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  submit()
                }
              }}
              placeholder="Ask about your documents…"
              className="field-sizing-content max-h-40 min-h-12 flex-1 resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="btn btn-primary group size-12 shrink-0 rounded-2xl p-0"
              disabled={!draft.trim() || chat.pending}
              aria-label="Send question"
            >
              <ArrowUp className="size-5 transition duration-200 group-hover:-translate-y-0.5" aria-hidden />
            </button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden />
            Answers use only your documents and are verified before you see them
            {draft.length > MAX_QUESTION - 200 && <span className="font-mono">· {draft.length}/{MAX_QUESTION}</span>}
          </p>
        </div>
      </form>
    </div>
  )
}

const STEPS = [
  { icon: Search, title: 'Retrieve', text: 'Finds the passages closest to your question.' },
  { icon: Sparkles, title: 'Answer', text: 'Claude answers from them only, citing each one.' },
  { icon: ShieldCheck, title: 'Verify', text: 'Every sentence is checked against its source.' },
]

function Welcome({ ready, suggestions, onPick }: { ready: boolean; suggestions: string[]; onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center sm:py-8">
      <div className="relative animate-fade-up">
        <span className="absolute inset-0 scale-150 rounded-full bg-violet-500/25 blur-3xl" aria-hidden />
        <span className="absolute -inset-4 animate-[spin_30s_linear_infinite] rounded-full border border-dashed border-violet-400/40" aria-hidden />
        <Orb size="lg" />
      </div>
      <h2 className="mt-8 animate-fade-up text-3xl font-semibold sm:text-4xl" style={{ animationDelay: '80ms' }}>
        What would you like <span className="gradient-text">to know?</span>
      </h2>
      <p className="mt-3 max-w-md animate-fade-up text-sm text-slate-500 dark:text-slate-400" style={{ animationDelay: '140ms' }}>
        If the answer isn't in your documents, you'll be told so. Nothing is made up.
      </p>

      {ready && suggestions.length > 0 && (
        <div className="mt-8 flex w-full max-w-xl flex-col gap-2">
          {suggestions.map((question, index) => (
            <button
              key={question}
              type="button"
              onClick={() => onPick(question)}
              className="card group flex animate-fade-up items-center gap-3 px-4 py-3 text-left text-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-400/50"
              style={{ animationDelay: `${200 + index * 70}ms` }}
            >
              <Sparkles className="size-4 shrink-0 text-violet-500" aria-hidden />
              <span className="flex-1">{question}</span>
              <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-500" aria-hidden />
            </button>
          ))}
        </div>
      )}

      {!ready && (
        <div className="card ring-gradient mt-8 flex w-full max-w-xl animate-fade-up flex-col items-center gap-4 p-5 sm:flex-row sm:text-left">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg">
            <Library className="size-5" aria-hidden />
          </span>
          <p className="flex-1 text-sm">Your knowledge base has no searchable documents yet. Add some to start asking.</p>
          <Link to="/knowledge-base" className="btn btn-primary">
            Upload documents
          </Link>
        </div>
      )}

      <ol className="mt-10 grid w-full gap-3 text-left sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="card animate-fade-up p-4" style={{ animationDelay: `${420 + index * 80}ms` }}>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="font-mono text-[10px] text-slate-400">0{index + 1}</span>
            </div>
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
