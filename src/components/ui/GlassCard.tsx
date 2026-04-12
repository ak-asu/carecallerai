import clsx from 'clsx'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  glow?: boolean
}

export function GlassCard({ children, className, glow }: GlassCardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-blue-500/10 backdrop-blur-xl',
        'bg-[rgba(8,25,60,0.55)] p-5',
        'transition-all duration-300',
        glow && 'shadow-[0_0_40px_rgba(59,130,246,0.12)] border-blue-500/20',
        className
      )}
    >
      {children}
    </div>
  )
}
