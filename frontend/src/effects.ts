import type { PointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

/** Animates a number from its previous value to `target` (instantly with reduced motion). */
export function useCountUp(target: number | undefined, duration = 800): number {
  const [value, setValue] = useState(0)
  const shown = useRef(0)

  useEffect(() => {
    if (target === undefined) return
    const from = shown.current
    const start = performance.now()
    const instant = matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = requestAnimationFrame(function tick(now) {
      const progress = instant ? 1 : Math.min(1, (now - start) / duration)
      const next = Math.round(from + (target - from) * (1 - (1 - progress) ** 3))
      shown.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

/** Feeds the pointer position to the `spotlight` utility's CSS variables. */
export function followPointer(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--x', `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty('--y', `${event.clientY - rect.top}px`)
}
