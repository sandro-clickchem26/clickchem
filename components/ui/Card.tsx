'use client'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  gold?: boolean
}

export function Card({ children, className, gold }: CardProps) {
  return (
    <div className={cn(
      'rounded-xl border shadow-lg p-5',
      gold
        ? 'bg-[#1B3A6B] border-yellow-600/40 shadow-yellow-900/10'
        : 'bg-[#111f3a] border-white/8',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('font-semibold text-white text-base', className)}>{children}</h3>
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(className)}>{children}</div>
}
