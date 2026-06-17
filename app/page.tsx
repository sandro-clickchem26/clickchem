import Link from 'next/link'
import Image from 'next/image'
import { FlaskConical, Microscope, BookOpen, TrendingUp, FileText, ArrowRight, Archive } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function getStats() {
  try {
    const { prisma } = await import('@/lib/db')
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string })?.id

    const [totalMPs, totalFormulacoes] = await Promise.all([
      prisma.materiaPrima.count(),
      prisma.formulacao.count({
        where: userId ? { userId } : undefined,
      }),
    ])
    return { totalMPs, totalFormulacoes }
  } catch {
    return { totalMPs: 0, totalFormulacoes: 0 }
  }
}

export default async function Dashboard() {
  const stats = await getStats()

  const acoes = [
    {
      href: '/nova-formulacao',
      icon: FlaskConical,
      title: 'Nova Formulação',
      desc: 'Descreva a necessidade e gere uma formulação com análise crítica completa',
      color: 'border-blue-500/40 hover:border-blue-500/70',
      iconColor: 'text-blue-400 bg-blue-500/15',
    },
    {
      href: '/formulacoes',
      icon: Archive,
      title: 'Minhas Fórmulas',
      desc: `${stats.totalFormulacoes} formulação(ões) gerada(s) — visualize composição, pH e sustentabilidade`,
      color: 'border-blue-400/40 hover:border-blue-400/70',
      iconColor: 'text-blue-300 bg-blue-400/15',
    },
    {
      href: '/analisar',
      icon: Microscope,
      title: 'Analisar Fórmula',
      desc: 'Insira uma formulação existente e receba diagnóstico técnico completo',
      color: 'border-yellow-600/40 hover:border-yellow-500/70',
      iconColor: 'text-yellow-400 bg-yellow-500/15',
    },
    {
      href: '/banco-tecnico',
      icon: BookOpen,
      title: 'Matérias-Primas',
      desc: `${stats.totalMPs} matérias-primas com fichas completas, compatibilidades e custos`,
      color: 'border-green-500/40 hover:border-green-500/70',
      iconColor: 'text-green-400 bg-green-500/15',
    },
    {
      href: '/tendencias',
      icon: TrendingUp,
      title: 'Modo Tendências',
      desc: 'Radar de mercado, lacunas de portfólio e oportunidades de inovação',
      color: 'border-purple-500/40 hover:border-purple-500/70',
      iconColor: 'text-purple-400 bg-purple-500/15',
    },
    {
      href: '/relatorio',
      icon: FileText,
      title: 'Relatório Técnico',
      desc: 'Gere relatórios profissionais em PDF com composição, processo e análise',
      color: 'border-[#D4A017]/40 hover:border-[#D4A017]/70',
      iconColor: 'text-[#D4A017] bg-yellow-700/15',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Click Chem"
            width={56}
            height={56}
            className="rounded-full object-cover"
          />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Click Chem</h1>
            <p className="text-[#D4A017] text-sm font-medium">A química que conecta inovação e eficiência</p>
          </div>
        </div>
        <p className="text-gray-400 text-base max-w-2xl">
          Plataforma de P&D químico assistida por IA da Astana Química. Transforme necessidades industriais em propostas de formulação viáveis — com análise crítica, viabilidade técnica e embasamento regulatório.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111f3a] border border-white/8 rounded-xl p-4">
          <div className="text-2xl font-bold text-[#D4A017]">{stats.totalMPs}</div>
          <div className="text-sm text-gray-500 mt-1">Matérias-primas no banco</div>
        </div>
        <Link href="/formulacoes" className="bg-[#111f3a] border border-white/8 hover:border-blue-400/40 rounded-xl p-4 transition-colors group">
          <div className="text-2xl font-bold text-blue-400">{stats.totalFormulacoes}</div>
          <div className="text-sm text-gray-500 mt-1 group-hover:text-blue-400 transition-colors">Formulações geradas →</div>
        </Link>
        <div className="bg-[#111f3a] border border-white/8 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">5</div>
          <div className="text-sm text-gray-500 mt-1">Segmentos atendidos</div>
        </div>
      </div>

      {/* Ações rápidas */}
      <h2 className="text-lg font-semibold text-white mb-4">O que você quer fazer?</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {acoes.map(({ href, icon: Icon, title, desc, color, iconColor }) => (
          <Link
            key={href}
            href={href}
            className={`group bg-[#111f3a] border ${color} rounded-xl p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
            <ArrowRight size={16} className="text-gray-600 group-hover:text-gray-400 shrink-0 mt-1 transition-colors" />
          </Link>
        ))}
      </div>

    </div>
  )
}
