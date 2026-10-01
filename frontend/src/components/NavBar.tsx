import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Library, MessageSquareText, Moon, Sparkles, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'

import { type DocumentCounts, plural } from '../format'
import type { SystemStatus } from '../types'

interface Props {
  status: SystemStatus | null
  counts: DocumentCounts | null
  chatBusy: boolean
}

const LINKS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: Library },
  { to: '/chat', label: 'Chat', icon: MessageSquareText },
]

export function NavBar({ status, counts, chatBusy }: Props) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggleTheme = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
    setDark(next)
  }

  const services = status ? Object.values(status.services) : null
  const online = services?.filter((s) => s.ok).length ?? 0
  const health = !services ? 'unknown' : online === services.length ? 'ok' : 'attention'
  const badge = (to: string) =>
    to === '/knowledge-base' && counts ? String(counts.total) : to === '/chat' && chatBusy ? 'live' : null

  return (
    <>
      {/* Desktop: a floating glass rail */}
      <aside className="glass ring-gradient fixed inset-y-3 left-3 z-30 hidden w-64 flex-col rounded-3xl lg:flex">
        <Brand />

        <nav aria-label="Main" className="mt-6 flex flex-col gap-1.5 px-3">
          <p className="eyebrow px-3 pb-1">Workspace</p>
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
                  isActive
                    ? 'bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_10px_28px_-10px_rgb(139_92_246/0.9)]'
                    : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-4.5 transition duration-200 group-hover:scale-110" aria-hidden />
                  {label}
                  {badge(to) && (
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : badge(to) === 'live'
                            ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300'
                            : 'bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                      }`}
                    >
                      {badge(to)}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {counts && (
          <div className="mx-3 mt-6 rounded-2xl bg-linear-to-br from-indigo-500/10 via-fuchsia-500/10 to-cyan-500/10 p-4">
            <p className="eyebrow">Knowledge</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
              {counts.chunks.toLocaleString()}
              <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">passages</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-linear-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 transition-[width] duration-700"
                style={{ width: `${counts.total ? (counts.ready / counts.total) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {counts.ready} of {plural(counts.total, 'document')} searchable
            </p>
          </div>
        )}

        <div className="mt-auto space-y-3 p-4">
          <Link
            to="/"
            className="focus-ring flex items-center gap-3 rounded-xl px-2 py-1.5 text-xs text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <HealthDot health={health} />
            <span className="flex-1">
              {health === 'unknown' ? 'Checking services…' : health === 'ok' ? 'All systems ready' : 'Needs attention'}
            </span>
            {services && <span className="font-mono text-[10px] text-slate-400">{online}/{services.length}</span>}
          </Link>
          <ThemeSwitch dark={dark} onToggle={toggleTheme} />
        </div>
      </aside>

      {/* Phones and tablets: a glass top bar and a floating tab dock */}
      <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-x-0 border-t-0 px-4 lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-3">
          <Link to="/" className="focus-ring rounded-full p-1" aria-label="System status">
            <HealthDot health={health} />
          </Link>
          <ThemeSwitch dark={dark} onToggle={toggleTheme} compact />
        </div>
      </header>
      <nav
        aria-label="Main"
        className="glass ring-gradient fixed inset-x-3 bottom-3 z-30 grid h-16 grid-cols-3 rounded-2xl p-1.5 lg:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `focus-ring flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition duration-200 ${
                isActive
                  ? 'bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_8px_20px_-8px_rgb(139_92_246/0.9)]'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`focus-ring group flex items-center gap-3 rounded-2xl ${compact ? '' : 'px-5 pt-6'}`}>
      <span className="relative flex size-10 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 via-fuchsia-500 to-cyan-400 bg-size-[200%_200%] text-white shadow-[0_10px_30px_-8px_rgb(139_92_246/0.8)] animate-gradient-pan">
        <Sparkles className="size-5 transition duration-500 group-hover:rotate-12" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-semibold">RAG Chatbot</span>
        {!compact && (
          <span className="block text-xs text-slate-500 dark:text-slate-400">Grounded answers</span>
        )}
      </span>
    </Link>
  )
}

function HealthDot({ health }: { health: 'ok' | 'attention' | 'unknown' }) {
  const color = health === 'ok' ? 'bg-emerald-500' : health === 'attention' ? 'bg-amber-500' : 'bg-slate-400'
  const label = health === 'ok' ? 'All systems ready' : health === 'attention' ? 'Needs attention' : 'Checking'
  return (
    <span className="relative flex size-2.5" title={label}>
      {health !== 'unknown' && (
        <span className={`absolute inset-0 animate-ping-slow rounded-full opacity-70 ${color}`} aria-hidden />
      )}
      <span className={`relative size-2.5 rounded-full ${color}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function ThemeSwitch({ dark, onToggle, compact = false }: { dark: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      onClick={onToggle}
      className={`focus-ring relative flex items-center rounded-full bg-slate-900/[0.06] p-1 transition dark:bg-white/[0.08] ${
        compact ? 'h-8 w-14' : 'h-9 w-full'
      }`}
    >
      <span
        className={`absolute top-1 bottom-1 flex items-center justify-center rounded-full bg-white shadow-md transition-all duration-300 ease-out dark:bg-slate-800 ${
          compact ? 'w-6' : 'w-[calc(50%-4px)]'
        } ${dark ? (compact ? 'left-7' : 'left-1/2') : 'left-1'}`}
        aria-hidden
      >
        {dark ? <Moon className="size-3.5 text-violet-300" /> : <Sun className="size-3.5 text-amber-500" />}
      </span>
      {!compact && (
        <span className="relative grid w-full grid-cols-2 text-xs font-medium" aria-hidden>
          <span className={dark ? 'text-slate-500' : 'opacity-0'}>Light</span>
          <span className={dark ? 'opacity-0' : 'text-slate-500'}>Dark</span>
        </span>
      )}
    </button>
  )
}
