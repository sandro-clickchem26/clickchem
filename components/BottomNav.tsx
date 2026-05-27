'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { FlaskConical, Microscope, BookOpen, TrendingUp, Archive } from 'lucide-react'

const navItems = [
  { href: '/nova-formulacao', icon: FlaskConical, label: 'Formular' },
  { href: '/formulacoes', icon: Archive, label: 'Fórmulas' },
  { href: '/analisar', icon: Microscope, label: 'Analisar' },
  { href: '/banco-tecnico', icon: BookOpen, label: 'Banco' },
  { href: '/tendencias', icon: TrendingUp, label: 'Tendências' },
]

export function BottomNav() {
  const pathname = usePathname()
  const [teclado, setTeclado] = useState(false)

  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) {
        setTeclado(true)
      }
    }
    const onBlur = () => setTeclado(false)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onBlur)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onBlur)
    }
  }, [])

  // Esconde na nova-formulacao para evitar navegação acidental
  if (pathname === '/nova-formulacao') return null
  if (teclado) return null

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d1f3c] border-t border-[#1B3A6B]/60 flex items-center justify-around px-2 py-2">
      {navItems.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all',
              active ? 'text-blue-400' : 'text-gray-500'
            )}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
