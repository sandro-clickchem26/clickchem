'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ChatAssistente } from './ChatAssistente'
import { MobileHeader } from './MobileHeader'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Fecha o menu ao navegar para outra página
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <>
      {/* Header fixo no mobile com botão hambúrguer */}
      <MobileHeader
        menuOpen={mobileMenuOpen}
        onToggle={() => setMobileMenuOpen(v => !v)}
      />

      <div className="flex min-h-screen">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
        {/* pt-[4.5rem] compensa o header fixo de 3.5rem + padding de 1rem no mobile */}
        <main className="ml-0 md:ml-60 flex-1 min-h-screen px-4 pb-20 pt-[4.5rem] md:p-8 md:pb-8 bg-[#0A1628]">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
      <ChatAssistente />
    </>
  )
}
