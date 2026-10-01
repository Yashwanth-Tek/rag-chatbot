import { Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

/** Native <dialog>: focus trapping, Escape and screen-reader semantics come for free. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      className="ring-gradient m-auto w-[min(26rem,calc(100%-2rem))] rounded-3xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-md open:animate-fade-up dark:bg-[#0c0e1a] dark:text-slate-100"
    >
      <div className="p-6">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/30">
          <Trash2 className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className="btn bg-linear-to-r from-rose-500 to-orange-500 text-white shadow-[0_10px_24px_-10px_rgb(244_63_94/0.9)] hover:brightness-110"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
