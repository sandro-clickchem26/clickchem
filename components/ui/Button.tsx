'use client'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'gold' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-[#2563EB] hover:bg-[#1d4ed8] text-white border border-blue-500/50',
    secondary: 'bg-[#1B3A6B] hover:bg-[#1e437a] text-white border border-blue-800/50',
    gold: 'bg-[#D4A017] hover:bg-[#b88a14] text-[#0A1628] font-semibold border border-yellow-500/50',
    danger: 'bg-red-600/90 hover:bg-red-600 text-white border border-red-500/50',
    ghost: 'bg-transparent hover:bg-white/8 text-gray-300 border border-transparent',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2',
  }

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading && <Loader2 className="animate-spin" size={14} />}
      {children}
    </button>
  )
}
