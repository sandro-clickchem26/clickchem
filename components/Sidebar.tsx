'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  FlaskConical, Microscope, BookOpen, TrendingUp, FileText, Settings, Lock, LogOut, User, Archive
} from 'lucide-react'

const navItems = [
  { href: '/nova-formulacao', icon: FlaskConical, label: 'Nova Formulação' },
  { href: '/formulacoes', icon: Archive, label: 'Minhas Fórmulas' },
  { href: '/analisar', icon: Microscope, label: 'Analisar Fórmula' },
  { href: '/banco-tecnico', icon: BookOpen, label: 'Matérias-Primas' },
  { href: '/tendencias', icon: TrendingUp, label: 'Modo Tendências' },
  { href: '/relatorio', icon: FileText, label: 'Relatório Técnico' },
]

interface Props {
  mobileOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ mobileOpen = false, onClose }: Props) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <>
      {/* Overlay escuro ao abrir o menu mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed left-0 w-60 bg-[#0d1f3c] border-r border-[#1B3A6B]/60 flex flex-col z-40',
        'transition-transform duration-300 ease-in-out',
        // Mobile: começa abaixo do header fixo
        'top-14 h-[calc(100vh-3.5rem)]',
        // Desktop: full height desde o topo
        'md:top-0 md:h-full',
        // Slide in/out no mobile; sempre visível no desktop
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        {/* Logo — só no desktop (no mobile está no MobileHeader) */}
        <div className="hidden md:flex justify-center px-4 py-4 border-b border-[#1B3A6B]/60">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Click Chem"
              width={170}
              height={170}
              className="rounded-full object-cover"
              priority
            />
          </Link>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-[#2563EB]/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon size={16} className={active ? 'text-blue-400' : ''} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Rodapé */}
        <div className="px-3 pb-4 border-t border-[#1B3A6B]/60 pt-3 space-y-1">
          <Link
            href="/admin"
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              pathname === '/admin'
                ? 'bg-[#D4A017]/15 text-[#D4A017]'
                : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'
            )}
          >
            <Lock size={14} />
            P&D Proprietário
          </Link>
          <Link
            href="/configuracoes"
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              pathname === '/configuracoes'
                ? 'bg-[#2563EB]/20 text-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Settings size={16} />
            Configurações
          </Link>

          {/* Usuário logado */}
          {session?.user && (
            <div className="mt-2 pt-2 border-t border-[#1B3A6B]/40">
              <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                  <User size={12} className="text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-300 truncate">{session.user.name}</p>
                  <p className="text-[10px] text-gray-600 truncate">{session.user.email}</p>
                </div>
              </div>
              <button
                onClick={() => { onClose?.(); signOut({ callbackUrl: '/login' }) }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/8 transition-all duration-150"
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          )}

          <div className="px-3 pt-1 text-[10px] text-gray-700 leading-tight">
            Click Chem v1.0 MVP<br />
            © 2026 Astana Química
          </div>
        </div>
      </aside>
    </>
  )
}
