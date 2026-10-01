import { Sparkles } from 'lucide-react'

const SIZES = {
  sm: { orb: 'size-9', icon: 'size-4' },
  md: { orb: 'size-14', icon: 'size-6' },
  lg: { orb: 'size-28 sm:size-32', icon: 'size-10 sm:size-12' },
}

/** The assistant's identity: a slowly turning gradient sphere that spins up while working. */
export function Orb({ size = 'md', busy = false }: { size?: keyof typeof SIZES; busy?: boolean }) {
  const { orb, icon } = SIZES[size]
  return (
    <span
      className={`orb relative inline-flex shrink-0 items-center justify-center rounded-full ${orb} ${busy ? 'orb-busy' : ''}`}
      aria-hidden
    >
      <Sparkles className={`relative z-10 text-white drop-shadow ${icon}`} />
    </span>
  )
}
