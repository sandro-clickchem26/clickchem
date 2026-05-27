'use client'
import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gold' | 'gray'
  className?: string
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  const variants = {
    green: 'bg-green-500/20 text-green-400 border border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    gold: 'bg-yellow-700/20 text-yellow-300 border border-yellow-600/30',
    gray: 'bg-white/10 text-gray-300 border border-white/10',
  }

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
