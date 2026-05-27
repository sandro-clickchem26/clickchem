'use client'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        id={id}
        {...props}
        className={cn(
          'w-full rounded-lg px-3 py-2 text-sm',
          'bg-[#0A1628] border border-[#1B3A6B] text-white',
          'placeholder:text-gray-500',
          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50',
          'transition-colors',
          error && 'border-red-500',
          className
        )}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <textarea
        id={id}
        {...props}
        className={cn(
          'w-full rounded-lg px-3 py-2 text-sm resize-y',
          'bg-[#0A1628] border border-[#1B3A6B] text-white',
          'placeholder:text-gray-500',
          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50',
          'transition-colors',
          error && 'border-red-500',
          className
        )}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, className, id, options, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <select
        id={id}
        {...props}
        className={cn(
          'w-full rounded-lg px-3 py-2 text-sm',
          'bg-[#0A1628] border border-[#1B3A6B] text-white',
          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50',
          'transition-colors',
          error && 'border-red-500',
          className
        )}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
