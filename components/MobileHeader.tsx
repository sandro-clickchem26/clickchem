'use client'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

interface Props {
  menuOpen: boolean
  onToggle: () => void
}

export function MobileHeader({ menuOpen, onToggle }: Props) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0d1f3c] border-b border-[#1B3A6B]/60 flex items-center justify-between px-4 h-14">
      <Link href="/" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Click Chem"
          width={36}
          height={36}
          className="rounded-full object-cover"
        />
        <span className="text-base font-bold text-white">Click Chem</span>
      </Link>

      <button
        onClick={onToggle}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
        aria-label="Menu"
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
    </header>
  )
}
